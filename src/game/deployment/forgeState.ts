/** Pure state helpers for the character-creation forge: restoring a saved character, detecting
 * unsaved edits, and summarising worn armor with the authoritative stat calculation. */
import { DEFAULT_SUBCLASS, SUBCLASSES, appearanceById, operatorByClass, type AppearanceDefinition, type ClassId, type SubclassId } from "../loadout";
import { DEFAULT_BODY_TYPE, bodyTypeOr, type BodyType } from "../operators";
import { loadoutAttributes, type Attributes } from "../armor-attributes";
import { SET_SLOTS, type SetSlot } from "../armor-sets";
import type { PlayerProgression } from "../progression";
import type { PlayerCharacter } from "./deployCharacter";

export type ForgeState = { classId: ClassId; subclassId: SubclassId; appearance: AppearanceDefinition; bodyType: BodyType };

/** The Operator's signature look with their callsign pre-filled. */
export function defaultAppearance(classId: ClassId): AppearanceDefinition {
  const op = operatorByClass(classId);
  return { ...appearanceById(op.appearanceId), callsign: op.callsign };
}

const isClass = (v: unknown): v is ClassId => v === "TITAN" || v === "HUNTER" || v === "WARLOCK";
const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);

/** Restores the saved character (class, subclass, body, colors, callsign). Missing, partial or
 * corrupt data falls back per field to the default for the class; never throws. */
export function forgeInitial(saved: Partial<PlayerCharacter> | null | undefined): ForgeState {
  const classId: ClassId = isClass(saved?.classId) ? saved!.classId! : "TITAN";
  const base = defaultAppearance(classId);
  const sub = SUBCLASSES.find((s) => s.id === saved?.subclassId && s.classId === classId)?.id ?? DEFAULT_SUBCLASS[classId];
  const a = saved?.appearance;
  const callsign = typeof a?.callsign === "string" && a.callsign.trim() ? a.callsign.trim().slice(0, 16) : base.callsign;
  return {
    classId, subclassId: sub,
    bodyType: saved?.bodyType === undefined ? DEFAULT_BODY_TYPE : bodyTypeOr(saved.bodyType),
    appearance: { ...base, armor: hex(a?.armor, base.armor), cloth: hex(a?.cloth, base.cloth), visor: hex(a?.visor, base.visor), trim: hex(a?.trim, base.trim), callsign },
  };
}

/** True when the forge differs from the starting state, i.e. leaving would discard edits. */
export function forgeDirty(a: ForgeState, b: ForgeState): boolean {
  return a.classId !== b.classId || a.subclassId !== b.subclassId || a.bodyType !== b.bodyType
    || a.appearance.armor !== b.appearance.armor || a.appearance.cloth !== b.appearance.cloth
    || a.appearance.visor !== b.appearance.visor || a.appearance.trim !== b.appearance.trim || a.appearance.callsign !== b.appearance.callsign;
}

export const SLOT_LABEL: Record<SetSlot, string> = { helmet: "Helmet", chest: "Chest", gauntlets: "Arms", legs: "Legs", classItem: "Accessory" };

export type ArmorSummary = { slots: { slot: SetSlot; label: string; name: string | null; setId: string | null; power: number }[]; stats: Attributes; worn: number };

/** Worn pieces per slot plus the effective Defense/Mobility/Intellect, all from loadoutAttributes (the single stat path). */
export function armorSummary(progress: Pick<PlayerProgression, "inventory" | "equippedGear">): ArmorSummary {
  const slots = SET_SLOTS.map((slot) => {
    const item = progress.inventory.find((i) => i.id === progress.equippedGear[slot] && i.slot === slot);
    return { slot, label: SLOT_LABEL[slot], name: item?.name ?? null, setId: item?.setId ?? null, power: item?.power ?? 0 };
  });
  const attrs = loadoutAttributes(progress);
  return { slots, stats: attrs.effective, worn: attrs.worn };
}
