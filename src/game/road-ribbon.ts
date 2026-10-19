/** Road surface ribbons: a thin strip draped over each supply road's graded centre line (terrain.ts already flattens the
 * corridor), so the road can show detail the 2.5 m ground mesh can't — tyre ruts, a grassy crown, gravel and soft
 * edges. Pure geometry data; Roads.tsx makes one mesh per road. The strip stops where the road is underwater or on a
 * bridge deck (the deck is its own surface), and never spans a gap: each run of kept samples is its own strip. */
import { LANES, ROAD_SAMPLES, laneSamples, type Lane } from "./lanes";
import { WATER_LEVEL, heightAt, riverCrossings } from "./terrain";

export const ROAD_HALF = 3.6;        // half the surfaced width, metres (the graded corridor is wider)
export const ROAD_LIFT = 0.07;       // above the ground mesh (plus a polygon offset in the material)
export const ROAD_TILE = 7;          // metres of road per texture repeat

export type Ribbon = { positions: Float32Array; uvs: Float32Array; indices: Uint32Array; points: number };

export function roadRibbon(lane: Lane, samples = ROAD_SAMPLES, height: (x: number, z: number) => number = heightAt, bridges = riverCrossings().filter((c) => c.resolved)): Ribbon {
  const pts = laneSamples(lane, samples);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let run = -1, along = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!;
    if (i > 0) along += Math.hypot(p.x - pts[i - 1]!.x, p.z - pts[i - 1]!.z);
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1, nx = -dz / len, nz = dx / len;
    const lx = p.x + nx * ROAD_HALF, lz = p.z + nz * ROAD_HALF, rx = p.x - nx * ROAD_HALF, rz = p.z - nz * ROAD_HALF;
    const hl = height(lx, lz), hr = height(rx, rz), hc = height(p.x, p.z);
    const onBridge = bridges.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.length / 2 + 2);
    const keep = Math.min(hl, hr, hc) > WATER_LEVEL + 0.25 && !onBridge;
    if (!keep) { run = -1; continue; }
    const v = pos.length / 3;
    pos.push(lx, hl + ROAD_LIFT, lz, rx, hr + ROAD_LIFT, rz);
    uv.push(0, along / ROAD_TILE, 1, along / ROAD_TILE);
    if (run >= 0) idx.push(run, run + 1, v, run + 1, v + 1, v);
    run = v;
  }
  return { positions: new Float32Array(pos), uvs: new Float32Array(uv), indices: new Uint32Array(idx), points: pos.length / 6 };
}

export const allRoadRibbons = () => LANES.map((l) => roadRibbon(l));
