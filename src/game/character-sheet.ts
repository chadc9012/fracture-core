/** The Character screen's view model (reference: Destiny 2's character/collections/triumphs screens, interfaceingame.com; see
 * docs/ui-references.md). Pure: everything the screen shows is derived here from the save, so the numbers match combat and the
 * screen can be tested without React. Equipping goes through `equipItem`, which refuses anything that is not a legal swap. */
import { loadoutAttributes, pieceAttributes } from "./armor-attributes";
import { ARMOR_SETS, SET_SLOTS, setById, type SetSlot } from "./armor-sets";
import { MATERIALS, type GearItem, type GearSlot } from "./inventory";
import { LANDMARKS, landmarkKey } from "./landmarks";
import type { PlayerProgression } from "./progression";
import { QUESTS } from "./quests";
import { VEHICLES } from "./vehicles";

export const WEAPON_SLOTS = ["primary", "secondary", "heavy"] as const satisfies readonly GearSlot[];
export const ARMOR_SLOTS: readonly SetSlot[] = ["helmet", "gauntlets", "chest", "legs", "classItem"];
export const SLOT_NAME: Record<GearSlot, string> = { primary: "Kinetic", secondary: "Energy", heavy: "Power", helmet: "Helmet", gauntlets: "Gauntlets", chest: "Chest Armor", legs: "Leg Armor", classItem: "Class Item", vehicle: "Vehicle" };

export type Tier = "EXOTIC" | "LEGENDARY" | "RARE" | "COMMON";
export const TIER_COLOR: Record<Tier, string> = { EXOTIC: "#cdae33", LEGENDARY: "#522f65", RARE: "#5076a3", COMMON: "#366f42" };

type Save = Pick<PlayerProgression, "inventory" | "equippedGear">;
const byId = (p: Save, id: string | undefined) => (id ? p.inventory.find((i) => i.id === id) ?? null : null);

export function tierOf(item: GearItem): Tier { return item.rarity ?? (item.setId ? "LEGENDARY" : item.power >= 120 ? "RARE" : "COMMON"); }

/** Power level: the average power of what is equipped in the weapon and armor slots (never the vault), rounded down */
export function powerLevel(p: Save): number {
  const items = [...WEAPON_SLOTS, ...ARMOR_SLOTS].map((s) => byId(p, p.equippedGear[s])).filter((i): i is GearItem => !!i);
  return items.length ? Math.floor(items.reduce((n, i) => n + i.power, 0) / items.length) : 0;
}

export type Sheet = {
  power: number;
  weapons: { slot: GearSlot; item: GearItem | null }[];
  armor: { slot: GearSlot; item: GearItem | null }[];
  attributes: { label: string; value: number }[];
  currencies: { name: string; amount: number }[];
};
export function characterSheet(p: Save & Pick<PlayerProgression, "materials" | "fractureShards">): Sheet {
  const a = loadoutAttributes(p);
  const mats = Object.entries(p.materials).filter(([, n]) => (n ?? 0) > 0).sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0)).slice(0, 2)
    .map(([k, n]) => ({ name: MATERIALS[k as keyof typeof MATERIALS]?.name ?? k, amount: n ?? 0 }));
  return {
    power: powerLevel(p),
    weapons: WEAPON_SLOTS.map((slot) => ({ slot, item: byId(p, p.equippedGear[slot]) })),
    armor: ARMOR_SLOTS.map((slot) => ({ slot, item: byId(p, p.equippedGear[slot]) })),
    attributes: [{ label: "Mobility", value: Math.round(a.effective.mobility) }, { label: "Defense", value: Math.round(a.effective.defense) }, { label: "Intellect", value: Math.round(a.effective.intellect) }],
    currencies: [{ name: "Fracture Shards", amount: p.fractureShards ?? 0 }, ...mats],
  };
}

export type Tooltip = { title: string; type: string; tier: Tier; color: string; power: number; source: string; stats: { label: string; value: number; max: number }[]; perks: string[] };
export function itemTooltip(item: GearItem): Tooltip {
  const tier = tierOf(item);
  const armor = (SET_SLOTS as readonly string[]).includes(item.slot);
  const stats = armor
    ? (() => { const at = pieceAttributes(item); return [{ label: "Mobility", value: Math.round(at.mobility), max: 20 }, { label: "Defense", value: Math.round(at.defense), max: 20 }, { label: "Intellect", value: Math.round(at.intellect), max: 20 }]; })()
    : [{ label: "Impact", value: item.power, max: 200 }, { label: "Level", value: item.level, max: 10 }];
  const set = item.setId ? setById(item.setId) : undefined;
  const perks = [
    ...(item.element && item.element !== "KINETIC" ? [`${item.element[0]}${item.element.slice(1).toLowerCase()} element`] : []),
    ...(item.perk === "NULL_DISRUPTION" ? ["Null Disruption"] : []),
    ...(set ? [`${set.name} set`] : []),
    ...(item.evolution ? ["Evolved at a ruin"] : []),
  ];
  return { title: item.name, type: `${SLOT_NAME[item.slot]} · ${tier[0]}${tier.slice(1).toLowerCase()}`, tier, color: TIER_COLOR[tier], power: item.power, source: item.source, stats, perks };
}

