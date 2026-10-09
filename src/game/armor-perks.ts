import { ARMOR_LEVEL_MAX, BONUS_PER_LEVEL, NO_EFFECTS, SET_SLOTS, setById, type ArmorEffects, type SetSlot } from "./armor-sets";
import type { GearItem } from "./inventory";
import type { PlayerProgression } from "./progression";

/**
 * Per-piece perks. Every regional set piece carries its own perk that works the moment the piece is
 * worn, whether or not you wear the rest of the set (set 2pc/4pc bonuses stack on top). Slot roles:
 * helmet = ability recharge, gauntlets = weapon damage, chest = protection, legs = movement, class item =
 * recovery/utility. A perk strengthens with the piece's level like the set bonuses do. Pure rules.
 */
export type ArmorPerk = { name: string; description: string; effects: Partial<ArmorEffects> };

const p = (name: string, description: string, effects: Partial<ArmorEffects>): ArmorPerk => ({ name, description, effects });

export const ARMOR_PERKS: Readonly<Record<string, Record<SetSlot, ArmorPerk>>> = {
  "verdant-warden": {
    helmet: p("Canopy Sight", "Abilities recharge 4% faster.", { abilityRecharge: 0.04 }),
    gauntlets: p("Thornwrap Grip", "Weapon damage +2%.", { weaponDamage: 0.02 }),
    chest: p("Barkplate", "Incoming damage reduced by 4%.", { resist: 0.04 }),
    legs: p("Rootstep", "Move 2% faster and regenerate a little hull.", { moveSpeed: 0.02, regen: 0.3 }),
    classItem: p("Living Sash", "Hull regenerates steadily.", { regen: 0.6 }),
  },
  "mire-stalker": {
    helmet: p("Fen Sight", "Abilities recharge 5% faster.", { abilityRecharge: 0.05 }),
    gauntlets: p("Silt Grip", "Weapon damage +2%.", { weaponDamage: 0.02 }),
    chest: p("Reed Weave", "Resist 2% and regenerate a little hull.", { resist: 0.02, regen: 0.3 }),
    legs: p("Bog Runner", "Move 4% faster.", { moveSpeed: 0.04 }),
    classItem: p("Mist Cloak", "Slides carry 8% further.", { slideBoost: 0.08 }),
  },
  "cinder-vanguard": {
    helmet: p("Ember Targeting", "Weapon damage +3%.", { weaponDamage: 0.03 }),
    gauntlets: p("Forgehand", "Weapon damage +5%.", { weaponDamage: 0.05 }),
    chest: p("Slag Plate", "Incoming damage reduced by 4%.", { resist: 0.04 }),
    legs: p("Ashtread", "Move 2% faster.", { moveSpeed: 0.02 }),
    classItem: p("Cinder Mark", "Abilities recharge 4% faster.", { abilityRecharge: 0.04 }),
  },
  "frostwrought-aegis": {
    helmet: p("Rime Focus", "Abilities recharge 3% faster.", { abilityRecharge: 0.03 }),
    gauntlets: p("Frostbite Grip", "Weapon damage +2%.", { weaponDamage: 0.02 }),
    chest: p("Glacier Carapace", "Incoming damage reduced by 6%.", { resist: 0.06 }),
    legs: p("Iceglide", "Slides carry 12% further.", { slideBoost: 0.12 }),
    classItem: p("Aegis Banner", "Resist 3% and regenerate hull.", { resist: 0.03, regen: 0.4 }),
  },
  "scrapborn-raider": {
    helmet: p("Scavenger Scope", "Abilities recharge 4% faster.", { abilityRecharge: 0.04 }),
    gauntlets: p("Salvage Grip", "Weapon damage +4%.", { weaponDamage: 0.04 }),
    chest: p("Patchwork Plate", "Incoming damage reduced by 3%.", { resist: 0.03 }),
    legs: p("Roadburner", "Move 4% faster.", { moveSpeed: 0.04 }),
    classItem: p("Dust Scarf", "Slides carry 10% further.", { slideBoost: 0.1 }),
  },
  "dune-seeker": {
    helmet: p("Mirage Lens", "Abilities recharge 6% faster.", { abilityRecharge: 0.06 }),
    gauntlets: p("Sunsplit Grip", "Weapon damage +3%.", { weaponDamage: 0.03 }),
    chest: p("Heatveil", "Incoming damage reduced by 2%.", { resist: 0.02 }),
    legs: p("Sandstride", "Move 5% faster.", { moveSpeed: 0.05 }),
    classItem: p("Seeker Mantle", "Slides 10% further, abilities 2% faster.", { slideBoost: 0.1, abilityRecharge: 0.02 }),
  },
};

export const perkFor = (setId: string | undefined, slot: string): ArmorPerk | null => (setId ? ARMOR_PERKS[setId]?.[slot as SetSlot] ?? null : null);

export const perkScale = (level: number) => 1 + BONUS_PER_LEVEL * (Math.min(ARMOR_LEVEL_MAX, Math.max(1, level)) - 1);

export function wornPerks(progress: Pick<PlayerProgression, "inventory" | "equippedGear">): { item: GearItem; perk: ArmorPerk }[] {
  const out: { item: GearItem; perk: ArmorPerk }[] = [];
  for (const slot of SET_SLOTS) {
    const item = progress.inventory.find((entry) => entry.id === progress.equippedGear[slot]);
    const perk = item && setById(item.setId ?? "") ? perkFor(item.setId, item.slot) : null;
    if (item && perk) out.push({ item, perk });
  }
  return out;
}

/** Sum of every worn piece's perk, scaled by that piece's level. */
export function perkEffects(progress: Pick<PlayerProgression, "inventory" | "equippedGear">): ArmorEffects {
  const total: ArmorEffects = { ...NO_EFFECTS };
  for (const { item, perk } of wornPerks(progress)) {
    const scale = perkScale(item.level);
    for (const key of Object.keys(perk.effects) as (keyof ArmorEffects)[]) total[key] += (perk.effects[key] ?? 0) * scale;
  }
  return total;
}
