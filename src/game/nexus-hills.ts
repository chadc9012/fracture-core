/** Trees on the hills round Nexus City (owner's overlook frame, docs/reference/target-overlook-day.png: wooded hills between the
 * city and the shore). Trees only grew inside the Verdant Forest region, so the Nexus island read as bare lawn from every hill.
 * This plants groves on the island's open ground outside the city: clustered stands with gaps between, thinning toward the
 * beaches, never on a road, river, beach, the city, the suburb, homes, the airport field, the bridge abutments or the lookout.
 * Pure and seeded; Terrain.tsx adds them to the forest it already draws (same models, culling, obstacles and felling). */
import { growGroves, type Tree } from "./forest-density";
import { mulberry32 } from "./rng";
import { REGIONS, NEXUS_SUBURB } from "./world";

export type HillRules = {
  height: (x: number, z: number) => number;
  slope: (x: number, z: number) => number;
  /** false for roads, rivers, homes, set pieces: everything the caller knows must stay clear */
  clear: (x: number, z: number) => boolean;
  /** true on the Nexus island (same landmass as the hub) */
  onIsland: (x: number, z: number) => boolean;
  water: number;
};

const NEXUS = REGIONS.find((r) => r.id === "nexus")!;
export const HILLS = { inner: 135, outer: 520, minAbove: 3.2, maxSlope: 0.6, centres: 70, perGrove: 20, scatter: 260 } as const;

/** may a tree stand at (x,z) */
export function hillPlantable(x: number, z: number, rules: HillRules): boolean {
  const d = Math.hypot(x - NEXUS.x, z - NEXUS.z);
  if (d < HILLS.inner || d > HILLS.outer) return false;
  if (Math.hypot(x - NEXUS_SUBURB.x, z - NEXUS_SUBURB.z) < NEXUS_SUBURB.r + NEXUS_SUBURB.fade + 10) return false;
  if (rules.height(x, z) < rules.water + HILLS.minAbove) return false; // beaches and the shore stay open
  if (rules.slope(x, z) > HILLS.maxSlope) return false;
  return rules.onIsland(x, z) && rules.clear(x, z);
}

/** the groves plus a light scatter between them; `density` is the tier's foliage density (0..1) */
export function nexusHillTrees(rules: HillRules, density: number, seed = 0x41e7): Tree[] {
  const rnd = mulberry32(seed);
  const pick = (n: number) => {
    const out: { x: number; z: number }[] = [];
    for (let guard = 0; out.length < n && guard < n * 40; guard++) {
      const a = rnd() * Math.PI * 2, d = HILLS.inner + Math.sqrt(rnd()) * (HILLS.outer - HILLS.inner);
      const x = NEXUS.x + Math.cos(a) * d, z = NEXUS.z + Math.sin(a) * d;
      if (hillPlantable(x, z, rules)) out.push({ x, z });
    }
    return out;
  };
  const centres = pick(Math.max(4, Math.round(HILLS.centres * density)));
  const loose: Tree[] = pick(Math.round(HILLS.scatter * density)).map((p) => ({ ...p, s: 0.8 + rnd() * 0.5, r: rnd() * Math.PI * 2 }));
  const groves = growGroves(centres, loose, rnd, (x, z) => hillPlantable(x, z, rules), Math.round(HILLS.perGrove * Math.max(0.5, density)));
  return [...loose, ...groves];
}
