/** Regional walk-up shops: specialist vendors placed in the world, each selling only its own
 * category, priced in region-flavoured materials from progression.materials (persisted), and gated
 * by player level and story progress. Pure logic; Scene detects proximity, ShopWindow draws it. */
import { mulberry32 } from "./useKeyboard";
import { REGIONS, NEON_OFFSET, scaleSite } from "./world";
import { THALASSIA_CENTER } from "./thalassia-site";
import { WEAPON_MANIFEST, ARMOR_MANIFEST, type WeaponTier, type ArmorTier } from "./equipment";
import { listingToGearItem, type VendorListing } from "./vendors";
import { upgradeGate } from "./upgrade-gates";
import { upgradeGear, infuseGear, gearCost, type GearItem, type MaterialId } from "./inventory";
import type { PlayerProgression } from "./progression";

export type ShopKind = "weapons" | "armor" | "supplies" | "mods" | "gunsmith" | "vehicles";
export const SHOP_KIND_LABEL: Record<ShopKind, string> = {
  weapons: "Weapon Dealer", armor: "Armor Shop", supplies: "Outfitter", mods: "Mod Shop", gunsmith: "Gunsmith", vehicles: "Vehicle Workshop",
};

export type RegionalShop = {
  id: string; name: string; kind: ShopKind; place: string; blurb: string;
  x: number; z: number;
  /** what this shop charges in */
  currency: MaterialId;
  priceMult: number;
  /** player level needed to trade at all */
  minLevel: number;
  /** mission that must be complete first (story gate) */
  requires?: { missionId: string; label: string };
};

const NEXUS = REGIONS.find((r) => r.id === "nexus")!;
const NEON = { x: NEXUS.x + NEON_OFFSET.x, z: NEXUS.z + NEON_OFFSET.z };
const THAL = THALASSIA_CENTER;
const at = (c: { x: number; z: number }, angle: number, r: number) => ({ x: c.x + Math.cos(angle) * r, z: c.z + Math.sin(angle) * r });

export const REGIONAL_SHOPS: readonly RegionalShop[] = [
  { id: "nexus-armory", name: "Nexus Armory", kind: "weapons", place: "Nexus City", blurb: "Regulated military weapons", ...at(NEXUS, 0.3, 7), currency: "scrapMetal", priceMult: 1, minLevel: 1 },
  { id: "nexus-plate", name: "Bastion Fittings", kind: "armor", place: "Nexus City", blurb: "Standard-issue armor by slot", ...at(NEXUS, 1.9, 7), currency: "reinforcedAlloy", priceMult: 1, minLevel: 1 },
  { id: "nexus-calibration", name: "Calibration Range", kind: "gunsmith", place: "Nexus City", blurb: "Weapon upgrades and tuning", ...at(NEXUS, 3.5, 7), currency: "scrapMetal", priceMult: 0.9, minLevel: 2 },
  { id: "nexus-outfitter", name: "Field Outfitter", kind: "supplies", place: "Nexus City", blurb: "Mission supplies and kits", ...at(NEXUS, 5.1, 7), currency: "scrapMetal", priceMult: 1, minLevel: 1 },
  { id: "neon-dealer", name: "Neon Street Dealer", kind: "weapons", place: "Neon City", blurb: "Civilian-market weapons", ...at(NEON, 0.8, 9), currency: "microCircuits", priceMult: 1.1, minLevel: 3 },
  { id: "neon-mods", name: "Glitch Mods", kind: "mods", place: "Neon City", blurb: "Element infusion and tuning", ...at(NEON, 2.6, 9), currency: "microCircuits", priceMult: 1, minLevel: 3 },
  { id: "thal-curator", name: "Thalassia Curator", kind: "armor", place: "Thalassia", blurb: "Pressure-rated ancient armor", ...at(THAL, 0.5, 10), currency: "dataShards", priceMult: 1.2, minLevel: 6, requires: { missionId: "system-core", label: "Reach Thalassia in the story" } },
  { id: "waste-trader", name: "Rust Port Trader", kind: "supplies", place: "The Wastelands", blurb: "Salvage, fuel and patch kits", ...at(scaleSite(12, -6), 2.2, 14), currency: "scrapMetal", priceMult: 0.85, minLevel: 1 },
  { id: "waste-garage", name: "Rust-Runner Garage", kind: "vehicles", place: "The Wastelands", blurb: "Ground vehicle parts", ...at(scaleSite(12, -6), 4.0, 14), currency: "fuel", priceMult: 1, minLevel: 2 },
  { id: "veridan-broker", name: "Grove Research Broker", kind: "mods", place: "Veridan Forest", blurb: "Organic infusions", ...at(scaleSite(-58, -34), 1.2, 12), currency: "sporeFiber", priceMult: 1, minLevel: 2 },
  { id: "swamp-relics", name: "Bog Relic Dealer", kind: "armor", place: "Shrouded Swamps", blurb: "Anomaly-resistant pieces", ...at(scaleSite(62, 82), 3.0, 10), currency: "bioCatalyst", priceMult: 1.1, minLevel: 5 },
  { id: "solara-heavy", name: "Dune Heavy Arms", kind: "weapons", place: "Solara Desert", blurb: "Heavy weapons and launchers", ...at(scaleSite(-18, 76), 0.4, 14), currency: "anomalyCarbon", priceMult: 1, minLevel: 4 },
  { id: "solara-garage", name: "Convoy Workshop", kind: "vehicles", place: "Solara Desert", blurb: "Vehicle plating and weapons", ...at(scaleSite(-18, 76), 2.6, 14), currency: "vehicleParts", priceMult: 1, minLevel: 4 },
  { id: "frost-research", name: "Spire Research Post", kind: "gunsmith", place: "Frostspire Mountains", blurb: "Precision calibration", ...at(scaleSite(18, -96), 1.6, 12), currency: "cryoCrystal", priceMult: 1, minLevel: 6 },
  { id: "ember-alliance", name: "Ember Alliance Vendor", kind: "weapons", place: "Ember Peaks", blurb: "Elite high-tier weapons", ...at(scaleSite(-52, 16), 5.2, 10), currency: "thermalShards", priceMult: 1.3, minLevel: 8, requires: { missionId: "awakening", label: "Complete Neon Core: Awakening" } },
];

