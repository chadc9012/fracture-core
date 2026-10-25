/** Flying traffic over the cities (owner's target frame "Neon at night": hover vehicles streaming between the towers with lit
 * engines). Vehicles fly fixed loops over Nexus and a corridor to Neon City (Neon's own lanes: hover-traffic.ts), at heights above the tallest towers'
 * shoulders, so they never clip a building. Pure: positions are a function of time; SkyTraffic.tsx draws them instanced. */
import { NEXUS } from "./nexus-districts";
import { NEON_SITE } from "./world";
import { heightAt } from "./terrain";

export type SkyLane = { cx: number; cz: number; rx: number; rz: number; rot: number; y: number; dir: 1 | -1; count: number; speed: number; color: string };

const ground = (x: number, z: number) => heightAt(x, z);
export const SKY_LANES: readonly SkyLane[] = (() => {
  const nexusY = ground(NEXUS.x, NEXUS.z), neonY = ground(NEON_SITE.x, NEON_SITE.z);
  const mx = (NEXUS.x + NEON_SITE.x) / 2, mz = (NEXUS.z + NEON_SITE.z) / 2;
  const span = Math.hypot(NEON_SITE.x - NEXUS.x, NEON_SITE.z - NEXUS.z) / 2, rot = Math.atan2(NEON_SITE.z - NEXUS.z, NEON_SITE.x - NEXUS.x);
  return [
    { cx: NEXUS.x, cz: NEXUS.z, rx: 170, rz: 130, rot: 0.3, y: nexusY + 78, dir: 1, count: 10, speed: 34, color: "#7fe8ff" },
    { cx: NEXUS.x, cz: NEXUS.z, rx: 230, rz: 190, rot: -0.4, y: nexusY + 104, dir: -1, count: 12, speed: 40, color: "#ffb36b" },
    // Neon City flies its own air lanes (hover-traffic.ts, NeonTiers.tsx); only Nexus and the corridor between the cities are here
    // the commuter corridor between the two cities: a long thin loop, both directions at once
    { cx: mx, cz: mz, rx: span + 40, rz: 26, rot, y: Math.max(nexusY, neonY) + 140, dir: 1, count: 14, speed: 52, color: "#ffffff" },
  ];
})();

/** where vehicle `k` of a lane is at time `t` (s): position and heading (yaw about +y, nose along +z) */
export function vehicleAt(l: SkyLane, k: number, t: number): { x: number; y: number; z: number; yaw: number; bank: number } {
  const perim = Math.PI * (3 * (l.rx + l.rz) - Math.sqrt((3 * l.rx + l.rz) * (l.rx + 3 * l.rz)));
  const a = (k / l.count) * Math.PI * 2 + l.dir * (t * l.speed / perim) * Math.PI * 2 + (k % 3) * 0.07;
  const ex = Math.cos(a) * l.rx, ez = Math.sin(a) * l.rz;
  const c = Math.cos(l.rot), s = Math.sin(l.rot);
  const x = l.cx + ex * c - ez * s, z = l.cz + ex * s + ez * c;
  // tangent of the ellipse, in the direction of travel
  const tx0 = -Math.sin(a) * l.rx * l.dir, tz0 = Math.cos(a) * l.rz * l.dir;
  const tx = tx0 * c - tz0 * s, tz = tx0 * s + tz0 * c;
  return { x, y: l.y + Math.sin(t * 0.6 + k * 1.7) * 1.5 + ((k % 2) - 0.5) * 6, z, yaw: Math.atan2(tx, tz), bank: -0.18 * l.dir };
}
