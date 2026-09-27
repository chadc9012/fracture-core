/**
 * Thalassia underwater combat: aim drift, projectile drag, recoil-as-positioning, and
 * cover/AI helpers for enemies that drift and reposition in 3D instead of standing still.
 * Pure functions — Scene.tsx and sim.ts call these, they don't own any state themselves.
 */
import { pressureSpeedMultiplier } from "./underwater";

/** Depth affects how forgiving aiming and firing are — same B1/C1/D1/D2 bands as movement. */
export function depthCombatModifiers(depth: number): { spreadMult: number; aimSpeedMult: number; recoilMult: number } {
  if (depth > 100) return { spreadMult: 1.5, aimSpeedMult: 0.7, recoilMult: 1.35 };
  if (depth > 50) return { spreadMult: 1.2, aimSpeedMult: 0.85, recoilMult: 1.15 };
  return { spreadMult: 1, aimSpeedMult: 1, recoilMult: 1 };
}

/** Slows a fired projectile over time so shots feel weighty instead of instant-hitscan underwater. */
export function stepProjectileDrag(speed: number, dragPerSecond = 0.96, dt: number): number {
  return speed * Math.pow(dragPerSecond, dt * 60);
}

/** Firing pushes the shooter backward — combat becomes 3D positioning, not just aim-and-click. */
export function recoilImpulse(yaw: number, pitch: number, strength: number): { x: number; y: number; z: number } {
  return { x: -Math.sin(yaw) * strength, y: -Math.sin(pitch) * strength * 0.6, z: -Math.cos(yaw) * strength };
}

export type CoverPoint = { x: number; y: number; z: number };

/** Enemies use floating debris/pillars/tunnel edges as cover, not walls — sorted nearest-to-enemy-but-away-from-player. */
export function bestCover(points: readonly CoverPoint[], enemy: { x: number; z: number }, player: { x: number; z: number }, minPlayerDistance = 5): CoverPoint | null {
  const candidates = points.filter((c) => Math.hypot(c.x - player.x, c.z - player.z) > minPlayerDistance);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (Math.hypot(c.x - enemy.x, c.z - enemy.z) < Math.hypot(best.x - enemy.x, best.z - enemy.z) ? c : best));
}

/**
 * Underwater enemy movement bias: they strafe/drift vertically instead of holding ground,
 * and break off to retreat upward once badly hurt.
 */
export function underwaterEnemyDrift(t: number, seedX: number, lowHealth: boolean): { dx: number; dy: number; dz: number } {
  if (lowHealth) return { dx: Math.sin(t * 0.6 + seedX) * 0.4, dy: 1.2, dz: Math.cos(t * 0.6 + seedX) * 0.4 };
  return { dx: Math.sin(t * 1.3 + seedX) * 1.1, dy: Math.sin(t * 0.7 + seedX) * 0.35, dz: Math.cos(t * 1.1 + seedX) * 1.1 };
}

/** Convenience: combine depth spread with the weapon's own base spread + existing bloom, matching Scene.tsx's shoot(). */
export function underwaterSpread(baseSpread: number, depth: number): number {
  return baseSpread * depthCombatModifiers(depth).spreadMult;
}

export function underwaterAimTurnRate(baseRate: number, depth: number): number {
  return baseRate * depthCombatModifiers(depth).aimSpeedMult;
}

export function underwaterPressureNote(depth: number): string {
  if (depth > 150) return "D2 · near-crush resistance";
  if (depth > 100) return "D1 · heavy drag";
  if (depth > 50) return "C1 · slowed movement";
  return "B1 · normal swim";
}

export { pressureSpeedMultiplier };
