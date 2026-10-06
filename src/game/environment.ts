/**
 * Seasons, temperature and environmental hazards — pure functions of the Scene day clock, like
 * weather-cycle.ts, so every client agrees without syncing and the rules stay testable apart from
 * rendering. Layers on top of the weather fronts instead of replacing them:
 *
 *   environmentAt(region, time, night)  → season + seasonally-adjusted weather + thermal index
 *   stepEnvironment(state, input)       → exposure meters, lightning strikes, damage and warnings
 *
 * Hazards are always telegraphed: exposure builds slowly with a warning long before it hurts,
 * and lightning shows a ground ring for ~1.6 s before it lands. Shelter (interiors, safe zones,
 * Nexus's weather shield) relieves every hazard.
 */
import { sampleWeather, weatherName, type WeatherSample } from "./weather-cycle";

export type Season = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
export const SEASONS: readonly Season[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];
export const SEASON_NAME: Record<Season, string> = { SPRING: "Spring", SUMMER: "Summer", AUTUMN: "Autumn", WINTER: "Winter" };
/** One season lasts this many day-clock days (Scene advances ~0.008 days/s, so ≈12 real minutes). */
export const SEASON_LENGTH_DAYS = 6;

export function seasonAt(time: number): { season: Season; progress: number; year: number } {
  const t = Math.max(0, time) / SEASON_LENGTH_DAYS;
  const index = Math.floor(t);
  return { season: SEASONS[index % 4]!, progress: t - index, year: Math.floor(index / 4) };
}

/** `base` is the region's resting thermal index (-1 freezing … +1 scorching); `seasonal` scales how
 * strongly seasons move it. Nexus is shielded: always mild, seasons are only cosmetic there. */
type Climate = { base: number; seasonal: number; shielded?: boolean };
export const REGION_CLIMATE: Record<string, Climate> = {
  veridan: { base: 0, seasonal: 1 },
  swamps: { base: 0.15, seasonal: 0.7 },
  wastelands: { base: 0.25, seasonal: 0.8 },
  solara: { base: 0.6, seasonal: 0.5 },
  ember: { base: 0.7, seasonal: 0.4 },
  frostspire: { base: -0.7, seasonal: 0.5 },
  nexus: { base: 0, seasonal: 0, shielded: true },
};
const DEFAULT_CLIMATE: Climate = { base: 0.1, seasonal: 0.8 };
const SEASON_OFFSET: Record<Season, number> = { SPRING: 0, SUMMER: 0.3, AUTUMN: -0.05, WINTER: -0.35 };

