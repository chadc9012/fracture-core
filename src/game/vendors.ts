/** Nexus vendor marketplace — real, purchasable rotating stock pulled from the master weapon/armor
 * manifest, plus a sell-back path for owned gear. Replaces the old vendors that only drained
 * currency and printed a notice: buying here actually grants a GearItem into progression.inventory,
 * and selling actually removes one and pays out. Pure logic module; OperationsHub.tsx owns the UI. */
import { mulberry32 } from "./rng";
import { WEAPON_MANIFEST, ARMOR_MANIFEST, type WeaponManifestItem, type ArmorManifestItem, type WeaponTier, type ArmorTier } from "./equipment";
import type { GearItem, GearSlot } from "./inventory";
import type { CurrencyId, Wallet } from "./economy";
import { canAfford, spend } from "./economy";
import type { PlayerProgression } from "./progression";

export type VendorId = "scrap" | "faction" | "singularity" | "black";
export type VendorDef = { id: VendorId; name: string; district: string; currency: CurrencyId; offer: string; weaponTiers: readonly WeaponTier[]; armorTiers: readonly ArmorTier[]; stockSize: number; priceMult: number };

export const VENDOR_DEFS: readonly VendorDef[] = [
  { id: "scrap", name: "Scrap-Market", district: "Lower District", currency: "credits", offer: "Standard components and material conversion", weaponTiers: ["T1", "T2"], armorTiers: ["T1-2"], stockSize: 4, priceMult: 1 },
  { id: "faction", name: "Faction Quarter", district: "Mid-Level Hub", currency: "dataShards", offer: "Thermal, cryogenic, and arc blueprints", weaponTiers: ["T2", "T3"], armorTiers: ["T3-4"], stockSize: 4, priceMult: 1 },
  { id: "singularity", name: "Singularity Exchange", district: "Upper Spire", currency: "spatialCores", offer: "Anomaly relic components", weaponTiers: ["T4", "T5"], armorTiers: ["T5"], stockSize: 3, priceMult: 1 },
  { id: "black", name: "Black-Market Node", district: "Hidden Underbelly", currency: "credits", offer: "Rotating prototype roll", weaponTiers: ["T3", "T4", "T5", "S"], armorTiers: ["T3-4", "T5", "S"], stockSize: 4, priceMult: 1.35 },
] as const;

const WEAPON_TIER_INDEX: Record<WeaponTier, number> = { T1: 0, T2: 1, T3: 2, T4: 3, T5: 4, S: 5 };
const ARMOR_TIER_INDEX: Record<ArmorTier, number> = { "T1-2": 0, "T3-4": 1, T5: 2, S: 3 };
const CREDIT_PRICE = [150, 320, 650, 1200, 2000, 3400] as const;
const DATA_PRICE = [4, 7, 11, 16, 22, 30] as const;
const CORE_PRICE = [1, 1, 2, 3, 4, 6] as const;
const ARMOR_CREDIT_PRICE = [140, 600, 1800, 3200] as const;
const ARMOR_DATA_PRICE = [4, 10, 20, 28] as const;
const ARMOR_CORE_PRICE = [1, 2, 4, 6] as const;
const WEAPON_POWER = [90, 140, 190, 260, 340, 420] as const;
const ARMOR_POWER = [90, 150, 240, 340] as const;

function priceTable(currency: CurrencyId, armor: boolean): readonly number[] {
  if (armor) return currency === "credits" ? ARMOR_CREDIT_PRICE : currency === "dataShards" ? ARMOR_DATA_PRICE : ARMOR_CORE_PRICE;
  return currency === "credits" ? CREDIT_PRICE : currency === "dataShards" ? DATA_PRICE : CORE_PRICE;
}

export type VendorListing = { key: string; kind: "weapon"; item: WeaponManifestItem; price: number; currency: CurrencyId; power: number }
  | { key: string; kind: "armor"; item: ArmorManifestItem; price: number; currency: CurrencyId; power: number };

