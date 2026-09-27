/**
 * Neon City parkour: rooftop/vault traversal tech layered on the existing jump (KeyC)
 * and momentum system rather than a separate climbing-geometry system (the world's
 * collision model is radius-based, not mesh-accurate, so parkour reads as *momentum*,
 * matching the design spec's "maintainVelocityMomentum()" note on vehicle exits).
 */

/** A fast-moving jump vaults further and a little higher than a standing jump. */
export function vaultLunge(forwardSpeed: number, baseJumpSpeed: number): { verticalBoost: number; forwardBoost: number } {
  const momentum = Math.min(1, forwardSpeed / 24);
  return { verticalBoost: baseJumpSpeed * (1 + momentum * 0.25), forwardBoost: momentum * 6 };
}

/** Exiting a vehicle mid-motion keeps a fraction of its speed as foot-chase momentum instead of snapping to zero. */
export function exitVehicleMomentum(vehicleSpeed: number, keepFraction = 0.55): number {
  return vehicleSpeed * keepFraction;
}

/** Consecutive vaults/jumps within this window chain into a small speed bonus, capped so it can't runaway-stack. */
const CHAIN_WINDOW_SECONDS = 1.4;
export function parkourChainBonus(chainCount: number, timeSinceLastAction: number): number {
  if (timeSinceLastAction > CHAIN_WINDOW_SECONDS) return 0;
  return Math.min(0.35, chainCount * 0.08);
}

/** Rooftops as escape routes: once a chase reaches this heat/hazard tier, going vertical is a valid route call. */
export function rooftopRouteAvailable(heightAboveGround: number): boolean {
  return heightAboveGround > 6;
}
