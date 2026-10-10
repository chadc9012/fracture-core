/* Coastline: land and ocean follow the illustrated Fractured Earth painting, and every shore is either a beach or a sea cliff.
 *
 * The painting is traced into a coarse land/ocean mask (coast-mask.ts, built by scripts/build-coast-mask.py) and placed on the world
 * with the same fit the star map uses (map-art.ts), so the world and the map the player sees agree. From the mask this builds a signed
 * distance field in metres (positive inland, negative at sea); terrain.ts passes its landform height through `coastShape`, which
 * turns that distance into a shore profile:
 *   - beach: a gentle ramp up from the waterline and a shallow shelf offshore (sand, surf)
 *   - cliff: the land keeps its height right to the edge and drops steeply into the sea (rock, breakers)
 * Which one you get varies along the coast with a slow noise, biased by region (Frostspire/Ember lean cliff, Solara/Swamps lean beach),
 * and only where the land is actually high; low land is always beach.
 *
 * Authored places are never trusted to the traced mask: regions, landmarks, supply lanes, the Verdant route and Neon City are
 * stamped into the mask as land before the distance field is built (PROTECTED), and Thalassia stays open ocean.
 *
 * Pure and deterministic. Off at WORLD_SCALE 1 (the original disc world) and with ?coast=disc, for A/B checks. */
import { COAST_MASK } from "./coast-mask";
import { artRawForWorld, metresPerArtPercent, worldForArt } from "./map-art";
import { REGIONS, WORLD_SCALE, NEON_OFFSET } from "./world";
import { LANES, ROAD_SAMPLES, laneSamples } from "./lanes";
import { LANDMARKS } from "./landmarks";
import { TRAIL, FOREST_SPAWN, CRASH_SITE } from "./verdant";

function readEnabled(): boolean {
  if (WORLD_SCALE !== 4) return false; // tuned and tested for the default scale; other scales keep the disc
  try {
    if ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.["COAST"] === "disc") return false; // tests / tooling
    const q = typeof location !== "undefined" ? new URLSearchParams(location.search).get("coast") : null;
    if (q === "disc") return false;
  } catch { /* SSR / blocked */ }
  return true;
}
export const COASTLINE_ENABLED = readEnabled();

/** shore profile constants (metres) */
export const SHORE = { beachRise: 0.05, beachWidth: 110, shelfSlope: 0.09, cliffSlope: 1.8, restHeight: 1.3, deepBelowWater: 24, inland: 130, openSea: -330 } as const;

/* ---- mask -> distance field ---- */
const PAD = 10;
const COLS = COAST_MASK.cols + PAD * 2, ROWS = COAST_MASK.rows + PAD * 2;

function decodeMask(): Uint8Array {
  const grid = new Uint8Array(COLS * ROWS); // padding stays ocean
  const runs = COAST_MASK.runs.split(",").map((t) => parseInt(t, 36));
  let idx = 0, land = 0;
  for (const n of runs) {
    if (land) for (let k = 0; k < n; k++) { const i = idx + k, r = Math.floor(i / COAST_MASK.cols), c = i % COAST_MASK.cols; grid[(r + PAD) * COLS + c + PAD] = 1; }
    idx += n; land ^= 1;
  }
  return grid;
}

/** cell centre (grid coordinates incl. padding) -> world */
function cellWorld(c: number, r: number): { x: number; z: number } {
  const px = (c - PAD + 0.5) * COAST_MASK.cell, py = (r - PAD + 0.5) * COAST_MASK.cell;
  return worldForArt((px / COAST_MASK.srcW) * 100, (py / COAST_MASK.srcH) * 100);
}

/** Authored places stamped as land: [x, z, radius m] */
function protectedDiscs(): [number, number, number][] {
  const d: [number, number, number][] = [];
  for (const r of REGIONS) d.push([r.x, r.z, r.id === "nexus" ? r.radius + 45 : r.radius * 0.5]);
  for (const l of LANDMARKS) if (l.type !== "ocean" && l.regionId !== "thalassia") d.push([l.x, l.z, 45]);
  d.push([REGIONS.find((r) => r.id === "nexus")!.x + NEON_OFFSET.x, REGIONS.find((r) => r.id === "nexus")!.z + NEON_OFFSET.z, 130]);
  d.push([FOREST_SPAWN.x, FOREST_SPAWN.z, 70], [CRASH_SITE.x, CRASH_SITE.z, 60]);
  for (const p of TRAIL) d.push([p.x, p.z, 55]);
  for (const lane of LANES) for (const p of laneSamples(lane, ROAD_SAMPLES)) d.push([p.x, p.z, 26]);
  return d;
}

function chamfer(src: Uint8Array, target: 0 | 1, mx: number, my: number): Float32Array {
  // distance (metres) from every cell to the nearest cell whose value == target; 0 on target cells
  const INF = 1e9, w = [mx, my, Math.hypot(mx, my)] as const;
  const d = new Float32Array(COLS * ROWS);
  for (let i = 0; i < d.length; i++) d[i] = src[i] === target ? 0 : INF;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c; let v = d[i]!;
    if (c > 0) v = Math.min(v, d[i - 1]! + w[0]);
    if (r > 0) { v = Math.min(v, d[i - COLS]! + w[1]); if (c > 0) v = Math.min(v, d[i - COLS - 1]! + w[2]); if (c < COLS - 1) v = Math.min(v, d[i - COLS + 1]! + w[2]); }
    d[i] = v;
  }
  for (let r = ROWS - 1; r >= 0; r--) for (let c = COLS - 1; c >= 0; c--) {
    const i = r * COLS + c; let v = d[i]!;
    if (c < COLS - 1) v = Math.min(v, d[i + 1]! + w[0]);
    if (r < ROWS - 1) { v = Math.min(v, d[i + COLS]! + w[1]); if (c < COLS - 1) v = Math.min(v, d[i + COLS + 1]! + w[2]); if (c > 0) v = Math.min(v, d[i + COLS - 1]! + w[2]); }
    d[i] = v;
  }
  return d;
}

