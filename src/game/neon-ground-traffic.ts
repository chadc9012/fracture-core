/** Neon City ground traffic: a little of it. A few supply trucks and cars drive closed loops round whole street blocks, keeping to the
 * right, turning through arcs at the corners. Loops are found on Neon's real carriageways (city-streets.ts): a loop is a closed route
 * whose every unit edge is an existing segment, so a vehicle can never drive through a tower, a venue lot or a gap in the grid.
 * Visual only, like Nexus traffic: nothing here touches the sim. Pure, world metres. */
import type { FleetModelId } from "./fleet-models";
import type { CityStreets } from "./city-streets";

export type Pt = { x: number; z: number };
export type GroundVehicle = { model: FleetModelId; paint?: string; /** metres per second */ speed: number; /** which loop (index into the found loops) is picked from the seed */ seed: number; reverse: boolean; at: number };

export const LANE_OFFSET = 1.6;
export const CORNER_R = 4.5;
export const MIN_LOOP_EDGES = 6; // no tiny laps round one block

export const GROUND_FLEET: readonly GroundVehicle[] = [
  { model: "tech-transport", paint: "#c9ced6", speed: 5.5, seed: 11, reverse: false, at: 0.0 },
  { model: "tech-transport", paint: "#2c323c", speed: 5, seed: 47, reverse: true, at: 0.3 },
  { model: "offroad-truck", paint: "#ffcf3a", speed: 6.5, seed: 83, reverse: false, at: 0.6 },
  { model: "luxury-sedan", paint: "#101216", speed: 8, seed: 5, reverse: true, at: 0.2 },
  { model: "tuner", paint: "#38e8ff", speed: 9, seed: 29, reverse: false, at: 0.5 },
  { model: "street-racer", paint: "#ff2ea6", speed: 10, seed: 61, reverse: true, at: 0.8 },
  { model: "security-suv", paint: "#e8ecf2", speed: 7, seed: 97, reverse: false, at: 0.1 },
  { model: "muscle-car", paint: "#b968ff", speed: 8.5, seed: 71, reverse: true, at: 0.4 },
];

/** the street grid as integer node coordinates, and the set of existing unit edges */
export function streetGrid(c: Pick<CityStreets, "segments" | "pitch" | "junctions">) {
  const h = c.pitch / 2;
  const xs: number[] = [], zs: number[] = [];
  for (const s of c.segments) { if (s.along === "x") { xs.push(s.x - h, s.x + h); zs.push(s.z); } else { zs.push(s.z - h, s.z + h); xs.push(s.x); } }
  const x0 = Math.min(...xs), z0 = Math.min(...zs);
  const ix = (x: number) => Math.round((x - x0) / c.pitch), iz = (z: number) => Math.round((z - z0) / c.pitch);
  const edges = new Set<string>();
  for (const s of c.segments) {
    if (s.along === "x") { const j = iz(s.z), i = ix(s.x - h); edges.add(`x:${i}:${j}`); }
    else { const i = ix(s.x), j = iz(s.z - h); edges.add(`z:${i}:${j}`); }
  }
  const junctions = new Set(c.junctions.map((j) => `${ix(j.x)},${iz(j.z)}`)); // only nodes with a paved junction box can be turned at
  return { x0, z0, pitch: c.pitch, edges, junctions, node: (i: number, j: number): Pt => ({ x: x0 + i * c.pitch, z: z0 + j * c.pitch }) };
}
export type StreetGrid = ReturnType<typeof streetGrid>;

/** a closed route: the grid nodes it visits, in order (the last joins back to the first) */
export type Loop = { nodes: { i: number; j: number }[] };

