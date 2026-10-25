/** Homes, apartments and garage living quarters (pure). Ownership and every decor purchase are one-time Nex spends
 * (`home:<id>`, `decor:<itemId>`) in the Nex ledger, so cloud merge (ledger union) never double-charges or loses a
 * purchase. What is placed in each room is a choice saved in `progression.housing` (newer copy wins per room slot).
 * Prices scale with location: Undercity cheap, Aegis Spire penthouses very expensive. */
import { nexBalance, spendNex, type NexLedger } from "./nex";
import type { GarageId } from "./fleet";

export type HomeKind = "APARTMENT" | "HOUSE" | "PENTHOUSE" | "GARAGE_QUARTERS";
export type RoomId = "living" | "bedroom" | "bathroom" | "kitchen" | "garage";
export type DecorSlot = "wallpaper" | "paint" | "floor" | "furniture" | "art" | "tv" | "bed" | "bath" | "lighting";

export type HomeDef = { id: string; name: string; kind: HomeKind; district: string; regionId: string; price: number; rooms: readonly RoomId[]; garage?: GarageId; blurb: string };
export type DecorDef = { id: string; name: string; slot: DecorSlot; price: number; /** rooms it can go in */ rooms: readonly RoomId[] };

export const HOMES: readonly HomeDef[] = [
  { id: "rustmuck-capsule", name: "Rust-Muck Capsule Flat", kind: "APARTMENT", district: "Rust-Muck Undercity", regionId: "nexus", price: 2500, rooms: ["living", "bathroom"], blurb: "One room over the black market. Cheap, loud, yours." },
  { id: "grid-loft", name: "Grid Transit Loft", kind: "APARTMENT", district: "The Grid", regionId: "nexus", price: 9000, rooms: ["living", "bedroom", "bathroom", "kitchen"], blurb: "Open loft above the walkways. Trains hum through the floor." },
  { id: "veridan-cabin", name: "Verdant Forest Cabin", kind: "HOUSE", district: "Verdant Wilds", regionId: "veridan", price: 32000, rooms: ["living", "bedroom", "bathroom", "kitchen"], blurb: "Timber and solar glass under the canopy." },
  { id: "solara-villa", name: "Solara Dune Villa", kind: "HOUSE", district: "Solara Desert", regionId: "solara", price: 85000, rooms: ["living", "bedroom", "bedroom", "bathroom", "kitchen"], blurb: "Shaded courtyard villa facing the Glass Flats." },
  { id: "aegis-penthouse", name: "Aegis Spire Penthouse", kind: "PENTHOUSE", district: "Aegis Spire", regionId: "nexus", price: 15000, rooms: ["living", "bedroom", "bedroom", "bathroom", "bathroom", "kitchen"], blurb: "The top of the city. Glass walls, sky deck, private lift." },
  { id: "wastes-hangar-bunk", name: "Scrap-Hangar Bunkroom", kind: "GARAGE_QUARTERS", district: "Rust Port", regionId: "wastelands", price: 6000, rooms: ["garage", "bedroom", "bathroom"], garage: "base-01", blurb: "Living quarters built into your Wastelands hangar." },
  { id: "frost-bunker-suite", name: "Frostspire Bunker Suite", kind: "GARAGE_QUARTERS", district: "Frostspire Mountains", regionId: "frostspire", price: 10000, rooms: ["garage", "living", "bedroom", "bathroom"], garage: "base-03", blurb: "Heated quarters behind the blast doors." },
];

const ALL: readonly RoomId[] = ["living", "bedroom", "bathroom", "kitchen", "garage"];
export const DECOR: readonly DecorDef[] = [
  { id: "paint-slate", name: "Slate paint", slot: "paint", price: 150, rooms: ALL },
  { id: "paint-neon-violet", name: "Neon violet paint", slot: "paint", price: 300, rooms: ALL },
  { id: "wall-circuit", name: "Circuit wallpaper", slot: "wallpaper", price: 600, rooms: ["living", "bedroom", "kitchen"] },
  { id: "wall-veyran-silk", name: "Veyran silk wallpaper", slot: "wallpaper", price: 1800, rooms: ["living", "bedroom"] },
  { id: "floor-concrete", name: "Polished concrete", slot: "floor", price: 400, rooms: ALL },
  { id: "floor-oak", name: "Veridan oak boards", slot: "floor", price: 1500, rooms: ["living", "bedroom", "kitchen"] },
  { id: "sofa-street", name: "Street-salvage sofa", slot: "furniture", price: 500, rooms: ["living", "garage"] },
  { id: "sofa-aegis", name: "Aegis lounge set", slot: "furniture", price: 6000, rooms: ["living"] },
  { id: "art-fracture", name: "Fracture print", slot: "art", price: 800, rooms: ["living", "bedroom"] },
  { id: "art-vyrak", name: "Vyrak oil painting", slot: "art", price: 4000, rooms: ["living", "bedroom"] },
  { id: "tv-wall", name: "Wall-screen TV", slot: "tv", price: 1200, rooms: ["living", "bedroom", "garage"] },
  { id: "tv-holo", name: "Holo-theatre", slot: "tv", price: 6000, rooms: ["living"] },
  { id: "bed-bunk", name: "Bunk bed", slot: "bed", price: 400, rooms: ["bedroom"] },
  { id: "bed-king", name: "King float bed", slot: "bed", price: 5000, rooms: ["bedroom"] },
  { id: "bath-shower", name: "Steam shower", slot: "bath", price: 700, rooms: ["bathroom"] },
  { id: "bath-soak", name: "Mineral soak tub", slot: "bath", price: 3500, rooms: ["bathroom"] },
  { id: "light-neon", name: "Neon strip lights", slot: "lighting", price: 350, rooms: ALL },
];

