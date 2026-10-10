/** Vertex layout for the water surface patch. The old patch was a uniform 300 x 300 grid (8 m spacing over 2400 m = 180k triangles at every quality
 * tier), although the waves are only readable near the camera and everything far away sits in fog. This is a tensor grid: the same 8 m spacing
 * inside `innerHalf` metres of the camera, then spacing that grows geometrically out to `outerHalf`. Inner coordinates are exact multiples of
 * `step`, so the patch can keep snapping to the world lattice and the near waves never swim. Shoreline colour/foam come from the fragment shader
 * (baked depth texture), so shore alignment does not depend on vertex density. Pure so the counts are testable without a GPU. */
import type { RenderTier } from "./performance";

export const WATER_STEP = 8;
export const WATER_OUTER_HALF = 1200;
export const WATER_GROWTH = 1.2;
/** Coarsest spacing anywhere: keeps the 70 m swell sampled (>= ~1 sample per wavelength) out to the edge of the patch. */
export const WATER_MAX_SPACING = 64;
/** Half-width (metres) of the full-density zone per tier. The old behaviour was 1200 (everything) at every tier. */
export const WATER_INNER_HALF: Record<RenderTier, number> = { LOW: 250, MEDIUM: 400, HIGH: 500, ULTRA: 600 };

/** Sorted, symmetric axis coordinates from -outerHalf to +outerHalf. */
export function waterAxis(innerHalf: number, step = WATER_STEP, outerHalf = WATER_OUTER_HALF, growth = WATER_GROWTH): number[] {
  const inner = Math.max(step, Math.floor(innerHalf / step) * step);
  const half: number[] = [];
  for (let c = 0; c <= inner; c += step) half.push(c);
  let c = inner, s = step;
  while (c < outerHalf) { s = Math.min(WATER_MAX_SPACING, s * growth); c = Math.min(outerHalf, c + s); half.push(c); }
  const out: number[] = [];
  for (let i = half.length - 1; i > 0; i--) out.push(-half[i]!);
  for (const v of half) out.push(v);
  return out;
}

export function waterTriangles(axis: readonly number[]): number { const n = axis.length - 1; return 2 * n * n; }

/** Positions as (x, y, 0) in the plane's local space (the mesh is rotated flat), row-major, plus a triangle index. */
export function waterGrid(axis: readonly number[]): { positions: Float32Array; index: Uint32Array } {
  const n = axis.length, positions = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = (j * n + i) * 3; positions[k] = axis[i]!; positions[k + 1] = -axis[j]!; positions[k + 2] = 0; }
  const index = new Uint32Array((n - 1) * (n - 1) * 6);
  let w = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    index[w++] = a; index[w++] = c; index[w++] = b; index[w++] = b; index[w++] = c; index[w++] = d;
  }
  return { positions, index };
}
