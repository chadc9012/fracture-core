/**
 * Line of sight (pure). Enemies used to see the player through hills, buildings and cover, and every ranged shot was a
 * dice roll that landed whatever stood in between — so cover did nothing. `sightLine` walks the segment from an
 * enemy's eye (or muzzle) to the player's chest and reports the first thing in the way:
 *  - the ground (a ridge or crest higher than the line),
 *  - an obstacle from obstacles.ts — those are footprint circles with no height, so each kind gets one here
 *    (buildings and trees block outright, rocks by their size, wrecks waist-to-chest high, cacti a little),
 *  - a solid box (environment-collision.ts model solids: walls, crates, cover).
 * Hearing is separate (enemy-perception.ts): firing a gun behind a wall still gives you away.
 */
import type { Obstacle, ObstacleKind } from "./obstacles";
import type { SolidBox } from "./environment-collision";

export type Point3 = { x: number; y: number; z: number };
export type SightBlock = { blocked: false } | { blocked: true; by: "ground" | "obstacle" | "solid"; at: Point3; t: number };
export type SightWorld = {
  ground: (x: number, z: number) => number;
  /** obstacles near a point (obstacles.ts queryObstacles: the 3x3 grid-cell neighbourhood, 24 m cells) */
  obstaclesNear?: (x: number, z: number) => readonly Obstacle[];
  solids?: readonly SolidBox[];
};

/** how tall each obstacle kind stands above the ground at its centre (m) */
export function obstacleHeight(o: Pick<Obstacle, "kind" | "r">): number {
  const H: Record<ObstacleKind, (r: number) => number> = {
    tower: () => 60,
    tree: () => 14,
    rock: (r) => Math.max(1.1, r * 1.5),
    wreck: () => 1.9,
    cactus: () => 3.5,
  };
  return H[o.kind](o.r);
}

/** sample spacing along the line for the ground test (m): fine enough to catch a crest a few metres wide */
const GROUND_STEP = 2;
/** a crest must rise this far above the line to block it (grass, small rolls) */
const GROUND_CLEAR = 0.15;
/** obstacle candidates are gathered every this many metres (the grid query covers ±36 m around each point) */
const QUERY_STEP = 30;

export function sightLine(a: Point3, b: Point3, world: SightWorld): SightBlock {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  let best: SightBlock = { blocked: false };
  const take = (t: number, by: "ground" | "obstacle" | "solid") => {
    if (t < 0 || t > 1) return;
    if (best.blocked && best.t <= t) return;
    best = { blocked: true, by, t, at: { x: a.x + dx * t, y: a.y + dy * t, z: a.z + dz * t } };
  };
  // ground: sample the terrain under the line (skip the first and last metre: the eye and the target stand on it)
  if (len > 2) {
    const n = Math.ceil(len / GROUND_STEP);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (t * len < 1 || (1 - t) * len < 1) continue;
      const x = a.x + dx * t, z = a.z + dz * t, y = a.y + dy * t;
      if (world.ground(x, z) > y + GROUND_CLEAR) { take(t, "ground"); break; }
    }
  }
  // obstacles: exact segment vs footprint circle in the plane, then the line's height there vs the obstacle's height
  if (world.obstaclesNear && len > 0) {
    const seen = new Set<number>();
    const n = Math.max(1, Math.ceil(len / QUERY_STEP));
    for (let i = 0; i <= n; i++) {
      const t0 = i / n;
      for (const o of world.obstaclesNear(a.x + dx * t0, a.z + dz * t0)) {
        if (seen.has(o.id) || o.broken) continue;
        seen.add(o.id);
        const t = segmentCircle(a.x, a.z, dx, dz, o.x, o.z, o.r);
        if (t === null) continue;
        const y = a.y + dy * t;
        if (y < world.ground(o.x, o.z) + obstacleHeight(o)) take(t, "obstacle");
      }
    }
  }
  // solid boxes: slab test in 3D
  if (world.solids) for (const s of world.solids) {
    const t = segmentBox(a, dx, dy, dz, s);
    if (t !== null) take(t, "solid");
  }
  return best;
}
export const canSee = (a: Point3, b: Point3, world: SightWorld) => !sightLine(a, b, world).blocked;

/** first t in [0,1] where the 2D segment a + t*d enters the circle (or 0 if it starts inside), else null */
function segmentCircle(ax: number, az: number, dx: number, dz: number, cx: number, cz: number, r: number): number | null {
  const fx = ax - cx, fz = az - cz;
  const A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - r * r;
  if (C <= 0) return 0;
  if (A < 1e-9) return null;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 && t <= 1 ? t : null;
}
/** first t in [0,1] where the segment enters the box (centre x,y,z, size w,h,d), else null */
function segmentBox(a: Point3, dx: number, dy: number, dz: number, s: SolidBox): number | null {
  let lo = 0, hi = 1;
  const axes: [number, number, number, number][] = [[a.x, dx, s.x - s.w / 2, s.x + s.w / 2], [a.y, dy, s.y - s.h / 2, s.y + s.h / 2], [a.z, dz, s.z - s.d / 2, s.z + s.d / 2]];
  for (const [p, d, mn, mx] of axes) {
    if (Math.abs(d) < 1e-9) { if (p < mn || p > mx) return null; continue; }
    let t1 = (mn - p) / d, t2 = (mx - p) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    lo = Math.max(lo, t1); hi = Math.min(hi, t2);
    if (lo > hi) return null;
  }
  return lo;
}

/* ---------------- enemy fire ---------------- */

/** chance one enemy shot with a clear line hits: better close, worse at range, worse against a moving or crouched target.
 * Tuned so a standing player in the open takes about what the old flat 25% gave at mid range. */
export function enemyHitChance(distance: number, range: number, playerSpeed: number, stance: "STAND" | "CROUCH" | "PRONE" = "STAND"): number {
  const reach = Math.min(1, Math.max(0, distance / Math.max(1, range)));
  const base = 0.38 - 0.24 * reach; // 38% point blank .. 14% at the edge of range (~26% at mid range)
  const moving = 1 - Math.min(0.4, Math.max(0, playerSpeed) / 40); // a full sprint (~30 m/s) takes ~30% off
  const low = stance === "PRONE" ? 0.55 : stance === "CROUCH" ? 0.75 : 1;
  return base * moving * low;
}