export type EnvironmentSample = {
  season: Season;
  seasonProgress: number;
  /** seasonally-adjusted weather: use this instead of sampleWeather() so seasons are visible */
  weather: WeatherSample;
  /** -1 freezing … +1 scorching */
  thermal: number;
  /** display only */
  tempC: number;
  shielded: boolean;
  /** "Autumn · Dense fog · 14°C" */
  summary: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function environmentAt(regionId: string | undefined, time: number, night: number): EnvironmentSample {
  const id = regionId ?? "wastelands";
  const climate = REGION_CLIMATE[id] ?? DEFAULT_CLIMATE;
  const { season, progress } = seasonAt(time);
  const raw = sampleWeather(id, time);

  const wetCool = raw.state === "STORM" ? -0.1 : raw.state === "RAIN" ? -0.05 : raw.state === "CLEAR" ? 0.05 : 0;
  const diurnal = night > 0 ? -0.2 * night : 0.05 * (1 - night);
  const thermal = climate.shielded ? 0 : clamp(climate.base + SEASON_OFFSET[season] * climate.seasonal + diurnal + wetCool, -1, 1);

  let weather = raw;
  if (!climate.shielded) {
    // seasonal flavour: haze in autumn, hard cloud in winter, bigger spring showers, bright summers
    const adj = { precipitation: raw.precipitation, cloud: raw.cloud, visibility: raw.visibility };
    if (season === "WINTER") { adj.cloud += 0.1; adj.visibility *= 0.92; }
    else if (season === "AUTUMN") adj.visibility *= 0.95;
    else if (season === "SPRING" && raw.state === "RAIN") adj.precipitation *= 1.15;
    else if (season === "SUMMER") adj.cloud -= 0.1;
    // cold precipitation falls as snow (Weather.tsx already renders the "Snow haze" label)
    const snowing = adj.precipitation > 0.15 && thermal < -0.2 && id !== "ember";
    weather = {
      ...raw,
      precipitation: clamp(adj.precipitation, 0, 1),
      cloud: clamp(adj.cloud, 0, 1),
      visibility: clamp(adj.visibility, 0.1, 1),
      label: snowing ? "Snow haze" : raw.label,
    };
  }
  const tempC = Math.round(12 + thermal * 30);
  return {
    season,
    seasonProgress: progress,
    weather,
    thermal,
    tempC,
    shielded: Boolean(climate.shielded),
    summary: `${SEASON_NAME[season]} · ${weatherName(weather, id)} · ${tempC}°C`,
  };
}

/* ------------------------------------------------------------------ hazards */

export type Strike = { id: number; x: number; z: number; radius: number; /** seconds until it lands */ warn: number };
export type StrikeFlash = { x: number; z: number; t: number };
export type EnvState = {
  /** 0..1 exposure meters; at 1 they hurt */
  heat: number; cold: number; toxic: number;
  strikes: Strike[]; flashes: StrikeFlash[];
  nextStrike: number; nextId: number;
};
export const createEnvState = (): EnvState => ({ heat: 0, cold: 0, toxic: 0, strikes: [], flashes: [], nextStrike: 8, nextId: 1 });

export const HEAT_THRESHOLD = 0.7;
export const COLD_THRESHOLD = -0.7;
export const STRIKE_WARN_SECONDS = 1.6;
export const STRIKE_RADIUS = 5;
export const STRIKE_PLAYER_DAMAGE = 14;
export const STRIKE_MACHINE_DAMAGE = 6;
const BUILD_FULL_SECONDS = 20;
const RELIEF_PER_SECOND = 0.12;
const EXPOSURE_DPS = 1;
const TOXIC_DPS = 0.8;

export type EnvInput = {
  dt: number; regionId: string | undefined; env: EnvironmentSample;
  /** interior, safe zone, or Nexus shield: relieves every hazard and suppresses strikes */
  sheltered: boolean;
  px: number; pz: number; rand: () => number;
};
export type EnvOutput = {
  /** hull damage to apply this step (already dt-scaled) */
  damage: number; cause: string;
  /** short HUD line, "" when nothing is wrong */
  warning: string;
  /** strikes that landed this step; the caller applies their area damage */
  detonated: Strike[];
};

function build(meter: number, pressure: number, dt: number, sheltered: boolean): number {
  if (!sheltered && pressure > 0) return Math.min(1, meter + (pressure / BUILD_FULL_SECONDS) * dt);
  return Math.max(0, meter - RELIEF_PER_SECOND * (sheltered ? 2 : 1) * dt);
}

export function stepEnvironment(state: EnvState, input: EnvInput): EnvOutput {
  const { dt, env, sheltered, regionId } = input;
  const shielded = env.shielded;

  // exposure meters
  const heatPressure = shielded ? 0 : clamp((env.thermal - HEAT_THRESHOLD) / 0.3, 0, 1);
  const coldPressure = shielded ? 0 : clamp((COLD_THRESHOLD - env.thermal) / 0.3, 0, 1);
  const toxicPressure = !shielded && regionId === "swamps" && env.weather.state === "FOG" ? 1 : 0;
  state.heat = build(state.heat, heatPressure, dt, sheltered);
  state.cold = build(state.cold, coldPressure, dt, sheltered);
  state.toxic = build(state.toxic, toxicPressure, dt, sheltered);

  // lightning: storms outside the shield, only while the player is exposed
  const stormy = !shielded && env.weather.state === "STORM" && env.weather.precipitation > 0.8;
  if (stormy && !sheltered) {
    state.nextStrike -= dt;
    if (state.nextStrike <= 0) {
      const a = input.rand() * Math.PI * 2;
      const d = 6 + input.rand() * 20;
      state.strikes.push({ id: state.nextId++, x: input.px + Math.cos(a) * d, z: input.pz + Math.sin(a) * d, radius: STRIKE_RADIUS, warn: STRIKE_WARN_SECONDS });
      state.nextStrike = 7 + input.rand() * 7;
    }
  } else if (state.nextStrike < 4) state.nextStrike = 4; // leaving the storm resets the cadence so re-entry isn't instant

  const detonated: Strike[] = [];
  for (const strike of state.strikes) {
    strike.warn -= dt;
    if (strike.warn <= 0) { detonated.push(strike); state.flashes.push({ x: strike.x, z: strike.z, t: 0.3 }); }
  }
  if (detonated.length) state.strikes = state.strikes.filter((strike) => strike.warn > 0);
  for (const flash of state.flashes) flash.t -= dt;
  if (state.flashes.length) state.flashes = state.flashes.filter((flash) => flash.t > 0);

  // damage + warnings
  let damage = 0;
  let cause = "";
  if (state.heat >= 1) { damage += EXPOSURE_DPS * dt; cause = "Heat exhaustion"; }
  if (state.cold >= 1) { damage += EXPOSURE_DPS * dt; cause = "Hypothermia"; }
  if (state.toxic >= 1) { damage += TOXIC_DPS * dt; cause = "Spore toxicity"; }

  const worst = Math.max(state.heat, state.cold, state.toxic);
  let warning = "";
  if (state.strikes.length) warning = "Lightning inbound — leave the marked ground";
  else if (worst >= 0.5) {
    const label = state.cold === worst ? "Cold exposure" : state.heat === worst ? "Heat stress" : "Spore haze";
    warning = `${label} ${Math.round(worst * 100)}% — ${worst >= 1 ? "taking damage" : "find shelter"}`;
  }
  return { damage, cause, warning, detonated };
}
