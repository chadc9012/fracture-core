import { recordEncounterClear } from "./encounter-journal";
import type { Evolution } from "./weapon-evolution";
import type { Godforged } from "./godforge";
import type { PlayerProgression } from "./progression";
import type { WorldSim } from "./sim";
import { playerPowerScore, rewardPacing } from "./balance";
import { ARMOR_LEVEL_MAX, grantSetPiece } from "./armor-sets";
import { grantScenarioReward } from "./scenario-loot";
import { challengesMet, recordVyrakClear } from "./dragonite";
import { VYRAK_REMATCH, markCompleted } from "./activities";
import { upgradeGate } from "./upgrade-gates";

export type MaterialId = "scrapMetal" | "reinforcedAlloy" | "microCircuits" | "thermalShards" | "cryoCrystal" | "sporeFiber" | "bioCatalyst" | "vehicleParts" | "anomalyCarbon" | "dataShards" | "magmaCore" | "zeroCore" | "abyssCore" | "aegisCore" | "forgeCatalyst" | "tuningCore" | "anomalyCore" | "fuel" | "fuelKingCore" | "fractureCore" | "glacierFang" | "nullPlate" | "hollowHalo" | "roninEdge" | "tideCrown" | "crownHeart" | "runeDust" | "dataChip" | "energyToken" | "relicFragment" | "ruinStone" | "gearParts" | "armorStim" | "healStim" | "dragonite";
export type GearSlot = "primary" | "secondary" | "heavy" | "helmet" | "chest" | "gauntlets" | "classItem" | "legs" | "vehicle";
export type GearItem = { /** foundries.ts: explicit foundry (otherwise derived from the name) */ foundry?: import("./foundries").FoundryId; id: string; name: string; slot: GearSlot; power: number; level: number; element: "KINETIC" | "THERMAL" | "CRYO" | "ARC" | "BIO"; favorite?: boolean; source: string; /** armor-sets.ts: which set this piece belongs to */ setId?: string; /** scenario-exclusive rarity tier (absent = ordinary gear) */ rarity?: "LEGENDARY" | "EXOTIC"; /** unique weapon perk (null-disruption.ts) */ perk?: "NULL_DISRUPTION" | "MAW_COLLAPSE"; /** weapon-evolution.ts: set once at a ruin */ evolution?: Evolution; /** godforge.ts: a Godforged relic's tier, socketed runes and mastery */ godforge?: Godforged; /** armor-shaders.ts: applied shader id (appearance only, never stats) */ shader?: string };

export const MATERIALS: Record<MaterialId, { name: string; source: string }> = {
  dataChip: { name: "Data Chips", source: "Collectible: mission loot boxes and world caches" },
  energyToken: { name: "Energy Tokens", source: "Collectible: every enemy drop" },
  relicFragment: { name: "Relic Fragments", source: "Collectible: bosses and first clears" },
  ruinStone: { name: "Ruin Stones", source: "Crafted: 5 data chips + 5 energy tokens + 3 relic fragments" },
  gearParts: { name: "Gear Parts", source: "Dismantled weapons and armor; upgrades gear" },
  armorStim: { name: "Armor Stim", source: "Crafted; carry up to 3; +10% resistance per stack for 60 s" },
  healStim: { name: "Heal Stim", source: "Crafted; carry up to 3; +5 health/s per stack for 30 s" },
  scrapMetal: { name: "Scrap Metal", source: "Raiders and convoy salvage" },
  reinforcedAlloy: { name: "Reinforced Alloy", source: "Warlords and armored patrols" },
  microCircuits: { name: "Micro-Circuits", source: "Overclocked units and city defenses" },
  thermalShards: { name: "Thermal Shards", source: "Ember Peaks" },
  cryoCrystal: { name: "Cryo Crystals", source: "Frostspire Mountains" },
  sporeFiber: { name: "Spore Fiber", source: "Verdant Forest and the Swamps" },
  bioCatalyst: { name: "Bio Catalyst", source: "Corrupted forest and swamp bosses" },
  vehicleParts: { name: "Vehicle Parts", source: "Rust-Runners and the Junkyard Citadel" },
  anomalyCarbon: { name: "Anomaly Carbon", source: "Solara Desert" },
  dataShards: { name: "Data Shards", source: "Fracture Architects" },
  magmaCore: { name: "Magma Core", source: "Overseer Kael" },
  zeroCore: { name: "Zero Core", source: "Subject Zero" },
  abyssCore: { name: "Abyss Core", source: "Kraken-Vanguard" },
  aegisCore: { name: "Aegis Core", source: "Aegis-Prime" },
  forgeCatalyst: { name: "Forge Catalyst", source: "First clear of a main mission or dungeon" },
  tuningCore: { name: "Tuning Core", source: "Side contracts, or bought at mod shops" },
  anomalyCore: { name: "Anomaly Core", source: "The Anomaly Prime" },
  fuel: { name: "Fuel", source: "Wasteland convoy raids and the Underground City Fuel Depot" },
  fuelKingCore: { name: "Fuel King Core", source: "The Fuel King" },
  fractureCore: { name: "Fracture Core", source: "The System Core" },
  glacierFang: { name: "Glacier Fang", source: "The Rime Alpha" },
  nullPlate: { name: "Null Plate", source: "The Dark Knight" },
  hollowHalo: { name: "Hollow Halo", source: "The Hollow Saint" },
  roninEdge: { name: "Ronin Edge", source: "The Red Ronin" },
  tideCrown: { name: "Tide Crown Shard", source: "The Drowned Monarch" },
  crownHeart: { name: "Heart of the Hollow Crown", source: "The Furnace Guardian (godforge.ts)" },
  dragonite: { name: "Dragonite", source: "Vyrak's Covenant and your Wyrmling's daily gift" },
  runeDust: { name: "Rune Dust", source: "Slain nemeses and secrets; spent at the Godforge" },
};

