/** Drivable race routes. The racing catalogue (racing.ts) lays each course out as a shape around its area's centre;
 * on the real map those straight legs ran through lakes, rivers, cliffs and city towers. This routes every vehicle
 * course over ground a car can actually drive: each authored checkpoint is moved to the nearest drivable spot, every leg
 * is path-found (A*) over a passability grid sampled from the same world the game uses (heightAt / slopeAt / rivers,
 * Nexus towers, Neon tower blocks, walk-in homes and their garages, shop counters), roads are cheaper, and extra gates
 * are added along the path so the straight line between any two gates stays on the route (racing.ts checks that you
 * stay within its corridor of the leg you are on).
 *
 * Routing is too slow to run while the game loads, so scripts/bake-race-routes.ts runs it once per world scale and
 * writes race-routes.generated.ts; racing.ts uses the baked route when there is one for the current scale.
 * race-routing.test.ts re-checks the baked routes against the live world, so a terrain or layout change that blocks a
 * route fails a test instead of shipping a race through a building. Pure. */
import { WATER_LEVEL, heightAt, riverAt, riverCrossings } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { buildings } from "./nexus-districts";
import { neonLayoutWorld, TOWER_FOOTPRINT } from "./neon-layout";
import { footprint, garageRect, neonKeepOut, residences } from "./residences";
import { REGIONAL_SHOPS } from "./regional-shops";
import { WORLD_RADIUS } from "./world";

export const CELL = 6;              // grid spacing, metres
/** a cell steeper than this (rise over run) is a cliff; cars climb anything less, slowly (vehicle-handling.ts slope drag) */
export const MAX_SLOPE = 0.85;
export const DRY = WATER_LEVEL + 0.4;
export const MAX_GAP = 150;         // longest gate-to-gate leg
export const PATH_TOLERANCE = 22;   // how far the straight leg between two gates may stray from the routed path

type Rect = { x: number; z: number; hx: number; hz: number; c: number; s: number };
let structures: { rects: Rect[]; circles: { x: number; z: number; r: number }[] } | null = null;
/** every built footprint a car can't drive through (rects carry their turn), plus shop counters */
function built() {
  if (structures) return structures;
  const rects: Rect[] = [];
  const add = (x: number, z: number, hx: number, hz: number, yaw = 0, pad = 2.5) => rects.push({ x, z, hx: hx + pad, hz: hz + pad, c: Math.cos(yaw), s: Math.sin(yaw) });
  for (const b of buildings()) add(b.x, b.z, b.w / 2, b.d / 2, b.yaw);
  for (const t of neonLayoutWorld(neonKeepOut()).towers) { const [hx, hz] = TOWER_FOOTPRINT[t.variant]; add(t.x, t.z, t.rot % 2 ? hz : hx, t.rot % 2 ? hx : hz); }
  for (const r of residences()) { const f = footprint(r); add(r.x, r.z, f.hx, f.hz); if (r.garage) { const g = garageRect(r.garage); add(g.x, g.z, g.hx, g.hz); } }
  return (structures = { rects, circles: REGIONAL_SHOPS.map((s) => ({ x: s.x, z: s.z, r: 5 })) });
}
function inStructure(x: number, z: number): boolean {
  const { rects, circles } = built();
  for (const r of rects) {
    const dx = x - r.x, dz = z - r.z;
    if (Math.abs(dx) > r.hx + r.hz + 1 || Math.abs(dz) > r.hx + r.hz + 1) continue;
    // into the footprint's own frame (yaw about +y: the inverse turn)
    const lx = dx * r.c - dz * r.s, lz = dx * r.s + dz * r.c;
    if (Math.abs(lx) < r.hx && Math.abs(lz) < r.hz) return true;
  }
  for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r) return true;
  return false;
}
let bridges: ReturnType<typeof riverCrossings> | null = null;
const onBridge = (x: number, z: number) => (bridges ??= riverCrossings().filter((c) => c.resolved)).some((c) => Math.hypot(x - c.x, z - c.z) < c.length / 2 + 2);

