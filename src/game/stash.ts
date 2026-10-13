/**
 * Account stash rules (pure): collectibles (data chips, energy tokens, relic fragments) are account currency in
 * progression.materials and sync with the cloud save. They craft Ruin Stones and field stims. Stims carry in stacks
 * of at most 3 and boost armor or healing for a while (active stacks also cap at 3). Duplicate gear can be sold to
 * shops for fracture shards; any spare gear can be dismantled into gear parts, which upgrade weapons and armor.
 * The vault stores gear out of the carried inventory (progression.vaultIds).
 * Removed gear leaves a "gone:<id>" tombstone in earnedRewards so a cloud merge never brings it back.
 */
import type { GearItem, MaterialId } from "./inventory";
import { ARMOR_LEVEL_MAX } from "./armor-sets";

type P = { inventory: GearItem[]; materials: Partial<Record<MaterialId, number>>; equippedGear: Partial<Record<string, string>>; earnedRewards: string[]; fractureShards: number; vaultIds?: string[] };

export const STACK_CAP = 3;
export const VAULT_CAP = 150;
export type StimId = "armorStim" | "healStim";
export const STIMS: Record<StimId, { name: string; seconds: number; blurb: string; recipe: Partial<Record<MaterialId, number>> }> = {
  armorStim: { name: "Armor Stim", seconds: 60, blurb: "+10% damage resistance per stack for 60 s", recipe: { gearParts: 4, energyToken: 2 } },
  healStim: { name: "Heal Stim", seconds: 30, blurb: "+5 health per second per stack for 30 s", recipe: { dataChip: 2, energyToken: 2 } },
};
export const RUIN_STONE_RECIPE: Partial<Record<MaterialId, number>> = { dataChip: 5, energyToken: 5, relicFragment: 3 };

const has = (p: P, cost: Partial<Record<MaterialId, number>>) => Object.entries(cost).every(([k, n]) => (p.materials[k as MaterialId] ?? 0) >= (n ?? 0));
const pay = (p: P, cost: Partial<Record<MaterialId, number>>) => {
  const m = { ...p.materials };
  for (const [k, n] of Object.entries(cost)) m[k as MaterialId] = (m[k as MaterialId] ?? 0) - (n ?? 0);
  return m;
};
const isStim = (id: MaterialId): id is StimId => id === "armorStim" || id === "healStim";
/** add to the account; stims never exceed STACK_CAP */
export function grant<T extends P>(p: T, id: MaterialId, n: number): T {
  const now = (p.materials[id] ?? 0) + n;
  return { ...p, materials: { ...p.materials, [id]: isStim(id) ? Math.min(STACK_CAP, now) : now } };
}

export function craftRuinStone<T extends P>(p: T): T {
  if (!has(p, RUIN_STONE_RECIPE)) return p;
  return grant({ ...p, materials: pay(p, RUIN_STONE_RECIPE) }, "ruinStone", 1);
}
export function craftStim<T extends P>(p: T, id: StimId): T {
  if ((p.materials[id] ?? 0) >= STACK_CAP || !has(p, STIMS[id].recipe)) return p;
  return grant({ ...p, materials: pay(p, STIMS[id].recipe) }, id, 1);
}

export type Buff = { stacks: number; until: number };
export type Buffs = Partial<Record<StimId, Buff>>;
/** use one stim: spends it, adds a stack (max 3) and refreshes the timer */
export function useStim<T extends P>(p: T, buffs: Buffs, id: StimId, now: number): { progression: T; buffs: Buffs } | null {
  if ((p.materials[id] ?? 0) < 1) return null;
  const cur = buffs[id];
  const stacks = cur && cur.until > now ? Math.min(STACK_CAP, cur.stacks + 1) : 1;
  return { progression: { ...p, materials: { ...p.materials, [id]: (p.materials[id] ?? 0) - 1 } }, buffs: { ...buffs, [id]: { stacks, until: now + STIMS[id].seconds * 1000 } } };
}
export function buffEffect(buffs: Buffs, now: number) {
  const s = (id: StimId) => { const b = buffs[id]; return b && b.until > now ? b.stacks : 0; };
  return { resist: 0.1 * s("armorStim"), regen: 5 * s("healStim") };
}

const locked = (p: P, item: GearItem) => item.favorite || item.source === "Starting loadout" || Object.values(p.equippedGear).includes(item.id);
export const isDuplicate = (p: P, item: GearItem) => p.inventory.some((g) => g.id !== item.id && g.name === item.name && g.slot === item.slot);
export const sellValue = (item: GearItem) => 10 + Math.round(item.power / 10) + item.level * 2;
export const dismantleParts = (item: GearItem) => 2 + item.level + (item.rarity ? 4 : 0);
const remove = <T extends P>(p: T, id: string): T => ({ ...p, inventory: p.inventory.filter((g) => g.id !== id), vaultIds: (p.vaultIds ?? []).filter((v) => v !== id), earnedRewards: [...p.earnedRewards, `gone:${id}`] });

/** only duplicates can be traded; equipped, favorited and starter gear are refused */
export function sellDuplicate<T extends P>(p: T, id: string): T {
  const item = p.inventory.find((g) => g.id === id);
  if (!item || locked(p, item) || !isDuplicate(p, item)) return p;
  return { ...remove(p, id), fractureShards: p.fractureShards + sellValue(item) };
}
export function dismantle<T extends P>(p: T, id: string): T {
  const item = p.inventory.find((g) => g.id === id);
  if (!item || locked(p, item)) return p;
  return grant(remove(p, id), "gearParts", dismantleParts(item));
}
export const partsCost = (item: GearItem) => 3 * item.level;
export function upgradeWithParts<T extends P>(p: T, id: string): T {
  const item = p.inventory.find((g) => g.id === id);
  if (!item || (item.setId && item.level >= ARMOR_LEVEL_MAX)) return p;
  const cost = partsCost(item);
  if ((p.materials.gearParts ?? 0) < cost) return p;
  return { ...p, materials: { ...p.materials, gearParts: (p.materials.gearParts ?? 0) - cost }, inventory: p.inventory.map((g) => (g.id === id ? { ...g, level: g.level + 1, power: g.power + 15 } : g)) };
}

export const inVault = (p: P, id: string) => (p.vaultIds ?? []).includes(id);
export function toVault<T extends P>(p: T, id: string): T {
  const item = p.inventory.find((g) => g.id === id);
  if (!item || inVault(p, id) || Object.values(p.equippedGear).includes(id) || (p.vaultIds ?? []).length >= VAULT_CAP) return p;
  return { ...p, vaultIds: [...(p.vaultIds ?? []), id] };
}
export function fromVault<T extends P>(p: T, id: string): T {
  return { ...p, vaultIds: (p.vaultIds ?? []).filter((v) => v !== id) };
}

/** cloud merge helper: drop tombstoned gear, keep the newer vault placement for gear that still exists */
export function mergeStash(inventory: GearItem[], earned: string[], newerVault: string[] | undefined) {
  const gone = new Set(earned.filter((e) => e.startsWith("gone:")).map((e) => e.slice(5)));
  const inv = inventory.filter((g) => !gone.has(g.id));
  const ids = new Set(inv.map((g) => g.id));
  return { inventory: inv, vaultIds: (newerVault ?? []).filter((v) => ids.has(v)) };
}
