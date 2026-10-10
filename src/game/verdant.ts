/* Verdant Forest layout — the authored spaces of the first mission area, as pure data and rules.
 * A winding trail leaves the spawn clearing, passes an ambush clearing with cover, and ends at the
 * Fracture crash site. Everything here is deterministic and renderer-free: Terrain, VerdantForest and
 * Scene all read the same trail, so props never block it, the ground paints it, and markers agree.
 * Only world.ts is imported, so terrain.ts can use it for ground colour without a cycle. */
import { REGIONS, WORLD_SCALE, scaleSite } from "./world";

type P = { x: number; z: number };

const forest = REGIONS.find((r) => r.id === "veridan")!;

/* Authored at the original forest size, then stretched by WORLD_SCALE: route control points and clearing centres move
 * with scaleSite (offset from the forest centre x WORLD_SCALE); anything that must stay human-sized (clearing radii,
 * cover/spawn offsets around a clearing, debris, trail width) keeps its authored metres. At WORLD_SCALE 1 this is the identity. */
const site = (x: number, z: number): P => scaleSite(x, z);

/** where the player materialises — kept identical to Scene's SPAWN */
export const FOREST_SPAWN: P = { x: forest.x, z: forest.z + 12 };
export const SPAWN_CLEARING_RADIUS = 12;

/** trail control points, spawn → ambush clearing → crash site */
export const TRAIL_CONTROL: readonly P[] = [
  FOREST_SPAWN,
  site(-63, -27),
  site(-71, -29),
  site(-79, -34),
  site(-82, -42),
  site(-79, -50),
  site(-72, -55),
  site(-69, -60),
];
export const TRAIL_HALF_WIDTH = 2.8;

/** the crash site and ambush clearing sit exactly where they did relative to the trail's own control points (so their local layout is unchanged) */
const lastControl = TRAIL_CONTROL[TRAIL_CONTROL.length - 1]!;
const encounterControl = TRAIL_CONTROL[4]!; // the (-82,-42) bend
const encC: P = { x: encounterControl.x + 1, z: encounterControl.z };
/** a point `dx, dz` metres from the clearing centre (authored offsets are in metres and do not scale) */
const enc = (dx: number, dz: number): P => ({ x: encC.x + dx, z: encC.z + dz });
export const CRASH_SITE = { x: lastControl.x, z: lastControl.z - 1, radius: 11, scanRadius: 9, label: "Fracture Crash Site" } as const;

/** the ambush clearing: open ground ringed with cover, beside the trail */
export const ENCOUNTER = {
  ...encC, radius: 11, triggerRadius: 30, label: "Forest Patrol",
  /** where the existing machine pool is placed when the encounter wakes — the AI integration points */
  spawnPoints: [
    enc(-7, -4), enc(-6, 5), enc(-2, -8), enc(5, -5), enc(-9, 0),
  ] as readonly P[],
} as const;

export type CoverKind = "rock" | "log";
export type Cover = { x: number; z: number; kind: CoverKind; yaw: number; r: number };
/** cover objects around the clearing; gaps are left on the trail sides so the route stays clear */
export const COVER: readonly Cover[] = [
  { ...enc(-6, -6), kind: "rock", yaw: 0.6, r: 1.7 },
  { ...enc(-7, 3), kind: "log", yaw: 1.2, r: 1.0 },
  { ...enc(-6, 8), kind: "rock", yaw: 2.1, r: 1.6 },
  { ...enc(6, 5), kind: "log", yaw: 0.3, r: 1.0 },
  { ...enc(7, -4), kind: "rock", yaw: 4.0, r: 1.5 },
  { ...enc(-5, -10), kind: "log", yaw: 1.9, r: 1.0 },
  { ...enc(-10, -1), kind: "rock", yaw: 5.2, r: 1.8 },
];

/* ---------------- trail geometry ---------------- */

function catmull(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const t2 = t * t, t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) };
}

const STEPS = 10;
/** dense centre-line of the trail */
export const TRAIL: readonly P[] = (() => {
  const c = TRAIL_CONTROL;
  const out: P[] = [];
  for (let i = 0; i < c.length - 1; i++) {
    const a = c[Math.max(0, i - 1)]!, b = c[i]!, d = c[i + 1]!, e = c[Math.min(c.length - 1, i + 2)]!;
    for (let s = 0; s < STEPS; s++) out.push(catmull(a, b, d, e, s / STEPS));
  }
  out.push(c[c.length - 1]!);
  return out;
})();

export const TRAIL_LENGTH = TRAIL.reduce((n, p, i) => (i ? n + Math.hypot(p.x - TRAIL[i - 1]!.x, p.z - TRAIL[i - 1]!.z) : 0), 0);

/** nearest point on the trail: distance to the centre-line and progress 0..1 along it */
export function trailInfo(x: number, z: number): { dist: number; t: number } {
  let best = Infinity, bt = 0;
  for (let i = 0; i < TRAIL.length - 1; i++) {
    const a = TRAIL[i]!, b = TRAIL[i + 1]!;
    const ex = b.x - a.x, ez = b.z - a.z;
    const len2 = ex * ex + ez * ez || 1;
    const u = Math.min(1, Math.max(0, ((x - a.x) * ex + (z - a.z) * ez) / len2));
    const d = Math.hypot(a.x + ex * u - x, a.z + ez * u - z);
    if (d < best) { best = d; bt = (i + u) / (TRAIL.length - 1); }
  }
  return { dist: best, t: bt };
}