export const STARTER_GEAR: GearItem[] = [
  { id: "vanguard-mk4", name: "Vanguard MK-IV", slot: "primary", power: 135, level: 1, element: "KINETIC", source: "Starting loadout" },
  { id: "scrap-slugger", name: "Scrap-Slugger", slot: "secondary", power: 90, level: 1, element: "KINETIC", source: "Starting loadout" },
  { id: "field-helmet", name: "Field Helmet", slot: "helmet", power: 75, level: 1, element: "KINETIC", source: "Starting loadout" },
  { id: "field-chest", name: "Field Chestplate", slot: "chest", power: 90, level: 1, element: "KINETIC", source: "Starting loadout" },
  { id: "field-legs", name: "Field Greaves", slot: "legs", power: 70, level: 1, element: "KINETIC", source: "Starting loadout" },
];
export const STARTER_SLOTS: Partial<Record<GearSlot, string>> = Object.fromEntries(STARTER_GEAR.map((item) => [item.slot, item.id]));

export function collectDrop(progress: PlayerProgression, material: MaterialId, amount = 1): PlayerProgression {
  return { ...progress, materials: { ...progress.materials, [material]: (progress.materials[material] ?? 0) + amount } };
}
export function gearCost(item: GearItem): { material: MaterialId; amount: number } {
  if (item.slot === "vehicle") return { material: "vehicleParts", amount: item.level * 2 };
  if (item.element === "THERMAL") return { material: "thermalShards", amount: item.level * 2 };
  if (item.element === "CRYO") return { material: "cryoCrystal", amount: item.level * 2 };
  if (item.element === "BIO") return { material: "sporeFiber", amount: item.level * 2 };
  return { material: item.slot === "primary" || item.slot === "secondary" || item.slot === "heavy" ? "scrapMetal" : "reinforcedAlloy", amount: item.level * 2 };
}
export function upgradeGear(progress: PlayerProgression, id: string): PlayerProgression {
  const item = progress.inventory.find((entry) => entry.id === id);
  if (!item) return progress;
  // every item stops at level 10 (+135 power): uncapped upgrades let a level-30 starting rifle hit 570 power
  if (item.level >= (item.setId ? ARMOR_LEVEL_MAX : GEAR_LEVEL_MAX)) return progress;
  const { material, amount } = gearCost(item);
  const gate = upgradeGate(item);
  if ((progress.materials[material] ?? 0) < amount) return progress;
  if (gate && (progress.materials[gate.material] ?? 0) < gate.amount) return progress;
  // both costs are deducted in this single return: exactly once, or not at all
  const materials = { ...progress.materials, [material]: (progress.materials[material] ?? 0) - amount };
  if (gate) materials[gate.material] = (materials[gate.material] ?? 0) - gate.amount;
  return { ...progress, materials, inventory: progress.inventory.map((entry) => entry.id === id ? { ...entry, level: entry.level + 1, power: entry.power + 15 } : entry) };
}
/** weapon damage from gear power: +1% per 5 power above 100, capped at ×1.7 (an S-tier 420 weapon fully upgraded) */
export const WEAPON_DAMAGE_CAP = 1.7;
export function weaponDamageMultiplier(power: number): number {
  return Math.min(WEAPON_DAMAGE_CAP, 1 + Math.max(0, power - 100) / 500);
}
/** upgrade ceiling for every non-set item (set pieces use armor-sets ARMOR_LEVEL_MAX) */
export const GEAR_LEVEL_MAX = 10;
export function infuseGear(progress: PlayerProgression, id: string, element: GearItem["element"]): PlayerProgression {
  const item = progress.inventory.find((entry) => entry.id === id);
  if (!item || item.evolution || element === "KINETIC" || element === item.element) return progress;
  const material: MaterialId = element === "THERMAL" ? "thermalShards" : element === "CRYO" ? "cryoCrystal" : element === "BIO" ? "bioCatalyst" : "microCircuits";
  if ((progress.materials[material] ?? 0) < 3) return progress;
  return { ...progress, materials: { ...progress.materials, [material]: (progress.materials[material] ?? 0) - 3 }, inventory: progress.inventory.map((entry) => entry.id === id ? { ...entry, element } : entry) };
}

