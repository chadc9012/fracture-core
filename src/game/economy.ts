import type { WeaponTier } from "./equipment";
import { validate, type LootItem } from "./loot";

export type CurrencyId = "credits" | "dataShards" | "spatialCores";
export type MaterialId = "scrapMetal" | "polymerResin" | "outpostCurrency" | "reinforcedAlloy" | "thermalShards" | "biomeElements" | "factionCores" | "microCircuits" | "singularityCatalysts" | "spatialFragments" | "anomalyCarbon" | "apexCores";
export type Wallet = Record<CurrencyId | MaterialId, number>;
export type UpgradeRecipe = { from: WeaponTier; to: WeaponTier; label: string; costs: Partial<Wallet>; tax: number; source: string };

export const STARTING_WALLET: Wallet = {
  credits: 2400, dataShards: 34, spatialCores: 4, scrapMetal: 420, polymerResin: 160, outpostCurrency: 14,
  reinforcedAlloy: 330, thermalShards: 100, biomeElements: 22, factionCores: 430, microCircuits: 118,
  singularityCatalysts: 10, spatialFragments: 620, anomalyCarbon: 210, apexCores: 3,
};

export const UPGRADE_RECIPES: readonly UpgradeRecipe[] = [
  { from: "T1", to: "T2", label: "Standardization", costs: { scrapMetal: 150, polymerResin: 50, outpostCurrency: 5 }, tax: 120, source: "Wastelands and outposts" },
  { from: "T2", to: "T3", label: "Elemental Tuning", costs: { reinforcedAlloy: 250, thermalShards: 75, biomeElements: 15 }, tax: 280, source: "Ember Peaks and Frostspire" },
  { from: "T3", to: "T4", label: "Prototype Integration", costs: { factionCores: 400, microCircuits: 100, singularityCatalysts: 8 }, tax: 520, source: "Nexus faction sectors" },
  { from: "T4", to: "T5", label: "Singularity Modification", costs: { spatialFragments: 600, anomalyCarbon: 200, apexCores: 3 }, tax: 900, source: "Rifts, raids, and apex bosses" },
];

export const VENDORS = [
  { id: "scrap", name: "Scrap-Market", district: "Lower District", currency: "credits" as const, offer: "Standard components and material conversion", price: 240 },
  { id: "faction", name: "Faction Quarter", district: "Mid-Level Hub", currency: "dataShards" as const, offer: "Thermal, cryogenic, and arc blueprints", price: 12 },
  { id: "singularity", name: "Singularity Exchange", district: "Upper Spire", currency: "spatialCores" as const, offer: "Anomaly relic components", price: 3 },
  { id: "black", name: "Black-Market Node", district: "Hidden Underbelly", currency: "credits" as const, offer: "Rotating prototype roll", price: 680 },
] as const;

export function canAfford(wallet: Wallet, costs: Partial<Wallet>, tax = 0) {
  return wallet.credits >= tax && Object.entries(costs).every(([key, value]) => wallet[key as keyof Wallet] >= (value ?? 0));
}

export function spend(wallet: Wallet, costs: Partial<Wallet>, tax = 0): Wallet {
  if (!canAfford(wallet, costs, tax)) return wallet;
  const next = { ...wallet, credits: wallet.credits - tax };
  for (const [key, value] of Object.entries(costs)) next[key as keyof Wallet] -= value ?? 0;
  return next;
}

export type ForgeMode = "PRECISION" | "CONTROL" | "GUARD";
export function transformGear(item: LootItem, mode: ForgeMode, wallet: Wallet): { item: LootItem; wallet: Wallet } | null {
  const costs = { dataShards: 8, scrapMetal: 40 };
  const tax = 150;
  if (!canAfford(wallet, costs, tax)) return null;
  const mod = mode === "PRECISION" ? { name: "Kinetic Precision", effect: "Crit" as const, value: 18 } : mode === "CONTROL" ? { name: "Signal Interference", effect: "Utility" as const, value: 16 } : { name: "Barrier Feedback", effect: "Utility" as const, value: 20 };
  const next: LootItem = { ...item, mods: [...item.mods.slice(0, 4), mod], power: Math.min(1000, item.power + 20), transformation: mode === "PRECISION" ? "Movement builds a charged precision strike" : mode === "CONTROL" ? "System disruption interrupts hostile casts" : "Blocked pressure releases a shockwave" };
  return validate(next) ? { item: next, wallet: spend(wallet, costs, tax) } : null;
}