/** a single point a ground vehicle can stand on (no slope check: that needs neighbours) */
export function drivablePoint(x: number, z: number): boolean {
  if (Math.hypot(x, z) > WORLD_RADIUS * 0.97) return false;
  if (heightAt(x, z) < DRY && !onBridge(x, z)) return false;
  const rv = riverAt(x, z);
  if (rv && rv.dist < rv.w && !onBridge(x, z)) return false;
  return !inStructure(x, z);
}

type Grid = { x0: number; z0: number; nx: number; nz: number; h: Float32Array; ok: Uint8Array; road: Uint8Array; slope: Float32Array };
function makeGrid(x0: number, z0: number, x1: number, z1: number): Grid {
  const nx = Math.ceil((x1 - x0) / CELL) + 1, nz = Math.ceil((z1 - z0) / CELL) + 1;
  const h = new Float32Array(nx * nz), ok = new Uint8Array(nx * nz), road = new Uint8Array(nx * nz), sl = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = x0 + i * CELL, z = z0 + j * CELL; h[j * nx + i] = heightAt(x, z); }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = x0 + i * CELL, z = z0 + j * CELL;
    const hx = (h[j * nx + Math.min(nx - 1, i + 1)]! - h[j * nx + Math.max(0, i - 1)]!) / (2 * CELL), hz = (h[Math.min(nz - 1, j + 1) * nx + i]! - h[Math.max(0, j - 1) * nx + i]!) / (2 * CELL);
    const slope = Math.hypot(hx, hz);
    sl[k] = slope;
    ok[k] = slope <= MAX_SLOPE && drivablePoint(x, z) ? 1 : 0;
    road[k] = distanceToRoad(x, z) < LANE_HALF_WIDTH ? 1 : 0;
  }
  return { x0, z0, nx, nz, h, ok, road, slope: sl };
}
const cellOf = (g: Grid, x: number, z: number) => ({ i: Math.max(0, Math.min(g.nx - 1, Math.round((x - g.x0) / CELL))), j: Math.max(0, Math.min(g.nz - 1, Math.round((z - g.z0) / CELL))) });

/** label the drivable cells by connected area (8-neighbour, no diagonal squeeze past blocked corners) */
function components(g: Grid): Int32Array {
  const lab = new Int32Array(g.nx * g.nz).fill(-1);
  let n = 0;
  const stack: number[] = [];
  for (let k0 = 0; k0 < lab.length; k0++) {
    if (!g.ok[k0] || lab[k0] !== -1) continue;
    lab[k0] = n; stack.push(k0);
    while (stack.length) {
      const k = stack.pop()!, i = k % g.nx, j = (k - i) / g.nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.nz) continue;
        const nk = nj * g.nx + ni; if (g.ok[nk] && lab[nk] === -1) { lab[nk] = n; stack.push(nk); }
      }
    }
    n++;
  }
  return lab;
}

/** nearest drivable cell to a point (spiral search), optionally only in one connected area, or null */
function snap(g: Grid, x: number, z: number, reach = 200, lab?: Int32Array, area = -1): { i: number; j: number } | null {
  const c = cellOf(g, x, z), R = Math.ceil(reach / CELL);
  let best: { i: number; j: number } | null = null, bd = Infinity;
  for (let r = 0; r <= R && !best; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const i = c.i + di, j = c.j + dj;
    if (i < 0 || j < 0 || i >= g.nx || j >= g.nz || !g.ok[j * g.nx + i]) continue;
    if (lab && area >= 0 && lab[j * g.nx + i] !== area) continue;
    // prefer a cell with drivable neighbours (not a one-cell pocket)
    let n = 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (g.ok[(j + b) * g.nx + i + a]) n++;
    const d = Math.hypot(di, dj) - n * 0.3;
    if (d < bd) { bd = d; best = { i, j }; }
  }
  return best;
}

