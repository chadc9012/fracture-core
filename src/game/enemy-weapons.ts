/**
 * Enemy weapons and death poses (pure presentation data; combat never reads this).
 *
 * Who carries what: the human factions carry the same authored weapon models the Operators use (public/models/weapons,
 * by handling class), picked to suit the faction and rank; Aberrations are creatures and fight with their bodies.
 * The enemy GLBs ship as bare bodies whose shoot clip aims at nothing, so the gun is placed by EnemyModel each frame:
 * gripped at the palm, pointed where the body faces — level while aiming/firing, angled down at a low ready otherwise.
 * (The hand bone twists through the clips, so a fixed hand-bone offset pointed the barrel at the sky.)
 *
 * Death: bodies (GoreFx corpses) play one of six keyframed death animations (death-animations.ts).
 */
import type { HandlingClass } from "./weapon-handling";
import type { EnemyKind, EnemyRole } from "./enemy-visuals";

export const ENEMY_ARMS: Record<EnemyKind, Record<EnemyRole, HandlingClass | null>> = {
  // scavengers: close-range scatterguns, a rifle for the skirmisher, the warbringer hauls a launcher
  RAIDER: { standard: "shotgun", elite: "rifle", boss: "launcher" },
  // cyber troopers: pulse rifles, the augmented carry heavy cannons, the executor closes in with a blade
  OVERCLOCKED: { standard: "rifle", elite: "heavy", boss: "sword" },
  // enforcers: service rifles, the juggernaut and champion carry heavy cannons
  VANGUARD: { standard: "rifle", elite: "heavy", boss: "heavy" },
  // avian legion: legionaries carry rifles, the Axiom fights with an energy blade, the Harbinger commands with a staff (no gun)
  SKYBORN: { standard: "rifle", elite: "sword", boss: null },
  // ancient constructs: no hand weapons, they fire fracture energy from the core
  GUARDIAN: { standard: null, elite: null, boss: null },
  // creatures: no weapons
  ABERRATION: { standard: null, elite: null, boss: null },
};
export const enemyWeapon = (kind: EnemyKind, role: EnemyRole): HandlingClass | null => ENEMY_ARMS[kind]?.[role] ?? null;

/** barrel tip of each held model, in the held frame (barrel along +Z after the half turn the held models get) */
export const HELD_MUZZLE: Record<HandlingClass, [number, number, number] | null> = {
  rifle: [0, 0.07, 0.8], pistol: [0, 0.075, 0.22], shotgun: [0, 0.095, 0.75], heavy: [0, 0.08, 0.74], launcher: [0, 0.12, 0.65], sword: null,
};

/** how far down the barrel points at a low ready (rad); blades are carried point-down further */
export const LOW_READY: Record<HandlingClass, number> = { rifle: 0.6, pistol: 0.9, shotgun: 0.55, heavy: 0.45, launcher: 0.35, sword: 1.1 };
/** where the grip sits between the wrist (0) and the middle knuckle (1) */
export const PALM = 0.6;
/** how fast the gun comes up to aim and drops back (1/s) */
export const RAISE_RATE = 9;

/** the pitch of the held gun given how much the body is aiming (0 low ready .. 1 aimed) */
export const heldPitch = (cls: HandlingClass, aim: number) => (cls === "sword" ? LOW_READY.sword : LOW_READY[cls] * (1 - Math.min(1, Math.max(0, aim)))); // a blade is never levelled like a gun

/* ---------------- death ---------------- */
// Death animations live in death-animations.ts (six keyframed styles chosen from the killing hit).

/* ---------------- dropped weapons ---------------- */

/** where a dropped gun starts relative to the body (hand height, a little to the right) and how it is thrown */
export const DROP_HEIGHT = 1.15;
export const DROP_SIDE = 0.35;
