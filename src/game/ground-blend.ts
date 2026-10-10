/** Ground colour blending helpers (pure, deterministic, no imports). terrain.ts bakes colour once per terrain vertex, so none of this runs per frame.
 * Goals: no ring-shaped biome edges, no contour-line slope seams, a soft skirt around the impact pit and a faint tide-mark where wet bank meets dry ground.
 * Callers pass already-sampled noise values (0..1), which keeps this file free of terrain/world imports and trivially testable. */
export const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix3 = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];

/** Biome edges follow the landform instead of a perfect circle: distance to a region centre is stretched/shrunk by up to +-AMOUNT using low-frequency noise (0..1, 0.5 = no change). */
export const BIOME_WARP = 0.14;
export const warpedDistance = (d: number, noise: number, amount = BIOME_WARP) => d * (1 + (noise - 0.5) * 2 * amount);

/** Slope thresholds jittered by noise so dirt and bare rock start at ragged, not constant-height, contours. `jitter` is in slope units. */
export const SLOPE_JITTER = 0.07;
export const jitteredSlope = (slope: number, noise: number, jitter = SLOPE_JITTER) => Math.max(0, slope + (noise - 0.5) * 2 * jitter);

/** Weight of the pit's turned-earth colour at `d` metres from the pit centre (R = the pit's authored radius). Soft smoothstep out to ~1.9R; the outer edge is broken by `noise`
 * (0..1) so the soil dissolves into the meadow in patches rather than as a disc. 1 in the bowl, 0 far away. */
export function pitSoilWeight(d: number, R: number, noise: number): number {
  const reach = R * (1.75 + 0.35 * noise);
  const base = 1 - smooth(R * 0.45, reach, d);
  const breakUp = 0.7 + 0.6 * noise; // 0.7..1.3 patchiness only where the weight is partial
  const patch = 1 + (breakUp - 1) * (1 - smooth(0.7, 1, base)); // patchiness fades in only as the soil thins, so the bowl stays solid and no step appears
  return Math.min(1, base * patch) * 0.85;
}

/** A band of loose rubble/lighter soil on the displaced-earth berm just outside the bowl (~1.1R), 0..1. */
export function pitRimWeight(d: number, R: number): number {
  const t = (d - R * 1.12) / (R * 0.4);
  return Math.exp(-t * t);
}
export const PIT_SOIL: [number, number, number] = [0.2, 0.15, 0.1];
export const PIT_RIM: [number, number, number] = [0.3, 0.24, 0.17];

/** Where wet ground fades into dry there is a faint tide-mark: a slightly sandy, dried-out fringe. `wet` is groundWetnessAt (0..1).
 * Zero when fully dry or fully wet, peaks at wet ~0.15. Subtle (<= 28% toward the fringe colour). */
export const BANK_FRINGE: [number, number, number] = [0.43, 0.38, 0.27];
export function bankFringe(c: [number, number, number], wet: number): [number, number, number] {
  const f = smooth(0, 0.08, wet) * (1 - smooth(0.12, 0.45, wet));
  return f <= 0 ? c : mix3(c, BANK_FRINGE, f * 0.28);
}

/** Gentle warm/cool drift so neighbouring patches differ in hue as well as brightness, without changing mean luminance much. `n` is 0..1 noise. */
export function hueDrift(c: [number, number, number], n: number, amount = 0.035): [number, number, number] {
  const t = (n - 0.5) * 2 * amount;
  return [c[0] + t, c[1] + t * 0.15, c[2] - t];
}
