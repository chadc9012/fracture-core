/** Living World core (pure): the two inhabited cities, their factions, reputation, district status and the
 * persistent `progression.living` record. Neon City and Nexus City stay separate places: each has its own
 * districts, factions, NPCs, patrols and events; nothing here links one city's standing to the other's.
 *
 * Persistence (one save system, additive merges):
 *  - reputation is two monotonic counters per faction (`gain`, `loss`); standing = gain − loss. Both counters
 *    only grow, so a cloud merge takes the max of each and never loses an earned (or lost) point;
 *  - district outcomes are timestamps (`securedAt`, `fallenAt`) merged by max, so the newest outcome wins;
 *  - contracts in progress merge by max progress; finished ones live in `earnedRewards` ("living:contract:<id>");
 *  - revealed intel is a union.
 * Rendering, input and spawning live elsewhere (LivingCity.tsx, Scene); this file only answers questions. */
import { REGIONS, NEON_OFFSET } from "./world";

export type CityId = "nexus" | "neon";
export type FactionId = "wardens" | "guild" | "syndicate" | "aegis";
export type RepTier = "HOSTILE" | "WARY" | "NEUTRAL" | "TRUSTED" | "HONORED";

const NEXUS_REGION = REGIONS.find((r) => r.id === "nexus")!;
export const NEXUS_CENTER = { x: NEXUS_REGION.x, z: NEXUS_REGION.z };
export const NEON_CENTER = { x: NEXUS_REGION.x + NEON_OFFSET.x, z: NEXUS_REGION.z + NEON_OFFSET.z };

export const CITIES: Record<CityId, { id: CityId; name: string; x: number; z: number; radius: number }> = {
  nexus: { id: "nexus", name: "Nexus City", ...NEXUS_CENTER, radius: 95 },
  neon: { id: "neon", name: "Neon City", ...NEON_CENTER, radius: 62 },
};

/** which city (if any) a world point is in */
export function cityAt(x: number, z: number): CityId | null {
  for (const c of [CITIES.neon, CITIES.nexus]) if (Math.hypot(x - c.x, z - c.z) <= c.radius) return c.id;
  return null;
}

export const FACTIONS: Record<FactionId, { id: FactionId; name: string; city: CityId; rival: FactionId | null; color: string; blurb: string }> = {
  wardens: { id: "wardens", name: "Nexus Wardens", city: "nexus", rival: null, color: "#66e0ff", blurb: "Civic security of Nexus City. They keep the hub standing and the perimeter honest." },
  guild: { id: "guild", name: "Arcology Guild", city: "nexus", rival: null, color: "#ffc65a", blurb: "Merchants, techs and smiths who keep Nexus City's markets and workshops running." },
  syndicate: { id: "syndicate", name: "Neon Syndicate", city: "neon", rival: "aegis", color: "#ff2ea6", blurb: "The Undercity's fixers, smugglers and street dealers." },
  aegis: { id: "aegis", name: "Aegis Directorate", city: "neon", rival: "syndicate", color: "#38e8ff", blurb: "The Spire's corporate authority and its quarantine checkpoint." },
};
export const CITY_FACTIONS: Record<CityId, FactionId[]> = { nexus: ["wardens", "guild"], neon: ["syndicate", "aegis"] };

/* ------------------------------------------------------------ districts ------------------------------------------------------------ */
export type District = { id: string; city: CityId; name: string; x: number; z: number; faction: FactionId };

const nexusAnchor = (bearing: number, r = 60) => ({ x: NEXUS_CENTER.x + Math.sin(bearing) * r, z: NEXUS_CENTER.z - Math.cos(bearing) * r });
const neonAt = (lx: number, lz: number) => ({ x: NEON_CENTER.x + lx, z: NEON_CENTER.z + lz });

export const DISTRICTS: readonly District[] = [
  { id: "nexus:spire", city: "nexus", name: "Spire District", ...nexusAnchor(0), faction: "wardens" },
  { id: "nexus:market", city: "nexus", name: "Market District", ...nexusAnchor(Math.PI / 2), faction: "guild" },
  { id: "nexus:shipyard", city: "nexus", name: "Shipyard", ...nexusAnchor(Math.PI), faction: "guild" },
  { id: "nexus:arcology", city: "nexus", name: "Arcology", ...nexusAnchor(-Math.PI / 2), faction: "wardens" },
  { id: "neon:spire", city: "neon", name: "Aegis Spire", ...neonAt(0, -29), faction: "aegis" },
  { id: "neon:undercity", city: "neon", name: "Undercity", ...neonAt(-22, -7), faction: "syndicate" },
  { id: "neon:market", city: "neon", name: "Neon Market", ...neonAt(0, 12), faction: "syndicate" },
  { id: "neon:grid", city: "neon", name: "The Grid", ...neonAt(40, 20), faction: "aegis" },
];
export const districtById = (id: string) => DISTRICTS.find((d) => d.id === id);

