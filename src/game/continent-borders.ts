/** Continent borders on the one map (Stage 151): which continent world a point belongs to, how far it is from the
 * nearest border, and the strait of open sea carved along every border (terrain.ts) so the continents are separate
 * landmasses. Pure, and imports only world.ts so terrain.ts can use it without a cycle (planet.ts re-exports the anchors). */
import { NEON_FADE, NEON_FLAT, NEON_SITE, REGIONS } from "./world";

/** a continent's pull on the map: the map point belongs to the anchor with the least (distance − weight) */
export type Anchor = { x: number; z: number; w: number };
const R = (id: string) => REGIONS.find((r) => r.id === id)!;
const at = (id: string, w: number): Anchor => ({ x: R(id).x, z: R(id).z, w });
/** Weights are tuned so every border runs through open country between cities, never through one, and (Stage 151) so
 * every authored site stands at least STRAIT_CLEAR + 16 m from a strait (planet.test.ts checks
 * every region centre, Neon City's whole plateau, the Nexus hub and its suburb, and every landmark). */
export const WORLD_ANCHORS: Readonly<Record<string, readonly Anchor[]>> = {
  aetheria: [at("nexus", 179), { x: R("nexus").x, z: R("nexus").z + 155, w: 168 }],
  noctyra: [{ x: NEON_SITE.x, z: NEON_SITE.z, w: 264 }],
  veyloria: [at("veridan", 274)],
  sylvaris: [at("swamps", 193)],
  kharos: [at("solara", 264), at("wastelands", 252)],
  frosthelm: [at("frostspire", 240)],
  pyrrath: [at("ember", 283)],
};
export type AnchorWorld = keyof typeof WORLD_ANCHORS;

/** Landmasses: continents that share one (no sea between them). Owner, Oct 25 2026: Neon City stays where it is, beside
 * Nexus, so Aetheria and Noctyra keep a land border (the invisible line); every other pair is split by sea. */
export const LANDMASS: Readonly<Record<string, string>> = { aetheria: "meridian", noctyra: "meridian" };
const massOf = (id: string) => LANDMASS[id] ?? id;

type Near = { id: AnchorWorld; s: number; ux: number; uz: number };
/** the closest continent world by anchor score (distance − weight) and the closest one on another landmass, each with
 * the unit direction from its winning anchor; a strait runs where the two scores are equal */
export function nearestTwo(x: number, z: number): { a: Near; b: Near } {
  const per: Near[] = [];
  for (const id in WORLD_ANCHORS) {
    let best: Near | null = null;
    for (const an of WORLD_ANCHORS[id]!) {
      const dx = x - an.x, dz = z - an.z, d = Math.hypot(dx, dz) || 1e-6, sc = d - an.w;
      if (!best || sc < best.s) best = { id: id as AnchorWorld, s: sc, ux: dx / d, uz: dz / d };
    }
    per.push(best!);
  }
  per.sort((p, q) => p.s - q.s);
  // the nearest landmass is the nearest world's; its own nearest member stands for it, the other side is the best world elsewhere
  const a = per[0]!, b = per.find((p) => massOf(p.id) !== massOf(a.id)) ?? a;
  return { a, b };
}
/* The border distance field: landmass labels rasterised on a grid, then an exact Euclidean distance transform from the
 * cells on a border between two landmasses, read back with bilinear interpolation. Continuous everywhere (an anchor-score
 * estimate jumps where the nearest anchor or neighbour switches, which would tear the terrain). Built once, lazily. */
