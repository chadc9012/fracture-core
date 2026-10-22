import type { ClassId } from "../loadout";
import type { PlayerCharacter } from "./deployCharacter";
import { forgeInitial } from "./forgeState";

/** A menu preference, never a confirmed character or a progression save. */
export const OPERATOR_SELECTION_KEY = "world-fracture.operator-selection.v1";
type SelectionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function selectionKey(testProfile: boolean) {
  return `${OPERATOR_SELECTION_KEY}${testProfile ? ".test-profile" : ""}`;
}
export function rememberedOperator(storage: SelectionStorage, key: string): ClassId | null {
  try {
    const value = storage.getItem(key);
    return value === "TITAN" || value === "HUNTER" || value === "WARLOCK" ? value : null;
  } catch { return null; }
}
export function rememberOperator(storage: SelectionStorage, key: string, classId: ClassId | null) {
  try {
    if (classId === null) storage.removeItem(key);
    else storage.setItem(key, classId);
  } catch { /* Storage restrictions must not block selection or deployment. */ }
}
export function initialOperatorSelection(saved: PlayerCharacter | null | undefined, remembered: ClassId | null) {
  return forgeInitial(saved ?? (remembered ? { classId: remembered } : null));
}