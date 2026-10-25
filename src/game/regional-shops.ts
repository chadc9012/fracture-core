/** Regional walk-up shops: specialist vendors placed in the world, each selling only its own
 * category, priced in region-flavoured materials from progression.materials (persisted), and gated
 * by player level and story progress. Pure logic; Scene detects proximity, ShopWindow draws it. */
import { mulberry32 } from "./rng";
import { shopClockHour, shopClosedReason } from "./shop-hours";
import { livingShopTerms, type RepTier } from "./living-world";
import { VAULT_GATE } from "./wasteland-activities";
import { REGIONS, NEON_OFFSET, scaleSite } from "./world";
import { THALASSIA_CENTER } from "./thalassia-site";
import { WEAPON_MANIFEST, ARMOR_MANIFEST, type WeaponTier, type ArmorTier } from "./equipment";
import { listingToGearItem, type VendorListing } from "./vendors";
import { CLASS_LABEL, weeklyCatalogStock } from "./weapon-catalog";
import { upgradeGate } from "./upgrade-gates";
import { upgradeGear, infuseGear, gearCost, type GearItem, type MaterialId } from "./inventory";
import type { PlayerProgression } from "./progression";
import { COLLECTIONS, vendorSellable, type VendorTier } from "./armor-collections";
import { grantSetPiece, type SetDrop } from "./armor-sets";

export type ShopKind = "weapons" | "armor" | "supplies" | "mods" | "gunsmith" | "vehicles" | "blackmarket" | "armorsmith" | "exotic";
export const SHOP_KIND_LABEL: Record<ShopKind, string> = {
  weapons: "Weapon Dealer", armor: "Armor Shop", supplies: "Outfitter", mods: "Mod Shop", gunsmith: "Gunsmith", vehicles: "Vehicle Workshop", blackmarket: "Black Market", armorsmith: "Armorsmith", exotic: "Exotic Trader",
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
  /** armor-collections.ts: highest collection tier this armor shop stocks (city tier) */
  vendorTier?: VendorTier;
  /** faction outposts (living-world.ts SHOP_FACTION): the standing needed before they trade at all */
  minStanding?: RepTier;
};

const NEXUS = REGIONS.find((r) => r.id === "nexus")!;
const NEON = { x: NEXUS.x + NEON_OFFSET.x, z: NEXUS.z + NEON_OFFSET.z };
const THAL = THALASSIA_CENTER;
const at = (c: { x: number; z: number }, angle: number, r: number) => ({ x: c.x + Math.cos(angle) * r, z: c.z + Math.sin(angle) * r });

