/* Verdant Forest relief: extra ground shape layered on the base heightmap, as one pure function.
 * terrain.ts adds `forestRelief` inside rawHeightAt, so the rendered mesh, the player, enemies, props and
 * vehicles all see the same ground (no shader-only displacement). Three layers:
 *  - rolling hills and shallow hollows (wavelengths >= 8 m, so the 2.5 m terrain mesh can draw them), faded to
 *    nothing around the spawn clearing, trail, ambush clearing and crash pad so the authored route stays level;
 *  - the impact pit the hull's nose dug, with an irregular rim and a heaped berm;
 *  - nothing outside the forest region (it fades out before the rim, so neighbours do not change).
 * Imports only world.ts + verdant.ts (no terrain.ts), so there is no cycle. */
import { REGIONS, WORLD_SCALE } from "./world";
import { CRASH_SITE, ENCOUNTER, FOREST_SPAWN, FURROW, SPAWN_CLEARING_RADIUS, TRAIL, TRAIL_HALF_WIDTH, patchNoise, trailInfo } from "./verdant";

const forest = REGIONS.find((r) => r.id === "veridan")!;
/** hill wavelengths grow with the forest (sqrt, so a 4x forest gets 2x longer hills and 1.6x taller ones); 1 at WORLD_SCALE 1 */
const HILL_K = 1 / Math.sqrt(WORLD_SCALE);
const HILL_AMP = Math.sqrt(WORLD_SCALE) * 0.8 + 0.2;

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The hull's nose end: 2.5 m back along the skid and 3.5 m to the side away from the trail approach, so the trail never runs through the pit. */
export const IMPACT_PIT = (() => {
  const px = -FURROW.dz, pz = FURROW.dx; // perpendicular to the skid
  return { x: CRASH_SITE.x - FURROW.dx * 2.5 - px * 3.5, z: CRASH_SITE.z - FURROW.dz * 2.5 - pz * 3.5, radius: 6.5, depth: 2.1, berm: 0.75 };
})();

/** Direction the hull lies in: from the buried nose out along the skid. */
export const HULL_AXIS = { x: FURROW.dx, z: FURROW.dz } as const;

// bounding box of the trail, so trailInfo (a segment scan) only runs where the trail can matter
const PAD = TRAIL_HALF_WIDTH + 9;
const BOX = TRAIL.reduce((b, p) => ({ x0: Math.min(b.x0, p.x - PAD), x1: Math.max(b.x1, p.x + PAD), z0: Math.min(b.z0, p.z - PAD), z1: Math.max(b.z1, p.z + PAD) }), { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });

/** 0 on the authored ground (trail, clearings, crash pad) easing to 1 in open woods */
export function openWoods(x: number, z: number): number {
  let m = smooth(SPAWN_CLEARING_RADIUS, SPAWN_CLEARING_RADIUS + 10, Math.hypot(x - FOREST_SPAWN.x, z - FOREST_SPAWN.z));
  m = Math.min(m, smooth(ENCOUNTER.radius, ENCOUNTER.radius + 9, Math.hypot(x - ENCOUNTER.x, z - ENCOUNTER.z)));
  m = Math.min(m, smooth(CRASH_SITE.radius, CRASH_SITE.radius + 10, Math.hypot(x - CRASH_SITE.x, z - CRASH_SITE.z)));
  if (m > 0 && x > BOX.x0 && x < BOX.x1 && z > BOX.z0 && z < BOX.z1) m = Math.min(m, smooth(TRAIL_HALF_WIDTH + 0.5, TRAIL_HALF_WIDTH + 8, trailInfo(x, z).dist));
  return m;
}

/** the impact pit: a bowl with an uneven rim and a berm of displaced soil, kept off the trail */
export function pitRelief(x: number, z: number): number {
  const dx = x - IMPACT_PIT.x, dz = z - IMPACT_PIT.z;
  const d = Math.hypot(dx, dz);
  const reach = IMPACT_PIT.radius * 2.1;
  if (d > reach) return 0;
  const a = Math.atan2(dz, dx);
  const R = IMPACT_PIT.radius * (1 + 0.16 * Math.sin(a * 3 + 1.1) + 0.09 * Math.sin(a * 5 + 0.4));
  const bowl = -IMPACT_PIT.depth * (1 - smooth(0.1 * R, R, d));
  const bermW = R * 0.45;
  const berm = IMPACT_PIT.berm * Math.exp(-(((d - R * 1.12) / bermW) ** 2)) * (0.7 + 0.5 * Math.sin(a * 4 + 2.0));
  const offTrail = smooth(TRAIL_HALF_WIDTH - 0.5, TRAIL_HALF_WIDTH + 3.5, trailInfo(x, z).dist);
  return (bowl + Math.max(0, berm)) * offTrail;
}

/** total extra height at (x, z): zero outside the forest region */
export function forestRelief(x: number, z: number): number {
  const d = Math.hypot(x - forest.x, z - forest.z);
  // the impact pit lies near the region's rim, so it must not be cut off by the region test
  if (d >= forest.radius) return pitRelief(x, z);
  const edge = 1 - smooth(forest.radius * 0.72, forest.radius * 0.97, d);
  let h = 0;
  if (edge > 0) {
    const open = openWoods(x, z);
    if (open > 0) {
      const hills = (patchNoise(x, z, 0.024 * HILL_K) - 0.5) * 5.6 + (patchNoise(x + 310, z - 120, 0.065 * HILL_K) - 0.5) * 2 + (patchNoise(x - 57, z + 83, 0.12) - 0.5) * 0.6;
      h += hills * HILL_AMP * open * edge;
    }
  }
  return h + pitRelief(x, z);
}
