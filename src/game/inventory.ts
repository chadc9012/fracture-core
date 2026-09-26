import type { PlayerProgression } from "./progression";
import type { WorldSim } from "./sim";

export type MaterialId = "scrapMetal" | "reinforcedAlloy" | "microCircuits" | "thermalShards" | "cryoCrystal" | "sporeFiber" | "bioCatalyst" | "vehicleParts" | "anomalyCarbon" | "dataShards" | "magmaCore" | "zeroCore" | "abyssCore" | "aegisCore";
export type GearSlot = "primary" | "secondary" | "heavy" | "helmet" | "chest" | "gauntlets" | "classItem" | "legs" | "vehicle";
export type GearItem = { id: string; name: string; slot: GearSlot; power: number; level: number; element: "KINETIC" | "THERMAL" | "CRYO" | "ARC" | "BIO"; favorite?: boolean; source: string };

export const MATERIALS: Record<MaterialId, { name: string; source: string }> = {
  scrapMetal: { name: "Scrap Metal", source: "Raiders and convoy salvage" },
  reinforcedAlloy: { name: "Reinforced Alloy", source: "Warlords and armored patrols" },
  microCircuits: { name: "Micro-Circuits", source: "Overclocked units and city defenses" },
  thermalShards: { name: "Thermal Shards", source: "Ember Peaks" },
  cryoCrystal: { name: "Cryo Crystals", source: "Frostspire Mountains" },
  sporeFiber: { name: "Spore Fiber", source: "Veridan Forest and the Swamps" },
  bioCatalyst: { name: "Bio Catalyst", source: "Corrupted forest and swamp bosses" },
  vehicleParts: { name: "Vehicle Parts", source: "Rust-Runners and the Junkyard Citadel" },
  anomalyCarbon: { name: "Anomaly Carbon", source: "Solara Desert" },
  dataShards: { name: "Data Shards", source: "Fracture Architects" },
  magmaCore: { name: "Magma Core", source: "Overseer Kael" },
  zeroCore: { name: "Zero Core", source: "Subject Zero" },
  abyssCore: { name: "Abyss Core", source: "Kraken-Vanguard" },
  aegisCore: { name: "Aegis Core", source: "Aegis-Prime" },
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
  const { material, amount } = gearCost(item);
  if ((progress.materials[material] ?? 0) < amount) return progress;
  return { ...progress, materials: { ...progress.materials, [material]: (progress.materials[material] ?? 0) - amount }, inventory: progress.inventory.map((entry) => entry.id === id ? { ...entry, level: entry.level + 1, power: entry.power + 15 } : entry) };
}
export function infuseGear(progress: PlayerProgression, id: string, element: GearItem["element"]): PlayerProgression {
  const item = progress.inventory.find((entry) => entry.id === id);
  if (!item || element === "KINETIC" || element === item.element) return progress;
  const material: MaterialId = element === "THERMAL" ? "thermalShards" : element === "CRYO" ? "cryoCrystal" : element === "BIO" ? "bioCatalyst" : "microCircuits";
  if ((progress.materials[material] ?? 0) < 3) return progress;
  return { ...progress, materials: { ...progress.materials, [material]: (progress.materials[material] ?? 0) - 3 }, inventory: progress.inventory.map((entry) => entry.id === id ? { ...entry, element } : entry) };
}

export function claimDrops(progress: PlayerProgression, drops: WorldSim["drops"]): PlayerProgression {
  let next = progress;
  for (const drop of drops) {
    next = collectDrop(next, drop.material, drop.amount);
    if (["magmaCore", "zeroCore", "abyssCore", "aegisCore", "vehicleParts"].includes(drop.material) && drop.amount >= 3) {
      const id = `boss-${drop.material}`;
      if (!next.inventory.some((item) => item.id === id)) {
        const slot: GearSlot = drop.material === "vehicleParts" ? "vehicle" : drop.material === "aegisCore" ? "chest" : "heavy";
        const element = drop.material === "magmaCore" ? "THERMAL" : drop.material === "zeroCore" ? "CRYO" : "ARC";
        next = { ...next, inventory: [...next.inventory, { id, name: `${drop.enemy} Relic`, slot, power: 260, level: 1, element, source: drop.enemy }] };
      }
    }
  }
  return next;
}