export const REGIONAL_SHOPS: readonly RegionalShop[] = [
  { id: "nexus-armory", name: "Nexus Armory", kind: "weapons", place: "Nexus City", blurb: "Regulated military weapons", ...at(NEXUS, 0.3, 7), currency: "scrapMetal", priceMult: 1, minLevel: 1 },
  { id: "nexus-plate", name: "Voss Armorworks", kind: "armor", place: "Nexus City", blurb: "Standard-issue armor by slot", ...at(NEXUS, 1.9, 7), currency: "reinforcedAlloy", priceMult: 1, minLevel: 1, vendorTier: 2 },
  { id: "nexus-calibration", name: "Calibration Range", kind: "gunsmith", place: "Nexus City", blurb: "Weapon upgrades and tuning", ...at(NEXUS, 3.5, 7), currency: "scrapMetal", priceMult: 0.9, minLevel: 2 },
  { id: "nexus-outfitter", name: "Field Outfitter", kind: "supplies", place: "Nexus City", blurb: "Mission supplies and kits", ...at(NEXUS, 5.1, 7), currency: "scrapMetal", priceMult: 1, minLevel: 1 },
  { id: "neon-dealer", name: "Neon Street Dealer", kind: "weapons", place: "Neon City", blurb: "Civilian-market weapons", ...at(NEON, 0.8, 9), currency: "microCircuits", priceMult: 1.1, minLevel: 3 },
  { id: "neon-mods", name: "Glitch Mods", kind: "mods", place: "Neon City", blurb: "Element infusion and tuning", ...at(NEON, 2.6, 9), currency: "microCircuits", priceMult: 1, minLevel: 3 },
  { id: "thal-curator", name: "Thalassia Curator", kind: "armor", place: "Thalassia", blurb: "Pressure-rated ancient armor", ...at(THAL, 0.5, 10), currency: "dataShards", priceMult: 1.2, minLevel: 6, requires: { missionId: "system-core", label: "Reach Thalassia in the story" }, vendorTier: 4 },
  { id: "waste-trader", name: "Rust Port Trader", kind: "supplies", place: "The Wastelands", blurb: "Salvage, fuel and patch kits", ...at(scaleSite(12, -6), 2.2, 14), currency: "scrapMetal", priceMult: 0.85, minLevel: 1 },
  { id: "waste-garage", name: "Rust-Runner Garage", kind: "vehicles", place: "The Wastelands", blurb: "Ground vehicle parts", ...at(scaleSite(12, -6), 4.0, 14), currency: "fuel", priceMult: 1, minLevel: 2 },
  { id: "veridan-broker", name: "Grove Research Broker", kind: "mods", place: "Verdant Forest", blurb: "Organic infusions", ...at(scaleSite(-58, -34), 1.2, 12), currency: "sporeFiber", priceMult: 1, minLevel: 2 },
  { id: "swamp-relics", name: "Bog Relic Dealer", kind: "armor", place: "Shrouded Swamps", blurb: "Anomaly-resistant pieces", ...at(scaleSite(62, 82), 3.0, 10), currency: "bioCatalyst", priceMult: 1.1, minLevel: 5, vendorTier: 3 },
  { id: "neon-underground", name: "The Underlink", kind: "blackmarket", place: "Neon City (underground)", blurb: "Smuggled street armor, no questions asked", ...at(NEON, 4.4, 12), currency: "microCircuits", priceMult: 1.5, minLevel: 10, requires: { missionId: "stitched-neon-core", label: "Complete Stitched Neon Core" }, vendorTier: 5 },
  { id: "solara-heavy", name: "Dune Heavy Arms", kind: "weapons", place: "Solara Desert", blurb: "Heavy weapons and launchers", ...at(scaleSite(-18, 76), 0.4, 14), currency: "anomalyCarbon", priceMult: 1, minLevel: 4 },
  { id: "solara-garage", name: "Convoy Workshop", kind: "vehicles", place: "Solara Desert", blurb: "Vehicle plating and weapons", ...at(scaleSite(-18, 76), 2.6, 14), currency: "vehicleParts", priceMult: 1, minLevel: 4 },
  { id: "frost-research", name: "Spire Research Post", kind: "gunsmith", place: "Frostspire Mountains", blurb: "Precision calibration", ...at(scaleSite(18, -96), 1.6, 12), currency: "cryoCrystal", priceMult: 1, minLevel: 6 },
  { id: "ember-alliance", name: "Ember Alliance Vendor", kind: "weapons", place: "Ember Peaks", blurb: "Elite high-tier weapons", ...at(scaleSite(-52, 16), 5.2, 10), currency: "thermalShards", priceMult: 1.3, minLevel: 8, requires: { missionId: "awakening", label: "Complete Neon Core: Awakening" } },
  // the owner's merchant sheets: Thalia Ren's Bastion (the only shop that upgrades armor), Cruz Mendez's Drive Hub
  // (Nexus vehicles) and Rafiq Kaleem's Dune Gate Outpost (rare materials and named weapons, never exotics)
  { id: "nexus-bastion", name: "The Bastion", kind: "armorsmith", place: "Nexus City", blurb: "Armor forging, upgrades and class gear", ...at(NEXUS, 1.1, 7), currency: "reinforcedAlloy", priceMult: 1.1, minLevel: 3, vendorTier: 3 },
  { id: "nexus-drive-hub", name: "The Drive Hub", kind: "vehicles", place: "Nexus City", blurb: "Vehicle parts, upgrades and tuning", ...at(NEXUS, 4.3, 7), currency: "vehicleParts", priceMult: 1.05, minLevel: 2 },
  { id: "solara-dunegate", name: "Dune Gate Outpost", kind: "exotic", place: "Solara Desert", blurb: "Rare materials and named weapons", ...at(scaleSite(-18, 76), 3.4, 14), currency: "anomalyCarbon", priceMult: 1.2, minLevel: 5 },
  // faction outposts: each faction's own quartermaster, trading only with operators it trusts
  { id: "aegis-quartermaster", name: "Directorate Quartermaster", kind: "armor", place: "Neon City (Aegis Spire)", blurb: "Aegis-issue plate for cleared operators", x: NEON.x - 10, z: NEON.z - 38, currency: "microCircuits", priceMult: 1.15, minLevel: 6, vendorTier: 3, minStanding: "TRUSTED" },
  { id: "legion-quartermaster", name: "Legion Quartermaster", kind: "weapons", place: "The Wastelands (Sub-Terra vault gate)", blurb: "Gate-guard arms, sold to those who held the line", x: VAULT_GATE.x - VAULT_GATE.radius - 7, z: VAULT_GATE.z + 6, currency: "scrapMetal", priceMult: 0.9, minLevel: 3, requires: { missionId: "side-vault-defense", label: "Hold the Sub-Terra vault gates once" } },
];

