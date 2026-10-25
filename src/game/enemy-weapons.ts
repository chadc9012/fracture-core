/**
 * Enemy weapons and death poses (pure presentation data; combat never reads this).
 *
 * Who carries what: the human factions carry the same authored weapon models the Operators use (public/models/weapons,
 * by handling class), picked to suit the faction and rank; Aberrations are creatures and fight with their bodies.
 * The enemy GLBs ship as bare bodies whose shoot clip aims at nothing, so the gun is placed by EnemyModel each frame:
 * gripped at the palm, pointed where the body faces — level while aiming/firing, angled down at a low ready otherwise.
 * (The hand bone twists through the clips, so a fixed hand-bone offset pointed the barrel at the sky.)
 *
 * Death: bodies (GoreFx corpses) blend from their standing pose into a collapse — knees buckle forward, the spine curls,
 * the head drops, the arms go limp — while the body topples; each body gets its own variation from a seed.
 * Checked by eye on the authored raider rig in a three.js render (front/side) before shipping.
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

/** bone-local additive rotations (radians, Euler XYZ) of the full collapse, Mixamo bone names without the prefix */
export const DEATH_POSE: Record<string, [number, number, number]> = {
  Spine: [0.35, 0, 0], Spine1: [0.3, 0, 0], Spine2: [0.2, 0, 0], Neck: [0.35, 0, 0], Head: [0.3, 0.2, 0],
  LeftUpLeg: [0.5, 0, 0], RightUpLeg: [0.3, 0, 0], LeftLeg: [1.0, 0, 0], RightLeg: [0.7, 0, 0],
  LeftArm: [-0.2, 0, -0.35], RightArm: [-0.2, 0, 0.35], LeftForeArm: [0, 0, -0.4], RightForeArm: [0, 0, 0.4],
};
/** the collapse finishes slightly before the topple lands (corpsePose FALL_TIME 0.55 s) */
export const COLLAPSE_TIME = 0.45;
/** how far the hips drop as the knees buckle (body heights) — the standing rig keeps its hips where they were */
export const COLLAPSE_DROP = 0.17;

/** this body's own collapse: the pose scaled per limb by a seeded wobble (0.7..1.25) and the head turned left or right */
export function deathPoseFor(seed: number): Record<string, [number, number, number]> {
  let s = (Math.floor(seed * 2654435761) >>> 0) || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const out: Record<string, [number, number, number]> = {};
  const headSide = rnd() < 0.5 ? -1 : 1;
  for (const [bone, e] of Object.entries(DEATH_POSE)) {
    const k = 0.7 + rnd() * 0.55;
    out[bone] = bone === "Head" ? [e[0] * k, e[1] * headSide * (0.5 + rnd()), e[2]] : [e[0] * k, e[1] * k, e[2] * k];
  }
  return out;
}
/** 0..1 through the collapse: quick at first (the legs go), easing into the ground */
export function collapseBlend(age: number): number {
  const t = Math.min(1, Math.max(0, age / COLLAPSE_TIME));
  return 1 - (1 - t) * (1 - t);
}

/* ---------------- dropped weapons ---------------- */

/** where a dropped gun starts relative to the body (hand height, a little to the right) and how it is thrown */
export const DROP_HEIGHT = 1.15;
export const DROP_SIDE = 0.35;
