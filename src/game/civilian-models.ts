/** Which authored body each civilian role wears, and which clip plays for its AI state. Pure data/rules; Civilians.tsx draws.
 * Bodies are Meshy models generated from the owner's NPC sheet (public/refs/npcs), rigged with idle / walk / wave clips. */
import type { CivilianRole } from "./civilians";

/** Two bodies so far (the apron-wearing merchant and the goggled mechanic from the sheet); the hooded tech specialist
 * was generated as a draft but not textured yet (Meshy credits ran out), so its roles share the mechanic. */
export type CivilianBody = "general-store" | "vehicle-dealer";
export const CIVILIAN_BODY: Record<CivilianRole, CivilianBody> = {
  VENDOR: "general-store", ARTISAN: "general-store", ENGINEER: "general-store",
  MEDIC: "vehicle-dealer", SCAVENGER: "vehicle-dealer", OBSERVER: "vehicle-dealer",
};
export const civilianModelUrl = (role: CivilianRole) => `/models/npcs/${CIVILIAN_BODY[role]}.glb`;
export const CIVILIAN_HEIGHT = 1.8;

export type CivilianClip = "idle" | "walk" | "wave";
/** WANDER and FLEE walk (FLEE plays it faster), GREET waves at the player, everything else (IDLE, COWER) idles. */
export function civilianClip(state: string): CivilianClip {
  return state === "WANDER" || state === "FLEE" ? "walk" : state === "GREET" ? "wave" : "idle";
}
