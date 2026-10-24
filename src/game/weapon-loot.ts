/** Weapon loot from every source the player explores: regular/elite/boss kills, dungeon clears and main-mission first clears (open-world
 * caches already drop weapons and armor in loot-caches.ts; armor-set pieces drop from kills in armor-sets.ts). Weapons are real named
 * entries of the master manifest (equipment.ts) turned into ordinary GearItems, so they equip, upgrade, sell and save like any other.
 * Power sits on the shop ladder (regional-shops.ts: T1 90 · T2 140 · T3 190 · T4 260 · T5 340): a regular drop matches a T2 buy, an elite a
 * T3, a boss or dungeon a T4, and story missions climb from 140 to 330 through the campaign, so loot is always worth picking up over
 * the 135-power starting rifle. (The old 80 / 95 / 110 bands were all below the starting gear.) Pure; Math.random only at the call site. */
import { WEAPON_MANIFEST, type WeaponManifestItem } from "./equipment";
import { catalogFrom, WEAPON_CATALOG } from "./weapon-catalog";
import type { GearItem, GearSlot, MaterialId } from "./inventory";

export type LootSource = "enemy-regular" | "enemy-elite" | "enemy-boss" | "dungeon" | "mission";
export const WEAPON_DROP_CHANCE: Record<Extract<LootSource, `enemy-${string}`>, number> = { "enemy-regular": 0.02, "enemy-elite": 0.08, "enemy-boss": 0.35 };
export const SOURCE_POWER: Record<LootSource, number> = { "enemy-regular": 140, "enemy-elite": 190, "enemy-boss": 260, dungeon: 260, mission: 140 };
/** story missions in campaign order: each first-clear weapon is 140 + 17 per step (awakening 140 … system-core 327); others 190 */
const CAMPAIGN = ["awakening", "broken-signal", "drowned-relay", "blackout-protocol", "stitched-neon-core", "solar-array", "core-node", "frozen-beacon", "failure-core", "convoy-breaker", "descent-protocol", "system-core"];
export function missionWeaponPower(missionId: string): number {
  const i = CAMPAIGN.indexOf(missionId);
  return i < 0 ? 190 : 140 + 17 * i;
}
const ELEMENT: Record<WeaponManifestItem["element"], GearItem["element"]> = { KINETIC: "KINETIC", PLASMA: "ARC", CRYO: "CRYO", ARC: "ARC", THERMAL: "THERMAL", VOID: "BIO" };
const SLOT_OF = (w: WeaponManifestItem): GearSlot => (w.archetype === "HEAVY" ? "heavy" : w.archetype === "SIDEARM" ? "secondary" : "primary");
/** only ordinary tiers can drop: T4+/S weapons stay behind forges, raids and signature rewards */
const DROPPABLE: WeaponManifestItem[] = WEAPON_MANIFEST.filter((w) => w.tier === "T1" || w.tier === "T2" || w.tier === "T3");
/** the named catalogue (weapon-catalog.ts): its rare "loot" weapons drop from any enemy, its epic "boss" weapons from bosses */
const ENEMY_POOL: WeaponManifestItem[] = [...DROPPABLE, ...catalogFrom("loot")];
const BOSS_POOL: WeaponManifestItem[] = [...ENEMY_POOL, ...catalogFrom("boss")];
const hash = (s: string) => { let h = 2166136261 >>> 0; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

function build(source: LootSource, w: WeaponManifestItem, id: string, label: string, power = SOURCE_POWER[source]): GearItem {
  return { id, name: w.name, slot: SLOT_OF(w), power, level: 1, element: ELEMENT[w.element], source: label };
}
/** `roll` is one uniform [0,1): the low end decides whether it drops, the same number then picks the weapon (like rollSetDrop). */
export function rollWeaponLoot(source: Extract<LootSource, `enemy-${string}`>, zone: string, roll: number, uniqueSuffix: string): GearItem | null {
  const chance = WEAPON_DROP_CHANCE[source];
  if (!(roll >= 0) || roll >= chance) return null;
  const pool = source === "enemy-boss" ? BOSS_POOL : ENEMY_POOL;
  const pick = pool[hash(`${zone}|${roll}`) % pool.length]!;
  return build(source, pick, `drop-${pick.id}-${uniqueSuffix}`, `${source === "enemy-boss" ? "Boss" : source === "enemy-elite" ? "Elite" : "Enemy"} drop · ${zone}`);
}
/** One guaranteed, stable-id weapon per clear (dungeon or main mission): granting twice is impossible because the id is the key. */
export function completionWeapon(source: "dungeon" | "mission", key: string): GearItem {
  const pick = DROPPABLE[hash(`${source}:${key}`) % DROPPABLE.length]!;
  return build(source, pick, `reward-weapon:${source}:${key}`, source === "dungeon" ? "Dungeon clear reward" : "Mission reward", source === "mission" ? missionWeaponPower(key) : SOURCE_POWER.dungeon);
}
export function grantCompletionWeapon<P extends { inventory: GearItem[] }>(p: P, source: "dungeon" | "mission", key: string): P {
  const item = completionWeapon(source, key);
  return p.inventory.some((g) => g.id === item.id) ? p : { ...p, inventory: [...p.inventory, item] };
}

/** The catalogue's twelve exotics (the "mission" and "quest" rows of weapon-catalog.ts) are the campaign's signature rewards:
 * each story mission's first clear grants its own, on top of the regular completion weapon, at that mission's power + 20.
 * The id `exotic:<catalogue id>` is the idempotence key; saves that cleared a mission before this existed get theirs on their
 * next mission reward (backfillCampaignExotics). */
export const CAMPAIGN_EXOTIC: Record<string, string> = {
  awakening: "Soulpiercer", "broken-signal": "Eclipse SMG", "drowned-relay": "Doombringer", "blackout-protocol": "Lightbringer",
  "stitched-neon-core": "Worldbreaker", "solar-array": "Light of Solara", "core-node": "Silent Horizon", "frozen-beacon": "Thunder Lord",
  "failure-core": "Solara Blade", "convoy-breaker": "Dominator", "descent-protocol": "Gravity Lance", "system-core": "World Ender",
};
export function campaignExotic(missionId: string): GearItem | null {
  const name = CAMPAIGN_EXOTIC[missionId];
  const w = name ? WEAPON_CATALOG.find((c) => c.name === name) : undefined;
  if (!w) return null;
  return { ...build("mission", w, `exotic:${w.id}`, `Exotic · ${w.source}`, missionWeaponPower(missionId) + 20), rarity: "EXOTIC" };
}
/** grant every cleared campaign mission's exotic that the inventory is missing */
export function backfillCampaignExotics<P extends { inventory: GearItem[]; completedMissions: string[] }>(p: P): P {
  let inventory = p.inventory;
  for (const id of p.completedMissions) {
    const item = campaignExotic(id);
    if (item && !inventory.some((g) => g.id === item.id)) inventory = [...inventory, item];
  }
  return inventory === p.inventory ? p : { ...p, inventory };
}

/** Dungeon first clear: one forgeCatalyst (weapon upgrade gate) + one guaranteed weapon. Repeat clears pay neither; the weapon id is the idempotence key. */
export function grantDungeonFirstClear<P extends { inventory: GearItem[]; materials: Partial<Record<MaterialId, number>>; dungeonClears: Record<string, number> }>(p: P, dungeonId: string): P {
  if ((p.dungeonClears[dungeonId] ?? 0) > 0) return p;
  const withWeapon = grantCompletionWeapon(p, "dungeon", dungeonId);
  return { ...withWeapon, materials: { ...withWeapon.materials, forgeCatalyst: (withWeapon.materials.forgeCatalyst ?? 0) + 1 } };
}
