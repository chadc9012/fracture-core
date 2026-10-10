import type { WeatherState } from "./weather-cycle";

/**
 * Signature sky effects per region (pure, deterministic). Scene eases a live copy toward
 * skyFxAt() so effects blend across borders; SkyFx.tsx only draws the result.
 *
 * - particles: an airborne layer around the player (ash, spores, dust, pollen, ice glitter)
 * - aurora:    0..1 curtain strength in the night sky
 */
export type SkyFx = {
  /** hex particle colour (chosen to sit inside the region's sky tint) */
  color: string;
  /** 0..1 how many particles are visible */
  density: number;
  /** metres per second downward (negative rises) */
  fall: number;
  /** sideways wander amplitude */
  drift: number;
  /** point size in px */
  size: number;
  /** 0 matte (lit by the scene tint) .. 1 self-glowing (fireflies, embers) */
  glow: number;
  /** 0..1 aurora curtain strength */
  aurora: number;
};

export const NO_SKY_FX: SkyFx = { color: "#ffffff", density: 0, fall: 0, drift: 0, size: 2, glow: 0, aurora: 0 };

type Signature = { day: Omit<SkyFx, "aurora">; night: Omit<SkyFx, "aurora">; aurora: number };

export const REGION_SKY_FX: Record<string, Signature> = {
  // ashfall: grey flakes by day, faintly glowing cinders after dark
  ember: {
    day: { color: "#9a8f88", density: 0.85, fall: 0.9, drift: 0.6, size: 3, glow: 0 },
    night: { color: "#ff7a3a", density: 0.6, fall: 0.7, drift: 0.7, size: 2.6, glow: 0.8 },
    aurora: 0,
  },
  // aurora over the peaks plus fine ice glitter in the air
  frostspire: {
    day: { color: "#e6f4ff", density: 0.35, fall: 0.35, drift: 0.9, size: 2, glow: 0.2 },
    night: { color: "#cfe8ff", density: 0.3, fall: 0.3, drift: 0.9, size: 2, glow: 0.35 },
    aurora: 1,
  },
  // drifting spores by day, fireflies at night
  swamps: {
    day: { color: "#b8c27a", density: 0.4, fall: -0.08, drift: 0.5, size: 2.4, glow: 0 },
    night: { color: "#d8ff6a", density: 0.55, fall: -0.04, drift: 1.2, size: 3, glow: 1 },
    aurora: 0,
  },
  // airborne grit blown sideways
  wastelands: {
    day: { color: "#c2a77a", density: 0.6, fall: 0.15, drift: 2.2, size: 2.2, glow: 0 },
    night: { color: "#8a7a62", density: 0.35, fall: 0.15, drift: 2, size: 2, glow: 0 },
    aurora: 0,
  },
  // pollen motes in sunbeams; quiet at night
  veridan: {
    day: { color: "#f2e7a6", density: 0.35, fall: 0.05, drift: 0.6, size: 2.2, glow: 0.3 },
    night: { color: "#bfe8a0", density: 0.12, fall: 0, drift: 0.8, size: 2.4, glow: 0.9 },
    aurora: 0,
  },
  // heat-lifted sand sparkle
  solara: {
    day: { color: "#ffe6b0", density: 0.25, fall: -0.2, drift: 1.2, size: 1.8, glow: 0.4 },
    night: { color: "#c8b48a", density: 0.08, fall: 0, drift: 1, size: 1.8, glow: 0 },
    aurora: 0,
  },
};

const mixHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return "#" + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0");
};

/**
 * The signature effect for a region at a given darkness (0 day .. 1 night), weather and cloud.
 * Rain washes airborne particles out; storms thicken ash and dust; cloud hides the aurora.
 */
export function skyFxAt(regionId: string | undefined, night: number, weather: WeatherState | undefined, cloud: number): SkyFx {
  const sig = regionId ? REGION_SKY_FX[regionId] : undefined;
  if (!sig) return { ...NO_SKY_FX };
  const n = Math.min(1, Math.max(0, night));
  const d = sig.day, nt = sig.night;
  const lerp = (a: number, b: number) => a + (b - a) * n;
  let density = lerp(d.density, nt.density);
  if (weather === "RAIN") density *= 0.35;
  else if (weather === "STORM") density *= regionId === "ember" || regionId === "wastelands" ? 1.3 : 0.4;
  else if (weather === "FOG") density *= 0.7;
  const aurora = sig.aurora * Math.max(0, (n - 0.4) / 0.6) * (1 - Math.min(1, cloud * 1.3));
  return {
    color: mixHex(d.color, nt.color, n),
    density: Math.min(1, density),
    fall: lerp(d.fall, nt.fall),
    drift: lerp(d.drift, nt.drift),
    size: lerp(d.size, nt.size),
    glow: lerp(d.glow, nt.glow),
    aurora: Math.max(0, aurora),
  };
}