const FIELD_CELL = 4;
/** metres the straits wander either side of the straight border line */
export const BORDER_WOBBLE = 14;
const FIELD_HALF = 1500;
const FIELD_N = Math.ceil((FIELD_HALF * 2) / FIELD_CELL) + 1;
let field: Float32Array | null = null;
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, zz: Float64Array) {
  let k = 0; v[0] = 0; zz[0] = -Infinity; zz[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let sx = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (sx <= zz[k]!) { k--; sx = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!); }
    k++; v[k] = q; zz[k] = sx; zz[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (zz[k + 1]! < q) k++; d[q] = (q - v[k]!) ** 2 + f[v[k]!]!; }
}
function buildField(): Float32Array {
  const N = FIELD_N, lab = new Int32Array(N * N), ids = new Map<string, number>();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const m = massOf(nearestTwo(-FIELD_HALF + i * FIELD_CELL, -FIELD_HALF + j * FIELD_CELL).a.id);
    if (!ids.has(m)) ids.set(m, ids.size);
    lab[j * N + i] = ids.get(m)!;
  }
  const BIG = 1e12, g = new Float64Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const l = lab[j * N + i]!;
    const edge = (i + 1 < N && lab[j * N + i + 1] !== l) || (j + 1 < N && lab[(j + 1) * N + i] !== l) || (i > 0 && lab[j * N + i - 1] !== l) || (j > 0 && lab[(j - 1) * N + i] !== l);
    g[j * N + i] = edge ? 0 : BIG;
  }
  const f = new Float64Array(N), d = new Float64Array(N), v = new Int32Array(N), zz = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) { for (let j = 0; j < N; j++) f[j] = g[j * N + i]!; edt1d(f, N, d, v, zz); for (let j = 0; j < N; j++) g[j * N + i] = d[j]!; }
  for (let j = 0; j < N; j++) { for (let i = 0; i < N; i++) f[i] = g[j * N + i]!; edt1d(f, N, d, v, zz); for (let i = 0; i < N; i++) g[j * N + i] = d[i]!; }
  const out = new Float32Array(N * N);
  // edge cells sit either side of the line: the line is half a cell from their centres
  for (let k = 0; k < N * N; k++) out[k] = Math.max(0, Math.sqrt(g[k]!) * FIELD_CELL - FIELD_CELL / 2);
  return out;
}
/** tooling: drop the distance field after editing WORLD_ANCHORS weights (it rebuilds on the next read) */
export const resetBorderField = () => { field = null; };
/** metres from (x, z) to the nearest border between two landmasses (Infinity past the field: open ocean) */
export function borderDistance(x: number, z: number): number {
  if (!field) field = buildField();
  // the field is read through a gentle warp so the straits meander like real coasts instead of running ruler-straight
  const wx = BORDER_WOBBLE * (Math.sin(x * 0.0113 + z * 0.0061) + 0.6 * Math.sin(z * 0.0187 - x * 0.0079 + 1.3)) / 1.6;
  const wz = BORDER_WOBBLE * (Math.sin(z * 0.0109 - x * 0.0057 + 2.1) + 0.6 * Math.sin(x * 0.0171 + z * 0.0083 - 0.7)) / 1.6;
  const fx = (x + wx + FIELD_HALF) / FIELD_CELL, fz = (z + wz + FIELD_HALF) / FIELD_CELL;
  if (fx < 0 || fz < 0 || fx >= FIELD_N - 1 || fz >= FIELD_N - 1) return Infinity;
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, N = FIELD_N;
  const a = field[j * N + i]!, b = field[j * N + i + 1]!, c = field[(j + 1) * N + i]!, e = field[(j + 1) * N + i + 1]!;
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz;
}

/** the strait: open water this far either side of a border, then a sloped beach up to the land */
export const STRAIT_WATER = 26;
export const STRAIT_SHORE = 30;
/** the strait's bed, below the sea */
export const STRAIT_DEPTH = 6;
/** 1 in the strait's open water, falling to 0 at the top of its beach */
export function straitWeight(x: number, z: number): number {
  // Neon City stays put (owner): the sea stops at its plateau, so the city is never cut; the land there is a border line
  const dn = Math.hypot(x - NEON_SITE.x, z - NEON_SITE.z);
  if (dn < NEON_KEEP) return 0;
  const keep = dn < NEON_KEEP + NEON_KEEP_FADE ? smooth((dn - NEON_KEEP) / NEON_KEEP_FADE) : 1;
  const d = borderDistance(x, z);
  if (d >= STRAIT_WATER + STRAIT_SHORE) return 0;
  if (d <= STRAIT_WATER) return keep;
  return keep * (1 - smooth((d - STRAIT_WATER) / STRAIT_SHORE));
}
const smooth = (t: number) => t * t * (3 - 2 * t);
/** the sea keeps this far from Neon City's centre (its plateau and fade), easing in over the next stretch */
export const NEON_KEEP = NEON_FLAT + NEON_FADE;
export const NEON_KEEP_FADE = 60;
/** the steepest the strait's banks run (rise per metre): land near a strait is capped under this slope from the open
 * water's edge, so a tall forest or mountain meets the sea as a steep bank, never a step */
export const STRAIT_SLOPE = 0.9;
/** the highest the ground may stand here, metres above the strait's bed (Infinity away from every strait) */
export function straitCeiling(x: number, z: number): number {
  const dn = Math.hypot(x - NEON_SITE.x, z - NEON_SITE.z);
  if (dn < NEON_KEEP) return Infinity;
  const d = borderDistance(x, z);
  const lift = dn < NEON_KEEP + NEON_KEEP_FADE ? (1 - smooth((dn - NEON_KEEP) / NEON_KEEP_FADE)) * 400 : 0;
  const c = Math.max(0, d - STRAIT_WATER) * STRAIT_SLOPE + lift;
  return c > 400 ? Infinity : c;
}
/** land stays this far back from a border (roads end, gates and props stay clear) */
export const STRAIT_CLEAR = STRAIT_WATER + STRAIT_SHORE;