/** A* over the grid (8-neighbour), cheaper on roads and on the flat; returns cell centres or null */
function astar(g: Grid, a: { i: number; j: number }, b: { i: number; j: number }): { x: number; z: number }[] | null {
  const N = g.nx * g.nz, start = a.j * g.nx + a.i, goal = b.j * g.nx + b.i;
  const gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  // binary heap of [f, k]
  const heap: number[] = [], hf: number[] = [];
  const push = (f: number, k: number) => { heap.push(k); hf.push(f); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hf[p]! <= hf[i]!) break; [heap[p], heap[i]] = [heap[i]!, heap[p]!]; [hf[p], hf[i]] = [hf[i]!, hf[p]!]; i = p; } };
  const pop = () => { const top = heap[0]!; const lk = heap.pop()!, lf = hf.pop()!; if (heap.length) { heap[0] = lk; hf[0] = lf; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && hf[l]! < hf[m]!) m = l; if (r < heap.length && hf[r]! < hf[m]!) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i]!, heap[m]!]; [hf[m], hf[i]] = [hf[i]!, hf[m]!]; i = m; } } return top; };
  const hEst = (k: number) => Math.hypot((k % g.nx) - b.i, Math.floor(k / g.nx) - b.j) * 0.6; // roads cost 0.6 per cell
  gs[start] = 0; push(hEst(start), start);
  const steps = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]] as const;
  let guard = 0;
  while (heap.length && guard++ < N * 4) {
    const k = pop();
    if (closed[k]) continue;
    if (k === goal) break;
    closed[k] = 1;
    const i = k % g.nx, j = (k - i) / g.nx;
    for (const [di, dj, len] of steps) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.nz) continue;
      const nk = nj * g.nx + ni;
      if (!g.ok[nk] || closed[nk]) continue;
      // no corner-cutting past a blocked cell on a diagonal
      if (di && dj && (!g.ok[j * g.nx + ni] || !g.ok[nj * g.nx + i])) continue;
      const climb = Math.abs(g.h[nk]! - g.h[k]!) / (CELL * len);
      const cost = len * (g.road[nk] ? 0.6 : 1) * (1 + climb * 2.5 + g.slope[nk]! * 1.5);
      const t = gs[k]! + cost;
      if (t < gs[nk]!) { gs[nk] = t; from[nk] = k; push(t + hEst(nk), nk); }
    }
  }
  if (from[goal] === -1 && goal !== start) return null;
  const out: { x: number; z: number }[] = [];
  for (let k = goal; k !== -1; k = from[k]!) { out.push({ x: g.x0 + (k % g.nx) * CELL, z: g.z0 + Math.floor(k / g.nx) * CELL }); if (k === start) break; }
  return out.reverse();
}

const segDist = (px: number, pz: number, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz, u = l2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / l2)) : 0;
  return Math.hypot(px - (a.x + u * dx), pz - (a.z + u * dz));
};
/** gates along a path: Douglas-Peucker to PATH_TOLERANCE, then no leg longer than MAX_GAP */
function gatesAlong(path: { x: number; z: number }[]): { x: number; z: number }[] {
  const keep = new Uint8Array(path.length); keep[0] = 1; keep[path.length - 1] = 1;
  const dp = (a: number, b: number) => {
    let m = -1, md = PATH_TOLERANCE;
    for (let i = a + 1; i < b; i++) { const d = segDist(path[i]!.x, path[i]!.z, path[a]!, path[b]!); if (d > md) { md = d; m = i; } }
    // close enough to the path, but the straight leg clips a building or a bank: split it anyway
    if (m < 0 && b - a > 1 && !legDrivable(path[a]!, path[b]!)) m = (a + b) >> 1;
    if (m >= 0) { keep[m] = 1; dp(a, m); dp(m, b); }
  };
  dp(0, path.length - 1);
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < path.length; i++) if (keep[i]) {
    const p = path[i]!, last = out[out.length - 1];
    if (last) {
      const d = Math.hypot(p.x - last.x, p.z - last.z), n = Math.floor(d / MAX_GAP);
      for (let k = 1; k <= n; k++) {
        // a gate in between, slid along the leg off any spot the leg merely clips
        let u = k / (n + 1);
        for (let t = 0; t < 12 && !drivablePoint(last.x + (p.x - last.x) * u, last.z + (p.z - last.z) * u); t++) u += (t % 2 ? -1 : 1) * (t + 1) * (2 / d);
        out.push({ x: last.x + (p.x - last.x) * u, z: last.z + (p.z - last.z) * u });
      }
    }
    out.push(p);
  }
  return out;
}

