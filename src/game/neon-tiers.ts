/** Neon City's three tiers (pure layout, local metres around NEON_CITY_CENTER; north = −z):
 *  - The Spire (upper tier): the Aegis Syndicate tower north of the market, hard-light terraces, a deployment pad near
 *    the top and a quarantine checkpoint (hard-light gate arches) at its base.
 *  - The Grid (mid tier): an elevated transit deck ring around the district on pillars, two skybridges, and drone
 *    traffic lanes looping above it.
 *  - The Undercity / Rust-Muck (street level): pipe runs, CRT terminal banks, black-market dens and steam vents on the
 *    east–west cross street and the district's back alleys.
 * Plus holographic billboards and the acid-rain/neon-fog volume. NeonTiers.tsx draws everything. */

export const SPIRE = { x: 0, z: -50, height: 96, base: 15, padY: 64, padR: 9, terraces: [22, 38, 52, 76] } as const;
export const CHECKPOINT = { x: 0, z: -36, width: 14, arches: 3 } as const;

/** the Grid deck: a rectangular ring at mid height around the market district, with corner pillars and mid-span pillars */
export const DECK = { y: 15, halfX: 38, halfZ: 32, width: 5 } as const;
export function deckPillars(): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (const sx of [-1, 1]) for (let z = -DECK.halfZ; z <= DECK.halfZ; z += 16) out.push({ x: sx * DECK.halfX, z });
  // north/south spans: pillars only outside the market avenue (|x| > 10), so the street stays open end to end
  for (const sz of [-1, 1]) for (const x of [-26, -14, 14, 26]) out.push({ x, z: sz * DECK.halfZ });
  return out;
}
/** skybridges cross the market avenue at deck height */
export const SKYBRIDGES = [{ z: -12 }, { z: 14 }] as const;

/** a drone lane is a closed loop; drones are evenly spaced along it and move at `speed` m/s */
export type Lane = { y: number; halfX: number; halfZ: number; speed: number; drones: number; color: string };
export const DRONE_LANES: Lane[] = [
  { y: 24, halfX: 44, halfZ: 30, speed: 9, drones: 10, color: "#38e8ff" },
  { y: 31, halfX: 30, halfZ: 26, speed: -12, drones: 8, color: "#ff2ea6" },
];
/** position along a rounded-rectangle loop, s in metres (wraps) */
export function laneAt(l: Lane, s: number): { x: number; z: number; yaw: number } {
  const per = 4 * (l.halfX + l.halfZ);
  let t = ((s % per) + per) % per;
  const W = 2 * l.halfX, D = 2 * l.halfZ;
  if (t < W) return { x: -l.halfX + t, z: -l.halfZ, yaw: Math.PI / 2 };
  t -= W; if (t < D) return { x: l.halfX, z: -l.halfZ + t, yaw: 0 };
  t -= D; if (t < W) return { x: l.halfX - t, z: l.halfZ, yaw: -Math.PI / 2 };
  t -= W; return { x: -l.halfX, z: l.halfZ - t, yaw: Math.PI };
}
export const lanePerimeter = (l: Lane) => 4 * (l.halfX + l.halfZ);

/** Undercity kit along the east–west cross street (z ≈ −7) and the back alleys at the district's rim */
export type Den = { x: number; z: number; yaw: number; kind: "terminals" | "den" | "vent" };
export function undercity(): Den[] {
  const out: Den[] = [];
  const kinds: Den["kind"][] = ["terminals", "den", "vent", "den", "terminals", "vent"];
  [-30, -21, -14, 14, 21, 30].forEach((x, i) => out.push({ x, z: -7 + (i % 2 ? 3.2 : -3.2), yaw: i % 2 ? Math.PI : 0, kind: kinds[i]! }));
  [-26, -9, 9, 26].forEach((z, i) => out.push({ x: i % 2 ? 33 : -33, z, yaw: i % 2 ? -Math.PI / 2 : Math.PI / 2, kind: i % 2 ? "den" : "terminals" }));
  return out;
}
/** pipe runs: straight segments along the cross street's walls and up building corners */
export const PIPES: { from: [number, number, number]; to: [number, number, number]; r: number }[] = [
  { from: [-34, 3.2, -10.5], to: [-10, 3.2, -10.5], r: 0.35 }, { from: [10, 3.2, -10.5], to: [34, 3.2, -10.5], r: 0.35 },
  { from: [-34, 1.4, -3.5], to: [-10, 1.4, -3.5], r: 0.22 }, { from: [10, 1.4, -3.5], to: [34, 1.4, -3.5], r: 0.22 },
  { from: [-34, 0.2, -10.5], to: [-34, 14, -10.5], r: 0.3 }, { from: [34, 0.2, -10.5], to: [34, 14, -10.5], r: 0.3 },
  { from: [-10, 3.2, -10.5], to: [-10, 9, -10.5], r: 0.35 }, { from: [10, 3.2, -10.5], to: [10, 9, -10.5], r: 0.35 },
];

export type Holo = { x: number; y: number; z: number; yaw: number; w: number; h: number; text: string; color: string };
export const HOLOGRAMS: Holo[] = [
  { x: 0, y: 30, z: -36.5, yaw: 0, w: 14, h: 5, text: "AEGIS SYNDICATE", color: "#38e8ff" },
  { x: -DECK.halfX - 0.5, y: 21, z: 0, yaw: Math.PI / 2, w: 10, h: 4, text: "COMPLIANCE IS SAFETY", color: "#38e8ff" },
  { x: DECK.halfX + 0.5, y: 21, z: 8, yaw: -Math.PI / 2, w: 10, h: 4, text: "NEON CORE // OPEN 24/7", color: "#ff2ea6" },
  { x: -18, y: 19, z: DECK.halfZ + 0.5, yaw: Math.PI, w: 9, h: 3.5, text: "SYNTH-COFFEE", color: "#ffcf3a" },
  { x: 18, y: 19, z: DECK.halfZ + 0.5, yaw: Math.PI, w: 9, h: 3.5, text: "CYBERNETICS · MODS", color: "#b968ff" },
  { x: -22, y: 6, z: -11, yaw: 0, w: 6, h: 2.4, text: "NO RIFT TECH", color: "#ff3b3b" },
  { x: 24, y: 7, z: -3, yaw: Math.PI, w: 6, h: 2.4, text: "DATA BROKER", color: "#39ff7a" },
];

/** the rain/fog volume: how strong the district weather is for a camera at local (x,z) — full inside, fading out */
export const WEATHER_R = 70, WEATHER_FADE = 40;
export function neonWeather(lx: number, lz: number): number {
  const d = Math.hypot(lx, lz);
  return d <= WEATHER_R ? 1 : d >= WEATHER_R + WEATHER_FADE ? 0 : 1 - (d - WEATHER_R) / WEATHER_FADE;
}