export const SHOP_REACH = 4;

export function shopNear(x: number, z: number): RegionalShop | null {
  let best: RegionalShop | null = null, bestD = SHOP_REACH;
  for (const shop of REGIONAL_SHOPS) { const d = Math.hypot(x - shop.x, z - shop.z); if (d < bestD) { bestD = d; best = shop; } }
  return best;
}

/** null = open; otherwise the reason the shop won't trade yet */
export function shopLock(shop: RegionalShop, p: Pick<PlayerProgression, "level" | "completedMissions"> & { living?: PlayerProgression["living"] }, now = Date.now()): string | null {
  if (p.level < shop.minLevel) return `Requires level ${shop.minLevel}`;
  if (shop.requires && !p.completedMissions.includes(shop.requires.missionId)) return shop.requires.label;
  const closed = shopClosedReason(shop, shopClockHour()); // shop-hours.ts: null until the world clock is set
  if (closed) return closed;
  return livingShopTerms(p.living, shop, now).lock; // living-world.ts: faction standing and district status (city shops only)
}

/** price multiplier from the Living World (standing, secured district); 1 outside the cities */
export const shopPriceMult = (shop: RegionalShop, p: { living?: PlayerProgression["living"] }, now = Date.now()) => livingShopTerms(p.living, shop, now).priceMult;

export type ShopOffer =
  | { key: string; type: "gear"; name: string; detail: string; price: number; minLevel: number; listing: VendorListing }
  | { key: string; type: "piece"; name: string; detail: string; price: number; minLevel: number; drop: SetDrop; deal?: boolean }
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

const EXOTIC_PACKS: Array<{ material: MaterialId; amount: number; price: number; name: string }> = [
  { material: "relicFragment", amount: 2, price: 40, name: "Relic fragments" },
  { material: "runeDust", amount: 3, price: 35, name: "Rune dust" },
  { material: "ruinStone", amount: 4, price: 30, name: "Ruin stone" },
  { material: "dragonite", amount: 1, price: 70, name: "Dragonite shard" },
  { material: "anomalyCarbon", amount: 4, price: 30, name: "Anomaly carbon" },
];

const daySeed = (id: string, day: number) => { let h = day * 2654435761; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h >>> 0; };
export const today = (now = Date.now()) => Math.floor(now / 86_400_000);

/** Stock rotates daily; each shop only stocks its own category. S-tier is never sold. */
export function shopOffers(shop: RegionalShop, day = today(), mult = 1): ShopOffer[] {
  shop = mult === 1 ? shop : { ...shop, priceMult: shop.priceMult * mult };
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
    // this week's named catalogue weapons (weapon-catalog.ts): a weekly rotation per shop, reset Monday 00:00 UTC
    for (const w of weeklyCatalogStock(shop.id, day * 86_400_000).filter((c) => !heavy || c.archetype === "HEAVY")) {
      const listing: VendorListing = { key: `${shop.id}-${w.id}`, kind: "weapon", item: w, price: 0, currency: "credits", power: WEAPON_POWER[w.tier] };
      offers.push({ key: listing.key, type: "gear", name: w.name, detail: `WEEKLY · ${CLASS_LABEL[w.cls]} · ${w.rarity} · ${w.element} · POWER ${listing.power}`, price: Math.round(WEAPON_PRICE[w.tier] * shop.priceMult * 1.2), minLevel: WEAPON_LEVEL[w.tier], listing });
    }
  } else if (shop.kind === "exotic") {
    // rare materials (never the shop's own currency) plus this week's named catalogue weapons
    for (const pack of EXOTIC_PACKS) if (pack.material !== shop.currency) offers.push({ key: `${shop.id}-${pack.material}`, type: "material", name: pack.name, detail: `+${pack.amount} ${pack.material}`, price: Math.max(1, Math.round(pack.price * shop.priceMult)), minLevel: 1, material: pack.material, amount: pack.amount });
    for (const w of weeklyCatalogStock(shop.id, day * 86_400_000)) {
      const listing: VendorListing = { key: `${shop.id}-${w.id}`, kind: "weapon", item: w, price: 0, currency: "credits", power: WEAPON_POWER[w.tier] };
      offers.push({ key: listing.key, type: "gear", name: w.name, detail: `WEEKLY · ${CLASS_LABEL[w.cls]} · ${w.rarity} · ${w.element} · POWER ${listing.power}`, price: Math.round(WEAPON_PRICE[w.tier] * shop.priceMult * 1.25), minLevel: WEAPON_LEVEL[w.tier], listing });
    }
  } else if ((shop.kind === "armor" || shop.kind === "armorsmith") && shop.vendorTier) {
    // tiered city stock: collection pieces up to this city's tier, never raid/dungeon/exotic
    collectionOffers(shop, rand, COLLECTIONS.filter((c) => vendorSellable(c, shop.vendorTier!) && !c.sources.includes("black-market")), 5, offers);
  } else if (shop.kind === "blackmarket") {
    collectionOffers(shop, rand, COLLECTIONS.filter((c) => c.sources.includes("black-market") && c.family !== "exotic"), 4, offers);
  }
  if (shop.kind === "armor") {
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
  const unique = offers.filter((o, i) => offers.findIndex((x) => x.key === o.key) === i);
  // one daily deal per gear shop: the first gear/piece offer of the day at DAILY_DEAL_OFF discount
  const deal = unique.find((o) => o.type !== "material");
  if (deal) { deal.price = Math.max(1, Math.round(deal.price * (1 - DAILY_DEAL_OFF))); deal.detail = `DAILY DEAL −${DAILY_DEAL_OFF * 100}% · ${deal.detail}`; if (deal.type === "piece") deal.deal = true; }
  return unique;
}

