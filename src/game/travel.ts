/** Travel between continents (Stage 149, pure): transit terminals, the Thalassia elevator, and which flights you may take.
 * Continents are separate worlds (planet.ts): you cannot walk, drive, sail or fly across a border, so every playable region
 * has a transit terminal (airport and port in one) beside its landing zone. Flights reuse the director's transit (the
 * same transition and teleport as deploying from the map). Thalassia is not on any continent: an elevator platform stands
 * in the sea off Veyloria's coast and rides down to the city's Sentry Dock; an underwater vehicle can also sail there. */
import { NEON_SITE, REGIONS } from "./world";
import { heightAt, WATER_LEVEL } from "./terrain";
import { THALASSIA_CENTER } from "./thalassia-site";
import { DOCK_DECK_Y, airlockSite } from "./thalassia-sectors";
import { CONTINENTS, worldAt, worldName, type ContinentId, type WorldId } from "./planet";
import type { PlayerProgression } from "./progression";
import { drivablePoint } from "./race-routing";

export type Terminal = { id: string; name: string; world: WorldId; regionId: string; x: number; z: number };

/** a terminal near each landing zone (region centre + 6 m south, destinations.ts dropPoint): the first spot on a spiral out
 * from 14 m beside it where the whole canopy footprint is open, dry, built-free ground (race-routing drivablePoint), so a
 * kiosk never stands in a building, a river or the sea */
const CLEAR_R = 8;
function beside(x: number, z: number): { x: number; z: number } {
  for (let k = 0; k < 120; k++) {
    const a = k * 2.399, d = 14 + k * 1.5;
    const cx = x + Math.cos(a) * d, cz = z + 6 + Math.sin(a) * d;
    let ok = drivablePoint(cx, cz);
    for (let i = 0; ok && i < 12; i++) ok = drivablePoint(cx + Math.cos((i / 12) * Math.PI * 2) * CLEAR_R, cz + Math.sin((i / 12) * Math.PI * 2) * CLEAR_R);
    if (ok) return { x: cx, z: cz };
  }
  return { x: x + 14, z: z + 6 };
}
export const TERMINALS: readonly Terminal[] = [
  ...REGIONS.map((r) => ({ id: `terminal:${r.id}`, name: `${r.name} Transit`, world: worldAt(r.x, r.z), regionId: r.id, ...beside(r.x, r.z) })),
  { id: "terminal:neon", name: "Neon City Transit", world: "noctyra" as WorldId, regionId: "neon", ...beside(NEON_SITE.x, NEON_SITE.z) },
];
export const TERMINAL_RADIUS = 4;
export const terminalAt = (x: number, z: number): Terminal | null => TERMINALS.find((t) => Math.hypot(x - t.x, z - t.z) < TERMINAL_RADIUS) ?? null;
/** where a flight sets you down: just past the terminal, clear of its trigger */
export const arrivalPoint = (t: Terminal) => ({ x: t.x + TERMINAL_RADIUS + 3, z: t.z });

/* ---------------- the Thalassia elevator ---------------- */

/** Off Veyloria's coast on the bearing to Thalassia: the first stretch of open sea past the shore, then 40 m out. The pier
 * runs from the last dry ground to the platform. Computed once from the terrain, so it moves if the coast does. */
