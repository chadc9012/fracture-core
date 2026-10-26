/** Nexus Airport (owner's overlook frame, docs/reference/target-overlook-day.png: an airport on the shore beside Nexus City).
 * A raised airfield on the island's southern shore: the ground there rolls ~10 m, so the field is a concrete platform held
 * level on piers (a sci-fi skyport rather than a graded field), with a runway down its length, an apron, a terminal and a
 * control tower, and an access ramp at each end. The platform is a registered deck (district-decks.ts), so the player and
 * vehicles can drive up and along it. Pure placement; NexusAirport.tsx draws it. Terrain is untouched. */
import type { Deck } from "./district-decks";
import { REGIONS } from "./world";

/** authored as an offset from the Nexus hub, so the field moves with the island when the map is re-laid (MAP_SPREAD) */
const NEXUS = REGIONS.find((r) => r.id === "nexus")!;
const HEADING = (105 * Math.PI) / 180;

export const AIRPORT = {
  x: NEXUS.x + 100, z: NEXUS.z + 310,
  /** runway heading (unit, world): along the island's southern shore */
  dirX: Math.cos(HEADING), dirZ: Math.sin(HEADING),
  length: 230, width: 54,
  /** the ramps down to the ground at each end */
  ramp: 42,
  /** runway strip across the platform: offset from the centre line toward +across, and its width */
  runwayOffset: -8, runwayWidth: 22,
} as const;

/** a point on the field from (along the runway, across it) to world */
export function airportPoint(along: number, across: number): { x: number; z: number } {
  const a = AIRPORT;
  return { x: a.x + a.dirX * along - a.dirZ * across, z: a.z + a.dirZ * along + a.dirX * across };
}

/** the platform's top: a little above the highest ground under the flat middle of its footprint */
export function airportTop(ground: (x: number, z: number) => number): number {
  const a = AIRPORT, half = a.length / 2 - a.ramp;
  let hi = -Infinity;
  for (let s = -half; s <= half; s += 10) for (let t = -a.width / 2; t <= a.width / 2; t += 9) { const p = airportPoint(s, t); hi = Math.max(hi, ground(p.x, p.z)); }
  return hi + 1.2;
}

/** the field as a walkable deck: flat top, ramps at both ends down to the lower of the two ends' ground */
export function airportDeck(ground: (x: number, z: number) => number): Deck {
  const a = AIRPORT, top = airportTop(ground);
  const e0 = airportPoint(-a.length / 2, 0), e1 = airportPoint(a.length / 2, 0);
  const base = Math.min(ground(e0.x, e0.z), ground(e1.x, e1.z)) - 0.2;
  return { id: "nexus-airport", x: a.x, z: a.z, dirX: a.dirX, dirZ: a.dirZ, length: a.length, width: a.width, top, base, ramp: a.ramp };
}

/** buildings on the field, in (along, across) metres from the centre: the terminal and tower stand on the apron side */
export const AIRPORT_BUILDINGS = {
  terminal: { along: 10, across: 17, length: 60, depth: 14, height: 9 },
  tower: { along: -40, across: 20, radius: 2.6, height: 26, cab: 5 },
  hangar: { along: 58, across: 18, length: 30, depth: 16, height: 11 },
} as const;
/** parked aircraft on the apron: (along, across, heading offset in rad) */
export const PARKED = [{ along: -18, across: 9, yaw: Math.PI / 2 }, { along: 28, across: 9, yaw: Math.PI / 2 }, { along: -60, across: -8, yaw: 0 }] as const;
/** runway edge lights: along positions, both edges */
export function runwayLights(): number[] {
  const a = AIRPORT, out: number[] = [], half = a.length / 2 - a.ramp - 4;
  for (let s = -half; s <= half; s += 12) out.push(s);
  return out;
}
