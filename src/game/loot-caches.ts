/**
 * World loot boxes (pure, deterministic). Every region has authored-by-seed cache sites, each with a
 * scenario that decides HOW it opens (plain, guarded, encrypted, sunken in a lake, storm-charged,
 * moon-locked). Caches refill daily. Opens are recorded in progression.earnedRewards as
 * "cache:<id>@<day>" so the existing additive cloud merge (union) keeps them without a schema change.
 * Side contracts complete once per region / scenario and pay through rewardMission (first-clear bonus).
 */
import { mulberry32 } from "./useKeyboard";
import { REGIONS, type ZoneKind } from "./world";
import { heightAt, riverAt, waterNetwork, WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import type { GearItem, GearSlot, MaterialId } from "./inventory";
import { grantXP } from "./xp";
import { rewardMission, type PlayerProgression } from "./progression";

export type CacheRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
export type CacheScenario = "supply" | "guarded" | "encrypted" | "sunken" | "storm" | "moon";
export type LootCache = { id: string; regionId: string; x: number; z: number; y: number; scenario: CacheScenario; rarity: CacheRarity };

export const SCENARIO_LABEL: Record<CacheScenario, string> = {
  supply: "Supply cache",
  guarded: "Guarded cache — clear nearby hostiles",
  encrypted: "Encrypted cache — hold to decrypt",
  sunken: "Sunken cache",
  storm: "Storm-charged cache — opens in rain or storm",
  moon: "Moon-locked cache — opens at night",
};

export const RARITY_HEX: Record<CacheRarity, string> = { COMMON: "#c9d1d9", RARE: "#4ea3ff", EPIC: "#b46cff", LEGENDARY: "#ffb23e" };

/** each region's own material (matches the regional shop currencies) */
export const REGION_MATERIAL: Record<string, MaterialId> = {
  nexus: "scrapMetal", veridan: "sporeFiber", swamps: "bioCatalyst", wastelands: "fuel",
  solara: "thermalShards", ember: "anomalyCarbon", frostspire: "cryoCrystal",
};

const TIERS: CacheRarity[] = ["COMMON", "RARE", "EPIC", "LEGENDARY"];
const ZONE_TIER: Record<ZoneKind, number> = { safe: 0, starter: 0, war: 1, fracture: 1, core: 2 };
const SCENARIO_BONUS: Record<CacheScenario, number> = { supply: 0, guarded: 1, encrypted: 0, sunken: 1, storm: 1, moon: 1 };
const PER_REGION: Record<string, number> = { nexus: 3 };
const LAND_SCENARIOS: CacheScenario[] = ["supply", "guarded", "encrypted", "storm", "moon", "supply"];
export const ENCRYPT_SECONDS = 3;
export const GUARD_RADIUS = 30;
export const CACHE_REACH = 3;

let cached: LootCache[] | null = null;

/** all cache sites in the world (stable across sessions and clients) */
export function lootCaches(): LootCache[] {
  if (cached) return cached;
  const out: LootCache[] = [];
  for (const r of REGIONS) {
    const n = PER_REGION[r.id] ?? 6;
    const rnd = mulberry32(r.id.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    let placed = 0, guard = 400;
    while (placed < n && guard-- > 0) {
      const a = rnd() * Math.PI * 2, d = r.radius * (0.2 + rnd() * 0.7);
      const x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
      const y = heightAt(x, z);
      if (y < WATER_LEVEL + 0.5) continue;
      if (distanceToRoad(x, z) < LANE_HALF_WIDTH + 2) continue;
      const rv = riverAt(x, z); if (rv && rv.dist < rv.w + 3) continue;
      if (out.some((c) => Math.hypot(c.x - x, c.z - z) < 14)) continue;
      const scenario = r.kind === "safe" ? "supply" : LAND_SCENARIOS[placed % LAND_SCENARIOS.length]!;
      // legendary is rare: only a lucky roll lifts a cache to the top tier
      const tier = Math.min(rnd() < 0.15 ? 3 : 2, ZONE_TIER[r.kind] + SCENARIO_BONUS[scenario] + (rnd() < 0.12 ? 1 : 0));
      out.push({ id: `${r.id}-${placed}`, regionId: r.id, x, z, y, scenario, rarity: TIERS[tier]! });
      placed++;
    }
  }
  // one sunken cache on the bed of every lake
  waterNetwork().lakes.forEach((l, i) => {
    const regionId = REGIONS.find((r) => Math.hypot(r.x - l.x, r.z - l.z) < r.radius * 1.1)?.id ?? "nexus";
    out.push({ id: `lake-${i}`, regionId, x: l.x, z: l.z, y: heightAt(l.x, l.z), scenario: "sunken", rarity: "EPIC" });
  });
  cached = out;
  return out;
}

const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);
const openKey = (id: string, now: number) => `cache:${id}@${dayKey(now)}`;

export function isOpenedToday(p: PlayerProgression, id: string, now = Date.now()) {
  return p.earnedRewards.includes(openKey(id, now));
}

/** every cache id this save has ever opened (for side contracts) */
export function cachesEverOpened(p: PlayerProgression): Set<string> {
  const s = new Set<string>();
  for (const k of p.earnedRewards) if (k.startsWith("cache:")) s.add(k.slice(6, k.lastIndexOf("@")));
  return s;
}

export type CacheContext = { enemiesNear: number; weather: string | undefined; night: number; heldSeconds: number };

export function canOpen(c: LootCache, ctx: CacheContext): { ok: boolean; reason: string } {
  switch (c.scenario) {
    case "guarded": return ctx.enemiesNear > 0 ? { ok: false, reason: `${ctx.enemiesNear} hostile${ctx.enemiesNear > 1 ? "s" : ""} guarding` } : { ok: true, reason: "" };
    case "encrypted": return ctx.heldSeconds >= ENCRYPT_SECONDS ? { ok: true, reason: "" } : { ok: false, reason: "Hold to decrypt" };
    case "storm": return ctx.weather === "STORM" || ctx.weather === "RAIN" ? { ok: true, reason: "" } : { ok: false, reason: "Needs rain or storm charge" };
    case "moon": return ctx.night >= 0.6 ? { ok: true, reason: "" } : { ok: false, reason: "Sealed until nightfall" };
    default: return { ok: true, reason: "" };
  }
}

const RARITY_AMOUNT: Record<CacheRarity, number> = { COMMON: 3, RARE: 6, EPIC: 10, LEGENDARY: 16 };

/** the contents of a cache today: its region's material, scaled by rarity, plus a rare bonus */
export function rollCache(c: LootCache, now = Date.now()): Partial<Record<MaterialId, number>> {
  const rnd = mulberry32((c.id + dayKey(now)).split("").reduce((a, ch) => (a * 33 + ch.charCodeAt(0)) >>> 0, 5381));
  const base = RARITY_AMOUNT[c.rarity];
  const loot: Partial<Record<MaterialId, number>> = { [REGION_MATERIAL[c.regionId] ?? "scrapMetal"]: base + Math.floor(rnd() * 3) };
  if (rnd() < 0.3 + TIERS.indexOf(c.rarity) * 0.15) loot.dataShards = 1 + Math.floor(rnd() * 2);
  if (c.rarity === "LEGENDARY" || (c.rarity === "EPIC" && rnd() < 0.35)) loot.vehicleParts = 2;
  return loot;
}

/* ---------------- gear drops ---------------- */

/** Chance a cache also holds one weapon or armor piece; Legendary boxes always do. */
export const GEAR_CHANCE: Record<CacheRarity, number> = { COMMON: 0.1, RARE: 0.25, EPIC: 0.45, LEGENDARY: 1 };
/** Power by box rarity — sits just above starter gear so boxes help without outclassing mission/raid rewards. */
export const GEAR_POWER: Record<CacheRarity, number> = { COMMON: 80, RARE: 95, EPIC: 110, LEGENDARY: 125 };
const WEAPON_SLOTS: GearSlot[] = ["primary", "secondary", "heavy"];
const ARMOR_SLOTS: GearSlot[] = ["helmet", "chest", "gauntlets", "legs"];
const REGION_ELEMENT: Record<string, GearItem["element"]> = { nexus: "ARC", veridan: "BIO", frostspire: "CRYO", ember: "THERMAL", wastelands: "KINETIC", solara: "THERMAL", swamps: "BIO" };
const SLOT_NAME: Partial<Record<GearSlot, string>> = { primary: "Rifle", secondary: "Sidearm", heavy: "Launcher", helmet: "Helm", chest: "Plate", gauntlets: "Grips", legs: "Greaves" };

/** At most one piece per open, weapons and armor equally likely, element follows the region. */
export function rollCacheGear(c: LootCache, now = Date.now()): GearItem | null {
  const rnd = mulberry32((c.id + "gear" + dayKey(now)).split("").reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7919));
  if (rnd() >= GEAR_CHANCE[c.rarity]) return null;
  const pool = rnd() < 0.5 ? WEAPON_SLOTS : ARMOR_SLOTS;
  const slot = pool[Math.floor(rnd() * pool.length)]!;
  const region = REGIONS.find((r) => r.id === c.regionId);
  return {
    id: `cache-gear-${c.id}-${dayKey(now)}`, name: `${region?.name ?? "Salvaged"} ${SLOT_NAME[slot]}`, slot,
    power: GEAR_POWER[c.rarity] + Math.floor(rnd() * 5), level: 1, element: REGION_ELEMENT[c.regionId] ?? "KINETIC",
    source: `${c.rarity.toLowerCase()} loot box`, ...(c.rarity === "LEGENDARY" ? { rarity: "LEGENDARY" as const } : {}),
  };
}

