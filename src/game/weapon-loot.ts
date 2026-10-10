/** Weapon loot from every source the player explores: regular/elite/boss kills, dungeon clears and main-mission first clears (open-world
 * caches already drop weapons and armor in loot-caches.ts; armor-set pieces drop from kills in armor-sets.ts). Weapons are real named
 * entries of the master manifest (equipment.ts) turned into ordinary GearItems, so they equip, upgrade, sell and save like any other.
 * Power stays inside the established bands (80 / 95 / 110 / 125): nothing here inflates rewards. Pure; Math.random only at the call site. */
import { WEAPON_MANIFEST, type WeaponManifestItem } from "./equipment";
import type { GearItem, GearSlot, MaterialId } from "./inventory";

export type LootSource = "enemy-regular" | "enemy-elite" | "enemy-boss" | "dungeon" | "mission";
export const WEAPON_DROP_CHANCE: Record<Extract<LootSource, `enemy-${string}`>, number> = { "enemy-regular": 0.02, "enemy-elite": 0.08, "enemy-boss": 0.35 };
export const SOURCE_POWER: Record<LootSource, number> = { "enemy-regular": 80, "enemy-elite": 95, "enemy-boss": 110, dungeon: 110, mission: 95 };
const ELEMENT: Record<WeaponManifestItem["element"], GearItem["element"]> = { KINETIC: "KINETIC", PLASMA: "ARC", CRYO: "CRYO", ARC: "ARC", THERMAL: "THERMAL", VOID: "BIO" };
const SLOT_OF = (w: WeaponManifestItem): GearSlot => (w.archetype === "HEAVY" ? "heavy" : w.archetype === "SIDEARM" ? "secondary" : "primary");
/** only ordinary tiers can drop: T4+/S weapons stay behind forges, raids and signature rewards */
const DROPPABLE = WEAPON_MANIFEST.filter((w) => w.tier === "T1" || w.tier === "T2" || w.tier === "T3");
const hash = (s: string) => { let h = 2166136261 >>> 0; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

function build(source: LootSource, w: WeaponManifestItem, id: string, label: string): GearItem {
  return { id, name: w.name, slot: SLOT_OF(w), power: SOURCE_POWER[source], level: 1, element: ELEMENT[w.element], source: label };
}
/** `roll` is one uniform [0,1): the low end decides whether it drops, the same number then picks the weapon (like rollSetDrop). */
export function rollWeaponLoot(source: Extract<LootSource, `enemy-${string}`>, zone: string, roll: number, uniqueSuffix: string): GearItem | null {
  const chance = WEAPON_DROP_CHANCE[source];
  if (!(roll >= 0) || roll >= chance) return null;
  const pick = DROPPABLE[hash(`${zone}|${roll}`) % DROPPABLE.length]!;
  return build(source, pick, `drop-${pick.id}-${uniqueSuffix}`, `${source === "enemy-boss" ? "Boss" : source === "enemy-elite" ? "Elite" : "Enemy"} drop · ${zone}`);
}
/** One guaranteed, stable-id weapon per clear (dungeon or main mission): granting twice is impossible because the id is the key. */
export function completionWeapon(source: "dungeon" | "mission", key: string): GearItem {
  const pick = DROPPABLE[hash(`${source}:${key}`) % DROPPABLE.length]!;
  return build(source, pick, `reward-weapon:${source}:${key}`, source === "dungeon" ? "Dungeon clear reward" : "Mission reward");
}
export function grantCompletionWeapon<P extends { inventory: GearItem[] }>(p: P, source: "dungeon" | "mission", key: string): P {
  const item = completionWeapon(source, key);
  return p.inventory.some((g) => g.id === item.id) ? p : { ...p, inventory: [...p.inventory, item] };
}

/** Dungeon first clear: one forgeCatalyst (weapon upgrade gate) + one guaranteed weapon. Repeat clears pay neither; the weapon id is the idempotence key. */
export function grantDungeonFirstClear<P extends { inventory: GearItem[]; materials: Partial<Record<MaterialId, number>>; dungeonClears: Record<string, number> }>(p: P, dungeonId: string): P {
  if ((p.dungeonClears[dungeonId] ?? 0) > 0) return p;
  const withWeapon = grantCompletionWeapon(p, "dungeon", dungeonId);
  return { ...withWeapon, materials: { ...withWeapon.materials, forgeCatalyst: (withWeapon.materials.forgeCatalyst ?? 0) + 1 } };
}