/** what can go in `slot`, strongest first, equipped item first among equals */
export function equipOptions(p: Save, slot: GearSlot): GearItem[] {
  return p.inventory.filter((i) => i.slot === slot).sort((a, b) => b.power - a.power || Number(p.equippedGear[slot] === b.id) - Number(p.equippedGear[slot] === a.id));
}
/** equip `id` into `slot`; returns the same object for anything illegal (wrong slot, not owned) */
export function equipItem<T extends Save>(p: T, slot: GearSlot, id: string): T {
  const item = p.inventory.find((i) => i.id === id);
  if (!item || item.slot !== slot || p.equippedGear[slot] === id) return p;
  return { ...p, equippedGear: { ...p.equippedGear, [slot]: id } };
}

/** `total` 0 = an open-ended collection (counted, no denominator: the catalogue is not finite yet) */
export type Collection = { id: string; label: string; owned: number; total: number };
export function collections(p: Pick<PlayerProgression, "inventory" | "ownedVehicles" | "earnedRewards">): Collection[] {
  const pieces = new Set(p.inventory.filter((i) => i.setId).map((i) => `${i.setId}:${i.slot}`));
  return [
    { id: "armor", label: "Armor", owned: pieces.size, total: ARMOR_SETS.length * SET_SLOTS.length },
    { id: "exotic", label: "Exotics", owned: new Set(p.inventory.filter((i) => i.rarity === "EXOTIC").map((i) => i.name)).size, total: 0 },
    { id: "weapons", label: "Weapons", owned: new Set(p.inventory.filter((i) => (WEAPON_SLOTS as readonly string[]).includes(i.slot)).map((i) => i.name)).size, total: 0 },
    { id: "vehicles", label: "Vehicles", owned: p.ownedVehicles.length, total: VEHICLES.length },
    { id: "landmarks", label: "Landmarks", owned: LANDMARKS.filter((l) => p.earnedRewards.includes(landmarkKey(l.id))).length, total: LANDMARKS.length },
  ];
}

export type Triumph = { id: string; title: string; detail: string; done: number; goal: number; score: number };
export function triumphs(p: Pick<PlayerProgression, "completedMissions" | "earnedRewards" | "dungeonClears" | "inventory" | "ownedVehicles">): { list: Triumph[]; score: number } {
  const campaign = Object.keys(QUESTS).filter((id) => id.startsWith("fd-"));
  const fullSets = ARMOR_SETS.filter((s) => SET_SLOTS.every((slot) => p.inventory.some((i) => i.setId === s.id && i.slot === slot))).length;
  const list: Triumph[] = [
    { id: "campaign", title: "The Fracture Descent", detail: "Finish the campaign's chapters.", done: campaign.filter((id) => p.completedMissions.includes(id)).length, goal: campaign.length, score: 50 },
    { id: "cartographer", title: "Cartographer", detail: "Discover every landmark.", done: LANDMARKS.filter((l) => p.earnedRewards.includes(landmarkKey(l.id))).length, goal: LANDMARKS.length, score: 30 },
    { id: "hunter", title: "Scenario Hunter", detail: "Defeat four Unique Scenario bosses.", done: Math.min(4, p.earnedRewards.filter((r) => r.startsWith("scenario-run:")).length), goal: 4, score: 40 },
    { id: "delver", title: "Delver", detail: "Clear five dungeon runs.", done: Math.min(5, Object.values(p.dungeonClears).reduce((n, c) => n + c, 0)), goal: 5, score: 25 },
    { id: "outfitter", title: "Outfitter", detail: "Complete a full regional armor set.", done: Math.min(1, fullSets), goal: 1, score: 20 },
    { id: "garage", title: "Motor Pool", detail: "Own three vehicles.", done: Math.min(3, p.ownedVehicles.length), goal: 3, score: 15 },
  ];
  return { list, score: list.reduce((n, t) => n + (t.done >= t.goal ? t.score : 0), 0) };
}