/** district of a world point, or null outside both cities */
export function districtOf(x: number, z: number): District | null {
  const city = cityAt(x, z);
  if (!city) return null;
  if (city === "nexus") {
    const a = Math.atan2(x - NEXUS_CENTER.x, -(z - NEXUS_CENTER.z)); // 0 = north, +π/2 = east (same convention as nexus-districts.ts)
    const id = a > -Math.PI / 4 && a <= Math.PI / 4 ? "spire" : a > Math.PI / 4 && a <= (3 * Math.PI) / 4 ? "market" : a > -(3 * Math.PI) / 4 && a <= -Math.PI / 4 ? "arcology" : "shipyard";
    return districtById(`nexus:${id}`)!;
  }
  const lx = x - NEON_CENTER.x, lz = z - NEON_CENTER.z;
  const id = lz < -26 ? "spire" : Math.abs(lz + 7) < 8 ? "undercity" : Math.abs(lx) < 12 ? "market" : "grid";
  return districtById(`neon:${id}`)!;
}

/* ------------------------------------------------------------ persistent state ------------------------------------------------------------ */
export type LivingState = {
  gain: Partial<Record<FactionId, number>>;
  loss: Partial<Record<FactionId, number>>;
  districts: Record<string, { securedAt: number; fallenAt: number }>;
  contracts: Record<string, { progress: number; acceptedAt: number }>;
  intel: string[];
};
export const EMPTY_LIVING: LivingState = { gain: {}, loss: {}, districts: {}, contracts: {}, intel: [] };

const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

export function normalizeLiving(raw: unknown): LivingState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<LivingState>;
  const counters = (v: unknown) => {
    const out: Partial<Record<FactionId, number>> = {};
    if (v && typeof v === "object") for (const f of FACTION_IDS) { const n = num((v as Record<string, unknown>)[f]); if (n) out[f] = n; }
    return out;
  };
  const districts: LivingState["districts"] = {};
  if (r.districts && typeof r.districts === "object") for (const [k, v] of Object.entries(r.districts)) if (districtById(k) && v && typeof v === "object") districts[k] = { securedAt: num(v.securedAt), fallenAt: num(v.fallenAt) };
  const contracts: LivingState["contracts"] = {};
  if (r.contracts && typeof r.contracts === "object") for (const [k, v] of Object.entries(r.contracts)) if (v && typeof v === "object") contracts[k] = { progress: num(v.progress), acceptedAt: num(v.acceptedAt) };
  return { gain: counters(r.gain), loss: counters(r.loss), districts, contracts, intel: Array.isArray(r.intel) ? [...new Set(r.intel.filter((x): x is string => typeof x === "string"))] : [] };
}

/** Cloud/slot merge: counters max, district timestamps max, contract progress max (finished ones dropped), intel union. */
export function mergeLiving(a: LivingState, b: LivingState, finished: readonly string[] = []): LivingState {
  const maxRec = <K extends string>(x: Partial<Record<K, number>>, y: Partial<Record<K, number>>) => {
    const out: Partial<Record<K, number>> = { ...x };
    for (const [k, v] of Object.entries(y) as [K, number][]) out[k] = Math.max(out[k] ?? 0, v);
    return out;
  };
  const districts: LivingState["districts"] = { ...a.districts };
  for (const [k, v] of Object.entries(b.districts)) { const o = districts[k]; districts[k] = o ? { securedAt: Math.max(o.securedAt, v.securedAt), fallenAt: Math.max(o.fallenAt, v.fallenAt) } : v; }
  const contracts: LivingState["contracts"] = { ...a.contracts };
  for (const [k, v] of Object.entries(b.contracts)) { const o = contracts[k]; contracts[k] = o ? { progress: Math.max(o.progress, v.progress), acceptedAt: Math.min(o.acceptedAt || v.acceptedAt, v.acceptedAt || o.acceptedAt) } : v; }
  for (const id of finished) if (id.startsWith("living:contract:")) delete contracts[id.slice("living:contract:".length)];
  return { gain: maxRec(a.gain, b.gain), loss: maxRec(a.loss, b.loss), districts, contracts, intel: [...new Set([...a.intel, ...b.intel])] };
}

/* ------------------------------------------------------------ reputation ------------------------------------------------------------ */
export const REP_MIN = -100, REP_MAX = 100;
export const repOf = (s: LivingState, f: FactionId) => Math.max(REP_MIN, Math.min(REP_MAX, (s.gain[f] ?? 0) - (s.loss[f] ?? 0)));

