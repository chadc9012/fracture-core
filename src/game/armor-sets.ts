import type { GearItem, GearSlot } from "./inventory";
import type { PlayerProgression } from "./progression";

/**
 * Armor sets: one themed five-piece set per region, dropped by that region's enemies. Equipping 2 or 4
 * pieces of the same set unlocks a bonus; upgrading the pieces (levels 1..ARMOR_LEVEL_MAX) strengthens
 * every bonus. Pure rules only: Scene reads armorEffects() and applies the numbers, inventory.ts
 * grants drops. A duplicate drop levels the piece you already own, so nothing is ever wasted.
 */
export type SetSlot = Extract<GearSlot, "helmet" | "gauntlets" | "chest" | "legs" | "classItem">;
export const SET_SLOTS: readonly SetSlot[] = ["helmet", "gauntlets", "chest", "legs", "classItem"];
export const ARMOR_LEVEL_MAX = 10;
export const BONUS_PER_LEVEL = 0.08;
const POWER_PER_LEVEL = 15;

/** Every number is a fraction (0.08 = +8%) except regen, which is hull points per second. */
export type ArmorEffects = { resist: number; weaponDamage: number; moveSpeed: number; regen: number; slideBoost: number; /** faster ability cooldowns and energy (armor-attributes.ts INTELLECT) */ abilityRecharge: number };
export const NO_EFFECTS: ArmorEffects = { resist: 0, weaponDamage: 0, moveSpeed: 0, regen: 0, slideBoost: 0, abilityRecharge: 0 };
export const MAX_RESIST = 0.5;

export type SetBonus = { name: string; description: string; effects: Partial<ArmorEffects> };
export type ArmorSet = {
  id: string;
  name: string;
  regionId: string;
  element: GearItem["element"];
  color: string;
  tagline: string;
  pieces: Record<SetSlot, string>;
  two: SetBonus;
  four: SetBonus;
};

export const ARMOR_SETS: readonly ArmorSet[] = [
  {
    id: "verdant-warden", name: "Verdant Warden", regionId: "veridan", element: "BIO", color: "#6fd06a", tagline: "Forest sentinels who never break cover.",
    pieces: { helmet: "Warden Hood", gauntlets: "Warden Grips", chest: "Warden Cuirass", legs: "Warden Greaves", classItem: "Warden Sash" },
    two: { name: "Canopy Ward", description: "Incoming damage reduced by 8%.", effects: { resist: 0.08 } },
    four: { name: "Rootbound Recovery", description: "Hull slowly regenerates, and resistance rises another 4%.", effects: { regen: 1.2, resist: 0.04 } },
  },
  {
    id: "mire-stalker", name: "Mire Stalker", regionId: "swamps", element: "BIO", color: "#8fbf5a", tagline: "Light armor for wading through the Swamps.",
    pieces: { helmet: "Stalker Mask", gauntlets: "Stalker Wraps", chest: "Stalker Vest", legs: "Stalker Waders", classItem: "Stalker Cloak" },
    two: { name: "Bog Stride", description: "Move 6% faster.", effects: { moveSpeed: 0.06 } },
    four: { name: "Spore Mend", description: "Regenerate hull, and resist 5% of incoming damage.", effects: { regen: 1, resist: 0.05 } },
  },
  {
    id: "cinder-vanguard", name: "Cinder Vanguard", regionId: "ember", element: "THERMAL", color: "#ff7a3a", tagline: "Forged in the Ember Peaks, built to hit back.",
    pieces: { helmet: "Cinder Visor", gauntlets: "Cinder Fists", chest: "Cinder Plate", legs: "Cinder Treads", classItem: "Cinder Mark" },
    two: { name: "Heat Sink", description: "Weapon damage +8%.", effects: { weaponDamage: 0.08 } },
    four: { name: "Ashfall Fury", description: "Weapon damage +14% more, and resist 4%.", effects: { weaponDamage: 0.14, resist: 0.04 } },
  },
  {
    id: "frostwrought-aegis", name: "Frostwrought Aegis", regionId: "frostspire", element: "CRYO", color: "#7fd8ff", tagline: "Rime-plated armor that shrugs off punishment.",
    pieces: { helmet: "Aegis Crown", gauntlets: "Aegis Gauntlets", chest: "Aegis Carapace", legs: "Aegis Sabatons", classItem: "Aegis Banner" },
    two: { name: "Rime Plating", description: "Incoming damage reduced by 10%.", effects: { resist: 0.1 } },
    four: { name: "Glacier Bulwark", description: "Resist 10% more, and slides carry further.", effects: { resist: 0.1, slideBoost: 0.12 } },
  },
  {
    id: "scrapborn-raider", name: "Scrapborn Raider", regionId: "wastelands", element: "KINETIC", color: "#d8b25a", tagline: "Salvage turned into armor, built for the open road.",
    pieces: { helmet: "Raider Goggles", gauntlets: "Raider Mitts", chest: "Raider Jacket", legs: "Raider Chaps", classItem: "Raider Scarf" },
    two: { name: "Salvager's Edge", description: "Weapon damage +5%, move 4% faster.", effects: { weaponDamage: 0.05, moveSpeed: 0.04 } },
    four: { name: "Road Warrior", description: "Move 8% faster and slide 15% further.", effects: { moveSpeed: 0.08, slideBoost: 0.15 } },
  },
  {
    id: "dune-seeker", name: "Dune Seeker", regionId: "solara", element: "ARC", color: "#ffd25a", tagline: "Sun-baked scouts who never stop moving.",
    pieces: { helmet: "Seeker Veil", gauntlets: "Seeker Bracers", chest: "Seeker Tunic", legs: "Seeker Wraps", classItem: "Seeker Mantle" },
    two: { name: "Mirage Step", description: "Move 7% faster.", effects: { moveSpeed: 0.07 } },
    four: { name: "Sun Surge", description: "Weapon damage +10%, move 6% faster.", effects: { weaponDamage: 0.1, moveSpeed: 0.06 } },
  },
];

