/** Ground wetness near water (pure, deterministic, no per-frame cost: it is sampled once when the terrain colour is baked).
 * 0 = dry, 1 = saturated. Three sources: the river channel and its banks, the rim of a lake or pond, and the spray zone around a waterfall's plunge pool.
 * `wetTint` darkens and cools the base ground colour toward damp mud; steep bare rock only darkens (it does not turn to mud). */
import { RIVER_SCALE } from "./rivers";

const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** damp margin outside the water edge (metres): a river bank stays wet for a few strides, a lake rim a little further */
export const BANK_WET = 3.5 * RIVER_SCALE;
export const LAKE_WET = 4 * RIVER_SCALE;
export const SPRAY_CORE = 5 * RIVER_SCALE;
export const SPRAY_REACH = 14 * RIVER_SCALE;

export type WetInputs = {
  /** distance to the nearest river centre line and that point's half width */
  river?: { dist: number; w: number } | null;
  /** distance from the lake centre and its radius */
  lake?: { dist: number; r: number } | null;
  /** distance to the nearest waterfall base */
  fall?: number | null;
};

export function wetnessAt(i: WetInputs): number {
  let w = 0;
  if (i.river) w = Math.max(w, 1 - smooth(i.river.w * 0.9, i.river.w + BANK_WET, i.river.dist));
  if (i.lake) w = Math.max(w, 1 - smooth(i.lake.r * 0.9, i.lake.r + LAKE_WET, i.lake.dist));
  if (i.fall != null) w = Math.max(w, 0.9 * (1 - smooth(SPRAY_CORE, SPRAY_REACH, i.fall)));
  return Math.min(1, Math.max(0, w));
}

export const MUD: [number, number, number] = [0.27, 0.23, 0.18];

/** `rock` 0..1 is how much of the surface is bare rock (from the slope mask); rock darkens, soil goes muddy. Subtle by design: at most ~55% toward mud. */
export function wetTint(c: [number, number, number], wet: number, rock = 0): [number, number, number] {
  if (wet <= 0) return c;
  const mud = wet * 0.55 * (1 - rock * 0.9);
  const dark = 1 - wet * (0.1 + 0.1 * rock);
  return [(c[0] + (MUD[0] - c[0]) * mud) * dark, (c[1] + (MUD[1] - c[1]) * mud) * dark, (c[2] + (MUD[2] - c[2]) * mud) * dark * 1.02];
}
