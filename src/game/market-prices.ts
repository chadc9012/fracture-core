/** The price scale for big-ticket purchases: vehicles, aircraft and property are priced like a big open-world crime-sandbox economy,
 * 1 Nex ~ $100 of that scale (a $240k light plane is 2,400 Nex; a $1.75M attack helicopter is 17,500; a $6.5M fighter is 65,000; a $10M
 * luxury jet is 100,000). Housing was already on this scale (a 2,500 Nex capsule flat ~ a cheap apartment, a 200,000 Nex Aegis Spire
 * penthouse ~ a $20M mansion). Race payouts of 50-300 Nex put a mid-tier car at a few dozen races, as the model it follows does.
 * Pure data: fleet.ts charges it, the garage and atlas show it. */
import type { NexLedger } from "./nex";

export const USD_PER_NEX = 100;
/** Nex price of every fleet build (fleet.ts), tiered by what it is: bikes and runabouts, 4x4s and sports cars, supers and hypers,
 * heavy trucks, armour, boats and submersibles, then helicopters, VTOLs and jets, with the one exotic on top. */
export const FLEET_NEX_PRICE: Readonly<Record<string, number>> = {
  "civic-rover": 600,           // city runabout
  "nomad-bike": 900,
  "sandstalker-atv": 1_200,
  "neon-drift": 3_500,          // sports car
  "goliath-4x4": 4_500,         // SUV / off-road
  "dune-stalker": 5_500,
  "rift-runner": 6_500,
  "war-rig": 8_500,             // heavy truck
  "behemoth-v16": 9_500,
  "apex-hauler": 11_000,
  "ghost-ray": 12_000,          // hover bike
  "triton-hydrospear": 14_000,  // patrol boat
  "skyhawk": 17_500,            // attack helicopter ($1.75M)
  "void-chaser": 18_000,        // supercar
  "aegis-siege": 22_000,        // armoured siege tank
  "nautilus-abyss": 22_000,     // submersible
  "riftwing": 30_000,           // jet
  "solara-falcon": 36_000,      // jet
  "valkyrie-vtol": 39_900,      // VTOL gunship ($3.99M)
  "f39-jupiter": 65_000,        // fighter jet ($6.5M)
  "void-skimmer-prototype": 100_000, // the exotic, a $10M luxury-jet price
};
export const fleetNexPrice = (id: string): number => FLEET_NEX_PRICE[id] ?? 0;
export const fleetLedgerKey = (id: string) => `fleet:${id}`;
export const ownsFleetByLedger = (ledger: NexLedger | undefined, id: string) => !!ledger && fleetLedgerKey(id) in ledger;
