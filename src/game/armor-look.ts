import { SET_SLOTS, setById, type SetSlot } from "./armor-sets";
import type { BodyType } from "./operators";
import type { PlayerProgression } from "./progression";

/**
 * How worn armor looks and fits. Each regional set has a visual identity (a signature motif per slot, in
 * the set's color) and every slot fits each body type (female / male / robot) with its own proportions, so
 * the same piece reads right on all three Operators instead of being a scaled copy. Pure data; Operator.tsx
 * renders it.
 */
export type Motif =
  | "crest" | "horns" | "slit"          // helmet
  | "spine" | "plates" | "core"          // chest
  | "spikes" | "bands"                   // gauntlets
  | "greaves" | "fins"                   // legs
  | "sash" | "banner" | "mantle";        // class item

export type SlotLook = { motif: Motif; color: string };
export type ArmorLook = Partial<Record<SetSlot, SlotLook>>;

/** Per-set signature motifs (colors come from the set itself). */
export const SET_MOTIFS: Readonly<Record<string, Record<SetSlot, Motif>>> = {
  "verdant-warden": { helmet: "horns", gauntlets: "bands", chest: "spine", legs: "greaves", classItem: "mantle" },
  "mire-stalker": { helmet: "slit", gauntlets: "bands", chest: "plates", legs: "fins", classItem: "sash" },
  "cinder-vanguard": { helmet: "crest", gauntlets: "spikes", chest: "core", legs: "greaves", classItem: "banner" },
  "frostwrought-aegis": { helmet: "crest", gauntlets: "spikes", chest: "plates", legs: "greaves", classItem: "banner" },
  "scrapborn-raider": { helmet: "slit", gauntlets: "bands", chest: "spine", legs: "fins", classItem: "sash" },
  "dune-seeker": { helmet: "horns", gauntlets: "bands", chest: "core", legs: "fins", classItem: "mantle" },
};

/** Scenario-exclusive pieces without a set borrow an existing motif in their own colour (no dedicated 3D model exists for them). */
export const SPECIAL_LOOKS: Readonly<Record<string, SlotLook>> = {
  "mantle-null-sovereign": { motif: "mantle", color: "#19e6ff" },
};

export function armorLook(progress: Pick<PlayerProgression, "inventory" | "equippedGear">): ArmorLook {
  const look: ArmorLook = {};
  for (const slot of SET_SLOTS) {
    const item = progress.inventory.find((entry) => entry.id === progress.equippedGear[slot]);
    const set = item?.setId ? setById(item.setId) : undefined;
    const motif = set ? SET_MOTIFS[set.id]?.[slot] : undefined;
    if (set && motif) look[slot] = { motif, color: set.color };
    else if (item && SPECIAL_LOOKS[item.id] && item.slot === slot) look[slot] = SPECIAL_LOOKS[item.id]!;
  }
  return look;
}

/** Width / height / depth multipliers on a slot's base plate for each body. */
export type Fit = { w: number; h: number; d: number };
export const BODY_FIT: Readonly<Record<BodyType, Record<SetSlot, Fit>>> = {
  male: {
    helmet: { w: 1, h: 1, d: 1 }, chest: { w: 1.06, h: 1, d: 1.04 }, gauntlets: { w: 1.05, h: 1, d: 1.05 }, legs: { w: 1.04, h: 1, d: 1.03 }, classItem: { w: 1, h: 1, d: 1 },
  },
  female: {
    helmet: { w: 0.94, h: 0.98, d: 0.95 }, chest: { w: 0.88, h: 0.96, d: 0.92 }, gauntlets: { w: 0.9, h: 0.98, d: 0.9 }, legs: { w: 0.9, h: 1.04, d: 0.9 }, classItem: { w: 0.95, h: 1, d: 0.95 },
  },
  robot: {
    helmet: { w: 1.02, h: 1.02, d: 1.05 }, chest: { w: 1.0, h: 1.04, d: 1.14 }, gauntlets: { w: 1.1, h: 1.02, d: 1.12 }, legs: { w: 1.06, h: 1, d: 1.1 }, classItem: { w: 1, h: 1, d: 1.05 },
  },
};

export const fitFor = (bodyType: BodyType, slot: SetSlot): Fit => BODY_FIT[bodyType]?.[slot] ?? BODY_FIT.male[slot];
