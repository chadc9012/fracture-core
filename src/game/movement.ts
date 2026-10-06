import type { ClassId } from "./loadout";

/**
 * Class movement kit (Destiny feel on top of the existing sprint + vault jump): each class gets its own
 * air mobility, and every Operator can slide out of a sprint. Pure state + rules: Scene feeds input and
 * applies the numbers. Speeds are in the same world units/s as the walk speed in Scene.
 *   Titan   — one weighty lift (air jump)
 *   Hunter  — two quick air jumps
 *   Warlock — one air jump, then hold jump to glide
 */
export type AirProfile = { airJumps: number; /** multiplies the ground-jump vertical speed */ jumpMult: number; glide: boolean };

export const AIR_PROFILE: Record<ClassId, AirProfile> = {
  TITAN: { airJumps: 1, jumpMult: 0.8, glide: false },
  HUNTER: { airJumps: 2, jumpMult: 0.9, glide: false },
  WARLOCK: { airJumps: 1, jumpMult: 0.7, glide: true },
};

export const GLIDE_MAX_FALL = 2.2;
export const GLIDE_THRUST = 14;
export const SLIDE_SECONDS = 0.85;
export const SLIDE_COOLDOWN = 0.6;
/** minimum horizontal speed (units/s) needed to start a slide */
export const SLIDE_MIN_SPEED = 26;
export const SLIDE_START_MULT = 1.3;
export const SLIDE_END_MULT = 0.5;

export type MoveState = {
  airJumpsLeft: number;
  slideLeft: number;
  slideCool: number;
  slideDirX: number;
  slideDirZ: number;
  slideSpeed: number;
  /** eased 0..1: how far the camera has dropped for a slide */
  drop: number;
};

export const createMoveState = (): MoveState => ({ airJumpsLeft: 0, slideLeft: 0, slideCool: 0, slideDirX: 0, slideDirZ: 0, slideSpeed: 0, drop: 0 });

/** Touching the ground refills air jumps. */
export function land(state: MoveState, classId: ClassId) { state.airJumpsLeft = AIR_PROFILE[classId].airJumps; }

/** Spend an air jump while airborne; returns the vertical-speed multiplier, or null when none are left. */
export function airJump(state: MoveState, classId: ClassId): number | null {
  if (state.airJumpsLeft <= 0) return null;
  state.airJumpsLeft--;
  return AIR_PROFILE[classId].jumpMult;
}

/** Warlock glide: while holding jump and falling, fall speed is capped. Returns the new vertical speed. */
export function glideVy(vy: number, classId: ClassId, holding: boolean): number {
  return AIR_PROFILE[classId].glide && holding && vy < -GLIDE_MAX_FALL ? -GLIDE_MAX_FALL : vy;
}

export function startSlide(state: MoveState, vx: number, vz: number): boolean {
  const speed = Math.hypot(vx, vz);
  if (state.slideLeft > 0 || state.slideCool > 0 || speed < SLIDE_MIN_SPEED) return false;
  state.slideLeft = SLIDE_SECONDS;
  state.slideDirX = vx / speed;
  state.slideDirZ = vz / speed;
  state.slideSpeed = speed;
  return true;
}

export function cancelSlide(state: MoveState) {
  if (state.slideLeft > 0) state.slideCool = SLIDE_COOLDOWN;
  state.slideLeft = 0;
}

/** Advance the slide timers; returns the current slide speed (0 when not sliding). */
export function stepSlide(state: MoveState, dt: number): number {
  state.slideCool = Math.max(0, state.slideCool - dt);
  const was = state.slideLeft > 0;
  state.slideLeft = Math.max(0, state.slideLeft - dt);
  if (was && state.slideLeft <= 0) state.slideCool = SLIDE_COOLDOWN;
  state.drop += ((state.slideLeft > 0 ? 1 : 0) - state.drop) * (1 - Math.exp(-14 * dt));
  if (state.slideLeft <= 0) return 0;
  const t = 1 - state.slideLeft / SLIDE_SECONDS; // 0 at start .. 1 at end
  return state.slideSpeed * (SLIDE_START_MULT + (SLIDE_END_MULT - SLIDE_START_MULT) * t * t);
}

/** Camera FOV for the current movement: wider when sprinting, widest in a slide, tight when aiming. */
export function movementFov(aiming: boolean, sprinting: boolean, sliding: boolean): number {
  if (aiming) return 48;
  return sliding ? 90 : sprinting ? 84 : 78;
}