/** 1 on the trail's worn centre, easing to 0 a couple of metres past its edge — ground colour uses this */
export function trailMask(x: number, z: number): number {
  if (Math.hypot(x - forest.x, z - forest.z) > forest.radius * 1.1) return 0;
  const { dist } = trailInfo(x, z);
  const edge = TRAIL_HALF_WIDTH;
  if (dist <= edge * 0.6) return 1;
  if (dist >= edge + 2) return 0;
  const t = (dist - edge * 0.6) / (edge + 2 - edge * 0.6);
  return 1 - t * t * (3 - 2 * t);
}

/** true where solid scenery (trees, rocks) must not stand: the trail, the clearings, the crash pad */
export function isReserved(x: number, z: number, margin = 0): boolean {
  if (Math.hypot(x - FOREST_SPAWN.x, z - FOREST_SPAWN.z) < SPAWN_CLEARING_RADIUS + margin) return true;
  if (Math.hypot(x - CRASH_SITE.x, z - CRASH_SITE.z) < CRASH_SITE.radius + margin) return true;
  if (Math.hypot(x - ENCOUNTER.x, z - ENCOUNTER.z) < ENCOUNTER.radius + margin) return true;
  return trailInfo(x, z).dist < TRAIL_HALF_WIDTH + 1.2 + margin;
}

/* ---------------- forest floor ---------------- */

export type Floor = { x: number; z: number; s: number; r: number };

/** points hugging the trail edge (ferns, shrubs): between `near` and `far` metres off the centre-line */
export function trailEdgeScatter(count: number, rnd: () => number, near: number, far: number, accept: (x: number, z: number) => boolean): Floor[] {
  const out: Floor[] = [];
  let guard = count * 14;
  while (out.length < count && guard-- > 0) {
    const i = Math.floor(rnd() * (TRAIL.length - 1));
    const a = TRAIL[i]!, b = TRAIL[i + 1]!;
    const u = rnd();
    const cx = a.x + (b.x - a.x) * u, cz = a.z + (b.z - a.z) * u;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const side = rnd() < 0.5 ? -1 : 1;
    const off = near + rnd() * (far - near);
    const x = cx + (-(b.z - a.z) / len) * off * side, z = cz + ((b.x - a.x) / len) * off * side;
    if (trailInfo(x, z).dist < TRAIL_HALF_WIDTH + 0.5) continue;
    if (Math.hypot(x - CRASH_SITE.x, z - CRASH_SITE.z) < 8.5) continue; // hull sections reach ~6 m out
    if (!accept(x, z)) continue;
    out.push({ x, z, s: 0.7 + rnd() * 0.7, r: rnd() * Math.PI * 2 });
  }
  return out;
}

/** How many more understory plants the bigger forest gets (parent counts only; per-parent cluster sizes are unchanged). */
export const UNDERSTORY_K = WORLD_SCALE > 1 ? Math.min(5, WORLD_SCALE * 1.25) : 1;
/** On a scaled forest most low plants are placed along the route where the player walks (within this many metres of the trail); the rest of the woods keeps a thinner spread. */
export const CORRIDOR_RADIUS = 70;
const CORRIDOR_SHARE = 0.78;

/** scatter anywhere in the forest region, off the reserved ground (on a scaled forest, mostly in the trail corridor) */
export function forestScatter(count: number, rnd: () => number, accept: (x: number, z: number) => boolean, margin = 0.5): Floor[] {
  const out: Floor[] = [];
  let guard = count * 14;
  while (out.length < count && guard-- > 0) {
    let x: number, z: number;
    if (WORLD_SCALE > 1 && rnd() < CORRIDOR_SHARE) {
      const p = TRAIL[Math.floor(rnd() * (TRAIL.length - 1))]!;
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * CORRIDOR_RADIUS;
      x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d;
      if (Math.hypot(x - forest.x, z - forest.z) > forest.radius * 0.95) continue;
    } else {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * forest.radius * 0.9;
      x = forest.x + Math.cos(a) * d; z = forest.z + Math.sin(a) * d;
    }
    if (isReserved(x, z, margin) || !accept(x, z)) continue;
    out.push({ x, z, s: 0.7 + rnd() * 0.7, r: rnd() * Math.PI * 2 });
  }
  return out;
}

