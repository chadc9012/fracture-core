/* ------------------------------------------------------------------
 * AI LOOT GENERATOR — context analyser → item skeleton → mod
 * generator → balance validator. Nothing is pre-authored: gear is
 * generated from world state, enemy type, zone corruption, player
 * build and raid difficulty.
 * ------------------------------------------------------------------ */

export type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "EXOTIC";

export type LootContext = {
  enemyType: string;
  zoneState: string;
  difficulty: number;
  isRaid: boolean;
  /** 0..100 fracture corruption of the zone */
  corruption: number;
  /** dominant player behaviour — biases the mod pool */
  playstyle: string;
};

export type GearMod = {
  name: string;
  effect: "Damage" | "Utility" | "Crit" | "RiskBoost" | "Element";
  value: number;
};

export type LootItem = {
  name: string;
  slot: "WEAPON" | "ARMOR" | "CORE";
  rarity: Rarity;
  power: number;
  mods: GearMod[];
  life: number;
};

export const RARITY_COLOR: Record<Rarity, string> = {
  COMMON: "#9aa3ad",
  RARE: "#5bb8ff",
  EPIC: "#c86bff",
  LEGENDARY: "#ffb057",
  EXOTIC: "#7dffca",
};

const PREFIX = ["Fracture", "Corrupted", "Aegis", "Resonant", "Voidbound", "Salvaged", "Overseer"];
const WEAPONS = ["Pulse Rifle", "Void Blade", "Energy Carbine", "Rail Repeater", "Arc Cleaver", "Scatter Cannon"];
const ARMORS = ["Conduit Plating", "Anchor Harness", "Phase Weave", "Reactor Shell"];
const CORES = ["Stabiliser Core", "Resonance Core", "Collapse Core"];
const SUFFIX = ["Mk II", "Prototype", "Variant", "Relic", "Pattern-7"];

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;

/** context-aware rarity: harder content and corruption push the tier up */
export function rollRarity(ctx: LootContext): Rarity {
  let roll = Math.random() * 100 + ctx.difficulty * 4;
  if (ctx.isRaid) roll += 22;
  if (ctx.corruption > 70) roll += 14;
  else if (ctx.corruption > 40) roll += 6;
  if (ctx.enemyType === "ELITE") roll += 12;
  if (roll > 128) return "EXOTIC";
  if (roll > 112) return "LEGENDARY";
  if (roll > 88) return "EPIC";
  if (roll > 58) return "RARE";
  return "COMMON";
}

const MOD_TIERS: Record<Rarity, number> = {
  COMMON: 0,
  RARE: 1,
  EPIC: 2,
  LEGENDARY: 3,
  EXOTIC: 4,
};

function generateMod(ctx: LootContext): GearMod {
  const pool: GearMod[] = [
    { name: "Void Amplifier", effect: "Damage", value: 15 },
    { name: "Stamina Reactor", effect: "Utility", value: 10 },
    { name: "Fracture Sync", effect: "Crit", value: 20 },
    { name: "Corruption Core", effect: "RiskBoost", value: 30 },
    { name: "Arc Infusion", effect: "Element", value: 12 },
    { name: "Convoy Uplink", effect: "Utility", value: 14 },
    { name: "Anchor Field", effect: "Utility", value: 18 },
  ];
  // player build biases the roll toward mods that suit how they play
  const biased =
    ctx.playstyle === "combat"
      ? pool.filter((m) => m.effect === "Damage" || m.effect === "Crit")
      : ctx.playstyle === "logistics"
        ? pool.filter((m) => m.effect === "Utility")
        : ctx.playstyle === "vehicles"
          ? pool.filter((m) => m.effect === "Damage" || m.effect === "Utility")
          : pool;
  const mod = { ...pick(Math.random() < 0.65 && biased.length ? biased : pool) };
  // corrupted zones roll unstable, higher-value versions
  const swing = 1 + ctx.corruption / 150 + ctx.difficulty * 0.04;
  mod.value = Math.round(mod.value * swing);
  return mod;
}

function generateName(ctx: LootContext, slot: LootItem["slot"]): string {
  const base = slot === "WEAPON" ? pick(WEAPONS) : slot === "ARMOR" ? pick(ARMORS) : pick(CORES);
  const prefix = ctx.corruption > 60 ? "Corrupted" : pick(PREFIX);
  return Math.random() < 0.35 ? `${prefix} ${base} ${pick(SUFFIX)}` : `${prefix} ${base}`;
}

/** hard ceiling so generated gear can never break the game */
export function validate(item: LootItem): boolean {
  if (item.power > 1000) return false;
  if (item.mods.length > 5) return false;
  if (item.mods.some((m) => m.value > 60)) return false;
  return true;
}

function clampItem(item: LootItem): LootItem {
  item.power = Math.min(1000, item.power);
  item.mods = item.mods.slice(0, 5).map((m) => ({ ...m, value: Math.min(60, m.value) }));
  return item;
}

export function generateLoot(ctx: LootContext): LootItem {
  const slot: LootItem["slot"] = Math.random() < 0.55 ? "WEAPON" : Math.random() < 0.7 ? "ARMOR" : "CORE";
  const rarity = rollRarity(ctx);
  const tier = MOD_TIERS[rarity];
  const item: LootItem = {
    name: generateName(ctx, slot),
    slot,
    rarity,
    power: Math.round(ctx.difficulty * 60 + tier * 90 + ctx.corruption * 1.2 + Math.random() * 40),
    mods: Array.from({ length: Math.min(4, 1 + tier) }, () => generateMod(ctx)),
    life: 9,
  };
  const final = validate(item) ? item : clampItem(item);
  return validate(final) ? final : { ...final, power: 900, mods: final.mods.slice(0, 3) };
}
