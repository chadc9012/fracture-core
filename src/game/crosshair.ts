/**
 * Dynamic reticle (Destiny/Helldivers feel): a spread ring that opens with movement and firing, plus a
 * separate barrel index that lags behind where the camera looks, so the weapon has weight. Pure and
 * stepped each frame by Scene; the HUD only draws the resulting view. Pixels are screen pixels.
 */
export type Motion = "IDLE" | "WALK" | "SPRINT" | "AIR";
export type HitKind = "NONE" | "HIT" | "KILL";

export const MOTION_SPREAD: Record<Motion, number> = { IDLE: 0, WALK: 3, SPRINT: 9, AIR: 12 };
export const BLOOM_SPREAD = 18;
export const BASE_GAP = 5;
export const ADS_TIGHTEN = 3;
export const BARREL_LAG_PX = 26;
export const BARREL_MAX_PX = 44;
export const HIT_SECONDS = 0.12;
export const KILL_SECONDS = 0.32;

export type ReticleState = { spread: number; bx: number; by: number; hit: HitKind; hitLeft: number };
export const createReticle = (): ReticleState => ({ spread: 0, bx: 0, by: 0, hit: "NONE", hitLeft: 0 });

export type ReticleInput = {
  motion: Motion;
  /** weapon bloom 0..1 */
  bloom: number;
  aiming: boolean;
  /** look rotation in radians/sec: right is positive, up is positive */
  lookRight: number;
  lookUp: number;
};

export type ReticleView = { gap: number; barrelX: number; barrelY: number; hit: HitKind; hitLeft: number };
export const EMPTY_RETICLE: ReticleView = { gap: BASE_GAP, barrelX: 0, barrelY: 0, hit: "NONE", hitLeft: 0 };

const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));

/** Register a hit; a kill outranks a plain hit and is never downgraded while it is showing. */
export function markHit(state: ReticleState, kind: Exclude<HitKind, "NONE">) {
  if (state.hit === "KILL" && state.hitLeft > 0 && kind === "HIT") return;
  state.hit = kind;
  state.hitLeft = kind === "KILL" ? KILL_SECONDS : HIT_SECONDS;
}

export function stepReticle(state: ReticleState, input: ReticleInput, dt: number): ReticleView {
  const target = MOTION_SPREAD[input.motion] + Math.max(0, Math.min(1, input.bloom)) * BLOOM_SPREAD;
  state.spread += (target - state.spread) * (1 - Math.exp(-dt * 12));
  // the barrel trails the camera: turning right leaves it left of centre, looking up leaves it below
  const tx = clamp(-input.lookRight * BARREL_LAG_PX, BARREL_MAX_PX);
  const ty = clamp(input.lookUp * BARREL_LAG_PX, BARREL_MAX_PX);
  const k = 1 - Math.exp(-dt / 0.08);
  state.bx += (tx - state.bx) * k;
  state.by += (ty - state.by) * k;
  state.hitLeft = Math.max(0, state.hitLeft - dt);
  if (state.hitLeft <= 0) state.hit = "NONE";
  const gap = Math.max(2, BASE_GAP + state.spread - (input.aiming ? ADS_TIGHTEN : 0));
  return { gap, barrelX: state.bx, barrelY: state.by, hit: state.hit, hitLeft: state.hitLeft };
}
