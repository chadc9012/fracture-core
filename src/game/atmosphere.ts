import type { WeatherState } from "./weather-cycle";

/**
 * Regional atmosphere grade — each region gets its own air: a fog tint and thickness, a sun/skylight
 * tint, so crossing a border changes the mood (Veridan golden haze, Swamp sick-green mist, Ember
 * smoke, Frostspire crisp ice-blue) on top of the day clock and weather. Pure and deterministic:
 * Scene eases toward the returned values and applies them to fog and lights.
 */
export type Atmosphere = {
  /** hex fog tint, blended into the day-clock fog colour by `fogMix` */
  fogTint: string;
  fogMix: number;
  /** multiplies fog near/far: <1 thicker air, >1 clearer */
  fogScale: number;
  /** hex tint for the sun and hemisphere light, blended by `lightMix` */
  lightTint: string;
  lightMix: number;
};

export const NEUTRAL_ATMOSPHERE: Atmosphere = { fogTint: "#ffffff", fogMix: 0, fogScale: 1, lightTint: "#ffffff", lightMix: 0 };

export const REGION_ATMOSPHERE: Record<string, Atmosphere> = {
  veridan: { fogTint: "#9bc27a", fogMix: 0.28, fogScale: 1, lightTint: "#ffe3a1", lightMix: 0.18 },
  swamps: { fogTint: "#6f8f62", fogMix: 0.5, fogScale: 0.55, lightTint: "#b8d68a", lightMix: 0.22 },
  wastelands: { fogTint: "#c9a16a", fogMix: 0.38, fogScale: 0.85, lightTint: "#ffbf80", lightMix: 0.2 },
  solara: { fogTint: "#f0d79b", fogMix: 0.32, fogScale: 1.2, lightTint: "#fff0c4", lightMix: 0.2 },
  ember: { fogTint: "#7a3a2e", fogMix: 0.55, fogScale: 0.6, lightTint: "#ff8a5c", lightMix: 0.3 },
  frostspire: { fogTint: "#bfdcf5", fogMix: 0.38, fogScale: 1.3, lightTint: "#d4eaff", lightMix: 0.22 },
  nexus: { fogTint: "#8fd2e8", fogMix: 0.16, fogScale: 1, lightTint: "#d6f4ff", lightMix: 0.1 },
};

/**
 * The air for a region under the current weather and night factor (0 day .. 1 night).
 * Tints fade at night so colour never fights the moonlight; fog and storms mute the light tint.
 */
export function atmosphereAt(regionId: string | undefined, weather: WeatherState | undefined, night: number): Atmosphere {
  const base = (regionId && REGION_ATMOSPHERE[regionId]) || NEUTRAL_ATMOSPHERE;
  const dayK = 1 - Math.min(1, Math.max(0, night)) * 0.7;
  const weatherScale = weather === "FOG" ? 0.65 : weather === "STORM" ? 0.8 : weather === "RAIN" ? 0.9 : 1;
  const lightMute = weather === "STORM" || weather === "OVERCAST" ? 0.5 : weather === "FOG" ? 0.7 : 1;
  return {
    fogTint: base.fogTint,
    // heavier weather lets the regional fog colour show more
    fogMix: Math.min(0.8, base.fogMix * dayK * (weather === "FOG" ? 1.4 : 1)),
    fogScale: base.fogScale * weatherScale,
    lightTint: base.lightTint,
    lightMix: base.lightMix * dayK * lightMute,
  };
}