let sdf: Float32Array | null = null;
let cellM = { x: 5, y: 8.5 };

function build(): Float32Array {
  const mask = decodeMask();
  const mpp = metresPerArtPercent();
  cellM = { x: mpp.x * (COAST_MASK.cell / COAST_MASK.srcW) * 100, y: mpp.y * (COAST_MASK.cell / COAST_MASK.srcH) * 100 };
  // stamp protected places as land (only the cells inside each disc's box are visited)
  // each disc is widened by the beach width, so the beach ramp / sea cliff never reaches the authored ground inside it
  for (const [x, z, r0] of protectedDiscs()) {
    const rad = r0 + SHORE.beachWidth;
    const a = artRawForWorld(x, z);
    const cc = (a.x / 100) * COAST_MASK.srcW / COAST_MASK.cell + PAD, rr = (a.y / 100) * COAST_MASK.srcH / COAST_MASK.cell + PAD;
    const sx = Math.ceil(rad / cellM.x) + 2, sy = Math.ceil(rad / cellM.y) + 2;
    for (let r = Math.max(0, Math.floor(rr) - sy); r <= Math.min(ROWS - 1, Math.floor(rr) + sy); r++)
      for (let c = Math.max(0, Math.floor(cc) - sx); c <= Math.min(COLS - 1, Math.floor(cc) + sx); c++) {
        const w = cellWorld(c, r);
        if (Math.hypot(w.x - x, w.z - z) <= rad) mask[r * COLS + c] = 1;
      }
  }
  const toSea = chamfer(mask, 0, cellM.x, cellM.y);   // distance from land cells to the nearest ocean cell
  const toLand = chamfer(mask, 1, cellM.x, cellM.y);  // distance from ocean cells to the nearest land cell
  const out = new Float32Array(COLS * ROWS);
  const halfCell = Math.min(cellM.x, cellM.y) * 0.5;
  for (let i = 0; i < out.length; i++) out[i] = mask[i] ? toSea[i]! - halfCell : -(toLand[i]! - halfCell);
  return out;
}

/* ---- sampling ---- */
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Signed distance to the shore in metres: positive on land, negative at sea. The painted outline is warped a little so the coast is never a traced curve. */
export function coastDistance(x: number, z: number): number {
  if (!sdf) sdf = build();
  const wx = x + 11 * Math.sin(z * 0.021 + 1.3) + 5 * Math.sin(z * 0.057 + x * 0.03), wz = z + 11 * Math.sin(x * 0.019 + 0.4) + 5 * Math.sin(x * 0.051 - z * 0.03);
  const a = artRawForWorld(wx, wz);
  const u = (a.x / 100) * COAST_MASK.srcW / COAST_MASK.cell + PAD - 0.5, v = (a.y / 100) * COAST_MASK.srcH / COAST_MASK.cell + PAD - 0.5;
  const c0 = Math.min(COLS - 2, Math.max(0, Math.floor(u))), r0 = Math.min(ROWS - 2, Math.max(0, Math.floor(v)));
  const fu = Math.min(1, Math.max(0, u - c0)), fv = Math.min(1, Math.max(0, v - r0));
  const i = r0 * COLS + c0;
  const top = sdf[i]! + (sdf[i + 1]! - sdf[i]!) * fu, bot = sdf[i + COLS]! + (sdf[i + COLS + 1]! - sdf[i + COLS]!) * fu;
  return top + (bot - top) * fv;
}

/** 0 (beach) .. 1 (cliff) at a world position: slow noise along the coast, biased by the nearest region. */
const CLIFF_BIAS: Record<string, number> = { frostspire: 0.4, ember: 0.32, wastelands: 0.2, veridan: 0.05, solara: -0.25, swamps: -0.35, nexus: -0.2 };
export function cliffiness(x: number, z: number): number {
  let best = Infinity, bias = 0;
  for (const r of REGIONS) { const sc = Math.hypot(x - r.x, z - r.z) / r.radius; if (sc < best) { best = sc; bias = CLIFF_BIAS[r.id] ?? 0; } }
  const n = vnoise(x / 70, z / 70) * 0.7 + vnoise(x / 23 + 9, z / 23 - 4) * 0.3;
  return smooth(0.5, 0.62, n + bias);
}

/** The shore profile: `h` is the landform height (metres) at (x, z); returns the height with beaches and cliffs applied. */
export function coastShape(h: number, x: number, z: number, water: number): number {
  if (!COASTLINE_ENABLED) return h;
  const s = coastDistance(x, z);
  const deep = water - SHORE.deepBelowWater;
  if (s >= SHORE.inland) return h;
  if (s <= SHORE.openSea) return Math.min(h, deep);
  const rest = water + SHORE.restHeight;
  const c = cliffiness(x, z) * smooth(3, 9, h - water); // cliffs only where the land is high
  if (s >= 0) {
    const beach = Math.min(h, rest + SHORE.beachRise * s);
    const u = Math.max(c, smooth(SHORE.beachWidth * 0.36, SHORE.beachWidth, s));
    return beach + (h - beach) * u;
  }
  const shelf = Math.max(deep, rest + SHORE.shelfSlope * s);
  const beachSea = Math.min(h, shelf);
  const cliffSea = Math.min(h, Math.max(h + SHORE.cliffSlope * s, shelf));
  return beachSea + (cliffSea - beachSea) * c;
}
