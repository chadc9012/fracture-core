/** The near grass field (Stage 45/46 ground pass): the reference photographs carpet the ground in grass, but the world is so big
 * that region-wide scatter (ground-cover.ts) is only a few plants per tennis court. This lays dense grass clumps in 16 m chunks
 * around the camera, chunk by chunk, so the ground right around the player is always full and the cost stays fixed however
 * big the map is. Each region grows its own grass: lush green in the Verdant Forest, golden in Solara, sparse dry tufts in the
 * Wastelands and Ember, tall wet grass in the Swamps, a mown lawn edge in Nexus; nothing on snow, in Neon City, on roads,
 * rivers, the mission pads or house floors (ground-cover.ts placeable).
 *
 * Pure and deterministic: a chunk always grows the same clumps, so walking away and back changes nothing. GrassField.tsx draws it. */
import { regionAt } from "./world";
import { WATER_LEVEL, heightAt, neonPlateauWeight, solaraValley } from "./terrain";
import { placeable } from "./ground-cover";
import type { RenderTier } from "./performance";

export const CHUNK = 16;
export type GrassSpec = { /** clumps per chunk at full density */ perChunk: number; /** blade height range (m) */ h: [number, number]; /** clump width (m) */ w: [number, number]; colors: readonly string[]; /** fraction of clumps kept where the patch noise is low (bare ground between meadows) */ patchy: number; maxSlope: number; /** never above this height (snow line) */ maxH?: number };
export const GRASS: Readonly<Record<string, GrassSpec>> = {
  veridan: { perChunk: 150, h: [0.45, 0.95], w: [0.8, 1.3], colors: ["#6fa83c", "#86b848", "#5c9436", "#9ac35a", "#7aa944"], patchy: 0.25, maxSlope: 0.7 },
  solara: { perChunk: 110, h: [0.4, 0.85], w: [0.7, 1.2], colors: ["#c9b36a", "#d8c27a", "#b59e58", "#a7b05e", "#e0cd8a"], patchy: 0.35, maxSlope: 0.6 },
  wastelands: { perChunk: 34, h: [0.3, 0.6], w: [0.5, 0.9], colors: ["#a68f5c", "#8f7f50", "#b8a06a"], patchy: 0.6, maxSlope: 0.5 },
  swamps: { perChunk: 140, h: [0.7, 1.4], w: [0.7, 1.2], colors: ["#5f7a3a", "#6f8a42", "#4f6a34", "#7a8f48"], patchy: 0.2, maxSlope: 0.5 },
  ember: { perChunk: 14, h: [0.25, 0.5], w: [0.4, 0.8], colors: ["#5a4a3a", "#6a5440", "#4a3c30"], patchy: 0.7, maxSlope: 0.5 },
  frostspire: { perChunk: 40, h: [0.25, 0.5], w: [0.5, 0.9], colors: ["#8a9a72", "#a2ae86", "#7c8c6a"], patchy: 0.55, maxSlope: 0.5, maxH: 22 },
  // Solara's green river valley: lush, tall grass by the water
  "solara-valley": { perChunk: 160, h: [0.5, 1.05], w: [0.8, 1.3], colors: ["#6fa83c", "#86b848", "#7aa944", "#9ac35a", "#a7b05e"], patchy: 0.15, maxSlope: 0.7 },
  nexus: { perChunk: 60, h: [0.18, 0.35], w: [0.6, 1.0], colors: ["#6fa040", "#7cae4a", "#62923a"], patchy: 0.3, maxSlope: 0.4 },
};
/** how far the field reaches and how dense it is, per tier (LOW draws none) */
export const GRASS_REACH: Record<RenderTier, { chunks: number; density: number }> = { LOW: { chunks: 0, density: 0 }, MEDIUM: { chunks: 3, density: 0.6 }, HIGH: { chunks: 4, density: 1 }, ULTRA: { chunks: 5, density: 1.25 } };

export type Clump = { x: number; y: number; z: number; h: number; w: number; r: number; color: string };

function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const chunkSeed = (cx: number, cz: number) => (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 0x5bd1e995) >>> 0;
/** soft meadow patches: 0..1 */
const patch = (x: number, z: number) => 0.5 + 0.25 * Math.sin(x * 0.045 + Math.sin(z * 0.03) * 2) + 0.25 * Math.sin(z * 0.052 - Math.cos(x * 0.027) * 2);

