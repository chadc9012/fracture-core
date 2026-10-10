import type { WeatherState } from "./weather-cycle";

/**
 * Regional atmosphere grade — each region gets its own air: a fog tint and thickness, a sun/skylight
 * tint, and its own sky colour and haze, so crossing a border changes the mood (Veridan golden haze,
 * Swamp sick-green mist, Ember smoke, Frostspire crisp ice-blue) on top of the day clock and weather.
 * Pure and deterministic: Scene eases toward the returned values and applies them to fog, lights and sky.
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
  /** hex tint for the sky/horizon colour, blended into the background by `skyMix` */
  skyTint: string;
  skyMix: number;
  /** extra airborne haze: added to sky turbidity/mie so some regions always read dustier or smokier */
  haze: number;
};

export const NEUTRAL_ATMOSPHERE: Atmosphere = {
  fogTint: "#ffffff",
  fogMix: 0,
  fogScale: 1,
  lightTint: "#ffffff",
  lightMix: 0,
  skyTint: "#ffffff",
  skyMix: 0,
  haze: 0,
};

export const REGION_ATMOSPHERE: Record<string, Atmosphere> = {
  // golden-green forest air, warm afternoon sky
  veridan: { fogTint: "#9bc27a", fogMix: 0.28, fogScale: 1, lightTint: "#ffe3a1", lightMix: 0.18, skyTint: "#cfe8b8", skyMix: 0.22, haze: 0.8 },
  // low sick-green bog mist, murky olive sky, very hazy
  swamps: { fogTint: "#6f8f62", fogMix: 0.5, fogScale: 0.55, lightTint: "#b8d68a", lightMix: 0.22, skyTint: "#8fa37a", skyMix: 0.4, haze: 3.2 },
  // dry dust bowl: tan sky, constant airborne grit
  wastelands: { fogTint: "#c9a16a", fogMix: 0.38, fogScale: 0.85, lightTint: "#ffbf80", lightMix: 0.2, skyTint: "#e0b983", skyMix: 0.34, haze: 2.4 },
  // high desert: pale bleached sky, thin clear air
  solara: { fogTint: "#f0d79b", fogMix: 0.32, fogScale: 1.2, lightTint: "#fff0c4", lightMix: 0.2, skyTint: "#ffe9b0", skyMix: 0.26, haze: 0.5 },
  // fracture zone: smoke and ash, bruised red-brown sky, heaviest haze
  ember: { fogTint: "#7a3a2e", fogMix: 0.55, fogScale: 0.6, lightTint: "#ff8a5c", lightMix: 0.3, skyTint: "#a5553d", skyMix: 0.48, haze: 4 },
  // frozen peaks: crisp ice-blue sky, clearest air on the map
  frostspire: { fogTint: "#bfdcf5", fogMix: 0.38, fogScale: 1.3, lightTint: "#d4eaff", lightMix: 0.22, skyTint: "#d8ecff", skyMix: 0.3, haze: 0.2 },
  // safe city: clean cyan-tinged sky, light haze
  nexus: { fogTint: "#8fd2e8", fogMix: 0.16, fogScale: 1, lightTint: "#d6f4ff", lightMix: 0.1, skyTint: "#bfe8f5", skyMix: 0.14, haze: 0.4 },
};

/**
 * The air for a region under the current weather and night factor (0 day .. 1 night).
 * Tints fade at night so colour never fights the moonlight; fog and storms mute the light tint,
 * and heavy weather adds its own haze on top of the region's baseline.
 */
export function atmosphereAt(regionId: string | undefined, weather: WeatherState | undefined, night: number): Atmosphere {
  const base = (regionId && REGION_ATMOSPHERE[regionId]) || NEUTRAL_ATMOSPHERE;
  const dayK = 1 - Math.min(1, Math.max(0, night)) * 0.7;
  const weatherScale = weather === "FOG" ? 0.65 : weather === "STORM" ? 0.8 : weather === "RAIN" ? 0.9 : 1;
  const lightMute = weather === "STORM" || weather === "OVERCAST" ? 0.5 : weather === "FOG" ? 0.7 : 1;
  const weatherHaze = weather === "STORM" ? 2.5 : weather === "FOG" ? 2 : weather === "RAIN" ? 1 : weather === "OVERCAST" ? 0.6 : 0;
  return {
    fogTint: base.fogTint,
    // heavier weather lets the regional fog colour show more
    fogMix: Math.min(0.8, base.fogMix * dayK * (weather === "FOG" ? 1.4 : 1)),
    fogScale: base.fogScale * weatherScale,
    lightTint: base.lightTint,
    lightMix: base.lightMix * dayK * lightMute,
    skyTint: base.skyTint,
    skyMix: base.skyMix * dayK,
    haze: base.haze + weatherHaze,
  };
}
