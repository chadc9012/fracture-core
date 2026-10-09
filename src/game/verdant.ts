/* Verdant Forest layout — the authored spaces of the first mission area, as pure data and rules.
 * A winding trail leaves the spawn clearing, passes an ambush clearing with cover, and ends at the
 * Fracture crash site. Everything here is deterministic and renderer-free: Terrain, VerdantForest and
 * Scene all read the same trail, so props never block it, the ground paints it, and markers agree.
 * Only world.ts is imported, so terrain.ts can use it for ground colour without a cycle. */
import { REGIONS } from "./world";

type P = { x: number; z: number };

const forest = REGIONS.find((r) => r.id === "veridan")!;

/** where the player materialises — kept identical to Scene's SPAWN */
export const FOREST_SPAWN: P = { x: forest.x, z: forest.z + 12 };
export const SPAWN_CLEARING_RADIUS = 12;

/** trail control points, spawn → ambush clearing → crash site */
export const TRAIL_CONTROL: readonly P[] = [
  FOREST_SPAWN,
  { x: -63, z: -27 },
  { x: -71, z: -29 },
  { x: -79, z: -34 },
  { x: -82, z: -42 },
  { x: -79, z: -50 },
  { x: -72, z: -55 },
  { x: -69, z: -60 },
];
export const TRAIL_HALF_WIDTH = 2.8;

export const CRASH_SITE = { x: -69, z: -61, radius: 11, scanRadius: 9, label: "Fracture Crash Site" } as const;

/** the ambush clearing: open ground ringed with cover, beside the trail */
export const ENCOUNTER = {
  x: -81, z: -42, radius: 11, triggerRadius: 30, label: "Forest Patrol",
  /** where the existing machine pool is placed when the encounter wakes — the AI integration points */
  spawnPoints: [
    { x: -88, z: -46 }, { x: -87, z: -37 }, { x: -83, z: -50 }, { x: -76, z: -47 }, { x: -90, z: -42 },
  ] as readonly P[],
} as const;

export type CoverKind = "rock" | "log";
export type Cover = { x: number; z: number; kind: CoverKind; yaw: number; r: number };
/** cover objects around the clearing; gaps are left on the trail sides so the route stays clear */
export const COVER: readonly Cover[] = [
  { x: -87, z: -48, kind: "rock", yaw: 0.6, r: 1.7 },
  { x: -88, z: -39, kind: "log", yaw: 1.2, r: 1.0 },
  { x: -87, z: -34, kind: "rock", yaw: 2.1, r: 1.6 },
  { x: -75, z: -37, kind: "log", yaw: 0.3, r: 1.0 },
  { x: -74, z: -46, kind: "rock", yaw: 4.0, r: 1.5 },
  { x: -86, z: -52, kind: "log", yaw: 1.9, r: 1.0 },
  { x: -91, z: -43, kind: "rock", yaw: 5.2, r: 1.8 },
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
    if (Math.hypot(x - CRASH_SITE.x, z - CRASH_SITE.z) < 5) continue;
    if (!accept(x, z)) continue;
    out.push({ x, z, s: 0.7 + rnd() * 0.7, r: rnd() * Math.PI * 2 });
  }
  return out;
}

/** scatter anywhere in the forest region, off the reserved ground */
export function forestScatter(count: number, rnd: () => number, accept: (x: number, z: number) => boolean, margin = 0.5): Floor[] {
  const out: Floor[] = [];
  let guard = count * 14;
  while (out.length < count && guard-- > 0) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * forest.radius * 0.9;
    const x = forest.x + Math.cos(a) * d, z = forest.z + Math.sin(a) * d;
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
