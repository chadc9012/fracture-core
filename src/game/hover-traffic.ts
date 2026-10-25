/** Neon City air and hover traffic: authored fleet vehicles (hover cars, pods, lightcycles, shuttles, a gunship) circulating on three
 * rounded-rectangle lanes at different heights, local metres around the district centre (north = -z), like neon-tiers.ts.
 *  - street lane (y 10): under the Grid deck ring and its skybridges, down the market avenue
 *  - deck lane (y 20): above the deck, outside its pillars, below the drone lanes
 *  - sky lane (y 52): shuttles and a gunship high over the market, clear of every tower footprint
 * Lanes stay inside the open market core, so they never cross a tower, the Spire or the deck pillars (hover-traffic.test.ts measures it
 * against the real layout). Neon never sleeps, so unlike Nexus traffic this does not thin out by the hour. Pure. */
import type { FleetModelId } from "./fleet-models";

export type HoverLane = { id: string; y: number; halfX: number; halfZ: number; corner: number; speed: number };
export const HOVER_LANES: readonly HoverLane[] = [
  { id: "street", y: 10, halfX: 30, halfZ: 22, corner: 9, speed: 11 },
  { id: "deck", y: 20, halfX: 48, halfZ: 26, corner: 12, speed: -15 },
  { id: "sky", y: 52, halfX: 58, halfZ: 24, corner: 14, speed: 20 },
];

export type HoverVehicle = { lane: string; model: FleetModelId; paint?: string; /** 0..1 along the lane */ at: number; bob: number };
const v = (lane: string, model: FleetModelId, at: number, bob: number, paint?: string): HoverVehicle => (paint ? { lane, model, paint, at, bob } : { lane, model, at, bob });
export const HOVER_FLEET: readonly HoverVehicle[] = [
  v("street", "hover-car", 0.0, 0.0, "#38e8ff"), v("street", "city-pod", 0.17, 1.1, "#e8ecf2"), v("street", "hover-car", 0.34, 2.2, "#ff2ea6"),
  v("street", "hover-car", 0.5, 3.3, "#b968ff"), v("street", "city-pod", 0.67, 4.4, "#ffcf3a"), v("street", "hover-car", 0.84, 5.5, "#101216"),
  v("deck", "hover-car", 0.0, 0.7, "#39ff7a"), v("deck", "aether-hoverbike", 0.12, 1.9, "#38e8ff"), v("deck", "city-pod", 0.25, 3.1, "#ffffff"),
  v("deck", "aether-hoverbike", 0.37, 4.3, "#ff2ea6"), v("deck", "hover-car", 0.5, 5.5, "#c9ced6"), v("deck", "aether-hoverbike", 0.62, 0.4, "#ffcf3a"),
  v("deck", "city-pod", 0.75, 1.6, "#38e8ff"), v("deck", "hover-car", 0.87, 2.8, "#2a0a6e"),
  v("sky", "void-skimmer", 0.0, 0.5, "#e8ecf2"), v("sky", "rift-helicopter", 0.36, 2, "#2c323c"), v("sky", "void-skimmer", 0.68, 3.5, "#101216"),
];

export const laneById = (id: string) => HOVER_LANES.find((l) => l.id === id)!;
/** the lane's length in metres: four straights and four quarter arcs */
export const hoverPerimeter = (l: HoverLane) => 4 * (l.halfX + l.halfZ) - 8 * l.corner + 2 * Math.PI * l.corner;

/** position and heading (nose direction, three.js rotation.y with the model's nose on +z) at arc length s along the lane; s wraps.
 * Corners are true arcs, so heading turns smoothly instead of snapping. Travel is clockwise seen from above when speed > 0. */
export function hoverAt(l: HoverLane, s: number): { x: number; z: number; yaw: number } {
  const per = hoverPerimeter(l), R = l.corner;
  let t = ((s % per) + per) % per;
  const W = 2 * l.halfX - 2 * R, D = 2 * l.halfZ - 2 * R, arc = (Math.PI / 2) * R;
  // north edge, west to east
  if (t < W) return { x: -l.halfX + R + t, z: -l.halfZ, yaw: Math.PI / 2 };
  t -= W; if (t < arc) { const a = t / R; return { x: l.halfX - R + Math.sin(a) * R, z: -l.halfZ + R - Math.cos(a) * R, yaw: Math.PI / 2 - a }; }
  t -= arc; if (t < D) return { x: l.halfX, z: -l.halfZ + R + t, yaw: 0 };
  t -= D; if (t < arc) { const a = t / R; return { x: l.halfX - R + Math.cos(a) * R, z: l.halfZ - R + Math.sin(a) * R, yaw: -a }; }
  t -= arc; if (t < W) return { x: l.halfX - R - t, z: l.halfZ, yaw: -Math.PI / 2 };
  t -= W; if (t < arc) { const a = t / R; return { x: -l.halfX + R - Math.sin(a) * R, z: l.halfZ - R + Math.cos(a) * R, yaw: -Math.PI / 2 - a }; }
  t -= arc; if (t < D) return { x: -l.halfX, z: l.halfZ - R - t, yaw: Math.PI };
  t -= D; const a = t / R;
  return { x: -l.halfX + R - Math.cos(a) * R, z: -l.halfZ + R - Math.sin(a) * R, yaw: Math.PI - a };
}

/** where one vehicle is at world-clock seconds `time`: its start offset plus speed x time; a negative-speed lane runs the loop backwards (heading flipped) */
export function hoverVehiclePose(veh: HoverVehicle, time: number): { x: number; y: number; z: number; yaw: number } {
  const l = laneById(veh.lane), per = hoverPerimeter(l);
  const p = hoverAt(l, veh.at * per + time * l.speed);
  return { x: p.x, y: l.y + Math.sin(time * 1.3 + veh.bob) * 0.35, z: p.z, yaw: l.speed < 0 ? p.yaw + Math.PI : p.yaw };
}
