/**
 * Neon City vehicle-combat + chase AI helpers. sim.ts already does real ramming/damage
 * (see `collidePlayer`'s convoy + war-machine sections) — these are the pieces that
 * pseudocode spec added on top: lead-prediction pursuit, a named damage-stage ladder for
 * HUD/feedback, and forced vehicle->foot transition. Pure functions, no owned state.
 */
import type { HeatLevel } from "./heat";

/** CHASE -> RAM -> CUT OFF -> SURROUND -> ESCALATE, gated by heat level. */
export type ChaseBehavior = "PURSUIT" | "RAM" | "CUT_OFF" | "SURROUND" | "ESCALATE";

export function chaseBehaviorFor(heat: HeatLevel, distanceToTarget: number): ChaseBehavior {
  if (heat >= 5) return "ESCALATE";
  if (heat >= 4) return "SURROUND";
  if (distanceToTarget < 8) return "RAM";
  if (heat >= 3) return "CUT_OFF";
  return "PURSUIT";
}

/** Lead prediction: aim/steer toward where the target will be, not where it is. */
export function predictIntercept(target: { x: number; z: number }, targetVelocity: { x: number; z: number }, leadSeconds: number): { x: number; z: number } {
  return { x: target.x + targetVelocity.x * leadSeconds, z: target.z + targetVelocity.z * leadSeconds };
}

/** Side-swipe / head-on ramming force, same shape as sim.ts's existing ram math, exposed for chase-vehicle AI to reuse. */
export function ramImpulse(attackerVelocity: { x: number; z: number }, attackerSpeed: number, strength = 0.5): { x: number; z: number } {
  return { x: attackerVelocity.x * strength * Math.sign(attackerSpeed || 1), z: attackerVelocity.z * strength * Math.sign(attackerSpeed || 1) };
}

export type VehicleDamageStage = "NOMINAL" | "LIGHT" | "MEDIUM" | "HEAVY" | "CRITICAL";

/** Structural / mobility / control readout from a 0-100 health percentage, for HUD + forced-exit logic. */
export function vehicleDamageStage(healthPct: number): VehicleDamageStage {
  if (healthPct <= 15) return "CRITICAL";
  if (healthPct <= 35) return "HEAVY";
  if (healthPct <= 60) return "MEDIUM";
  if (healthPct <= 85) return "LIGHT";
  return "NOMINAL";
}

export const VEHICLE_DAMAGE_EFFECT: Record<VehicleDamageStage, { speedMult: number; handlingMult: number; weaponsDisabled: boolean }> = {
  NOMINAL: { speedMult: 1, handlingMult: 1, weaponsDisabled: false },
  LIGHT: { speedMult: 0.95, handlingMult: 0.95, weaponsDisabled: false },
  MEDIUM: { speedMult: 0.8, handlingMult: 0.85, weaponsDisabled: false },
  HEAVY: { speedMult: 0.55, handlingMult: 0.6, weaponsDisabled: true },
  CRITICAL: { speedMult: 0.3, handlingMult: 0.35, weaponsDisabled: true },
};

/** "Forced Transition Event": vehicle heavily damaged or blocked forces a vehicle->foot decision point. */
export function shouldForceFootTransition(stage: VehicleDamageStage, blocked: boolean): boolean {
  return stage === "CRITICAL" || (stage === "HEAVY" && blocked);
}
