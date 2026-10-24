/** Neon City's nightlife venues as walk-in pocket rooms (interiors.ts): the door sits on each venue's red carpet, in front
 * of its entrance (NeonVenues.tsx draws the building on the same lot), and opens only during the venue's hours
 * (nightlife.ts VENUE_HOURS). Registered into INTERIORS when this module loads; residences.ts neonKeepOut leaves venue
 * doors out, so adding them never moves a tower (the venues stand on tower lots by design). */
import { INTERIORS, type InteriorDef } from "./interiors";
import { neonKeepOut } from "./residences";
import { neonTowersWorld } from "./neon-layout";
import { VENUE_HOST, VENUE_HOURS, venueLots } from "./nightlife";

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
export const VENUE_INTERIORS: readonly InteriorDef[] = build();
for (const v of VENUE_INTERIORS) if (!INTERIORS.some((i) => i.id === v.id)) INTERIORS.push(v);