export function repTier(rep: number): RepTier {
  if (rep <= -40) return "HOSTILE";
  if (rep < -10) return "WARY";
  if (rep < 20) return "NEUTRAL";
  if (rep < 55) return "TRUSTED";
  return "HONORED";
}
export const tierOf = (s: LivingState, f: FactionId) => repTier(repOf(s, f));
const TIER_ORDER: readonly RepTier[] = ["HOSTILE", "WARY", "NEUTRAL", "TRUSTED", "HONORED"];
export const tierAtLeast = (t: RepTier, min: RepTier) => TIER_ORDER.indexOf(t) >= TIER_ORDER.indexOf(min);

/** What a standing actually changes in play. */
export const TIER_RULES: Record<RepTier, { trade: boolean; priceMult: number; patrol: "hostile" | "neutral" | "ally"; label: string; color: string }> = {
  HOSTILE: { trade: false, priceMult: 1.5, patrol: "hostile", label: "Hostile", color: "#ff4d4d" },
  WARY: { trade: true, priceMult: 1.25, patrol: "neutral", label: "Wary", color: "#ff9b4d" },
  NEUTRAL: { trade: true, priceMult: 1, patrol: "ally", label: "Neutral", color: "#c9d3dd" },
  TRUSTED: { trade: true, priceMult: 0.9, patrol: "ally", label: "Trusted", color: "#7ef2b0" },
  HONORED: { trade: true, priceMult: 0.8, patrol: "ally", label: "Honored", color: "#ffd166" },
};

/** Standing change. In Neon City the two factions are rivals: helping one costs half as much with the other
 * (`spill: false` for effects that are already explicit about both sides). */
export function adjustRep(s: LivingState, f: FactionId, amount: number, spill = true): LivingState {
  if (!amount) return s;
  const bump = (st: LivingState, fac: FactionId, a: number): LivingState =>
    a > 0 ? { ...st, gain: { ...st.gain, [fac]: (st.gain[fac] ?? 0) + a } } : { ...st, loss: { ...st.loss, [fac]: (st.loss[fac] ?? 0) - a } };
  let out = bump(s, f, amount);
  const rival = FACTIONS[f].rival;
  if (spill && rival && amount > 0) out = bump(out, rival, -Math.ceil(amount / 2));
  return out;
}

/* ------------------------------------------------------------ districts: status ------------------------------------------------------------ */
export type DistrictStatus = "STABLE" | "SECURED" | "FALLEN";
/** how long a defended district stays "secured" (its discount and calmer streets) */
export const SECURED_MS = 2 * 86_400_000;

export function districtStatus(s: LivingState, id: string, now: number): DistrictStatus {
  const d = s.districts[id];
  if (!d) return "STABLE";
  if (d.fallenAt > d.securedAt) return "FALLEN";
  if (d.securedAt && now - d.securedAt < SECURED_MS) return "SECURED";
  return "STABLE";
}
export function recordDistrict(s: LivingState, id: string, outcome: "WON" | "FAILED", now: number): LivingState {
  const d = s.districts[id] ?? { securedAt: 0, fallenAt: 0 };
  return { ...s, districts: { ...s.districts, [id]: outcome === "WON" ? { ...d, securedAt: Math.max(now, d.fallenAt + 1) } : { ...d, fallenAt: Math.max(now, d.securedAt + 1) } } };
}

/* ------------------------------------------------------------ shops ------------------------------------------------------------ */
/** which faction runs each walk-up shop inside the two cities (others are outside the Living World) */
export const SHOP_FACTION: Record<string, FactionId> = {
  "nexus-armory": "wardens", "nexus-plate": "wardens", "nexus-calibration": "guild", "nexus-outfitter": "guild",
  "neon-dealer": "syndicate", "neon-mods": "syndicate",
};

/** Trading terms a city shop offers right now: refused while its faction is hostile or its district has fallen,
 * otherwise priced by standing (and 10% off while the district is freshly secured). Shops outside the cities: open, ×1. */
export function livingShopTerms(s: LivingState | undefined, shop: { id: string; x: number; z: number }, now: number): { lock: string | null; priceMult: number } {
  const f = SHOP_FACTION[shop.id];
  if (!s || !f) return { lock: null, priceMult: 1 };
  const tier = tierOf(s, f);
  const district = districtOf(shop.x, shop.z);
  const status = district ? districtStatus(s, district.id, now) : "STABLE";
  if (!TIER_RULES[tier].trade) return { lock: `${FACTIONS[f].name} refuse to trade with you (Hostile)`, priceMult: TIER_RULES[tier].priceMult };
  if (status === "FALLEN") return { lock: `${district!.name} was overrun. Defend it to reopen trade`, priceMult: 1 };
  return { lock: null, priceMult: TIER_RULES[tier].priceMult * (status === "SECURED" ? 0.9 : 1) };
}
