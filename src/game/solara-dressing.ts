/** Solara Desert dressing (pure layout, no three.js): layered sandstone mesas and hoodoos, a palm oasis, the bleached
 * ribcage of something enormous, half-buried pillars by the Sunken Arcology, and dust devils that wander the dunes.
 * SolaraDesert.tsx draws it. Everything keeps off supply roads, out of the drifting quicksand basin (its whole orbit),
 * away from the Solar Array mission site and off any water. Presentation only: no collision, hazards or rewards. */
import { REGIONS, WORLD_SCALE } from "./world";
import { heightAt, riverAt, slopeAt, solaraValley, WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { mulberry32 } from "./rng";
import { LANDMARKS } from "./landmarks";
import { HAZARD_ZONES, QUICKSAND_DRIFT_RADIUS } from "./hazard-zones";
import { arraySite } from "./missions/solar-array";
import { isWet } from "./wildlife-habitat";

export type Prop = { x: number; z: number; s: number; r: number; tilt: number };
export type Palm = { x: number; z: number; h: number; lean: number; r: number };
export type Devil = { cx: number; cz: number; orbit: number; speed: number; phase: number; h: number };

export const solara = () => REGIONS.find((r) => r.id === "solara")!;
const S = Math.max(1, WORLD_SCALE / 2);
const lm = (id: string) => LANDMARKS.find((l) => l.id === id)!;

/** keep-out circles: the quicksand basin's full drift orbit, the Solar Array site, Glass Flats (open by design) */
function keepOut(): { x: number; z: number; r: number }[] {
  const q = HAZARD_ZONES.find((z) => z.kind === "quicksand")!, ql = lm(q.landmarkId);
  const site = arraySite(solara());
  const flats = lm("glass-flats");
  return [
    { x: ql.x, z: ql.z, r: q.radius + QUICKSAND_DRIFT_RADIUS + 6 },
    { x: site.x, z: site.z, r: 40 * S },
    { x: flats.x, z: flats.z, r: 22 * S },
  ];
}

export function placeable(x: number, z: number, clear = 3): boolean {
  const r = solara();
  if (Math.hypot(x - r.x, z - r.z) > r.radius * 0.95) return false;
  if (heightAt(x, z) < WATER_LEVEL + 0.6 || isWet(x, z)) return false;
  if (distanceToRoad(x, z) < LANE_HALF_WIDTH + clear) return false;
  return keepOut().every((k) => Math.hypot(x - k.x, z - k.z) > k.r + clear);
}

function scatter(count: number, seed: number, opts: { inner: number; outer: number; maxSlope: number; gap: number; clear?: number; around?: { x: number; z: number } }): Prop[] {
  const r = solara(), c = opts.around ?? r, rnd = mulberry32(seed), out: Prop[] = [];
  for (let guard = count * 30; out.length < count && guard-- > 0;) {
    const a = rnd() * Math.PI * 2, d = opts.inner + Math.sqrt(rnd()) * (opts.outer - opts.inner);
    const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
    if (!placeable(x, z, opts.clear ?? 3) || slopeAt(x, z) > opts.maxSlope) continue;
    if (solaraValley(x, z) > 0.2) continue; // the river valley stays green and open: rock formations stand in the desert
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < opts.gap)) continue;
    out.push({ x, z, s: 0.7 + rnd() * 0.8, r: rnd() * Math.PI * 2, tilt: (rnd() - 0.5) * 0.12 });
  }
  return out;
}

/** big flat-topped sandstone mesas on the region's outer ring (they frame the dunes without blocking the middle) */
export const mesas = () => scatter(9, 0x3e5a, { inner: solara().radius * 0.55, outer: solara().radius * 0.93, maxSlope: 0.5, gap: 45 * S, clear: 14 });
/** slender hoodoo spires, scattered */
export const hoodoos = () => scatter(30, 0x40d0, { inner: solara().radius * 0.2, outer: solara().radius * 0.9, maxSlope: 0.6, gap: 10, clear: 4 });