/* ---------------- side contracts ---------------- */

export type SideContract = { id: string; title: string; detail: string; need: number; progress: (p: PlayerProgression, opened: Set<string>) => number; reward: Partial<Record<MaterialId, number>> };

const all = () => lootCaches();
const countWhere = (opened: Set<string>, f: (c: LootCache) => boolean) => all().filter((c) => f(c) && opened.has(c.id)).length;

export const SIDE_CONTRACTS: SideContract[] = [
  ...REGIONS.map((r): SideContract => ({
    id: `side-salvage-${r.id}`, title: `Salvage Survey: ${r.name}`, detail: `Recover 3 different caches in ${r.name}.`, need: 3,
    progress: (_p, o) => countWhere(o, (c) => c.regionId === r.id), reward: { [REGION_MATERIAL[r.id] ?? "scrapMetal"]: 12, dataShards: 2 },
  })),
  { id: "side-deep-salvage", title: "Deep Salvage", detail: "Dive to a sunken cache on a lake bed.", need: 1, progress: (_p, o) => countWhere(o, (c) => c.scenario === "sunken"), reward: { dataShards: 3, vehicleParts: 3 } },
  { id: "side-storm-chaser", title: "Storm Chaser", detail: "Crack 2 storm-charged caches while the weather rages.", need: 2, progress: (_p, o) => countWhere(o, (c) => c.scenario === "storm"), reward: { thermalShards: 8, dataShards: 2 } },
  { id: "side-moonrunner", title: "Moonrunner", detail: "Open 2 moon-locked caches after dark.", need: 2, progress: (_p, o) => countWhere(o, (c) => c.scenario === "moon"), reward: { cryoCrystal: 8, dataShards: 2 } },
  { id: "side-breaker", title: "Breaker", detail: "Clear the guards off 3 guarded caches.", need: 3, progress: (_p, o) => countWhere(o, (c) => c.scenario === "guarded"), reward: { reinforcedAlloy: 10, microCircuits: 6 } },
  { id: "side-codebreaker", title: "Codebreaker", detail: "Decrypt 3 encrypted caches.", need: 3, progress: (_p, o) => countWhere(o, (c) => c.scenario === "encrypted"), reward: { microCircuits: 10, dataShards: 2 } },
];

