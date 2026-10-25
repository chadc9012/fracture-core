/** Neon City's nightlife venues as walk-in pocket rooms (interiors.ts): the door sits on each venue's red carpet, in front
 * of its entrance (NeonVenues.tsx draws the building on the same lot), and opens only during the venue's hours
 * (nightlife.ts VENUE_HOURS). Registered into INTERIORS when this module loads; residences.ts neonKeepOut leaves venue
 * doors out, so adding them never moves a tower (the venues stand on tower lots by design). */
import { INTERIORS, type InteriorDef } from "./interiors";
import { neonKeepOut } from "./residences";
import { neonTowersWorld } from "./neon-layout";
import { VENUE_HOST, VENUE_HOURS, venueLots } from "./nightlife";
import { buildings } from "./nexus-districts";
import { REGIONS } from "./world";
import { NEXUS_DINER } from "./venue-life";

function build(): InteriorDef[] {
  return venueLots(neonTowersWorld(neonKeepOut())).map((lot, i) => {
    const a = (lot.rot * Math.PI) / 2, front = (lot.hz * 2 - 1.2) / 2 + 2;
    const h = VENUE_HOURS[lot.venue.id] ?? { open: 20, close: 4 };
    return {
      id: `venue-${lot.venue.id}`, name: lot.venue.name.replace(/\b(\w)(\w*)/g, (_, f: string, r: string) => f + r.toLowerCase()), kind: "VENUE" as const, regionId: "nexus",
      doorPos: { x: lot.x + Math.sin(a) * front, z: lot.z + Math.cos(a) * front },
      origin: { x: 3200, z: i * 60 }, spawnOffset: { x: 0, z: -2.5 }, exitOffset: { x: 0, z: 4 },
      npcName: VENUE_HOST[lot.venue.id] ?? "Host", openHour: h.open, closeHour: h.close, venueId: lot.venue.id,
    };
  });
}
/** The Grid Line Diner (venue-life.ts NEXUS_DINER) takes the ground floor of the low-rise Nexus block nearest the hub: its
 * door sits just outside the side that faces the hub, so no building moves and the block keeps its collision. */
export function dinerFront(): { x: number; z: number; yaw: number; door: { x: number; z: number }; half: number; base: number; building: { x: number; z: number; w: number; d: number } } {
  const N = REGIONS.find((r) => r.id === "nexus")!;
  const b = buildings().filter((x) => x.floors <= 5).sort((a, c) => Math.hypot(a.x - N.x, a.z - N.z) - Math.hypot(c.x - N.x, c.z - N.z))[0]!;
  const dx = N.x - b.x, dz = N.z - b.z, alongX = Math.abs(dx) > Math.abs(dz);
  // the face toward the hub, its outward normal and half-width; yaw turns local +Z onto that normal
  const nx = alongX ? Math.sign(dx) : 0, nz = alongX ? 0 : Math.sign(dz), out = alongX ? b.w / 2 : b.d / 2;
  const x = b.x + nx * out, z = b.z + nz * out;
  return { x, z, yaw: Math.atan2(nx, nz), door: { x: x + nx * 2.2, z: z + nz * 2.2 }, half: alongX ? b.d / 2 : b.w / 2, base: b.base, building: { x: b.x, z: b.z, w: b.w, d: b.d } };
}
function diner(): InteriorDef {
  const f = dinerFront();
  return { id: `venue-${NEXUS_DINER.id}`, name: "Grid Line Diner", kind: "VENUE", regionId: "nexus", doorPos: f.door, origin: { x: 3200, z: 4 * 60 },
    spawnOffset: { x: 0, z: -2.5 }, exitOffset: { x: 0, z: 4 }, npcName: NEXUS_DINER.host, openHour: NEXUS_DINER.open, closeHour: NEXUS_DINER.close, venueId: NEXUS_DINER.id };
}
export const VENUE_INTERIORS: readonly InteriorDef[] = build();
/** Nexus City's diner, registered alongside Neon's venues */
export const DINER_INTERIOR: InteriorDef = diner();
for (const v of [...VENUE_INTERIORS, DINER_INTERIOR]) if (!INTERIORS.some((i) => i.id === v.id)) INTERIORS.push(v);
