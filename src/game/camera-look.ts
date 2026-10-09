/* Look input that doesn't need a mouse: arrow keys and the gamepad right stick turn the camera.
 * Pure — Scene feeds it held keys, stick axes and dt, and applies the result to yaw/pitch.
 * Mouse look (pointer lock) is unchanged and adds on top. */
export const KEY_YAW_RATE = 1.9; // rad/s
export const KEY_PITCH_RATE = 1.3;
export const PAD_YAW_RATE = 2.8;
export const PAD_PITCH_RATE = 1.9;
export const STICK_DEADZONE = 0.16;
export const PITCH_LIMIT = 1.2;

/** deadzone then a squared response: fine control near centre, full speed at the edge */
export function stickCurve(v: number): number {
  const a = Math.abs(v);
  if (a <= STICK_DEADZONE) return 0;
  const n = (a - STICK_DEADZONE) / (1 - STICK_DEADZONE);
  return Math.sign(v) * Math.min(1, n * n);
}

export type LookInput = { left: boolean; right: boolean; up: boolean; down: boolean; stickX: number; stickY: number };

/** change in yaw/pitch for this frame (positive yaw turns left, positive pitch looks up — matching mouse look) */
export function lookDelta(i: LookInput, dt: number): { dyaw: number; dpitch: number } {
  const keyX = (i.left ? 1 : 0) - (i.right ? 1 : 0);
  const keyY = (i.up ? 1 : 0) - (i.down ? 1 : 0);
  const dyaw = keyX * KEY_YAW_RATE * dt - stickCurve(i.stickX) * PAD_YAW_RATE * dt;
  const dpitch = keyY * KEY_PITCH_RATE * dt - stickCurve(i.stickY) * PAD_PITCH_RATE * dt; // stick up is negative
  return { dyaw, dpitch };
}

export const clampPitch = (p: number) => Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p));
