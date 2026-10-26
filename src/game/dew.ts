/**
 * Morning dew on grass and low foliage (pure). Dew forms on clear, calm nights as the ground cools, beads on the blades through the
 * small hours and burns off once the sun is up: strongest from ~04:30 to ~07:00, gone by ~10:00. Cloud cover (no radiative cooling),
 * wind (mixes the air) and rain (the grass is simply wet: see wetness.ts) all suppress it, and dry regions barely get any.
 * wind-sway.ts turns the value into a fine sparkle and sheen on the foliage shaders; Scene feeds it from the day clock and weather.
 */

/** dew-forming tendency per region (humid forest and bog full, deserts a trace, Frostspire's is rime) */
export const REGION_DEW: Record<string, number> = { veridan: 1, swamps: 1, frostspire: 0.7, nexus: 0.55, wastelands: 0.35, solara: 0.25, ember: 0.08 };

const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** 0..1 by the hour of day alone (0..24) */
export function dewByHour(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  return smooth(2.5, 4.75, h) * (1 - smooth(6.75, 10, h));
}

export type DewWeather = { cloud?: number; wind?: number; precipitation?: number; regionId?: string | undefined };

export function dewStrength(hour: number, w: DewWeather = {}): number {
  const clear = 1 - 0.75 * Math.min(1, Math.max(0, w.cloud ?? 0));
  const calm = 1 - smooth(4, 12, Math.max(0, w.wind ?? 0));
  const dry = 1 - Math.min(1, Math.max(0, w.precipitation ?? 0));
  const region = REGION_DEW[w.regionId ?? ""] ?? 0.6;
  return Math.min(1, Math.max(0, dewByHour(hour) * clear * calm * dry * region));
}