/** Stock rotates once per UTC day per vendor — deterministic, no server round trip needed. */
export function dailyRotationSeed(vendorId: VendorId, dayOffset = 0): number {
  const day = Math.floor(Date.now() / 86_400_000) + dayOffset;
  let hash = day * 2654435761;
  for (const ch of vendorId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash >>> 0;
}

export function vendorStock(vendor: VendorDef, seed = dailyRotationSeed(vendor.id)): VendorListing[] {
  const rand = mulberry32(seed);
  const weapons = WEAPON_MANIFEST.filter((item) => vendor.weaponTiers.includes(item.tier));
  const armors = ARMOR_MANIFEST.filter((item) => vendor.armorTiers.includes(item.tier));
  const listings: VendorListing[] = [];
  for (let i = 0; i < vendor.stockSize; i++) {
    const wantWeapon = rand() < 0.6;
    const pool = wantWeapon && weapons.length ? weapons : armors;
    if (!pool.length) continue;
    const pick = pool[Math.floor(rand() * pool.length)];
    if (!pick) continue;
    if ("archetype" in pick) {
      const tierIndex = WEAPON_TIER_INDEX[pick.tier];
      const price = Math.round(priceTable(vendor.currency, false)[tierIndex]! * vendor.priceMult);
      listings.push({ key: `${vendor.id}-${pick.id}`, kind: "weapon", item: pick, price, currency: vendor.currency, power: WEAPON_POWER[tierIndex]! });
    } else {
      const tierIndex = ARMOR_TIER_INDEX[pick.tier];
      const price = Math.round(priceTable(vendor.currency, true)[tierIndex]! * vendor.priceMult);
      listings.push({ key: `${vendor.id}-${pick.id}`, kind: "armor", item: pick, price, currency: vendor.currency, power: ARMOR_POWER[tierIndex]! });
    }
  }
  // de-dupe within a single day's stock (small pools can repeat-roll)
  return listings.filter((entry, index) => listings.findIndex((other) => other.key === entry.key) === index);
}

const ARMOR_SLOT_TO_GEAR: Record<ArmorManifestItem["slot"], GearSlot> = { HELM: "helmet", CHEST: "chest", ARMS: "gauntlets", LEGS: "legs", BACK: "classItem", CORE: "classItem" };
const DAMAGE_TO_GEAR_ELEMENT: Record<WeaponManifestItem["element"], GearItem["element"]> = { KINETIC: "KINETIC", PLASMA: "ARC", CRYO: "CRYO", ARC: "ARC", THERMAL: "THERMAL", VOID: "BIO" };

export function listingToGearItem(listing: VendorListing, vendorName: string): GearItem {
  const instanceId = `${listing.item.id}-${Date.now().toString(36)}${Math.floor(Math.random() * 36).toString(36)}`;
  if (listing.kind === "weapon") {
    const slot: GearSlot = listing.item.archetype === "HEAVY" ? "heavy" : listing.item.archetype === "SIDEARM" ? "secondary" : "primary";
    return { id: instanceId, name: listing.item.name, slot, power: listing.power, level: 1, element: DAMAGE_TO_GEAR_ELEMENT[listing.item.element], source: `Purchased · ${vendorName}` };
  }
  return { id: instanceId, name: listing.item.name, slot: ARMOR_SLOT_TO_GEAR[listing.item.slot], power: listing.power, level: 1, element: "KINETIC", source: `Purchased · ${vendorName}` };
}

export function purchaseListing(progression: PlayerProgression, wallet: Wallet, listing: VendorListing, vendorName: string): { progression: PlayerProgression; wallet: Wallet } | null {
  const cost = { [listing.currency]: listing.price } as Partial<Wallet>;
  if (!canAfford(wallet, cost)) return null;
  const item = listingToGearItem(listing, vendorName);
  return { progression: { ...progression, inventory: [...progression.inventory, item] }, wallet: spend(wallet, cost) };
}

/** Selling pays out in the gear's own slot-appropriate material via gearCost's material choice, at a
 * flat credit rate scaled by power so early salvage and endgame relics both feel proportionate. */
export function sellValue(item: GearItem): { currency: CurrencyId; amount: number } {
  return { currency: "credits", amount: Math.max(20, Math.round(item.power * 1.8 * (item.level || 1))) };
}

export function sellGear(progression: PlayerProgression, wallet: Wallet, itemId: string): { progression: PlayerProgression; wallet: Wallet } | null {
  const item = progression.inventory.find((entry) => entry.id === itemId);
  if (!item) return null;
  const equippedElsewhere = Object.values(progression.equippedGear).includes(itemId);
  if (equippedElsewhere) return null;
  const value = sellValue(item);
  return {
    progression: { ...progression, inventory: progression.inventory.filter((entry) => entry.id !== itemId) },
    wallet: { ...wallet, [value.currency]: wallet[value.currency] + value.amount },
  };
}
