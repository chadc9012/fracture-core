/** Wet-street light reflections (owner's target frames: Nexus and Neon at night, every lamp smeared down the wet asphalt toward the
 * camera). A real mirror pass is too costly for the owner's GPU, so each light gets a streak decal on the road: it starts under the
 * light and runs toward the viewer, longer for higher and farther lights, exactly where a reflection on rough wet asphalt appears.
 * Pure: the light list and the streak placement are plain numbers; WetReflections.tsx draws them as one additive instanced batch. */
import { streetLights } from "./nexus-districts";
import { neonStreetLightsWorld } from "./neon-layout";
import { neonKeepOut } from "./residences";
import { nexusSigns } from "./nexus-signs";
import { walkHeight } from "./terrain";

export type Glint = { x: number; z: number; /** light height above its ground (m) */ h: number; color: string; /** streak width (m) */ w: number };

/** Nexus cobra-head lamps (7.4 m pole, 1.8 m outreach, sodium-warm) and Neon City's LED lamps (6.6 m, 2.1 m arm, sign colour) */
export function cityGlints(): Glint[] {
  const out: Glint[] = [];
  for (const l of streetLights()) out.push({ x: l.x + Math.sin(l.yaw) * 1.8, z: l.z + Math.cos(l.yaw) * 1.8, h: 7.3, color: "#ffc98e", w: 1.1 });
  for (const l of neonStreetLightsWorld(neonKeepOut())) out.push({ x: l.x + Math.sin(l.yaw) * 2.1, z: l.z + Math.cos(l.yaw) * 2.1, h: 6.6, color: l.glow, w: 1.2 });
  // Nexus banners and holo screens smear their colour down the street too (wider, softer streaks from higher up)
  const { banners, screens } = nexusSigns();
  for (const b of [...banners, ...screens]) {
    const h = b.y - b.h * 0.3 - walkHeight(b.x, b.z);
    if (h < 25) out.push({ x: b.x + Math.sin(b.yaw) * 2, z: b.z + Math.cos(b.yaw) * 2, h, color: b.color, w: Math.min(3.2, b.w * 0.8) });
  }
  return out;
}

export const WET = {
  /** only lights this close to the camera get a streak (m) */
  range: 140,
  /** cap on drawn streaks */
  max: 260,
  /** streak length per metre of light height, and as a share of the camera distance */
  perHeight: 3.2, perDistance: 0.55,
} as const;

/** where the streak lies: centre, length and heading (yaw about +y, the streak's long axis pointing from the light foot to the camera) */
export function streak(camX: number, camZ: number, g: Glint): { cx: number; cz: number; len: number; yaw: number } | null {
  const dx = camX - g.x, dz = camZ - g.z, d = Math.hypot(dx, dz);
  if (d < 1.5 || d > WET.range) return null;
  const len = Math.min(g.h * WET.perHeight, d * WET.perDistance);
  const ux = dx / d, uz = dz / d;
  return { cx: g.x + ux * len * 0.5, cz: g.z + uz * len * 0.5, len, yaw: Math.atan2(ux, uz) };
}

/** the `n` lights nearest (x, z) within `range`, nearest first: the ones the sea and lakes mirror this frame (Water.tsx, a small
 * per-tier budget of point reflections instead of a mirror pass) */
export function nearestGlints<T extends { x: number; z: number }>(glints: readonly T[], x: number, z: number, n: number, range = 420): T[] {
  if (n <= 0) return [];
  const r2 = range * range;
  const near: { g: T; d: number }[] = [];
  for (const g of glints) { const d = (g.x - x) ** 2 + (g.z - z) ** 2; if (d <= r2) near.push({ g, d }); }
  near.sort((a, b) => a.d - b.d);
  return near.slice(0, n).map((e) => e.g);
}

/** how wet the streets read: damp by day, soaked at night, and fully wet whenever it rains */
export function wetness(night: number, rain: number): number {
  return Math.min(1, 0.25 + 0.55 * Math.max(0, Math.min(1, night)) + 0.6 * Math.max(0, Math.min(1, rain)));
}