/** placed decor: homeId -> "roomIndex:slot" -> decorId */
/** `parked`: fleet vehicle id -> the residence (residence-deeds.ts) whose garage it is parked in; "" = taken out again
 * (kept, not deleted, so a cloud merge with an older copy can't park it back) */
export type HousingState = { placed: Record<string, Record<string, string>>; home: string | null; parked?: Record<string, string> };
export const EMPTY_HOUSING: HousingState = { placed: {}, home: null };
/** residence ids (residences.ts), checked by shape here so housing.ts stays leaf-level */
export const RESIDENCE_ID = /^(nexus|neon)-home-\d+$/;

type HouseSave = { nexLedger: NexLedger; housing?: HousingState; fleet?: { garages: GarageId[] } };
export type HousingResult<P> = { progression: P; message: string } | { error: string };

export const homeById = (id: string) => HOMES.find((h) => h.id === id);
export const decorById = (id: string) => DECOR.find((d) => d.id === id);
export const ownsHome = (p: HouseSave, id: string) => `home:${id}` in p.nexLedger;
export const ownsDecor = (p: HouseSave, id: string) => `decor:${id}` in p.nexLedger;
export const ownedHomes = (p: HouseSave) => HOMES.filter((h) => ownsHome(p, h.id));

export function buyHome<P extends HouseSave>(p: P, id: string): HousingResult<P> {
  const h = homeById(id);
  if (!h) return { error: "Unknown property" };
  if (ownsHome(p, id)) return { error: "You already own this property" };
  if (h.garage && !(p.fleet?.garages ?? []).includes(h.garage)) return { error: "Buy the garage base first to add living quarters" };
  const ledger = spendNex(p.nexLedger, `home:${id}`, h.price);
  if (!ledger) return { error: `Needs ${h.price} Nex (you have ${nexBalance(p.nexLedger)})` };
  const housing = p.housing ?? EMPTY_HOUSING;
  return { progression: { ...p, nexLedger: ledger, housing: { ...housing, home: housing.home ?? id } }, message: `${h.name} is yours` };
}

export function buyDecor<P extends HouseSave>(p: P, id: string): HousingResult<P> {
  const d = decorById(id);
  if (!d) return { error: "Unknown item" };
  if (ownsDecor(p, id)) return { error: "Already owned — place it in any home for free" };
  const ledger = spendNex(p.nexLedger, `decor:${id}`, d.price);
  if (!ledger) return { error: `Needs ${d.price} Nex (you have ${nexBalance(p.nexLedger)})` };
  return { progression: { ...p, nexLedger: ledger }, message: `${d.name} bought` };
}

/** Place (or with decorId null, clear) an owned item in a room of an owned home. Owned decor is reusable in every home. */
export function placeDecor<P extends HouseSave>(p: P, homeId: string, roomIndex: number, slot: DecorSlot, decorId: string | null): HousingResult<P> {
  const h = homeById(homeId);
  if (!h || !ownsHome(p, homeId)) return { error: "You don't own this property" };
  const room = h.rooms[roomIndex];
  if (!room) return { error: "No such room" };
  const housing = p.housing ?? EMPTY_HOUSING;
  const key = `${roomIndex}:${slot}`;
  const rooms = { ...(housing.placed[homeId] ?? {}) };
  if (decorId === null) delete rooms[key];
  else {
    const d = decorById(decorId);
    if (!d || !ownsDecor(p, decorId)) return { error: "Buy this item first" };
    if (d.slot !== slot) return { error: `${d.name} doesn't go in the ${slot} slot` };
    if (!d.rooms.includes(room)) return { error: `${d.name} can't go in a ${room}` };
    rooms[key] = decorId;
  }
  return { progression: { ...p, housing: { ...housing, placed: { ...housing.placed, [homeId]: rooms } } }, message: decorId ? "Placed" : "Removed" };
}

export function normalizeHousing(raw: unknown): HousingState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<HousingState>;
  const placed: HousingState["placed"] = {};
  if (r.placed && typeof r.placed === "object") for (const [h, rooms] of Object.entries(r.placed)) {
    if (!homeById(h) || !rooms || typeof rooms !== "object") continue;
    placed[h] = {};
    for (const [k, v] of Object.entries(rooms)) if (typeof v === "string" && decorById(v)) placed[h]![k] = v;
  }
  const parked: Record<string, string> = {};
  if (r.parked && typeof r.parked === "object") for (const [v, at] of Object.entries(r.parked)) if (typeof at === "string" && (at === "" || RESIDENCE_ID.test(at))) parked[v] = at;
  return { placed, home: typeof r.home === "string" && homeById(r.home) ? r.home : null, ...(Object.keys(parked).length ? { parked } : {}) };
}
export function mergeHousing(a: HousingState, b: HousingState, aIsNewer: boolean): HousingState {
  const newer = aIsNewer ? a : b, older = aIsNewer ? b : a;
  const placed: HousingState["placed"] = {};
  for (const h of new Set([...Object.keys(older.placed), ...Object.keys(newer.placed)])) placed[h] = { ...(older.placed[h] ?? {}), ...(newer.placed[h] ?? {}) };
  const parked = { ...(older.parked ?? {}), ...(newer.parked ?? {}) };
  return { placed, home: newer.home ?? older.home, ...(Object.keys(parked).length ? { parked } : {}) };
}