let elevatorCache: { pier: { x: number; z: number }; platform: { x: number; z: number }; deckY: number } | null = null;
export function thalassiaElevator() {
  if (elevatorCache) return elevatorCache;
  const v = REGIONS.find((r) => r.id === "veridan")!;
  const dx = THALASSIA_CENTER.x - v.x, dz = THALASSIA_CENTER.z - v.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  let shore = len * 0.5, wet = 0;
  for (let d = 0; d < len; d += 2) {
    if (heightAt(v.x + ux * d, v.z + uz * d) < WATER_LEVEL - 1) { wet += 2; if (wet >= 20) { shore = d - 20; break; } } else wet = 0;
  }
  const out = shore + 40;
  elevatorCache = { pier: { x: v.x + ux * shore, z: v.z + uz * shore }, platform: { x: v.x + ux * out, z: v.z + uz * out }, deckY: WATER_LEVEL + 2.6 };
  return elevatorCache;
}
export const ELEVATOR_PLATFORM_R = 9;
export const ELEVATOR_PAD_R = 2.6;
export const PIER_HALF_WIDTH = 2.4;
/** the deck you stand on at the platform and along the pier; -Infinity elsewhere (the Storm Islands' stormGroundAt pattern) */
export function elevatorGroundAt(x: number, z: number, feetY: number): number {
  const e = thalassiaElevator();
  if (feetY < e.deckY - 3) return -Infinity;
  if (Math.hypot(x - e.platform.x, z - e.platform.z) <= ELEVATOR_PLATFORM_R) return e.deckY;
  const px = e.platform.x - e.pier.x, pz = e.platform.z - e.pier.z, l2 = px * px + pz * pz;
  const t = Math.max(0, Math.min(1, ((x - e.pier.x) * px + (z - e.pier.z) * pz) / l2));
  if (Math.hypot(e.pier.x + px * t - x, e.pier.z + pz * t - z) <= PIER_HALF_WIDTH) return e.deckY;
  return -Infinity;
}
/** the car at the platform's centre takes you down; the car at the dock brings you up */
export const elevatorDown = (x: number, z: number, feetY: number) => { const e = thalassiaElevator(); return Math.abs(feetY - e.deckY) < 1.5 && Math.hypot(x - e.platform.x, z - e.platform.z) < ELEVATOR_PAD_R; };
export const dockLift = () => { const a = airlockSite(); return { x: a.x, z: a.z + 6, y: DOCK_DECK_Y }; };
export const elevatorUp = (x: number, y: number, z: number) => { const d = dockLift(); return Math.abs(y - 1.6 - d.y) < 2.5 && Math.hypot(x - d.x, z - d.z) < ELEVATOR_PAD_R; };
/** arrivals: at the dock you step out of the car into the berth, diving with a full rebreather; at the top, onto the deck */
export const dockArrival = () => { const a = airlockSite(); return { x: a.x + 5, z: a.z, y: DOCK_DECK_Y + 1.6 }; };
export const platformArrival = () => { const e = thalassiaElevator(); return { x: e.platform.x - 4, z: e.platform.z, y: e.deckY + 1.6 }; };
export const ELEVATOR_RIDE_S = 6;

/* ---------------- flights ---------------- */

export const visitedKey = (w: WorldId) => `planet:visited:${w}`;
export const hasVisited = (p: Pick<PlayerProgression, "earnedRewards">, w: WorldId) => p.earnedRewards.includes(visitedKey(w));
/** the start continent counts as visited from the first step */
export const START_WORLD: ContinentId = "veyloria";

export type FlightOption = { terminal: Terminal; continent: string; open: boolean; reason: string | null; visited: boolean };
/** every other terminal, grouped by continent; flights are open to every CORE continent (tickets are free for now), the
 * terminal you are standing at is left out, and Thalassia is never a flight (elevator or submarine only) */
export function flightsFrom(from: Terminal, p: Pick<PlayerProgression, "earnedRewards">): FlightOption[] {
  return TERMINALS.filter((t) => t.id !== from.id).map((t) => {
    const c = CONTINENTS.find((x) => x.id === t.world);
    const open = !!c && c.tier === "CORE";
    return { terminal: t, continent: worldName(t.world), open, reason: open ? null : "No scheduled service", visited: t.world === START_WORLD || hasVisited(p, t.world) };
  }).sort((a, b) => a.continent.localeCompare(b.continent) || a.terminal.name.localeCompare(b.terminal.name));
}

/** a world you just entered for the first time (to record), or null */
export function newlyVisited(p: Pick<PlayerProgression, "earnedRewards">, w: WorldId): WorldId | null {
  return hasVisited(p, w) ? null : w;
}
export function recordVisit<P extends Pick<PlayerProgression, "earnedRewards">>(p: P, w: WorldId): P {
  return hasVisited(p, w) ? p : { ...p, earnedRewards: [...p.earnedRewards, visitedKey(w)] };
}