/** fragments of the crashed craft, laid out around the impact point (units: metres from the site centre) */
export type Debris = { dx: number; dz: number; w: number; h: number; d: number; yaw: number; tilt: number };
export const DEBRIS: readonly Debris[] = [
  { dx: 0, dz: 0, w: 5.2, h: 1.4, d: 2.6, yaw: 0.5, tilt: 0.22 },
  { dx: -3.4, dz: 2.2, w: 3.0, h: 0.5, d: 1.8, yaw: 1.7, tilt: -0.35 },
  { dx: 3.8, dz: -1.6, w: 2.4, h: 0.6, d: 1.4, yaw: 2.6, tilt: 0.4 },
  { dx: -1.2, dz: -3.6, w: 1.6, h: 1.8, d: 0.4, yaw: 0.9, tilt: 0.12 },
  { dx: 2.2, dz: 3.4, w: 1.4, h: 0.4, d: 2.2, yaw: 4.1, tilt: -0.2 },
  { dx: 5.6, dz: 1.6, w: 1.0, h: 1.2, d: 0.3, yaw: 3.3, tilt: 0.5 },
  { dx: -5.4, dz: -1.2, w: 1.2, h: 0.35, d: 1.5, yaw: 5.5, tilt: -0.1 },
];

/* ---------------- investigation ---------------- */

export const SCAN_SECONDS = 4;
export type Investigation = { scan: number; done: boolean; announced: boolean };
export const NEW_INVESTIGATION: Investigation = { scan: 0, done: false, announced: false };
export type InvestigationEvent = "APPROACH" | "COMPLETE" | null;

/** advance the crash-site scan: fills while the player stands inside scanRadius, drains slowly outside */
export function stepInvestigation(s: Investigation, dt: number, dist: number): { next: Investigation; event: InvestigationEvent } {
  if (s.done) return { next: s, event: null };
  let event: InvestigationEvent = null;
  let announced = s.announced;
  if (!announced && dist < CRASH_SITE.radius + 14) { announced = true; event = "APPROACH"; }
  const scan = dist <= CRASH_SITE.scanRadius ? Math.min(1, s.scan + dt / SCAN_SECONDS) : Math.max(0, s.scan - dt * 0.4);
  if (scan >= 1) return { next: { scan: 1, done: true, announced }, event: "COMPLETE" };
  return { next: { scan, done: false, announced }, event };
}

/** the patrol wakes once, when the player first enters the trigger radius */
export function shouldWakePatrol(dist: number, woken: boolean): boolean {
  return !woken && dist < ENCOUNTER.triggerRadius;
}

/* ---------------- crash-site surroundings ---------------- */

/** the skid the craft cut before it stopped: a strip leaving the hull to the east, away from the trail approach */
export const FURROW = { dx: 0.97, dz: -0.24, length: 15, width: 3.4 } as const;

/** position relative to the furrow: distance along it (0 at the hull) and across it, or null when outside the strip + margin */
export function furrowFrame(x: number, z: number): { along: number; across: number } | null {
  const rx = x - CRASH_SITE.x, rz = z - CRASH_SITE.z;
  const along = rx * FURROW.dx + rz * FURROW.dz;
  const across = -rx * FURROW.dz + rz * FURROW.dx;
  return along >= -2 && along <= FURROW.length ? { along, across } : null;
}
export function inFurrow(x: number, z: number, margin = 0): boolean {
  const f = furrowFrame(x, z);
  return !!f && Math.abs(f.across) < FURROW.width / 2 + margin;
}

/** low plants may grow here: off the trail/clearings/crash pad and out of the churned furrow */
export function vegetationOk(x: number, z: number): boolean {
  return !isReserved(x, z, 0.2) && !inFurrow(x, z, 1);
}

/** a ring of plants framing the wreck (rMin..rMax from the site centre) that keeps the trail approach and furrow open */
export function aroundScatter(count: number, rnd: () => number, rMin: number, rMax: number, accept: (x: number, z: number) => boolean): Floor[] {
  const out: Floor[] = [];
  let guard = count * 14;
  while (out.length < count && guard-- > 0) {
    const a = rnd() * Math.PI * 2, d = rMin + Math.sqrt(rnd()) * (rMax - rMin);
    const x = CRASH_SITE.x + Math.cos(a) * d, z = CRASH_SITE.z + Math.sin(a) * d;
    if (trailInfo(x, z).dist < TRAIL_HALF_WIDTH + 0.9 || inFurrow(x, z, 1.2) || !accept(x, z)) continue;
    out.push({ x, z, s: 0.7 + rnd() * 0.7, r: rnd() * Math.PI * 2 });
  }
  return out;
}

/* ---------------- ground-cover patchiness ---------------- */

function lattice(ix: number, iz: number): number {
  let n = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** smooth deterministic 0..1 noise (two octaves). Grass and ground cover grow where it is high, so the forest
 * floor breaks into meadows and bare duff instead of one even carpet. */
export function patchNoise(x: number, z: number, scale = 0.085): number {
  const oct = (sx: number, sz: number) => {
    const fx = Math.floor(sx), fz = Math.floor(sz), tx = sx - fx, tz = sz - fz;
    const u = tx * tx * (3 - 2 * tx), v = tz * tz * (3 - 2 * tz);
    const a = lattice(fx, fz), b = lattice(fx + 1, fz), c = lattice(fx, fz + 1), d = lattice(fx + 1, fz + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return oct(x * scale, z * scale) * 0.65 + oct(x * scale * 2.3 + 17, z * scale * 2.3 - 9) * 0.35;
}
