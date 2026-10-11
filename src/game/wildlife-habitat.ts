/** Real-terrain habitat and population for the wildlife (wildlife.ts holds the rules; this file places
 * the animals in the actual world). Pure: reads terrain/rivers/regions, no React or three.js, so tests
 * can prove that nothing spawns in water, on the first-mission trail, or outside its region. */
import { REGIONS, WORLD_SCALE } from "./world";
import { heightAt, riverAt, waterNetwork, WATER_LEVEL } from "./terrain";
import { isReserved } from "./verdant";
import { placeHomes, seededRnd, spawnCritter, SPECIES_PROFILE, type Critter, type Habitat, type Species } from "./wildlife";

/** Water a land animal must not enter: sea, lakes, and river channels (wet or dry wash beds). */
export function isWet(x: number, z: number): boolean {
  if (heightAt(x, z) < WATER_LEVEL + 0.15) return true;
  const net = waterNetwork();
  for (const l of net.lakes) if (Math.hypot(x - l.x, z - l.z) < l.r + 0.8) return true;
  const rv = riverAt(x, z);
  return Boolean(rv && rv.dist < rv.w + 0.6);
}

export const HABITAT: Habitat = { isWet };

const region = (id: string) => REGIONS.find((r) => r.id === id)!;
/** Ground good enough to be a herd's home: dry, not too close to a bank, and off the mission route. */
const goodGround = (x: number, z: number) => !isWet(x, z) && !isWet(x + 4, z) && !isWet(x - 4, z) && !isWet(x, z + 4) && !isWet(x, z - 4) && !isReserved(x, z, 6);

type Plan = { species: Species; region: string; groups: number; members: [number, number]; seed: number };

/** Population per region. Counts scale with the world size (a WORLD_SCALE 4 forest is ~16x the area). */
const k = Math.max(1, Math.round(WORLD_SCALE / 2));
export const POPULATION: Plan[] = [
  { species: "DEER", region: "veridan", groups: 2 * k, members: [3, 5], seed: 301 },
  { species: "FOX", region: "veridan", groups: 2 * k, members: [1, 1], seed: 302 },
  { species: "RABBIT", region: "veridan", groups: 3 * k, members: [2, 3], seed: 303 },
  { species: "SONGBIRD", region: "veridan", groups: 2 * k, members: [4, 7], seed: 304 },
  { species: "DEER", region: "frostspire", groups: k, members: [2, 4], seed: 305 },
  { species: "SONGBIRD", region: "swamps", groups: k, members: [3, 5], seed: 306 },
  { species: "SNAKE", region: "swamps", groups: 2 * k, members: [1, 1], seed: 307 },
  { species: "SNAKE", region: "solara", groups: 2 * k, members: [1, 1], seed: 308 },
  { species: "SNAKE", region: "wastelands", groups: 2 * k, members: [1, 1], seed: 309 },
  { species: "VULTURE", region: "solara", groups: 1, members: [2, 3], seed: 310 },
  { species: "VULTURE", region: "wastelands", groups: 1, members: [2, 3], seed: 311 },
  { species: "DOG", region: "nexus", groups: 3, members: [1, 1], seed: 312 },
  { species: "CAT", region: "nexus", groups: 3, members: [1, 1], seed: 313 },
  { species: "SONGBIRD", region: "nexus", groups: 2, members: [3, 5], seed: 314 },
];

/** Every animal in the world, deterministic for a given terrain. */
export function buildPopulation(): Critter[] {
  const list: Critter[] = [];
  let n = 0;
  for (const plan of POPULATION) {
    const r = region(plan.region);
    const soaring = SPECIES_PROFILE[plan.species].locomotion === "soar";
    // city animals stay near the plaza; soaring birds circle the whole region
    const homes = soaring ? [{ x: r.x, z: r.z }] : placeHomes(r, plan.groups, plan.seed, goodGround, plan.region === "nexus" ? 0.5 : 0.8);
    const rnd = seededRnd(plan.seed * 31);
    homes.forEach((h, gi) => {
      const group = `${plan.species}-${plan.region}-${gi}`;
      const members = plan.members[0] + Math.floor(rnd() * (plan.members[1] - plan.members[0] + 1));
      for (let m = 0; m < members; m++) {
        let x = h.x, z = h.z;
        for (let t = 0; t < 6; t++) {
          const cx = h.x + (rnd() - 0.5) * 6, cz = h.z + (rnd() - 0.5) * 6;
          if (soaring || !isWet(cx, cz)) { x = cx; z = cz; break; }
        }
        const c = spawnCritter(`${plan.species}-${n}`, plan.species, h.x, h.z, n, group);
        c.x = x; c.z = z;
        if (soaring) { c.homeRadius = r.radius * 0.45; c.x = h.x + c.homeRadius * Math.cos(m * 2.1); c.z = h.z + c.homeRadius * Math.sin(m * 2.1); }
        list.push(c);
        n++;
      }
    });
  }
  // fish schools: one per lake that is big and deep enough, inside the lake circle
  waterNetwork().lakes.forEach((l, i) => {
    if (l.r < 6) return;
    const rnd = seededRnd(900 + i);
    const count = 5 + Math.floor(rnd() * 5);
    for (let m = 0; m < count; m++) {
      const c = spawnCritter(`FISH-${n}`, "FISH", l.x, l.z, n, `FISH-lake-${i}`);
      c.homeRadius = l.r * 0.65;
      const a = rnd() * Math.PI * 2, d = rnd() * c.homeRadius * 0.6;
      c.x = l.x + Math.cos(a) * d; c.z = l.z + Math.sin(a) * d;
      list.push(c);
      n++;
    }
  });
  return list;
}

/** Height of the water surface over (x,z) if it is inside a lake, else null (fish swim relative to it). */
export function lakeSurfaceAt(x: number, z: number): number | null {
  for (const l of waterNetwork().lakes) if (Math.hypot(x - l.x, z - l.z) < l.r) return l.level;
  return null;
}
