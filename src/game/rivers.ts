/**
 * Natural water networks (pure, deterministic). Rivers are traced DOWNHILL on the uncarved
 * heightmap from a source high in each region; they end in the ocean, or in a basin where they
 * form a lake. Waterfalls are placed only where the traced surface genuinely drops steeply.
 * terrain.ts carves the beds into heightAt, so every system walks the same ground.
 */
import { REGIONS } from "./world";

export type RiverPoint = { x: number; z: number; /** water surface height */ s: number; /** half width */ w: number; /** bed depth below surface */ d: number };
export type Waterfall = { x: number; z: number; top: number; bottom: number; dirX: number; dirZ: number; w: number };
export type Lake = { x: number; z: number; level: number; r: number };
export type River = {
  id: string;
  regionId: string;
  /** dry wash: carved channel but no water (scarce-water regions) */
  dry: boolean;
  points: RiverPoint[];
  falls: Waterfall[];
  /** "ocean" if it reaches the sea, "lake" if it pools in a basin */
  mouth: "ocean" | "lake";
  /** metres per second of surface flow, per point */
  speed: number[];
};
export type WaterNetwork = { rivers: River[]; lakes: Lake[] };

type H = (x: number, z: number) => number;

/** authored character per region: width, depth, whether it carries water */
const RIVER_SPEC: { regionId: string; w: number; d: number; dry: boolean }[] = [
  { regionId: "frostspire", w: 2.6, d: 1.4, dry: false }, // snowmelt stream off the peaks
  { regionId: "veridan", w: 3.2, d: 1.5, dry: false },    // clear forest river
  { regionId: "ember", w: 2.2, d: 1.2, dry: false },      // dark mineral stream off the cone
  { regionId: "swamps", w: 4.2, d: 0.9, dry: false },     // slow, wide bog channel
  { regionId: "wastelands", w: 3, d: 1.1, dry: true },    // dry wash
];

export const STEP = 3;
const FALL_GRADE = 0.5;      // drop per metre that counts as a cliff
const FALL_MIN_DROP = 3;     // total drop before a steep run is a waterfall

/** highest point in the inner part of a region — a plausible spring */
function findSource(h: H, rx: number, rz: number, radius: number): { x: number; z: number } {
  let best = { x: rx, z: rz }, bh = -Infinity;
  const r = radius * 0.6;
  for (let gx = -r; gx <= r; gx += 4) for (let gz = -r; gz <= r; gz += 4) {
    if (gx * gx + gz * gz > r * r) continue;
    const v = h(rx + gx, rz + gz);
    if (v > bh) { bh = v; best = { x: rx + gx, z: rz + gz }; }
  }
  return best;
}

/** springs rise on the upper slopes, not on the summit: walk down to ~60% of the peak's height */
function springBelow(h: H, x: number, z: number, sea: number) {
  const top = h(x, z), want = sea + (top - sea) * 0.6;
  for (let i = 0; i < 40 && h(x, z) > want; i++) {
    let ba = 0, bv = Infinity;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; const v = h(x + Math.cos(a) * 3, z + Math.sin(a) * 3); if (v < bv) { bv = v; ba = a; } }
    x += Math.cos(ba) * 3; z += Math.sin(ba) * 3;
  }
  return { x, z };
}

/** fit a lake into the basin at (x,z): the surface stops where the rim encloses it */
export function fitLake(h: H, x: number, z: number): Lake {
  const pit = h(x, z);
  let level = pit + 1.2;
  const ring = (r: number) => { let m = Infinity; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; m = Math.min(m, h(x + Math.cos(a) * r, z + Math.sin(a) * r)); } return m; };
  for (let r = 1.5; r <= 12; r += 0.5) if (ring(r) >= level) return { x, z, level, r };
  // leaky basin: lower the surface until a small rim holds it
  level = Math.max(pit + 0.25, ring(3) - 0.1);
  return { x, z, level, r: 3 };
}

