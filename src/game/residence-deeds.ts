/** Deeds for the walk-in residences (residences.ts): every house, apartment block, condo, loft and villa in Nexus City
 * and Neon City is its own property with a street address, a Nex price and a garage with its own parking bays.
 * Ownership is the same one-time Nex spend as every other home (`home:<id>` in the ledger, housing.ts), so it merges
 * across devices the same way. Owned fleet vehicles (fleet.ts) can be parked in an owned home's garage bays, which
 * ResidenceGarages.tsx shows in the world. */
import { nexBalance, spendNex, type NexLedger } from "./nex";
import { EMPTY_HOUSING, type HousingState } from "./housing";
import { residences, GARAGE_BAYS, DESIGNS, PORCH, GARAGE_D, garageWidth, type HomeStyle, type Residence } from "./residences";
import { FLEET, fleetById, type FleetState } from "./fleet";

export type DeedKind = "HOUSE" | "APARTMENT" | "CONDO";
export type Deed = { id: string; residence: Residence; address: string; name: string; kind: DeedKind; city: "Nexus City" | "Neon City"; district: string; price: number; bays: number; blurb: string };

const STYLE: Record<HomeStyle, { kind: DeedKind; name: string; price: number; blurb: string }> = {
  suburban: { kind: "HOUSE", name: "Suburban House", price: 24000, blurb: "Single-storey family house with a private garage." },
  townhouse: { kind: "HOUSE", name: "Townhouse", price: 30000, blurb: "Three storeys of brick on a quiet row." },
  duplex: { kind: "HOUSE", name: "Duplex", price: 36000, blurb: "Wide two-storey home with a double garage." },
  courtyard: { kind: "HOUSE", name: "Courtyard House", price: 48000, blurb: "Built round a planted courtyard; double garage." },
  apartment: { kind: "APARTMENT", name: "Apartment", price: 14000, blurb: "Ground-floor flat in a four-storey block, one parking bay." },
  condo: { kind: "CONDO", name: "Condominium", price: 60000, blurb: "Corner condo with balconies and two parking bays." },
  loft: { kind: "APARTMENT", name: "Industrial Loft", price: 42000, blurb: "Double-height warehouse loft, two bays below." },
  villa: { kind: "HOUSE", name: "Skyline Villa", price: 160000, blurb: "Glass villa over the city lights; three-car garage." },
};
const NEXUS_STREETS = ["Cedar Lane", "Foundry Row", "Courtyard Square", "Exchange Walk"];
const NEON_STREETS = ["Lumen Row", "Chrome Way", "Skyline Vista", "Arc Street"];
/** Neon prices carry the city premium */
const NEON_PREMIUM = 1.6;

function build(): Deed[] {
  return residences().map((r) => {
    const s = STYLE[r.style], n = Number(r.id.split("-").pop());
    const neon = r.city === "neon", streets = neon ? NEON_STREETS : NEXUS_STREETS;
    const address = `${neon ? 10 + n * 6 : 100 + n * 2} ${streets[(n - 1) % streets.length]}`;
    return {
      id: r.id, residence: r, address, name: `${address}`, kind: s.kind, city: neon ? "Neon City" : "Nexus City",
      district: neon ? "Skyline Residences" : "Residential Street",
      price: Math.round((s.price * (neon ? NEON_PREMIUM : 1)) / 500) * 500,
      bays: r.garage ? GARAGE_BAYS[r.style] : 0,
      blurb: `${s.name} · ${s.blurb}`,
    };
  });
}
let cached: Deed[] | null = null;
export const deeds = (): Deed[] => (cached ??= build());
export const deedById = (id: string) => deeds().find((d) => d.id === id);
export const styleName = (d: Deed) => STYLE[d.residence.style].name;

type Save = { nexLedger: NexLedger; housing?: HousingState | undefined; fleet?: FleetState | undefined };
export type DeedResult<P> = { progression: P; message: string } | { error: string };

export const ownsDeed = (p: Pick<Save, "nexLedger">, id: string) => `home:${id}` in p.nexLedger;
export const ownedDeeds = (p: Pick<Save, "nexLedger">) => deeds().filter((d) => ownsDeed(p, d.id));

