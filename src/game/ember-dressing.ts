/** Ember Peaks dressing (pure layout, no three.js): lava flows that run downhill from the crater rim, basalt column
 * clusters, obsidian spires, charred dead trees and steam/smoke fumaroles. EmberPeaks.tsx draws it.
 * Everything keeps off supply roads and out of the Smoldering Trench (its own set piece), and lava flows follow the real
 * terrain (steepest descent on heightAt) so the glow sits in the ground's own channels. Presentation only: the lava
 * flows do not hurt (the trench hazard is the region's lava damage rule). */
import { REGIONS, WORLD_SCALE } from "./world";
import { heightAt, slopeAt, WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { mulberry32 } from "./rng";
import { TRENCH_ZONE, trenchCentre } from "./set-pieces";

export type FlowPoint = { x: number; z: number; w: number };
export type Prop = { x: number; z: number; s: number; r: number; tilt: number };
export type Vent = { x: number; z: number; big: boolean };

export const ember = () => REGIONS.find((r) => r.id === "ember")!;
const S = Math.max(1, WORLD_SCALE);
/** world radius of the crater mouth (terrain.ts carves it over 7 base units) */
export const CRATER_R = 7 * S;

/** Is (x,z) fit for a prop: on land, off roads, out of the trench set piece, outside the crater mouth. */
export function placeable(x: number, z: number, clear = 2): boolean {
  const e = ember();
  if (Math.hypot(x - e.x, z - e.z) < CRATER_R * 1.15) return false;
  if (heightAt(x, z) < WATER_LEVEL + 0.5) return false;
  if (distanceToRoad(x, z) < LANE_HALF_WIDTH + clear) return false;
  const t = trenchCentre();
  if (Math.hypot(x - t.x, z - t.z) < TRENCH_ZONE.radius + clear) return false;
  return true;
}

export const FLOW_COUNT = 4;
/** Lava flows: start on the crater rim, step downhill along the steepest descent, narrow and stop as the slope flattens. */
export function lavaFlows(): FlowPoint[][] {
  const e = ember(), rnd = mulberry32(0xe11a);
  const flows: FlowPoint[][] = [];
  const step = 2.5;
  for (let f = 0; f < FLOW_COUNT; f++) {
    const a = (f / FLOW_COUNT) * Math.PI * 2 + rnd() * 0.8;
    let x = e.x + Math.cos(a) * CRATER_R * 1.05, z = e.z + Math.sin(a) * CRATER_R * 1.05;
    const pts: FlowPoint[] = [];
    let dirx = Math.cos(a), dirz = Math.sin(a);
    for (let i = 0; i < 70; i++) {
      const h = heightAt(x, z);
      // gradient by central differences; blend with the previous heading so the flow meanders instead of zig-zagging
      const gx = heightAt(x + 1, z) - heightAt(x - 1, z), gz = heightAt(x, z + 1) - heightAt(x, z - 1);
      const g = Math.hypot(gx, gz);
      if (g < 0.04 || h < WATER_LEVEL + 1) break;
      dirx = dirx * 0.6 - (gx / g) * 0.4; dirz = dirz * 0.6 - (gz / g) * 0.4;
      const dl = Math.hypot(dirx, dirz) || 1; dirx /= dl; dirz /= dl;
      const life = 1 - i / 70;
      pts.push({ x, z, w: (1.2 + 1.6 * life) * (0.85 + rnd() * 0.3) });
      x += dirx * step; z += dirz * step;
      const t = trenchCentre();
      if (distanceToRoad(x, z) < LANE_HALF_WIDTH || Math.hypot(x - t.x, z - t.z) < TRENCH_ZONE.radius) break;
    }
    if (pts.length >= 6) flows.push(pts);
  }
  return flows;
}

function scatter(count: number, seed: number, opts: { inner: number; outer: number; maxSlope: number; gap: number }): Prop[] {
  const e = ember(), rnd = mulberry32(seed), out: Prop[] = [];
  for (let guard = count * 20; out.length < count && guard-- > 0;) {
    const a = rnd() * Math.PI * 2, d = opts.inner + Math.sqrt(rnd()) * (opts.outer - opts.inner);
    const x = e.x + Math.cos(a) * d, z = e.z + Math.sin(a) * d;
    if (!placeable(x, z) || slopeAt(x, z) > opts.maxSlope) continue;
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < opts.gap)) continue;
    out.push({ x, z, s: 0.7 + rnd() * 0.8, r: rnd() * Math.PI * 2, tilt: (rnd() - 0.5) * 0.3 });
  }
  return out;
}

/** clusters of hexagonal basalt columns on the lower slopes */
export const basaltClusters = () => scatter(18, 0xba5a, { inner: CRATER_R * 1.6, outer: ember().radius * 0.9, maxSlope: 0.8, gap: 9 });
/** black glass spires near the cone */
export const obsidianSpires = () => scatter(26, 0x0b51, { inner: CRATER_R * 1.3, outer: ember().radius * 0.7, maxSlope: 1.1, gap: 5 });
/** burnt-out trees on the outer skirt where the forest used to be */
export const deadTrees = () => scatter(60, 0xdead, { inner: ember().radius * 0.55, outer: ember().radius * 0.98, maxSlope: 0.6, gap: 4 });

/** Fumaroles: one great plume over the crater plus steam vents on the flanks. */
export function vents(): Vent[] {
  const e = ember();
  return [{ x: e.x, z: e.z, big: true }, ...scatter(7, 0xf0e5, { inner: CRATER_R * 1.4, outer: ember().radius * 0.75, maxSlope: 0.9, gap: 14 }).map((p) => ({ x: p.x, z: p.z, big: false }))];
}
