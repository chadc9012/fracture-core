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
  // (misty valley: cooler, thicker green-blue air with a warm key light, so shafts and distant ridges read in layers)
  veridan: { fogTint: "#a3c7ad", fogMix: 0.34, fogScale: 0.78, lightTint: "#ffd98f", lightMix: 0.24, skyTint: "#cfe8c4", skyMix: 0.22, haze: 1.3 },
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
/** The cities after dark (owner's trailers): violet-and-magenta air under the Fracture Storm, the neon bleeding into the fog.
 * Blended in by the night factor, replacing the daytime city air, so the neon districts read like the reference at night. */
export const CITY_NIGHT: Atmosphere = { fogTint: "#3a2366", fogMix: 0.5, fogScale: 0.85, lightTint: "#b08cff", lightMix: 0.3, skyTint: "#2c1858", skyMix: 0.42, haze: 0.6 };
export const isCity = (regionId: string | undefined) => regionId === "nexus" || regionId === "neon";

export function atmosphereAt(regionId: string | undefined, weather: WeatherState | undefined, night: number): Atmosphere {
  const day = dayAtmosphere(regionId, weather, night);
  if (!isCity(regionId)) return day;
  const k = Math.min(1, Math.max(0, (night - 0.35) / 0.5)); // only after the sun is down: at sunset the city keeps its orange sky
  if (k <= 0) return day;
  const mix = (a: number, b: number) => a + (b - a) * k;
  return { ...day, fogTint: k > 0.5 ? CITY_NIGHT.fogTint : day.fogTint, fogMix: mix(day.fogMix, CITY_NIGHT.fogMix), fogScale: mix(day.fogScale, CITY_NIGHT.fogScale),
    lightTint: k > 0.5 ? CITY_NIGHT.lightTint : day.lightTint, lightMix: mix(day.lightMix, CITY_NIGHT.lightMix), skyTint: k > 0.5 ? CITY_NIGHT.skyTint : day.skyTint, skyMix: mix(day.skyMix, CITY_NIGHT.skyMix), haze: mix(day.haze, CITY_NIGHT.haze) };
}
function dayAtmosphere(regionId: string | undefined, weather: WeatherState | undefined, night: number): Atmosphere {
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

/** City glow bounce after dark: signage, street lamps and lit windows throw light back onto the streets, so a city at night
 * is never pitch black between its lamps. Extra hemisphere intensity for a point `inCity` (0 outside .. 1 inside a city). */
export const CITY_NIGHT_FILL = 0.42;
export const cityNightFill = (inCity: number, night: number) => CITY_NIGHT_FILL * Math.max(0, Math.min(1, inCity)) * Math.max(0, Math.min(1, night));
/** 1 inside `radius`, fading to 0 over `fade` metres beyond it */
export const cityPresence = (dist: number, radius: number, fade = 60) => Math.max(0, Math.min(1, 1 - (dist - radius) / fade));

/** The fog bleed that tells the player a zone is fracturing (Scene: above 0.2 instability, full at 0.8). It is the Fracture's own
 * violet (the storm, the rift, the trailers), not the hot pink-red it used to be: at 35% that turned whole landscapes mauve at night
 * against a blue sky. */
export const INSTABILITY_FOG = { color: "#6a3cff", max: 0.24, from: 0.2, span: 0.6 } as const;
export const instabilityBleed = (instability: number) =>
  instability <= INSTABILITY_FOG.from ? 0 : Math.min(1, (instability - INSTABILITY_FOG.from) / INSTABILITY_FOG.span) * INSTABILITY_FOG.max;
