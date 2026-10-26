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

/* ---------------- rain wetness over time (ground, roads and leaves after a shower) ----------------
 * The weather is a pure function of the day clock (weather-cycle.ts + environment.ts), so how wet the ground is can be worked out from
 * the recent rain alone: it soaks in fast while it rains and dries slowly afterwards (faster under the sun and in hot regions, slower
 * at night and in the swamp). Scene steps it each frame and re-seeds it from the history after a clock jump. Units are game hours.
 * The bank wetness above is baked into the terrain colour; this one is live and drives the ground/street/foliage shaders. */

/** hours of full rain to soak dry ground through, and hours for soaked ground to dry in full sun (mild climate) */
export const RAIN_SOAK_HOURS = 0.8;
export const DRY_HOURS = 5;
/** how far back the history seed looks (hours); older rain has always dried by then */
export const WET_HISTORY_HOURS = 12;

/** per-region drying speed: deserts bake dry, the bog stays wet */
export const REGION_DRYING: Record<string, number> = { solara: 2.4, wastelands: 1.9, ember: 2.6, veridan: 0.85, swamps: 0.45, frostspire: 0.6, nexus: 1.2 };

/** only rain wets the ground: snow (Frostspire, cold fronts) and ash (Ember) fall as `precipitation` too, under other labels */
export function rainFall(label: string | undefined, precipitation: number): number {
  return label === "Rain mist" ? Math.min(1, Math.max(0, precipitation)) : 0;
}

/** advance ground wetness `wet` (0..1) by `hours` of game time under `rain` (0..1). `sun` 0 night .. 1 clear noon. */
export function stepGroundWetness(wet: number, rain: number, hours: number, sun = 0.6, regionId?: string): number {
  let w = Math.min(1, Math.max(0, wet));
  if (!(hours > 0)) return w;
  const r = Math.min(1, Math.max(0, rain));
  if (r > 0.02) w += (r / RAIN_SOAK_HOURS) * hours * (1.15 - w * 0.4);
  else {
    const k = (REGION_DRYING[regionId ?? ""] ?? 1) * (0.35 + 0.65 * Math.min(1, Math.max(0, sun)));
    // soaked soil drains quickly, the last damp film takes longer
    w -= (k / DRY_HOURS) * hours * (0.45 + 0.55 * w);
  }
  return Math.min(1, Math.max(0, w));
}

/** wetness now, rebuilt from the last WET_HISTORY_HOURS of weather. `at(hoursAgo)` gives the rain 0..1 and the sun 0..1 then. */
export function wetnessFromHistory(at: (hoursAgo: number) => { rain: number; sun: number }, regionId?: string, step = 0.25): number {
  let w = 0;
  for (let h = WET_HISTORY_HOURS; h > 0; h -= step) {
    const s = at(h);
    w = stepGroundWetness(w, s.rain, step, s.sun, regionId);
  }
  return w;
}

/** share of flat ground standing in puddles: none until the ground is soaked past ~45%, then they spread */
export function puddleCover(wet: number): number {
  const t = Math.min(1, Math.max(0, (wet - 0.45) / 0.5));
  return t * t * (3 - 2 * t);
}