export const setById = (id: string): ArmorSet | undefined => ARMOR_SETS.find((s) => s.id === id);
export const setForRegion = (regionId: string): ArmorSet | undefined => ARMOR_SETS.find((s) => s.regionId === regionId);
export const setPieceId = (setId: string, slot: SetSlot) => `set-${setId}-${slot}`;

const BASE_POWER: Record<SetSlot, number> = { helmet: 95, gauntlets: 90, chest: 110, legs: 95, classItem: 85 };

export function makeSetPiece(setId: string, slot: SetSlot, level = 1): GearItem | null {
  const set = setById(setId);
  if (!set) return null;
  const lv = Math.max(1, Math.min(ARMOR_LEVEL_MAX, Math.round(level)));
  return { id: setPieceId(setId, slot), name: set.pieces[slot], slot, power: BASE_POWER[slot] + POWER_PER_LEVEL * (lv - 1), level: lv, element: set.element, source: `${set.name} set`, setId };
}

export type DropTier = "NORMAL" | "ELITE" | "BOSS";
export const SET_DROP_CHANCE: Record<DropTier, number> = { NORMAL: 0.03, ELITE: 0.12, BOSS: 0.6 };
export type SetDrop = { setId: string; slot: SetSlot };

/** `roll` is one uniform [0,1) number: the low end of it decides whether it drops, the same number picks the slot. */
export function rollSetDrop(regionId: string, tier: DropTier, roll: number): SetDrop | null {
  const set = setForRegion(regionId);
  const chance = SET_DROP_CHANCE[tier];
  if (!set || !(roll >= 0) || roll >= chance) return null;
  const slot = SET_SLOTS[Math.min(SET_SLOTS.length - 1, Math.floor((roll / chance) * SET_SLOTS.length))]!;
  return { setId: set.id, slot };
}

export type GrantResult = "NEW" | "UPGRADED" | "MAXED";
/** New piece goes into the inventory; a duplicate levels the owned piece (up to the cap). */
export function grantSetPiece(progress: PlayerProgression, drop: SetDrop): { progress: PlayerProgression; result: GrantResult; item: GearItem } | null {
  const id = setPieceId(drop.setId, drop.slot);
  const owned = progress.inventory.find((item) => item.id === id);
  if (!owned) {
    const item = makeSetPiece(drop.setId, drop.slot);
    return item ? { progress: { ...progress, inventory: [...progress.inventory, item] }, result: "NEW", item } : null;
  }
  if (owned.level >= ARMOR_LEVEL_MAX) return { progress, result: "MAXED", item: owned };
  const item = { ...owned, level: owned.level + 1, power: owned.power + POWER_PER_LEVEL };
  return { progress: { ...progress, inventory: progress.inventory.map((entry) => (entry.id === id ? item : entry)) }, result: "UPGRADED", item };
}

export function equipPiece(progress: PlayerProgression, id: string): PlayerProgression {
  const item = progress.inventory.find((entry) => entry.id === id);
  if (!item) return progress;
  return { ...progress, equippedGear: { ...progress.equippedGear, [item.slot]: id } };
}

export type SetStatus = { set: ArmorSet; equipped: number; owned: number; averageLevel: number; twoActive: boolean; fourActive: boolean };

/** Per-set progress: how many pieces are worn, how many are owned, and which bonuses are live. */
export function setStatuses(progress: Pick<PlayerProgression, "inventory" | "equippedGear">): SetStatus[] {
  const worn = new Set(Object.values(progress.equippedGear).filter((id): id is string => typeof id === "string"));
  return ARMOR_SETS.map((set) => {
    const pieces = progress.inventory.filter((item) => item.setId === set.id);
    const equippedPieces = pieces.filter((item) => worn.has(item.id));
    const avg = equippedPieces.length ? equippedPieces.reduce((sum, item) => sum + item.level, 0) / equippedPieces.length : 1;
    return { set, equipped: equippedPieces.length, owned: pieces.length, averageLevel: avg, twoActive: equippedPieces.length >= 2, fourActive: equippedPieces.length >= 4 };
  });
}

/** Total effect of every active bonus; each set's bonuses scale with the average level of its worn pieces. */
export function armorEffects(progress: Pick<PlayerProgression, "inventory" | "equippedGear">): ArmorEffects {
  const total: ArmorEffects = { ...NO_EFFECTS };
  for (const status of setStatuses(progress)) {
    if (!status.twoActive) continue;
    const scale = 1 + BONUS_PER_LEVEL * (Math.min(ARMOR_LEVEL_MAX, status.averageLevel) - 1);
    const bonuses = status.fourActive ? [status.set.two, status.set.four] : [status.set.two];
    for (const bonus of bonuses) {
      for (const key of Object.keys(bonus.effects) as (keyof ArmorEffects)[]) total[key] += (bonus.effects[key] ?? 0) * scale;
    }
  }
  total.resist = Math.min(MAX_RESIST, total.resist);
  return total;
}
