/** Swimming motion for the Abyssal sea creatures (owner, Oct 25: "make swimming movements").
 *
 * The Abyssal bodies are solid (unrigged) Meshy meshes fitted by scripts/fit-creature-meshy.py so the body runs along
 * model +Z with the head at the front (+Z) and the tail at the back. They swim with a travelling wave, the way fish
 * and eels do: every point is pushed sideways (x) by a sine wave that runs from head to tail, its amplitude growing
 * toward the tail (the head stays nearly still so the creature keeps looking where it goes). The wave beats faster and
 * wider when the creature is moving fast and settles to a slow hover-wave when it holds position.
 *
 * Pure: the same formula runs on the GPU (SWIM_GLSL, patched into the creature's materials by EnemyModel.tsx) and here
 * for tests. */

/** how many wavelengths fit along the body (≈1 for an eel-like swimmer) */
export const SWIM_WAVES = 1.15;
/** sideways sway at the tail tip, as a fraction of body length, at full cruising speed */
export const SWIM_AMP = 0.085;
/** wave rate (rad/s) at rest and at full speed */
export const SWIM_RATE = { rest: 3.2, cruise: 8.5 } as const;
/** ground speed (m/s) treated as full cruise */
export const SWIM_CRUISE_SPEED = 6;

/** 0 at rest .. 1 at cruising speed */
export const swimEffort = (speed: number) => Math.min(1, Math.max(0, speed / SWIM_CRUISE_SPEED));

/** wave rate (rad/s) for a ground speed */
export const swimRate = (speed: number) => SWIM_RATE.rest + (SWIM_RATE.cruise - SWIM_RATE.rest) * swimEffort(speed);

/** tail sway amplitude (fraction of length) for a ground speed: a hovering creature still sways, a third as much */
export const swimAmp = (speed: number) => SWIM_AMP * (0.35 + 0.65 * swimEffort(speed));

/** Sideways offset (model units) of a point at `u` along the body (0 head .. 1 tail) for a body `len` long, wave `phase`
 * (rad) and amplitude `amp` (fraction of length). Quadratic envelope: the head barely moves, the tail does the work. */
export function swimOffset(u: number, len: number, phase: number, amp: number): number {
  const t = Math.min(1, Math.max(0, u));
  return amp * len * t * t * Math.sin(2 * Math.PI * SWIM_WAVES * t - phase);
}

/** the same bend for the vertex shader: model-space `position` with the head at uSwimHead (z) and length uSwimLen */
export const SWIM_GLSL = /* glsl */ `
  float swimU = clamp((uSwimHead - position.z) / uSwimLen, 0.0, 1.0);
  transformed.x += uSwimAmp * uSwimLen * swimU * swimU * sin(6.28318530718 * ${SWIM_WAVES.toFixed(4)} * swimU - uSwimPhase);
`;