export type Routed = { points: { x: number; z: number }[]; /** index in `points` of each authored checkpoint that survived */ anchors: number[]; dropped: number };
/** route one course through world points (the authored checkpoints, in order; a loop repeats its first point last) */
export function routeCourse(raw: readonly { x: number; z: number }[]): Routed | null {
  const pad = 240;
  const xs = raw.map((p) => p.x), zs = raw.map((p) => p.z);
  const g = makeGrid(Math.min(...xs) - pad, Math.min(...zs) - pad, Math.max(...xs) + pad, Math.max(...zs) + pad);
  const loop = raw.length > 2 && Math.hypot(raw[0]!.x - raw[raw.length - 1]!.x, raw[0]!.z - raw[raw.length - 1]!.z) < 1;
  // one connected stretch of drivable ground for the whole course: the area most of the checkpoints sit in or beside
  // (a mountain's flanks split into pockets a car can't cross; a gate in another pocket would be unreachable)
  const lab = components(g), votes = new Map<number, number>();
  for (const p of raw) { const s0 = snap(g, p.x, p.z, 120); if (s0) { const a = lab[s0.j * g.nx + s0.i]!; votes.set(a, (votes.get(a) ?? 0) + 1); } }
  const sizes = new Map<number, number>(); for (const a of lab) if (a >= 0) sizes.set(a, (sizes.get(a) ?? 0) + 1);
  const area = [...votes.entries()].sort((a, b) => b[1] - a[1] || (sizes.get(b[0]) ?? 0) - (sizes.get(a[0]) ?? 0))[0]?.[0] ?? -1;
  const snapped = raw.map((p) => snap(g, p.x, p.z, 260, lab, area));
  const points: { x: number; z: number }[] = [], anchors: number[] = [];
  let dropped = 0, prev: { i: number; j: number } | null = null;
  for (let n = 0; n < snapped.length; n++) {
    const s = snapped[n] ?? null;
    if (!s) { dropped++; continue; }
    if (!prev) { points.push({ x: g.x0 + s.i * CELL, z: g.z0 + s.j * CELL }); anchors.push(0); prev = s; continue; }
    const path = astar(g, prev, s);
    if (!path || path.length < 2) { if (!path) dropped++; continue; }
    const gates = gatesAlong(path);
    for (let k = 1; k < gates.length; k++) points.push(gates[k]!);
    anchors.push(points.length - 1);
    prev = s;
  }
  if (points.length < 3) return null;
  // a loop must close exactly on its start line
  if (loop) { const a = points[0]!, b = points[points.length - 1]!; if (Math.hypot(a.x - b.x, a.z - b.z) > CELL * 1.5) return null; points[points.length - 1] = { ...a }; }
  return { points, anchors, dropped };
}

/** sample a straight leg: every few metres drivable and not a cliff */
export function legDrivable(a: { x: number; z: number }, b: { x: number; z: number }, step = 4): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / step));
  let bad = 0;
  for (let k = 0; k <= n; k++) { const u = k / n, x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u; if (!drivablePoint(x, z)) bad++; }
  // a straight leg may clip one sample of a building's padding or a bank the path bends round, never more
  return bad <= 1;
}