/** the chunk index containing a world position */
export const chunkOf = (x: number, z: number) => ({ cx: Math.floor(x / CHUNK), cz: Math.floor(z / CHUNK) });
/** chunk indices within `reach` chunks of the camera's chunk (a square ring, nearest first) */
export function chunksAround(x: number, z: number, reach: number): { cx: number; cz: number }[] {
  const { cx, cz } = chunkOf(x, z), out: { cx: number; cz: number; d: number }[] = [];
  for (let i = -reach; i <= reach; i++) for (let j = -reach; j <= reach; j++) out.push({ cx: cx + i, cz: cz + j, d: i * i + j * j });
  return out.sort((a, b) => a.d - b.d).map(({ cx: a, cz: b }) => ({ cx: a, cz: b }));
}

const H_STEP = 4, H_N = CHUNK / H_STEP + 1; // height samples: a 5x5 grid per chunk (heightAt is ~0.2 ms a call)
const OK_STEP = 2, OK_N = CHUNK / OK_STEP; // placement rules on a 2 m grid (roads, rivers, pads, house floors)

/** the clumps one chunk grows (deterministic). Height and slope come from a coarse per-chunk grid (bilinear), so a chunk
 * costs ~25 terrain samples instead of one per clump; blades are short and sink a little, so the 4 m grid never shows. */
export function chunkClumps(cx: number, cz: number, density = 1): Clump[] {
  const r = rng(chunkSeed(cx, cz)), out: Clump[] = [];
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  const mid = regionAt(x0 + CHUNK / 2, z0 + CHUNK / 2);
  const specAt = (x: number, z: number, id: string | undefined) => (id === "solara" && solaraValley(x, z) > 0.45 ? GRASS["solara-valley"] : GRASS[id ?? ""]);
  const want = Math.round((specAt(x0 + CHUNK / 2, z0 + CHUNK / 2, mid?.id)?.perChunk ?? 0) * density);
  if (!want) return out;
  if (neonPlateauWeight(x0 + CHUNK / 2, z0 + CHUNK / 2) > 0.5) return out;
  const hs = new Float32Array(H_N * H_N);
  for (let j = 0; j < H_N; j++) for (let i = 0; i < H_N; i++) hs[j * H_N + i] = heightAt(x0 + i * H_STEP, z0 + j * H_STEP);
  const ok = new Uint8Array(OK_N * OK_N);
  for (let j = 0; j < OK_N; j++) for (let i = 0; i < OK_N; i++) { const px = x0 + (i + 0.5) * OK_STEP, pz = z0 + (j + 0.5) * OK_STEP; ok[j * OK_N + i] = placeable(px, pz, "flower", regionAt(px, pz)) ? 1 : 0; }
  const hAt = (x: number, z: number) => {
    const fx = (x - x0) / H_STEP, fz = (z - z0) / H_STEP, i = Math.min(H_N - 2, Math.floor(fx)), j = Math.min(H_N - 2, Math.floor(fz)), u = fx - i, v = fz - j;
    const a = hs[j * H_N + i]!, b = hs[j * H_N + i + 1]!, c = hs[(j + 1) * H_N + i]!, d = hs[(j + 1) * H_N + i + 1]!;
    return { y: (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v, slope: Math.hypot((b - a) * (1 - v) + (d - c) * v, (c - a) * (1 - u) + (d - b) * u) / H_STEP };
  };
  for (let i = 0; i < want; i++) {
    const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK, roll = r(), hk = r(), wk = r(), rot = r(), ck = r();
    const region = regionAt(x, z), spec = region ? specAt(x, z, region.id) : undefined;
    if (!spec) continue;
    if (patch(x, z) < spec.patchy && roll < 0.8) continue; // bare ground between the meadows
    if (!ok[Math.min(OK_N - 1, Math.floor((z - z0) / OK_STEP)) * OK_N + Math.min(OK_N - 1, Math.floor((x - x0) / OK_STEP))]) continue;
    const { y, slope } = hAt(x, z);
    if (y < WATER_LEVEL + 0.4 || (spec.maxH !== undefined && y > spec.maxH)) continue;
    if (slope > spec.maxSlope) continue;
    out.push({ x, y, z, h: spec.h[0] + hk * (spec.h[1] - spec.h[0]), w: spec.w[0] + wk * (spec.w[1] - spec.w[0]), r: rot * Math.PI, color: spec.colors[Math.floor(ck * spec.colors.length)]! });
  }
  return out;
}