export function buyDeed<P extends Save>(p: P, id: string): DeedResult<P> {
  const d = deedById(id);
  if (!d) return { error: "Unknown property" };
  if (ownsDeed(p, id)) return { error: "You already own this property" };
  const ledger = spendNex(p.nexLedger, `home:${id}`, d.price);
  if (!ledger) return { error: `Needs ${d.price.toLocaleString()} Nex (you have ${nexBalance(p.nexLedger).toLocaleString()})` };
  return { progression: { ...p, nexLedger: ledger }, message: `${d.address} is yours${d.bays ? ` · ${d.bays} parking bay${d.bays > 1 ? "s" : ""}` : ""}` };
}

/** fleet vehicle id -> residence id, only live entries */
export function parkedAt(p: Pick<Save, "housing">): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [v, at] of Object.entries(p.housing?.parked ?? {})) if (at && fleetById(v)) out[v] = at;
  return out;
}
/** the vehicles parked at one home, in bay order (bay i holds the i-th) */
export function parkedIn(p: Pick<Save, "housing">, deedId: string): string[] {
  const at = parkedAt(p);
  return FLEET.map((f) => f.id).filter((v) => at[v] === deedId);
}

/** Park an owned fleet vehicle in an owned home's garage (moving it from wherever it was parked). */
export function parkVehicle<P extends Save>(p: P, vehicleId: string, deedId: string): DeedResult<P> {
  const d = deedById(deedId), v = fleetById(vehicleId);
  if (!d || !v) return { error: "Unknown property or vehicle" };
  if (!ownsDeed(p, deedId)) return { error: "You don't own this property" };
  if (!(p.fleet?.owned ?? []).includes(vehicleId)) return { error: "Buy the vehicle first" };
  if (!d.bays) return { error: "This home has no garage" };
  const here = parkedIn(p, deedId);
  if (here.includes(vehicleId)) return { error: `${v.name} is already parked here` };
  if (here.length >= d.bays) return { error: `All ${d.bays} bay${d.bays > 1 ? "s are" : " is"} taken` };
  const housing = p.housing ?? EMPTY_HOUSING;
  return { progression: { ...p, housing: { ...housing, parked: { ...(housing.parked ?? {}), [vehicleId]: deedId } } }, message: `${v.name} parked at ${d.address}` };
}
export function unparkVehicle<P extends Save>(p: P, vehicleId: string): DeedResult<P> {
  const at = parkedAt(p)[vehicleId], v = fleetById(vehicleId);
  if (!at || !v) return { error: "Not parked anywhere" };
  const housing = p.housing ?? EMPTY_HOUSING;
  return { progression: { ...p, housing: { ...housing, parked: { ...(housing.parked ?? {}), [vehicleId]: "" } } }, message: `${v.name} taken out of the garage` };
}

/** the owned home whose front door or garage apron is within reach of a point (for the street prompt) */
export const DEED_REACH = 7;
/** the street spot just outside a home's front door */
export function frontDoor(r: Residence) { const z = DESIGNS[r.style].d / 2 + PORCH + 1; return { x: r.x + z * Math.sin(r.rot), z: r.z + z * Math.cos(r.rot) }; }
/** the spot in front of a home's garage doors */
export function garageFront(r: Residence) { const g = r.garage; if (!g) return null; const z = GARAGE_D / 2 + 2.5; return { x: g.x + z * Math.sin(g.rot), z: g.z + z * Math.cos(g.rot) }; }
/** the residence whose front door or garage front is nearest within reach, if any */
export function deedNear(x: number, z: number): string | null {
  let best: string | null = null, bd = DEED_REACH;
  for (const r of residences()) for (const p of [frontDoor(r), garageFront(r)]) {
    if (!p) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) { bd = d; best = r.id; }
  }
  return best;
}
/** the home garage a point stands inside (stepping out of the car there parks it), if any */
export function garageAt(x: number, z: number): string | null {
  for (const r of residences()) {
    const g = r.garage; if (!g) continue;
    const dx = x - g.x, dz = z - g.z, c = Math.cos(g.rot), s = Math.sin(g.rot);
    // world -> local: the inverse of residences.ts turnG
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) < garageWidth(g.bays) / 2 + 0.5 && Math.abs(lz) < GARAGE_D / 2 + 1.5) return r.id;
  }
  return null;
}
