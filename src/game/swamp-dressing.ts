/** Swamps dressing (pure layout): moss-hung cypress in and around the water, lily pads and floating logs on the water,
 * glowing fungus clusters on the banks, rickety boardwalks out from the Airboat Hub, and drifting fireflies/marsh-glow.
 * Keeps clear of the Spatial Sink, the Sunken Temple, roads and boss/mission arenas. */
import { arenaCircles, clusters, landmark, regionById, scatter, zoneCircle, type PlaceRules } from "./dressing-kit";
import { mulberry32 } from "./rng";
import { heightAt, WATER_LEVEL } from "./terrain";

const keepOut = () => [zoneCircle("spatial-sink", 8), { ...landmark("temple-of-echoes"), r: 24 }, ...arenaCircles("swamps")];
export const SWAMP_LAND: PlaceRules = { region: "swamps", keepOut };
export const SWAMP_WATER: PlaceRules = { region: "swamps", keepOut, water: "require" };
export const SWAMP_ANY: PlaceRules = { region: "swamps", keepOut, water: "allow" };
const R = () => regionById("swamps");

export const cypress = () => scatter(SWAMP_ANY, 140, 0xc795, { inner: 0, outer: R().radius * 0.95, maxSlope: 0.6, gap: 5, clear: 2 });
export const lilyPads = () => scatter(SWAMP_WATER, 260, 0x111e, { inner: 0, outer: R().radius * 0.95, maxSlope: 2, gap: 1.6, clear: 0 });
export const logs = () => scatter(SWAMP_ANY, 40, 0x1095, { inner: 0, outer: R().radius * 0.9, maxSlope: 0.5, gap: 6, clear: 1 });
export const fungusPatches = () => clusters(SWAMP_LAND, scatter(SWAMP_LAND, 22, 0xf09, { inner: 0, outer: R().radius * 0.9, maxSlope: 0.5, gap: 18, clear: 2 }), 7, 3.5, 0xf0a, 0.7);
export const waterLevel = () => WATER_LEVEL;

/** boardwalks: plank runs leaving the Airboat Hub in three directions, stopping at dry ground or after a set length */
export function boardwalks(): { x: number; z: number; yaw: number }[][] {
  const hub = landmark("airboat-hub"), rnd = mulberry32(0xb0a2), out: { x: number; z: number; yaw: number }[][] = [];
  for (let k = 0; k < 3; k++) {
    let yaw = (k / 3) * Math.PI * 2 + rnd() * 0.6, x = hub.x + Math.sin(yaw) * 8, z = hub.z + Math.cos(yaw) * 8;
    const run: { x: number; z: number; yaw: number }[] = [];
    for (let i = 0; i < 40; i++) {
      if (keepOut().some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) break;
      run.push({ x, z, yaw });
      yaw += (rnd() - 0.5) * 0.25;
      x += Math.sin(yaw) * 2.4; z += Math.cos(yaw) * 2.4;
      if (i > 8 && heightAt(x, z) > WATER_LEVEL + 2.5) break;
    }
    if (run.length > 4) out.push(run);
  }
  return out;
}
/** glow motes: anchors the renderer drifts fireflies around (night-weighted by the renderer) */
export const glowAnchors = () => scatter(SWAMP_ANY, 16, 0x9107, { inner: 0, outer: R().radius * 0.85, maxSlope: 2, gap: 25, clear: 0 });
