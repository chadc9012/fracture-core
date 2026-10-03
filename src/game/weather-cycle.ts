/**
 * Deterministic, time-driven weather cycle per region. Pure: same (region, time) → same weather,
 * so every client and the HUD agree without syncing anything.
 *
 * `time` is the Scene day clock (1.0 = one full day). Weather fronts change every
 * FRONT_LENGTH days and cross-fade over the last BLEND fraction of a front.
 */
export type WeatherState = "CLEAR" | "OVERCAST" | "RAIN" | "STORM" | "FOG";
export type WeatherSample = {
  state: WeatherState;
  /** 0..1 precipitation strength (drives particle count/speed and audio) */
  precipitation: number;
  /** 0..1 cloud cover; dims sun and moon */
  cloud: number;
  /** 0..1 visibility (1 = clear horizon) */
  visibility: number;
  /** wind on the ground plane, world units/s */
  windX: number;
  windZ: number;
  /** particle label consumed by Weather.tsx and audio.ts */
  label: string;
};

export const FRONT_LENGTH = 0.35;
const BLEND = 0.25;

const BASE: Record<WeatherState, Omit<WeatherSample, "state" | "windX" | "windZ" | "label"> & { wind: number }> = {
  CLEAR: { precipitation: 0, cloud: 0.1, visibility: 1, wind: 2 },
  OVERCAST: { precipitation: 0, cloud: 0.6, visibility: 0.8, wind: 5 },
  RAIN: { precipitation: 0.6, cloud: 0.75, visibility: 0.6, wind: 7 },
  STORM: { precipitation: 1, cloud: 0.95, visibility: 0.42, wind: 14 },
  FOG: { precipitation: 0, cloud: 0.5, visibility: 0.3, wind: 1 },
};

/** Which fronts each region can roll. Nexus has a weather shield: always clear. */
export const REGION_WEATHER: Record<string, WeatherState[]> = {
  veridan: ["RAIN", "OVERCAST", "STORM", "FOG", "CLEAR"],
  ember: ["CLEAR", "OVERCAST", "STORM"],
  frostspire: ["OVERCAST", "STORM", "FOG", "CLEAR"],
  swamps: ["FOG", "RAIN", "FOG", "OVERCAST"],
  wastelands: ["CLEAR", "OVERCAST", "STORM"],
  solara: ["CLEAR", "CLEAR", "OVERCAST", "STORM"],
  nexus: ["CLEAR"],
};

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function strId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

export function frontAt(regionId: string, frontIndex: number): WeatherState {
  const table = REGION_WEATHER[regionId] ?? ["CLEAR", "OVERCAST", "RAIN"];
  return table[Math.floor(hash(frontIndex + strId(regionId) * 0.013) * table.length) % table.length]!;
}

function particleLabel(regionId: string, state: WeatherState, precipitation: number): string {
  if (regionId === "nexus") return "Clear shield";
  if (regionId === "ember") return state === "CLEAR" ? "Dust front" : "Ashfall";
  if (regionId === "frostspire") return state === "CLEAR" ? "Clear shield" : "Snow haze";
  if (precipitation > 0.15) return "Rain mist";
  if (regionId === "solara" || regionId === "wastelands") return "Dust front";
  return "Clear shield";
}

export function sampleWeather(regionId: string | undefined, time: number): WeatherSample {
  const id = regionId ?? "wastelands";
  const f = time / FRONT_LENGTH;
  const idx = Math.floor(f);
  const frac = f - idx;
  const a = frontAt(id, idx);
  const b = frontAt(id, idx + 1);
  const k = frac < 1 - BLEND ? 0 : (frac - (1 - BLEND)) / BLEND;
  const s = k * k * (3 - 2 * k);
  const A = BASE[a], B = BASE[b];
  const mix = (x: number, y: number) => x + (y - x) * s;
  const precipitation = mix(A.precipitation, B.precipitation);
  const wind = mix(A.wind, B.wind) * (0.8 + 0.4 * Math.sin(time * 40 + strId(id)));
  const dir = hash(idx * 3.7 + strId(id)) * Math.PI * 2 + Math.sin(time * 9) * 0.4;
  const state = s < 0.5 ? a : b;
  return {
    state,
    precipitation,
    cloud: mix(A.cloud, B.cloud),
    visibility: mix(A.visibility, B.visibility),
    windX: Math.cos(dir) * wind,
    windZ: Math.sin(dir) * wind,
    label: particleLabel(id, state, precipitation),
  };
}

/** Human-readable HUD label. */
export function weatherName(w: WeatherSample, regionId?: string): string {
  if (regionId === "nexus") return "Clear shield";
  const map: Record<WeatherState, string> = { CLEAR: "Clear", OVERCAST: "Overcast", RAIN: "Rain", STORM: "Storm", FOG: "Dense fog" };
  return map[w.state];
}