export function claimDrops(progress: PlayerProgression, drops: WorldSim["drops"]): PlayerProgression {
  let next = progress;
  // Global Balance Controller (balance.ts): paces material income against the player's own power —
  // a boost while under-geared, tapering toward and then below 1x late-game so income doesn't
  // outrun what upgrade/vendor costs already assume.
  const pacing = rewardPacing(playerPowerScore(progress));
  for (const drop of drops) {
    if (drop.setDrop) next = grantSetPiece(next, drop.setDrop)?.progress ?? next;
    if (drop.weaponDrop && !next.inventory.some((g) => g.id === drop.weaponDrop!.id)) next = { ...next, inventory: [...next.inventory, drop.weaponDrop] };
    if (drop.scenarioClaim) next = grantScenarioReward(next, drop.scenarioClaim).progress;
    if (drop.scenarioClaim?.participated) next = recordEncounterClear(next, next.identityClass, drop.scenarioClaim.scenarioId);
    // Vyrak pays no gear through scenario-loot: a confirmed, participated kill bonds the winning Operator class
    // (dragon-covenant.ts — Dragonite set, class ability, Wyrmling). Idempotent per class.
    if (drop.scenarioClaim?.scenarioId === "vyrak" && drop.scenarioClaim.participated) next = markCompleted(recordVyrakClear(next, next.identityClass, drop.scenarioClaim.runId, challengesMet(drop.scenarioClaim)).progression, VYRAK_REMATCH);
    next = collectDrop(next, drop.material, Math.max(1, Math.round(drop.amount * pacing)));
    next = collectDrop(next, "energyToken", 1);
    if (drop.amount >= 3) next = collectDrop(next, "relicFragment", 1);
    if (["magmaCore", "zeroCore", "abyssCore", "aegisCore", "anomalyCore", "vehicleParts", "fractureCore"].includes(drop.material) && drop.amount >= 3) {
      const id = `boss-${drop.material}`;
      if (!next.inventory.some((item) => item.id === id)) {
        const slot: GearSlot = drop.material === "vehicleParts" ? "vehicle" : drop.material === "aegisCore" ? "chest" : drop.material === "anomalyCore" || drop.material === "fractureCore" ? "classItem" : "heavy";
        const element = drop.material === "magmaCore" ? "THERMAL" : drop.material === "zeroCore" ? "CRYO" : "ARC";
        next = { ...next, inventory: [...next.inventory, { id, name: `${drop.enemy} Relic`, slot, power: 260, level: 1, element, source: drop.enemy }] };
      }
    }
  }
  return next;
}