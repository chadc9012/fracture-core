/** Mud and dust on the vehicle (owner's off-road brief, Oct 25: swamp mud, desert dust and mountain clay build up on the vehicle
 * as you drive and slide through them; water washes it off). Pure: a 0..1 grime level plus the colour of what's caked on.
 * Scene steps it from the surface under the wheels and tints the vehicle's paint toward the grime colour. */
import type { Surface } from "./vehicle-surface";

/** grime per second at full speed on each surface (0 = this ground leaves nothing) */
export const MUD_RATE: Record<Surface, number> = { MUD: 0.09, SAND: 0.035, GRAVEL: 0.025, SNOW: 0.02, GRASS: 0.008, ICE: 0, ROAD: 0, WATER: 0 };
/** what each surface leaves on the bodywork (sRGB) */
export const MUD_COLOR: Record<Surface, string> = { MUD: "#3b2f22", SAND: "#c9a774", GRAVEL: "#7a6a5a", SNOW: "#d8dde2", GRASS: "#4d5a2e", ICE: "#d8dde2", ROAD: "#5a5550", WATER: "#5a5550" };
export const MUD = {
  /** speed (m/s) that counts as full rate */
  fullSpeed: 25,
  /** sliding throws up more: multiplier at full slip */
  slideBoost: 2.5,
  /** per second: rinsed off driving through water, and the slow fall-off of dust on a paved road */
  wash: 0.35, roadShed: 0.004,
  /** how far the paint is tinted toward the grime colour at full grime */
  maxTint: 0.72,
} as const;

export type Grime = { level: number; r: number; g: number; b: number };
export const cleanGrime = (): Grime => ({ level: 0, r: 0.35, g: 0.3, b: 0.25 });

const hex = (h: string) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] as const; };

/** one frame: surface under the wheels, speed (m/s), slip (0..1), dt (s); rain rinses a little too */
export function stepGrime(g: Grime, surface: Surface, speed: number, slip: number, dt: number, rain = 0): Grime {
  const s = Math.min(1, Math.abs(speed) / MUD.fullSpeed);
  if (surface === "WATER") return { ...g, level: Math.max(0, g.level - (MUD.wash * (0.4 + s)) * dt) };
  const gain = MUD_RATE[surface] * s * (1 + (MUD.slideBoost - 1) * Math.min(1, slip)) * dt;
  const shed = (surface === "ROAD" ? MUD.roadShed : 0) * dt + rain * 0.02 * dt;
  const level = Math.max(0, Math.min(1, g.level + gain - shed));
  if (gain <= 0) return { ...g, level };
  // the colour is a running blend weighted by how much of each ground went on
  const [r, gg, b] = hex(MUD_COLOR[surface]), w = gain / Math.max(gain, level);
  return { level, r: g.r + (r - g.r) * w, g: g.g + (gg - g.g) * w, b: g.b + (b - g.b) * w };
}

/** how far to pull a paint colour toward the grime colour */
export const grimeTint = (g: Grime) => Math.min(MUD.maxTint, g.level * MUD.maxTint);