export function contractStatus(p: PlayerProgression) {
  const opened = cachesEverOpened(p);
  return SIDE_CONTRACTS.map((c) => ({ contract: c, have: Math.min(c.need, c.progress(p, opened)), done: p.completedMissions.includes(c.id) }));
}

/** open a cache: grant loot + discovery XP, record today's open, and pay any side contract it completes */
export function openCache(p: PlayerProgression, c: LootCache, now = Date.now()): { progression: PlayerProgression; loot: Partial<Record<MaterialId, number>>; gear: GearItem | null; contracts: string[] } | null {
  if (isOpenedToday(p, c.id, now)) return null;
  const loot = rollCache(c, now);
  const materials = { ...p.materials };
  for (const [k, v] of Object.entries(loot) as [MaterialId, number][]) materials[k] = (materials[k] ?? 0) + v;
  const rolled = rollCacheGear(c, now);
  const gear = rolled && !p.inventory.some((g) => g.id === rolled.id) ? rolled : null;
  const inventory = gear ? [...p.inventory, gear] : p.inventory;
  let next = grantXP({ ...p, materials, inventory, earnedRewards: [...p.earnedRewards, openKey(c.id, now)] }, "DISCOVERY").progression;
  const contracts: string[] = [];
  const opened = cachesEverOpened(next);
  for (const sc of SIDE_CONTRACTS) {
    if (next.completedMissions.includes(sc.id) || sc.progress(next, opened) < sc.need) continue;
    next = rewardMission(next, sc.id, sc.reward, now);
    contracts.push(sc.title);
  }
  return { progression: next, loot, gear, contracts };
}

export function nearestCache(x: number, z: number, y: number): LootCache | null {
  let best: LootCache | null = null, bd = CACHE_REACH;
  for (const c of lootCaches()) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd && Math.abs(c.y - y) < 4) { bd = d; best = c; }
  }
  return best;
}
