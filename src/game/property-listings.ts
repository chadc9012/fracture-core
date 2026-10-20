/** Everything the property agent sells, as one list (reference: the real-estate screen's Homes / Apartments / Condos
 * tabs): the agent's homes with furnished interiors (housing.ts) and the walk-in residences on the street with their own
 * garages (residence-deeds.ts). Both are bought the same way, a one-time Nex spend, so this module only reshapes them
 * for the store; buying goes through each system's own function. Pure. */
import { HOMES, buyHome, type HomeKind, type HousingState } from "./housing";
import { buyDeed, deeds, frontDoor, parkedIn, styleName } from "./residence-deeds";
import { INTERIORS } from "./interiors";
import type { HomeStyle } from "./residences";
import type { NexLedger } from "./nex";
import type { FleetState, GarageId } from "./fleet";

export type ListingTab = "HOMES" | "APARTMENTS" | "CONDOS" | "QUARTERS";
export const LISTING_TABS: readonly ListingTab[] = ["HOMES", "APARTMENTS", "CONDOS", "QUARTERS"];
export const TAB_LABEL: Record<ListingTab, string> = { HOMES: "Homes", APARTMENTS: "Apartments", CONDOS: "Condos", QUARTERS: "Garage quarters" };

export type Listing = {
  id: string; source: "agent" | "deed"; name: string; place: string; tab: ListingTab; price: number; blurb: string;
  /** parking bays in its own garage (walk-in homes) */
  bays: number; rooms: number;
  /** art: the design it is built to, or its kind, and which skyline it stands against */
  style?: HomeStyle; kind?: HomeKind; art: string;
  /** where you arrive when you go home: outside its front door */
  door?: { x: number; z: number };
  /** walk-in homes have their furniture built in; the agent's homes are decorated room by room */
  decor: boolean;
  /** garage quarters need their base first */
  needsBase?: GarageId;
};

const ART: Record<string, string> = { nexus: "nexus", veridan: "wild", solara: "desert", frostspire: "frost", wastelands: "wastes" };
const NEON = /rust-muck|the grid|aegis/i;
const tabOf = (k: HomeKind): ListingTab => (k === "HOUSE" ? "HOMES" : k === "APARTMENT" ? "APARTMENTS" : k === "PENTHOUSE" ? "CONDOS" : "QUARTERS");

let cached: Listing[] | null = null;
export function listings(): Listing[] {
  return (cached ??= [
    ...HOMES.map((h): Listing => {
      const door = INTERIORS.find((i) => i.homeId === h.id)?.doorPos;
      const neon = NEON.test(h.district);
      return { id: h.id, source: "agent", name: h.name, place: neon ? `Neon City · ${h.district}` : h.district, tab: tabOf(h.kind), price: h.price, blurb: h.blurb, bays: 0, rooms: h.rooms.length, kind: h.kind, art: neon ? "neon" : ART[h.regionId] ?? "nexus", ...(door ? { door: { x: door.x, z: door.z } } : {}), decor: true, ...(h.garage ? { needsBase: h.garage } : {}) };
    }),
    ...deeds().map((d): Listing => ({ id: d.id, source: "deed", name: d.address, place: `${d.city} · ${d.district}`, tab: d.kind === "HOUSE" ? "HOMES" : d.kind === "CONDO" ? "CONDOS" : "APARTMENTS", price: d.price, blurb: d.blurb, bays: d.bays, rooms: 3, style: d.residence.style, art: d.city === "Neon City" ? "neon" : "nexus", door: frontDoor(d.residence), decor: false, kind: d.kind === "HOUSE" ? "HOUSE" : "APARTMENT" })),
  ]);
}
export const listingById = (id: string) => listings().find((l) => l.id === id);
export const styleLabel = (l: Listing) => (l.source === "deed" ? styleName(deeds().find((d) => d.id === l.id)!) : (l.kind ?? "HOUSE").replace("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()));

type Save = { nexLedger: NexLedger; housing?: HousingState | undefined; fleet?: FleetState | undefined };
export const ownsListing = (p: Save, id: string) => `home:${id}` in p.nexLedger;
export function buyListing<P extends Save>(p: P, id: string): { progression: P; message: string } | { error: string } {
  const l = listingById(id);
  if (!l) return { error: "Unknown property" };
  // housing.ts types its save with required-when-present fields; the shapes are the same
  return l.source === "deed" ? buyDeed(p, id) : (buyHome as unknown as (p: P, id: string) => { progression: P; message: string } | { error: string })(p, id);
}
export const parkedHere = (p: Save, id: string) => parkedIn(p, id);
