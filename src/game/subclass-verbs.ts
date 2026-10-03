/** Gives each of the 9 subclass special abilities (loadout.ts's SubclassDefinition.specialAbility)
 * a real, mechanical status-effect verb — Destiny-style (Weaken/Volatile/Suppress/Marked, etc.) —
 * instead of leaving them as flavor text. Each subclass flavors ONE of its class's three existing
 * ability-network slots (see live-build.ts's classBuild) rather than inventing a disconnected new
 * ability, so the Ability Network / loadout system stays the single source of truth for what Q/E/R
 * actually do; the subclass just attaches a verb to whichever slot its signature move maps onto. */
import type { AbilitySlot, SubclassId } from "./loadout";

export type StatusVerb =
  | "WEAKEN"      // target takes bonus damage for a time
  | "MARKED"      // target takes bonus damage for a time (recon-flavored twin of WEAKEN)
  | "VOLATILE"    // damage-over-time zone
  | "SUPPRESS"    // extends enemy fire-cooldown, same mechanism as the CRYO/ARC elements already use
  | "RAGE"        // self: damage dealt multiplier
  | "OVERSHIELD"  // self: damage taken reduction
  | "HASTE";      // self: ability energy/cooldowns run faster

export type VerbTarget = "enemy" | "self";

export type SubclassVerbDef = {
  /** which of the class's 3 existing ability-network slots (PRIMARY/TACTICAL/ULTIMATE) this
   * subclass's special ability flavors with its verb. */
  slot: AbilitySlot;
  verb: StatusVerb;
  target: VerbTarget;
  /** verb-specific scalar: a damage multiplier for WEAKEN/MARKED/RAGE, a reduction fraction (0..1)
   * for OVERSHIELD, a rate multiplier for HASTE, seconds of added fire-cooldown for SUPPRESS, or
   * damage-per-second for VOLATILE. */
  magnitude: number;
  duration: number;
  /** world-unit radius around the player the verb applies in; 0 for self-only verbs. */
  radius: number;
};

export const SUBCLASS_VERBS: Record<SubclassId, SubclassVerbDef> = {
  SHIELD_TITAN: { slot: "ULTIMATE", verb: "WEAKEN", target: "enemy", magnitude: 1.35, duration: 6, radius: 10 },
  BERSERKER_TITAN: { slot: "TACTICAL", verb: "RAGE", target: "self", magnitude: 1.4, duration: 5, radius: 0 },
  BULWARK_TITAN: { slot: "PRIMARY", verb: "OVERSHIELD", target: "self", magnitude: 0.5, duration: 6, radius: 0 },
  SHADOW_HUNTER: { slot: "PRIMARY", verb: "WEAKEN", target: "enemy", magnitude: 1.5, duration: 3, radius: 6 },
  TRACKER_HUNTER: { slot: "TACTICAL", verb: "MARKED", target: "enemy", magnitude: 1.3, duration: 8, radius: 24 },
  FRACTURE_RUNNER: { slot: "ULTIMATE", verb: "HASTE", target: "self", magnitude: 2, duration: 4, radius: 0 },
  CODE_WARLOCK: { slot: "PRIMARY", verb: "SUPPRESS", target: "enemy", magnitude: 3, duration: 4, radius: 12 },
  VOID_WARLOCK: { slot: "TACTICAL", verb: "VOLATILE", target: "enemy", magnitude: 4, duration: 8, radius: 7 },
  ORACLE_WARLOCK: { slot: "ULTIMATE", verb: "WEAKEN", target: "enemy", magnitude: 1.3, duration: 10, radius: 14 },
};

/** Returns the verb this subclass attaches to the given slot, or null if that slot isn't the one
 * this subclass flavors (the other two slots stay plain, undecorated class abilities). */
export function verbForActivation(subclassId: SubclassId, slot: AbilitySlot): SubclassVerbDef | null {
  const def = SUBCLASS_VERBS[subclassId];
  return def && def.slot === slot ? def : null;
}

export const VERB_LABEL: Record<StatusVerb, string> = {
  WEAKEN: "Weaken", MARKED: "Marked", VOLATILE: "Volatile", SUPPRESS: "Suppressed", RAGE: "Rage", OVERSHIELD: "Overshield", HASTE: "Haste",
};