export function traceRiver(h: H, id: string, regionId: string, sx: number, sz: number, spec: { w: number; d: number; dry: boolean }, sea: number): { river: River; lake: Lake | null } {
  const pts: RiverPoint[] = [];
  let x = sx, z = sz;
  // initial direction: steepest descent
  let dir = 0, lowest = Infinity;
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const v = h(x + Math.cos(a) * 6, z + Math.sin(a) * 6); if (v < lowest) { lowest = v; dir = a; } }
  let surface = h(x, z) - 0.3;
  let mouth: River["mouth"] = "lake";
  for (let step = 0; step < 240; step++) {
    const g = h(x, z);
    surface = Math.min(surface, g - 0.25); // never flows uphill
    const grow = Math.min(1.6, 1 + step / 120);
    pts.push({ x, z, s: surface, w: spec.w * grow, d: spec.d });
    if (g < sea) { mouth = "ocean"; break; }
    // choose the lowest heading near the current one (keeps meanders smooth)
    let bestA = dir, bestV = Infinity;
    for (const off of [0, -0.3, 0.3, -0.6, 0.6, -0.95, 0.95, -1.4, 1.4]) {
      const a = dir + off;
      const v = h(x + Math.cos(a) * STEP * 2, z + Math.sin(a) * STEP * 2) + Math.abs(off) * 0.15;
      if (v < bestV) { bestV = v; bestA = a; }
    }
    if (bestV > g + 0.4) {
      // basin: spill over the lowest nearby saddle if one leads lower, else pool into a lake here
      let spill: { a: number; v: number } | null = null;
      for (let r = 6; r <= 48 && !spill; r += 3) for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const v = h(x + Math.cos(a) * r, z + Math.sin(a) * r);
        if (v < g - 0.3 && (!spill || v < spill.v)) spill = { a, v };
      }
      if (!spill || step > 200 || g - surface > 6) break; // never cut an implausibly deep gorge
      dir = spill.a;
      x += Math.cos(dir) * STEP; z += Math.sin(dir) * STEP;
      continue;
    }
    dir = dir + (bestA - dir) * 0.6;
    x += Math.cos(dir) * STEP; z += Math.sin(dir) * STEP;
  }
  const last = pts[pts.length - 1]!;
  const lake = mouth === "lake" && !spec.dry ? fitLake(h, last.x, last.z) : null;
  if (lake) for (const p of pts.slice(-4)) p.s = Math.max(Math.min(p.s, lake.level + 0.4), lake.level);

  // waterfalls: consecutive steep steps merged until they make a real drop (max ~9 m per fall,
  // so a long mountain face becomes a cascade of falls and rapids, not one impossible plunge)
  const falls: Waterfall[] = [];
  const speed: number[] = pts.map((p, k) => k === 0 ? 0.6 : 0.6 + Math.min(2.4, Math.max(0, (pts[k - 1]!.s - p.s) / STEP) * 6));
  let lip = -1;
  for (let k = 1; k < pts.length; k++) {
    const grade = (pts[k - 1]!.s - pts[k]!.s) / STEP;
    if (grade >= FALL_GRADE) {
      if (lip < 0) lip = k - 1;
      speed[k] = 3;
      const drop = pts[lip]!.s - pts[k]!.s;
      const end = k === pts.length - 1 || (pts[k]!.s - pts[k + 1]!.s) / STEP < FALL_GRADE || drop >= 9;
      if (end) {
        if (drop >= FALL_MIN_DROP && !spec.dry) {
          const a = pts[lip]!, b = pts[k]!;
          const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
          falls.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, top: a.s, bottom: b.s, dirX: dx / len, dirZ: dz / len, w: a.w * 0.9 });
        }
        lip = -1;
      }
    } else lip = -1;
  }
  return { river: { id, regionId, dry: spec.dry, points: pts, falls, mouth, speed }, lake };
}

/** basin pools: e.g. a Solara oasis in the lowest dune hollow that still sits above the sea */
function oasis(h: H, regionId: string, sea: number): Lake | null {
  const r = REGIONS.find((q) => q.id === regionId);
  if (!r) return null;
  let best = { x: r.x, z: r.z }, bv = Infinity;
  const rad = r.radius * 0.55;
  for (let gx = -rad; gx <= rad; gx += 3) for (let gz = -rad; gz <= rad; gz += 3) {
    if (gx * gx + gz * gz > rad * rad) continue;
    const v = h(r.x + gx, r.z + gz);
    if (v > sea + 1.5 && v < bv) { bv = v; best = { x: r.x + gx, z: r.z + gz }; }
  }
  if (!isFinite(bv)) return null;
  const lake = fitLake(h, best.x, best.z);
  return lake.r >= 2 ? lake : null;
}

export function buildWaterNetwork(h: H, sea: number): WaterNetwork {
  const rivers: River[] = [];
  const lakes: Lake[] = [];
  for (const spec of RIVER_SPEC) {
    const r = REGIONS.find((q) => q.id === spec.regionId);
    if (!r) continue;
    const peak = findSource(h, r.x, r.z, r.radius);
    const src = springBelow(h, peak.x, peak.z, sea);
    const { river, lake } = traceRiver(h, `river-${spec.regionId}`, spec.regionId, src.x, src.z, spec, sea);
    if (river.points.length < 8) continue; // a spring that goes nowhere is not a river
    rivers.push(river);
    if (lake) lakes.push(lake);
  }
  const o = oasis(h, "solara", sea);
  if (o) lakes.push(o);
  return { rivers, lakes };
}

/** carve profile: how far below the natural ground the bed sits at distance `dist` from the centre line */
export function carveTarget(base: number, surface: number, halfW: number, depth: number, dist: number): number {
  const bank = 6;
  if (dist >= halfW + bank) return base;
  const bed = surface - depth;
  const inChannel = dist < halfW ? bed + (dist / halfW) ** 2 * (depth + 0.3) : surface + 0.3;
  const t = dist < halfW ? 1 : 1 - (dist - halfW) / bank;
  const blend = t * t * (3 - 2 * t);
  const target = base + (inChannel - base) * blend;
  return Math.min(base, target); // only ever lowers the ground
}
