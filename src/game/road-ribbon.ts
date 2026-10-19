/** Road surface ribbons: a thin strip draped over each supply road's graded centre line (terrain.ts already flattens the
 * corridor), so the road can show detail the 2.5 m ground mesh can't — tyre ruts, a grassy crown, gravel and soft
 * edges. Pure geometry data; Roads.tsx makes one mesh per road. The strip stops where the road is underwater or on a
 * bridge deck (the deck is its own surface), and never spans a gap: each run of kept samples is its own strip. */
import { LANES, ROAD_SAMPLES, laneSamples, type Lane } from "./lanes";
import { WATER_LEVEL, heightAt, riverCrossings, slopeAt } from "./terrain";

export const ROAD_HALF = 3.6;        // half the surfaced width, metres (the graded corridor is wider)
export const ROAD_LIFT = 0.09;       // above the ground mesh (plus a polygon offset in the material)
/** extra lift where the ground slopes (cut and embankment edges): the 2.5 m ground triangles can't follow those, and
 * poked through the strip edge in a sawtooth */
export const SLOPE_LIFT = 0.3;
export const liftAt = (slope: number) => ROAD_LIFT + Math.min(SLOPE_LIFT, slope * 0.6);
/** vertices across the strip: it must follow the graded crown, or the ground pokes through its middle */
export const ROAD_COLS = 5;
export const ROAD_TILE = 7;          // metres of road per texture repeat

export type Ribbon = { positions: Float32Array; uvs: Float32Array; indices: Uint32Array; points: number };

export function roadRibbon(lane: Lane, samples = ROAD_SAMPLES, height: (x: number, z: number) => number = heightAt, slope: (x: number, z: number) => number = slopeAt, bridges = riverCrossings().filter((c) => c.resolved)): Ribbon {
  const pts = laneSamples(lane, samples);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let run = -1, along = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!;
    if (i > 0) along += Math.hypot(p.x - pts[i - 1]!.x, p.z - pts[i - 1]!.z);
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1, nx = -dz / len, nz = dx / len;
    const row: number[] = [];
    let low = Infinity;
    for (let c = 0; c < ROAD_COLS; c++) {
      const u = c / (ROAD_COLS - 1), off = (0.5 - u) * 2 * ROAD_HALF; // u = 0 on the left edge
      const x = p.x + nx * off, z = p.z + nz * off, h = height(x, z);
      low = Math.min(low, h);
      row.push(x, h + liftAt(slope(x, z)), z);
    }
    const onBridge = bridges.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.length / 2 + 2);
    if (low <= WATER_LEVEL + 0.25 || onBridge) { run = -1; continue; }
    const v = pos.length / 3;
    pos.push(...row);
    for (let c = 0; c < ROAD_COLS; c++) uv.push(c / (ROAD_COLS - 1), along / ROAD_TILE);
    // wound counter-clockwise seen from above, so the face points up (the other way it is back-face culled and invisible)
    if (run >= 0) for (let c = 0; c < ROAD_COLS - 1; c++) idx.push(run + c, v + c, run + c + 1, run + c + 1, v + c, v + c + 1);
    run = v;
  }
  return { positions: new Float32Array(pos), uvs: new Float32Array(uv), indices: new Uint32Array(idx), points: pos.length / (3 * ROAD_COLS) };
}

export const allRoadRibbons = () => LANES.map((l) => roadRibbon(l));
