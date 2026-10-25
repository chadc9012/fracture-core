/** Which body an Operator wears, from the armor they have equipped (owner, Stage 47: "each Operator starts in their own
 * Common-tier rookie set; their existing higher-tier armor remains progression equipment").
 *
 *  - ROOKIE  : Common gear (the rookie bodies made from docs/reference/rookie-*.jpg)
 *  - VETERAN : Rare-level gear (mid-tier bodies, when authored)
 *  - ELITE   : Legendary-level gear (the original concept-art heroes: Goliath Destroyer, Nyx Rift, Cipher Tech)
 *
 * The tier is the average power of the armor actually worn across the five set slots, so swapping one piece never flips the
 * whole body and an empty slot pulls the average down. A tier with no authored body for that class falls back to the next
 * one down, so adding a body later is a one-line change here. Pure; OperatorModel.tsx picks the url.
 */
import type { ClassId } from "./loadout";
import type { GearItem, GearSlot } from "./inventory";
import { SET_SLOTS } from "./armor-sets";

export type BodyTier = "ROOKIE" | "VETERAN" | "ELITE";
export const BODY_TIERS: readonly BodyTier[] = ["ROOKIE", "VETERAN", "ELITE"];
/** average worn armor power where each tier starts (armor tiers sell at 90 / 150 / 240 / 340 power, +15 a level) */
export const TIER_POWER: Record<BodyTier, number> = { ROOKIE: 0, VETERAN: 150, ELITE: 240 };
export const TIER_LABEL: Record<BodyTier, string> = { ROOKIE: "Rookie", VETERAN: "Veteran", ELITE: "Elite" };

export type TierBody = { url: string; /** the body's own colours are its look: the rookie colourway does not apply */ colorway: boolean };
/** authored bodies per class and tier; a missing entry falls back down a tier */
export const TIER_BODIES: Record<ClassId, Partial<Record<BodyTier, TierBody>>> = {
  TITAN: {
    ROOKIE: { url: "/models/operators/goliath-authored.glb", colorway: true },
    VETERAN: { url: "/models/operators/goliath-veteran-authored.glb", colorway: false },
    ELITE: { url: "/models/operators/goliath-legacy-authored.glb", colorway: false },
  },
  HUNTER: {
    ROOKIE: { url: "/models/operators/nyx-authored.glb", colorway: true },
    VETERAN: { url: "/models/operators/nyx-veteran-authored.glb", colorway: false },
    ELITE: { url: "/models/operators/nyx-rift-authored.glb", colorway: false },
  },
  WARLOCK: {
    ROOKIE: { url: "/models/operators/cipher-authored.glb", colorway: true },
    VETERAN: { url: "/models/operators/cipher-veteran-authored.glb", colorway: false },
    ELITE: { url: "/models/operators/cipher-elite-authored.glb", colorway: false },
  },
};

export type WornArmor = { inventory: readonly Pick<GearItem, "id" | "slot" | "power">[]; equippedGear: Partial<Record<GearSlot, string>> };

/** mean power over the five set slots (an empty slot counts as 0) */
export function wornArmorPower(gear: WornArmor | undefined): number {
  if (!gear) return 0;
  let sum = 0;
  for (const slot of SET_SLOTS) {
    const item = gear.inventory.find((i) => i.id === gear.equippedGear[slot] && i.slot === slot);
    sum += item?.power ?? 0;
  }
  return sum / SET_SLOTS.length;
}

/** the tier the worn armor earns (before checking which bodies exist) */
export function bodyTierFor(gear: WornArmor | undefined): BodyTier {
  const p = wornArmorPower(gear);
  return p >= TIER_POWER.ELITE ? "ELITE" : p >= TIER_POWER.VETERAN ? "VETERAN" : "ROOKIE";
}

/** the body to draw: the earned tier's, else the nearest authored tier below it */
export function tierBodyFor(classId: ClassId, gear: WornArmor | undefined): { tier: BodyTier; body: TierBody } {
  const bodies = TIER_BODIES[classId];
  for (let i = BODY_TIERS.indexOf(bodyTierFor(gear)); i >= 0; i--) {
    const tier = BODY_TIERS[i]!, body = bodies[tier];
    if (body) return { tier, body };
  }
  return { tier: "ROOKIE", body: bodies.ROOKIE! };
}
