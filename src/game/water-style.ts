import type { WeatherState } from "./weather-cycle";

/**
 * Regional water style — each region's water gets its own deep/shallow colours, murkiness and wave
 * chop, so the swamp reads as still green murk, Frostspire as clear ice-blue, and Thalassia's ocean
 * as deep teal. Pure and deterministic: Scene eases the Water shader uniforms toward these values.
 */
export type WaterStyle = {
  /** hex deep-water colour */
  deep: string;
  /** hex shallow-water colour (shorelines, sandbars) */
  shallow: string;
  /** 0 crystal clear .. 1 opaque murk: dulls specular and darkens shallows */
  murk: number;
  /** wave amplitude multiplier (1 = calm sea) */
  chop: number;
};

export const NEUTRAL_WATER: WaterStyle = { deep: "#062a44", shallow: "#1d7fa8", murk: 0.15, chop: 1 };

export const REGION_WATER: Record<string, WaterStyle> = {
  // forest lakes: green-teal, gentle
  veridan: { deep: "#0a3a3c", shallow: "#2e9c8a", murk: 0.25, chop: 0.8 },
  // bog: still, opaque green-brown murk
  swamps: { deep: "#1e2b1a", shallow: "#4a6b3a", murk: 0.75, chop: 0.45 },
  // rare oasis pools: warm and silty
  wastelands: { deep: "#3a3423", shallow: "#8a7a4d", murk: 0.55, chop: 0.6 },
  // desert: bright, glassy, shallow pans
  solara: { deep: "#0d4a5e", shallow: "#3fb6c9", murk: 0.1, chop: 0.9 },
  // fracture zone: dark, unsettled, faintly ember-lit
  ember: { deep: "#241a20", shallow: "#6b4a3d", murk: 0.5, chop: 1.3 },
  // frozen coast: clear ice-blue
  frostspire: { deep: "#0a2f4a", shallow: "#7cc4e8", murk: 0.05, chop: 1.1 },
  // Nexus / Thalassia ocean: deep clear teal
  nexus: { deep: "#052a3d", shallow: "#1d9fc0", murk: 0.1, chop: 1 },
};

/**
 * The water style for a region under the current weather. Storms and rain roughen the surface
 * everywhere; fog slightly stills it. Unknown ground gets the neutral sea.
 */
export function waterStyleAt(regionId: string | undefined, weather: WeatherState | undefined): WaterStyle {
  const base = (regionId && REGION_WATER[regionId]) || NEUTRAL_WATER;
  const chopK = weather === "STORM" ? 2 : weather === "RAIN" ? 1.4 : weather === "FOG" ? 0.7 : 1;
  return { ...base, chop: Math.min(2.6, base.chop * chopK) };
}
