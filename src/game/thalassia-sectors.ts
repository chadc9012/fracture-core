/** Thalassia's districts as gameplay volumes (pure; Scene samples them, HUD and ThalassiaSectors.tsx draw them):
 *  - Sentry Dock: the docking ring where subs berth through an airlock (shallow, safe-ish; a pressure-safe refill point).
 *  - Abyssal Ring (containment): an annulus whose floor is flooded with electrified coolant. The coolant arcs on a
 *    telegraphed cycle; anyone within reach of the floor when it arcs is hurt — swim up off the floor to stay safe.
 *  - Sunk-Core (deep trench): the rupture below the city. Past crush depth the suit's hull stress climbs; at full stress
 *    the pressure hurts until you rise. Oxygen still comes from underwater.ts.
 * Damage is returned as numbers for Scene to apply; nothing here touches the sim. */
import { THALASSIA_CENTER } from "./thalassia-site";
import { WATER_LEVEL } from "./terrain";

export type ThalassiaSector = "SENTRY_DOCK" | "ABYSSAL_RING" | "SUNK_CORE" | "OUTER_CITY";
export const SECTOR_LABEL: Record<ThalassiaSector, string> = { SENTRY_DOCK: "Sentry Dock", ABYSSAL_RING: "Abyssal Ring · Containment", SUNK_CORE: "Sunk-Core · Deep Trench", OUTER_CITY: "Thalassia" };

export const CITY_RADIUS = 85;
export const DOCK = { dx: 52, dz: 0, r: 15 } as const;
export const RING = { inner: 21, outer: 33, floorY: -14.5 } as const;
export const CORE = { r: 40, belowY: -20 } as const;
/** depth (m below the surface) where the suit starts to take hull stress */
export const CRUSH_DEPTH = 18;

export function sectorAt(x: number, y: number, z: number): ThalassiaSector | null {
  const lx = x - THALASSIA_CENTER.x, lz = z - THALASSIA_CENTER.z, d = Math.hypot(lx, lz);
  if (d > CITY_RADIUS) return null;
  if (d < CORE.r && y < CORE.belowY) return "SUNK_CORE";
  if (Math.hypot(lx - DOCK.dx, lz - DOCK.dz) < DOCK.r) return "SENTRY_DOCK";
  if (d >= RING.inner && d <= RING.outer) return "ABYSSAL_RING";
  return "OUTER_CITY";
}

export const depthOf = (y: number) => Math.max(0, WATER_LEVEL - y);

/** Hull stress 0..1: climbs past crush depth (faster the deeper you go), bleeds off when shallower. */
export function hullStressStep(stress: number, depth: number, dt: number): number {
  const over = depth - CRUSH_DEPTH;
  const next = over > 0 ? stress + (0.08 + over * 0.03) * dt : stress - 0.25 * dt;
  return Math.max(0, Math.min(1, next));
}
/** hp per second the pressure takes at full stress (none below full) */
export const hullDamagePerSec = (stress: number) => (stress >= 1 ? 4 : 0);

/** Coolant arc cycle: WARN (telegraph) then ARC; the rest of the period is calm. */
export const COOLANT = { period: 7, warn: 1.6, arc: 0.9, reach: 2.4, damage: 9 } as const;
export type CoolantPhase = "CALM" | "WARN" | "ARC";
export function coolantPhase(t: number): CoolantPhase {
  const k = ((t % COOLANT.period) + COOLANT.period) % COOLANT.period;
  const warnAt = COOLANT.period - COOLANT.warn - COOLANT.arc;
  return k < warnAt ? "CALM" : k < warnAt + COOLANT.warn ? "WARN" : "ARC";
}
/** Damage this frame from the coolant: only in the Abyssal Ring, only during an ARC, only near the coolant floor. */
export function coolantDamage(sector: ThalassiaSector | null, y: number, t: number, dt: number): number {
  if (sector !== "ABYSSAL_RING" || coolantPhase(t) !== "ARC") return 0;
  return y - RING.floorY < COOLANT.reach ? (COOLANT.damage / COOLANT.arc) * dt : 0;
}

/** mission sites (world x,z) */
export const dockSite = () => ({ x: THALASSIA_CENTER.x + DOCK.dx, z: THALASSIA_CENTER.z + DOCK.dz });
export const airlockSite = () => ({ x: THALASSIA_CENTER.x + DOCK.dx - 9, z: THALASSIA_CENTER.z + DOCK.dz });
/** the Abyssal Ring's far side from the dock */
export const ringWaypoint = () => ({ x: THALASSIA_CENTER.x, z: THALASSIA_CENTER.z - (RING.inner + RING.outer) / 2 });
export const reactorSite = () => ({ x: THALASSIA_CENTER.x, z: THALASSIA_CENTER.z });
/** the dock's pressurised deck (world y) — submersible arrivals and dock respawns stand here */
export const DOCK_DECK_Y = -10;
/** how deep the reactor sits (world y) */
export const REACTOR_Y = -24;

/** Air stations: refill oxygen while you're within reach. The dock's only works once its airlock is restored. */
export type AirStation = { id: "dock" | "ring"; x: number; y: number; z: number };
export function airStations(): AirStation[] {
  const a = airlockSite(), r = ringWaypoint();
  return [{ id: "dock", x: a.x - 3, y: DOCK_DECK_Y + 1, z: a.z + 4 }, { id: "ring", x: r.x + 6, y: RING.floorY + 5, z: r.z }];
}
export const AIR_REACH = 4.5;
/** Inside Thalassia the operator dives on the deep-dive rebreather: ~73 s of air instead of the ~18 s open-water lungful.
 * Live playtest: at the open-water rate the diver arrived at the Sentry Dock and was at 11% before the first fight was over. */
export const REBREATHER_DRAIN_SCALE = 0.25;
/** the air station refilling the player at (x,y,z), if any is functional and in reach */
export function airStationAt(x: number, y: number, z: number, airlockRestored: boolean): AirStation | null {
  for (const s of airStations()) {
    if (s.id === "dock" && !airlockRestored) continue;
    if (Math.hypot(x - s.x, y - s.y, z - s.z) <= AIR_REACH) return s;
  }
  return null;
}