export const DAILY_DEAL_OFF = 0.3;
const PIECE_SLOTS = ["helmet", "gauntlets", "chest", "legs", "classItem"] as const;
const PIECE_PRICE: Record<VendorTier, number> = { 1: 30, 2: 55, 3: 95, 4: 150, 5: 220 };
const PIECE_LEVEL: Record<VendorTier, number> = { 1: 1, 2: 3, 3: 5, 4: 8, 5: 10 };
function collectionOffers(shop: RegionalShop, rand: () => number, pool: typeof COLLECTIONS, count: number, out: ShopOffer[]) {
  if (!pool.length) return;
  for (let i = 0; i < count; i++) {
    const c = pool[Math.floor(rand() * pool.length)]!;
    const slot = PIECE_SLOTS[Math.floor(rand() * PIECE_SLOTS.length)]!;
    const tier = c.vendorTier ?? 5;
    out.push({ key: `${shop.id}-${c.id}-${slot}`, type: "piece", name: c.pieces[slot] ?? `${c.name} ${slot}`, detail: `${c.name} · tier ${tier} · ${c.two.name} (2) / ${c.four.name} (4)`, price: Math.round(PIECE_PRICE[tier] * shop.priceMult), minLevel: PIECE_LEVEL[tier], drop: { setId: c.id, slot } });
  }
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
  if (offer.type === "piece") {
    const granted = grantSetPiece(paid, offer.drop);
    if (!granted) return { error: "That piece is unavailable" };
    if (granted.result !== "NEW") return { error: "You already own that piece" };
    return { progression: granted.progress, message: `${offer.name} added to inventory` };
  }
  if (offer.type === "gear") {
    const item = listingToGearItem(offer.listing, shop.name);
    return { progression: { ...paid, inventory: [...paid.inventory, item] }, message: `${offer.name} added to inventory` };
  }
  return { progression: { ...paid, materials: { ...paid.materials, [offer.material]: (paid.materials[offer.material] ?? 0) + offer.amount } }, message: `${offer.name} purchased` };
}

/** Gunsmith: upgrades a weapon for a service fee on top of the normal material cost. */
export function serviceFee(shop: RegionalShop, item: GearItem) { return Math.max(2, Math.round(item.level * 4 * shop.priceMult)); }
const ARMOR_SLOTS = new Set<GearItem["slot"]>(["helmet", "chest", "gauntlets", "legs", "classItem"]);
export function serviceTargets(shop: RegionalShop, p: PlayerProgression): GearItem[] {
  if (shop.kind === "gunsmith") return p.inventory.filter((i) => i.slot === "primary" || i.slot === "secondary" || i.slot === "heavy");
  if (shop.kind === "mods") return p.inventory.filter((i) => i.slot !== "vehicle");
  if (shop.kind === "armorsmith") return p.inventory.filter((i) => ARMOR_SLOTS.has(i.slot));
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
