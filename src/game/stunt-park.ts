/** The Wastelands Stunt Park (owner's off-road brief, Oct 25: "Industrial Ramp Parks" with gap jumps for the ATVs and dirt bikes):
 * a fenced dirt yard on the open flats south of the Wastelands hub with a row of steel ramps to launch off (stunts.ts scores
 * the air). Each ramp is a registered deck (district-decks.ts), so the wheels, the player and the camera all ride the same
 * surface; a symmetric deck is a tabletop (flat top) or a peak (no top) depending on its ramp length. Pure placement data. */
import type { Deck } from "./district-decks";
import { REGIONS } from "./world";

/** authored as an offset from the Wastelands centre, so the park moves with its land when the map is re-laid (MAP_SPREAD) */
const WASTE = REGIONS.find((r) => r.id === "wastelands")!;

export const STUNT_PARK = { x: WASTE.x - 40, z: WASTE.z + 160, /** run-up direction (unit, world) */ dirX: 1, dirZ: 0, length: 150, width: 46 } as const;

export type Ramp = { id: string; /** offset along the run-up and across it, m */ along: number; across: number; length: number; ramp: number; width: number; height: number; label: string };
export const RAMPS: readonly Ramp[] = [
  { id: "kicker", along: -42, across: -12, length: 18, ramp: 9, width: 9, height: 3.2, label: "Kicker" },
  { id: "tabletop", along: -6, across: -12, length: 32, ramp: 11, width: 11, height: 4.6, label: "Tabletop" },
  { id: "launch", along: 38, across: -12, length: 30, ramp: 15, width: 10, height: 7.5, label: "Mega Launch" },
  { id: "hump-a", along: -30, across: 13, length: 14, ramp: 7, width: 8, height: 2.2, label: "Whoops" },
  { id: "hump-b", along: -12, across: 13, length: 14, ramp: 7, width: 8, height: 2.2, label: "Whoops" },
  { id: "hump-c", along: 6, across: 13, length: 14, ramp: 7, width: 8, height: 2.2, label: "Whoops" },
  { id: "gap-up", along: 30, across: 13, length: 20, ramp: 10, width: 9, height: 5, label: "Gap Jump" },
  { id: "gap-down", along: 56, across: 13, length: 20, ramp: 10, width: 9, height: 4, label: "Gap Jump" },
];

/** a ramp's world centre */
export function rampCentre(r: Ramp): { x: number; z: number } {
  const p = STUNT_PARK;
  return { x: p.x + p.dirX * r.along - p.dirZ * r.across, z: p.z + p.dirZ * r.along + p.dirX * r.across };
}

/** the ramp as a walkable deck; `ground` is the terrain height at its centre */
export function rampDeck(r: Ramp, ground: number): Deck {
  const c = rampCentre(r), base = ground - 0.15;
  return { id: `stunt-${r.id}`, x: c.x, z: c.z, dirX: STUNT_PARK.dirX, dirZ: STUNT_PARK.dirZ, length: r.length, width: r.width, top: base + r.height, base, ramp: r.ramp };
}

/** the side profile (along, height above base) of a ramp: base → up the ramp → flat top (if any) → down to base */
export function rampProfile(r: Ramp): [number, number][] {
  const h = r.length / 2;
  return [[-h, 0], [-h + r.ramp, r.height], [h - r.ramp, r.height], [h, 0]];
}

/** inside the park's yard (plus `margin`): scatter and props keep out so the run-ups are clear */
export function inStuntPark(x: number, z: number, margin = 0): boolean {
  const p = STUNT_PARK, dx = x - p.x, dz = z - p.z;
  const along = dx * p.dirX + dz * p.dirZ, across = -dx * p.dirZ + dz * p.dirX;
  return Math.abs(along) < p.length / 2 + margin && Math.abs(across) < p.width / 2 + margin;
}