export const SHOP_REACH = 4;

export function shopNear(x: number, z: number): RegionalShop | null {
  let best: RegionalShop | null = null, bestD = SHOP_REACH;
  for (const shop of REGIONAL_SHOPS) { const d = Math.hypot(x - shop.x, z - shop.z); if (d < bestD) { bestD = d; best = shop; } }
  return best;
}

/** null = open; otherwise the reason the shop won't trade yet */
export function shopLock(shop: RegionalShop, p: Pick<PlayerProgression, "level" | "completedMissions">): string | null {
  if (p.level < shop.minLevel) return `Requires level ${shop.minLevel}`;
  if (shop.requires && !p.completedMissions.includes(shop.requires.missionId)) return shop.requires.label;
  return null;
}

export type ShopOffer =
  | { key: string; type: "gear"; name: string; detail: string; price: number; minLevel: number; listing: VendorListing }
  | { key: string; type: "material"; name: string; detail: string; price: number; minLevel: number; material: MaterialId; amount: number };

const WEAPON_LEVEL: Record<WeaponTier, number> = { T1: 1, T2: 3, T3: 6, T4: 9, T5: 12, S: 99 };
const ARMOR_LEVEL: Record<ArmorTier, number> = { "T1-2": 1, "T3-4": 5, T5: 10, S: 99 };
const WEAPON_PRICE: Record<WeaponTier, number> = { T1: 30, T2: 60, T3: 110, T4: 180, T5: 280, S: 0 };
const ARMOR_PRICE: Record<ArmorTier, number> = { "T1-2": 25, "T3-4": 90, T5: 220, S: 0 };
const WEAPON_POWER: Record<WeaponTier, number> = { T1: 90, T2: 140, T3: 190, T4: 260, T5: 340, S: 420 };
const ARMOR_POWER: Record<ArmorTier, number> = { "T1-2": 90, "T3-4": 150, T5: 240, S: 340 };

const SUPPLY_PACKS: Record<"supplies" | "vehicles", Array<{ material: MaterialId; amount: number; price: number; name: string }>> = {
  supplies: [
    { material: "scrapMetal", amount: 20, price: 0, name: "Salvage bundle" },
    { material: "reinforcedAlloy", amount: 6, price: 30, name: "Armor patch kit" },
    { material: "microCircuits", amount: 4, price: 35, name: "Circuit repair kit" },
    { material: "fuel", amount: 10, price: 25, name: "Fuel cells" },
  ],
  vehicles: [
    { material: "vehicleParts", amount: 4, price: 20, name: "Chassis parts" },
    { material: "scrapMetal", amount: 30, price: 15, name: "Plating scrap" },
    { material: "fuel", amount: 15, price: 18, name: "Reserve tanks" },
  ],
};

const daySeed = (id: string, day: number) => { let h = day * 2654435761; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h >>> 0; };
export const today = (now = Date.now()) => Math.floor(now / 86_400_000);