/** The oasis: the flattest open spot in a fixed search, a shallow pool, a ring of palms and green scrub. */
export function oasis(): { x: number; z: number; pool: number; palms: Palm[] } | null {
  const r = solara(), rnd = mulberry32(0x0a51);
  let best: { x: number; z: number; score: number } | null = null;
  for (let i = 0; i < 400; i++) {
    const a = rnd() * Math.PI * 2, d = r.radius * (0.25 + rnd() * 0.5);
    const x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
    if (!placeable(x, z, 18)) continue;
    // flat over the whole pool footprint
    let worst = 0;
    for (let k = 0; k < 8; k++) worst = Math.max(worst, slopeAt(x + Math.cos(k) * 10, z + Math.sin(k) * 10));
    const score = worst + Math.abs(slopeAt(x, z));
    if (!best || score < best.score) best = { x, z, score };
  }
  if (!best) return null;
  const pool = 9 * Math.max(1, S * 0.7);
  const palms: Palm[] = Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * Math.PI * 2 + rnd() * 0.4, d = pool + 2.5 + rnd() * 8;
    return { x: best!.x + Math.cos(a) * d, z: best!.z + Math.sin(a) * d, h: 7 + rnd() * 6, lean: 0.12 + rnd() * 0.25, r: a + Math.PI + (rnd() - 0.5) * 0.6 };
  });
  return { x: best.x, z: best.z, pool, palms };
}

/** the bleached ribcage of a colossal creature half-sunk in a dune (a navigation landmark you can walk through) */
export function ribcage(): { x: number; z: number; yaw: number; length: number } | null {
  const [m] = scatter(1, 0xb0e5, { inner: solara().radius * 0.3, outer: solara().radius * 0.75, maxSlope: 0.35, gap: 1, clear: 20 });
  return m ? { x: m.x, z: m.z, yaw: m.r, length: 34 * S } : null;
}

/** toppled and half-buried pillars from the Sunken Arcology's old colonnade */
export const pillars = () => {
  const a = lm("sunken-arcology");
  return scatter(16, 0x9111, { inner: 8, outer: 40 * S, maxSlope: 0.6, gap: 5, clear: 3, around: a });
};

/** dust devils: each orbits a dune-field point slowly; the renderer spins the column */
export function dustDevils(): Devil[] {
  const rnd = mulberry32(0xd57d);
  return scatter(5, 0xde71, { inner: solara().radius * 0.15, outer: solara().radius * 0.8, maxSlope: 0.8, gap: 50, clear: 6 }).map((p) => ({
    cx: p.x, cz: p.z, orbit: 15 + rnd() * 25, speed: 0.02 + rnd() * 0.03, phase: rnd() * Math.PI * 2, h: 14 + rnd() * 14,
  }));
}
export const devilAt = (d: Devil, t: number) => ({ x: d.cx + Math.cos(d.phase + t * d.speed) * d.orbit, z: d.cz + Math.sin(d.phase + t * d.speed * 1.3) * d.orbit * 0.7 });

/** trees along Solara's green river valley (terrain.ts solaraValley): broadleaf and birch clumps on the banks, never in the
 * water, on a road or in a keep-out; the rest of the region stays open desert */
export function valleyTrees(): Prop[] {
  const r = solara(), rnd = mulberry32(0x5a11e7), out: Prop[] = [];
  for (let guard = 0; guard < 9000 && out.length < 120; guard++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r.radius * 0.95;
    const x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
    if (solaraValley(x, z) < 0.55 + rnd() * 0.3) continue;
    const rv = riverAt(x, z);
    if (rv && rv.dist < rv.w + 3) continue;
    if (!placeable(x, z, 2) || slopeAt(x, z) > 0.5 || heightAt(x, z) < WATER_LEVEL + 0.8) continue;
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 8)) continue;
    out.push({ x, z, s: 0.75 + rnd() * 0.5, r: rnd() * Math.PI * 2, tilt: 0 });
  }
  return out;
}
