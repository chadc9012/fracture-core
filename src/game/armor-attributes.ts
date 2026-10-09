import { perkEffects } from "./armor-perks";
import { NO_EFFECTS, MAX_RESIST, armorEffects, setStatuses, type ArmorEffects, type SetSlot } from "./armor-sets";
import type { GearItem } from "./inventory";
import type { PlayerProgression } from "./progression";

/**
 * Mix-and-match armor attributes. Every armor piece (set piece or not) carries three attributes, derived
 * purely from its slot, power and set, so no save migration is needed:
 *   INTELLECT — ability recharge   MOBILITY — move speed and slides   DEFENSE — damage resistance
 * No set is ever required. Rules that keep any one stat from dominating: soft caps (diminishing returns),
 * trade-offs (heavy defense costs mobility, heavy intellect costs defense), and a flexibility bonus for
 * mixed gear that has no set bonus active. Pure; Scene applies loadoutEffects().
 */
export type Attribute = "intellect" | "mobility" | "defense";
export type Attributes = Record<Attribute, number>;
export const ATTRIBUTES: readonly Attribute[] = ["intellect", "mobility", "defense"];
export const NO_ATTRIBUTES: Attributes = { intellect: 0, mobility: 0, defense: 0 };

const WEIGHTS: Record<SetSlot, Attributes> = {
  helmet: { intellect: 0.6, mobility: 0.1, defense: 0.3 },
  chest: { intellect: 0.1, mobility: 0.1, defense: 0.8 },
  gauntlets: { intellect: 0.2, mobility: 0.6, defense: 0.2 },
  legs: { intellect: 0.1, mobility: 0.7, defense: 0.2 },
  classItem: { intellect: 0.4, mobility: 0.3, defense: 0.3 },
};
/** Each set leans a direction; a multiplier per attribute (1 = neutral). */
const SET_TILT: Record<string, Attributes> = {
  "verdant-warden": { intellect: 1.1, mobility: 1, defense: 1.1 },
  "mire-stalker": { intellect: 1, mobility: 1.25, defense: 0.85 },
  "cinder-vanguard": { intellect: 1, mobility: 0.9, defense: 1.2 },
  "frostwrought-aegis": { intellect: 0.9, mobility: 0.8, defense: 1.4 },
  "scrapborn-raider": { intellect: 1, mobility: 1.15, defense: 1 },
  "dune-seeker": { intellect: 1.1, mobility: 1.3, defense: 0.75 },
};

export const SOFT_CAP = 40;
export const SOFT_CAP_FALLOFF = 0.5;
export const TRADEOFF_FLOOR = 35;
const ARMOR_SLOTS = Object.keys(WEIGHTS) as SetSlot[];
const isArmor = (item: GearItem): item is GearItem & { slot: SetSlot } => (ARMOR_SLOTS as string[]).includes(item.slot);

export function pieceAttributes(item: Pick<GearItem, "slot" | "power" | "setId">): Attributes {
  const weights = WEIGHTS[item.slot as SetSlot];
  if (!weights) return { ...NO_ATTRIBUTES };
  const tilt = (item.setId && SET_TILT[item.setId]) || { intellect: 1, mobility: 1, defense: 1 };
  const base = item.power / 10;
  return { intellect: base * weights.intellect * tilt.intellect, mobility: base * weights.mobility * tilt.mobility, defense: base * weights.defense * tilt.defense };
}

const soft = (x: number) => (x <= SOFT_CAP ? x : SOFT_CAP + (x - SOFT_CAP) * SOFT_CAP_FALLOFF);

export function wornArmor(progress: Pick<PlayerProgression, "inventory" | "equippedGear">): GearItem[] {
  return ARMOR_SLOTS.map((slot) => progress.inventory.find((item) => item.id === progress.equippedGear[slot])).filter((item): item is GearItem => !!item && isArmor(item));
}

export type LoadoutAttributes = { raw: Attributes; effective: Attributes; worn: number };

export function loadoutAttributes(progress: Pick<PlayerProgression, "inventory" | "equippedGear">): LoadoutAttributes {
  const worn = wornArmor(progress);
  const raw = worn.reduce<Attributes>((sum, item) => { const a = pieceAttributes(item); return { intellect: sum.intellect + a.intellect, mobility: sum.mobility + a.mobility, defense: sum.defense + a.defense }; }, { ...NO_ATTRIBUTES });
  // trade-offs act on the raw totals, then the soft cap flattens whatever is left
  const mobility = raw.mobility - Math.max(0, raw.defense - TRADEOFF_FLOOR) * 0.3;
  const defense = raw.defense - Math.max(0, raw.intellect - TRADEOFF_FLOOR) * 0.25;
  return { raw, effective: { intellect: soft(raw.intellect), mobility: soft(Math.max(0, mobility)), defense: soft(Math.max(0, defense)) }, worn: worn.length };
}

/** Mixed gear (four or more pieces, three or more different sources, no set bonus live) earns a flexibility bonus. */
export function hasFlexibility(progress: Pick<PlayerProgression, "inventory" | "equippedGear">): boolean {
  const worn = wornArmor(progress);
  if (worn.length < 4) return false;
  if (setStatuses(progress).some((status) => status.twoActive)) return false;
  return new Set(worn.map((item) => item.setId ?? item.source)).size >= 3;
}

export const FLEX_BONUS: Partial<ArmorEffects> = { resist: 0.03, moveSpeed: 0.03, abilityRecharge: 0.05 };

export function attributeEffects(attrs: Attributes): ArmorEffects {
  return { ...NO_EFFECTS, abilityRecharge: (attrs.intellect / 100) * 0.6, moveSpeed: (attrs.mobility / 100) * 0.3, slideBoost: (attrs.mobility / 100) * 0.4, resist: (attrs.defense / 100) * 0.5 };
}

/** Set bonuses + attribute effects + flexibility, with resistance still capped. */
export function loadoutEffects(progress: Pick<PlayerProgression, "inventory" | "equippedGear">): ArmorEffects {
  const total = { ...armorEffects(progress) };
  const fromAttrs = attributeEffects(loadoutAttributes(progress).effective);
  for (const key of Object.keys(fromAttrs) as (keyof ArmorEffects)[]) total[key] += fromAttrs[key];
  const perks = perkEffects(progress); // per-piece perks work with or without the rest of the set
  for (const key of Object.keys(perks) as (keyof ArmorEffects)[]) total[key] += perks[key];
  if (hasFlexibility(progress)) for (const key of Object.keys(FLEX_BONUS) as (keyof ArmorEffects)[]) total[key] += FLEX_BONUS[key] ?? 0;
  total.resist = Math.min(MAX_RESIST, total.resist);
  return total;
}

/** Soft warnings only: a fragile or sluggish loadout is allowed, the player is just told. */
export function loadoutWarnings(progress: Pick<PlayerProgression, "inventory" | "equippedGear">): string[] {
  const { effective, worn } = loadoutAttributes(progress);
  const out: string[] = [];
  if (worn < ARMOR_SLOTS.length) out.push(`${ARMOR_SLOTS.length - worn} armor slot${ARMOR_SLOTS.length - worn === 1 ? "" : "s"} empty`);
  if (worn >= 3 && effective.defense < 8) out.push("Fragile: very little protection if you get caught");
  if (worn >= 3 && effective.mobility < 8) out.push("Slow: little help repositioning or escaping");
  if (worn >= 3 && effective.intellect < 8) out.push("Abilities recharge at the base rate");
  return out;
}