/** every simple closed route on the street graph between minEdges and maxEdges long (each listed once, one direction) */
export function findLoops(grid: StreetGrid, minEdges = MIN_LOOP_EDGES, maxEdges = 12): Loop[] {
  const adj = new Map<string, string[]>();
  const add = (a: string, b: string) => { (adj.get(a) ?? adj.set(a, []).get(a)!).push(b); (adj.get(b) ?? adj.set(b, []).get(b)!).push(a); };
  for (const e of grid.edges) { const [k, i, j] = e.split(":"); const a = `${i},${j}`, b = k === "x" ? `${+i! + 1},${j}` : `${i},${+j! + 1}`; if (grid.junctions.has(a) && grid.junctions.has(b)) add(a, b); }
  const order = [...adj.keys()].sort(), idx = new Map(order.map((k, n) => [k, n]));
  const out: Loop[] = [];
  const dfs = (start: string, cur: string, path: string[]) => {
    for (const nx of adj.get(cur)!) {
      if (nx === start && path.length >= Math.max(3, minEdges)) { if (idx.get(path[1]!)! < idx.get(path[path.length - 1]!)!) out.push({ nodes: path.map((k) => { const [i, j] = k.split(",").map(Number); return { i: i!, j: j! }; }) }); continue; }
      if (path.length >= maxEdges || idx.get(nx)! <= idx.get(start)! || path.includes(nx)) continue;
      path.push(nx); dfs(start, nx, path); path.pop();
    }
  };
  for (const s of order) dfs(s, s, [s]);
  return out;
}

/** the lane a vehicle follows round a loop: right-hand, closed, each 90 degree turn cut as a quadratic arc (straight-through nodes add nothing). */
export function loopPath(grid: StreetGrid, loop: Loop, reverse: boolean): Pt[] {
  const corners = loop.nodes.map((n) => grid.node(n.i, n.j));
  if (reverse) corners.reverse();
  const dir = (a: Pt, b: Pt) => { const l = Math.hypot(b.x - a.x, b.z - a.z); return { x: (b.x - a.x) / l, z: (b.z - a.z) / l }; };
  const right = (d: Pt) => ({ x: -d.z, z: d.x });
  const pts: Pt[] = [];
  const n = corners.length;
  for (let k = 0; k < n; k++) {
    const prev = corners[(k + n - 1) % n]!, c = corners[k]!, next = corners[(k + 1) % n]!;
    const d1 = dir(prev, c), d2 = dir(c, next), r1 = right(d1), r2 = right(d2);
    if (Math.abs(d1.x * d2.x + d1.z * d2.z) > 0.99) continue; // straight through
    const L = { x: c.x + (r1.x + r2.x) * LANE_OFFSET, z: c.z + (r1.z + r2.z) * LANE_OFFSET }; // where the two lane lines cross
    const a = { x: L.x - d1.x * CORNER_R, z: L.z - d1.z * CORNER_R }, b = { x: L.x + d2.x * CORNER_R, z: L.z + d2.z * CORNER_R };
    const steps = 10;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, u = 1 - t;
      pts.push({ x: u * u * a.x + 2 * u * t * L.x + t * t * b.x, z: u * u * a.z + 2 * u * t * L.z + t * t * b.z });
    }
  }
  return pts;
}

export type Path = { pts: Pt[]; cum: number[]; length: number };
export function makePath(pts: Pt[]): Path {
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1]!, b = pts[i % pts.length]!; cum.push(cum[i - 1]! + Math.hypot(b.x - a.x, b.z - a.z)); }
  return { pts, cum, length: cum[pts.length]! };
}
/** position and heading (rotation.y with the model's nose on +z) at distance s along the closed path */
export function pathAt(p: Path, s: number): { x: number; z: number; yaw: number } {
  const t = ((s % p.length) + p.length) % p.length;
  let lo = 0, hi = p.pts.length;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (p.cum[mid]! <= t) lo = mid; else hi = mid; }
  const a = p.pts[lo]!, b = p.pts[(lo + 1) % p.pts.length]!, seg = p.cum[lo + 1]! - p.cum[lo]!, f = seg > 0 ? (t - p.cum[lo]!) / seg : 0;
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
}

/** which loop each vehicle drives: spread over the loops by seed, preferring different ones for different vehicles */
export function assignLoops(loops: readonly Loop[], fleet: readonly GroundVehicle[]): Loop[] {
  const used = new Set<number>(), out: Loop[] = [];
  for (const v of fleet) {
    let k = v.seed % loops.length;
    for (let tries = 0; tries < loops.length && used.has(k); tries++) k = (k + 7) % loops.length;
    used.add(k); out.push(loops[k]!);
  }
  return out;
}
