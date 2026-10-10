import { FOOT_SCALE } from "./foot-speed";
/**
 * Movement feel — the stride that makes moving read as walking or running instead of gliding on a
 * rail. One phase accumulator is shared by the camera (head bob, sway, strafe roll, landing dip), the
 * first-person weapon and the third-person Operator's limbs, so everything steps in sync. Pure: Scene
 * integrates it each frame from the real velocity.
 */
export type Stride = {
  /** stride phase in radians; one full cycle = a left step and a right step */
  phase: number;
  /** 0 standing .. 1 full run; smoothed so starting/stopping blends */
  intensity: number;
  /** extra vertical camera dip after a hard landing, decays to 0 */
  landDip: number;
  wasGrounded: boolean;
};

export const createStride = (): Stride => ({ phase: 0, intensity: 0, landDip: 0, wasGrounded: true });

/** Speeds are world units/s as produced by Scene's walk speed (walk ~27, sprint ~57). */
export const WALK_SPEED = 27 * FOOT_SCALE;
export const RUN_SPEED = 57 * FOOT_SCALE;

export type StrideInput = { speed: number; grounded: boolean; sliding: boolean; vy: number; dt: number };

export type FeelView = {
  phase: number;
  intensity: number;
  /** camera offsets in world units / radians */
  bobY: number;
  swayX: number;
  roll: number;
  /** limb swing amplitude in radians for the Operator (legs); arms use about 0.7 of it */
  swing: number;
  /** forward torso lean in radians */
  lean: number;
};

/** Steps per second grows with speed: ~1.7 Hz walking, ~2.9 Hz sprinting. */
export function strideHz(speed: number): number {
  const t = Math.min(1, Math.max(0, (speed - 12 * FOOT_SCALE) / (RUN_SPEED - 12 * FOOT_SCALE)));
  return 1.7 + t * 1.2;
}

export function stepStride(stride: Stride, input: StrideInput, strafe: number): FeelView {
  const { speed, grounded, sliding, vy, dt } = input;
  const moving = grounded && !sliding && speed > 3 * FOOT_SCALE;
  const target = moving ? Math.min(1, speed / RUN_SPEED) : 0;
  stride.intensity += (target - stride.intensity) * (1 - Math.exp(-(target > stride.intensity ? 9 : 6) * dt));
  if (moving) stride.phase += strideHz(speed) * Math.PI * 2 * dt;
  if (grounded && !stride.wasGrounded) stride.landDip = Math.min(0.28, Math.abs(vy) * 0.028);
  stride.wasGrounded = grounded;
  stride.landDip *= Math.exp(-9 * dt);

  const i = stride.intensity;
  // two bobs per cycle (one per footfall); sway is once per cycle (weight shifting foot to foot)
  const bobY = Math.sin(stride.phase * 2) * (0.03 + 0.05 * i) * i - stride.landDip - (sliding ? 0.1 : 0);
  const swayX = Math.sin(stride.phase) * 0.035 * i;
  const roll = Math.max(-1, Math.min(1, strafe)) * -0.04 * Math.min(1, i + 0.2) + Math.sin(stride.phase) * 0.006 * i + (sliding ? -0.05 : 0);
  return { phase: stride.phase, intensity: i, bobY, swayX, roll, swing: 0.35 + 0.55 * i, lean: 0.04 + 0.16 * i + (sliding ? 0.35 : 0) };
}