/** Stock rotates daily; each shop only stocks its own category. S-tier is never sold. */
export function shopOffers(shop: RegionalShop, day = today()): ShopOffer[] {
  const rand = mulberry32(daySeed(shop.id, day));
  const offers: ShopOffer[] = [];
  if (shop.kind === "weapons") {
    const heavy = shop.id === "solara-heavy";
    const pool = WEAPON_MANIFEST.filter((w) => w.tier !== "S" && (!heavy || w.archetype === "HEAVY"));
    for (let i = 0; i < 6; i++) {
      const w = pool[Math.floor(rand() * pool.length)]!;
      const listing: VendorListing = { key: `${shop.id}-${w.id}`, kind: "weapon", item: w, price: 0, currency: "credits", power: WEAPON_POWER[w.tier] };
      offers.push({ key: listing.key, type: "gear", name: w.name, detail: `${w.tier} · ${w.archetype} · ${w.element} · POWER ${listing.power}`, price: Math.round(WEAPON_PRICE[w.tier] * shop.priceMult), minLevel: WEAPON_LEVEL[w.tier], listing });
    }
  } else if (shop.kind === "armor") {
    const pool = ARMOR_MANIFEST.filter((a) => a.tier !== "S");
    for (let i = 0; i < 6; i++) {
      const a = pool[Math.floor(rand() * pool.length)]!;
      const listing: VendorListing = { key: `${shop.id}-${a.id}`, kind: "armor", item: a, price: 0, currency: "credits", power: ARMOR_POWER[a.tier] };
      offers.push({ key: listing.key, type: "gear", name: a.name, detail: `${a.tier} · ${a.slot} · ${a.classId} · POWER ${listing.power}`, price: Math.round(ARMOR_PRICE[a.tier] * shop.priceMult), minLevel: ARMOR_LEVEL[a.tier], listing });
    }
  } else if (shop.kind === "supplies" || shop.kind === "vehicles") {
    for (const pack of SUPPLY_PACKS[shop.kind]) {
      if (pack.material === shop.currency) continue; // never sell the currency for itself
      offers.push({ key: `${shop.id}-${pack.material}`, type: "material", name: pack.name, detail: `+${pack.amount} ${pack.material}`, price: Math.max(1, Math.round((pack.price || 20) * shop.priceMult)), minLevel: 1, material: pack.material, amount: pack.amount });
    }
  }
  if (shop.kind === "mods" && shop.currency !== "tuningCore") {
    // the only way to BUY an armor-upgrade gate material; capped by the shop's own currency price, never sold for free
    offers.push({ key: `${shop.id}-tuningCore`, type: "material", name: "Tuning Core", detail: "+1 tuningCore · unlocks armor upgrades from level 4", price: Math.max(1, Math.round(8 * shop.priceMult)), minLevel: 1, material: "tuningCore", amount: 1 });
  }
  return offers.filter((o, i) => offers.findIndex((x) => x.key === o.key) === i);
}

export type ShopResult = { progression: PlayerProgression; message: string } | { error: string };

const pay = (p: PlayerProgression, material: MaterialId, amount: number): PlayerProgression | null => {
  const have = p.materials[material] ?? 0;
  if (have < amount) return null;
  return { ...p, materials: { ...p.materials, [material]: have - amount } };
};

export function buyOffer(p: PlayerProgression, shop: RegionalShop, offer: ShopOffer): ShopResult {
  const lock = shopLock(shop, p);
  if (lock) return { error: lock };
  if (p.level < offer.minLevel) return { error: `Requires level ${offer.minLevel}` };
  const paid = pay(p, shop.currency, offer.price);
  if (!paid) return { error: `Not enough ${shop.currency}` };
  if (offer.type === "gear") {
    const item = listingToGearItem(offer.listing, shop.name);
    return { progression: { ...paid, inventory: [...paid.inventory, item] }, message: `${offer.name} added to inventory` };
  }
  return { progression: { ...paid, materials: { ...paid.materials, [offer.material]: (paid.materials[offer.material] ?? 0) + offer.amount } }, message: `${offer.name} purchased` };
}

/** Gunsmith: upgrades a weapon for a service fee on top of the normal material cost. */
export function serviceFee(shop: RegionalShop, item: GearItem) { return Math.max(2, Math.round(item.level * 4 * shop.priceMult)); }
export function serviceTargets(shop: RegionalShop, p: PlayerProgression): GearItem[] {
  if (shop.kind === "gunsmith") return p.inventory.filter((i) => i.slot === "primary" || i.slot === "secondary" || i.slot === "heavy");
  if (shop.kind === "mods") return p.inventory.filter((i) => i.slot !== "vehicle");
  if (shop.kind === "vehicles") return p.inventory.filter((i) => i.slot === "vehicle");
  return [];
}

export function serviceGear(p: PlayerProgression, shop: RegionalShop, itemId: string, element?: GearItem["element"]): ShopResult {
  const lock = shopLock(shop, p);
  if (lock) return { error: lock };
  const item = p.inventory.find((i) => i.id === itemId);
  if (!item || !serviceTargets(shop, p).some((i) => i.id === itemId)) return { error: "This shop can't service that item" };
  const paid = pay(p, shop.currency, serviceFee(shop, item));
  if (!paid) return { error: `Not enough ${shop.currency}` };
  const next = shop.kind === "mods" && element ? infuseGear(paid, itemId, element) : upgradeGear(paid, itemId);
  if (next === paid) return { error: shop.kind === "mods" ? "Missing infusion materials" : `Needs ${gearCost(item).amount} ${gearCost(item).material}${upgradeGate(item) ? ` + 1 ${upgradeGate(item)!.material}` : ""}` };
  return { progression: next, message: shop.kind === "mods" ? `${item.name} infused` : `${item.name} upgraded to level ${item.level + 1}` };
}
