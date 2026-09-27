/**
 * Thalassia underwater movement physics: buoyancy + drag + pressure zones, replacing
 * normal ground gravity/traction whenever the player is submerged (see `submerged` in
 * Scene.tsx, driven by `heightAt` vs. `WATER_LEVEL` in terrain.ts). Pure/deterministic
 * so it can be unit-tested and driven from Scene's useFrame the same way sim.ts is.
 */

export type UnderwaterState = "SURFACE" | "SWIMMING" | "GLIDING" | "BOOSTING" | "UNDER_PRESSURE" | "LOW_OXYGEN";

export const WATER_DRAG = { horizontal: 0.92, vertical: 0.94 } as const;
export const BUOYANCY_RISE = 1.4; // world units/sec natural upward drift when not actively swimming down
export const OXYGEN_MAX = 100;
export const OXYGEN_DRAIN_PER_SEC = 5.5;
export const OXYGEN_REGEN_PER_SEC = 14;
export const LOW_OXYGEN_THRESHOLD = 20;

/**
 * Depth-based speed penalty. `depth` is how far below the water surface the player is
 * (positive = deeper), matching the design spec's B1/C1/D1/D2 pressure-zone bands.
 */
export function pressureSpeedMultiplier(depth: number): number {
  if (depth > 150) return 0.4;
  if (depth > 100) return 0.6;
  if (depth > 50) return 0.8;
  return 1;
}

/** Frame-rate independent version of `velocity *= drag` — stable at any dt, not just 60fps. */
export function applyWaterDrag(value: number, dragPerSecond: number, dt: number): number {
  return value * Math.exp(-(1 - dragPerSecond) * 60 * dt);
}

/** Natural upward drift while submerged and not actively kicking; caps so you don't rocket to the surface. */
export function stepBuoyancy(velocityY: number, dt: number, activelyDescending: boolean): number {
  if (activelyDescending) return velocityY;
  return Math.min(3.5, velocityY + BUOYANCY_RISE * dt);
}

export function oxygenStep(oxygen: number, dt: number, submerged: boolean): number {
  const next = submerged ? oxygen - OXYGEN_DRAIN_PER_SEC * dt : oxygen + OXYGEN_REGEN_PER_SEC * dt;
  return Math.max(0, Math.min(OXYGEN_MAX, next));
}

export function classifyUnderwaterState(opts: { submerged: boolean; depth: number; oxygen: number; boosting: boolean }): UnderwaterState {
  if (!opts.submerged) return "SURFACE";
  if (opts.oxygen <= LOW_OXYGEN_THRESHOLD) return "LOW_OXYGEN";
  if (opts.boosting) return "BOOSTING";
  if (opts.depth > 50) return "UNDER_PRESSURE";
  return "SWIMMING";
}

/** Vision/handling penalty once oxygen runs low — Scene applies this to fog/aim, HUD applies it to a blur overlay. */
export function lowOxygenPenalty(oxygen: number): { visionBlur: number; speedMultiplier: number } {
  if (oxygen > LOW_OXYGEN_THRESHOLD) return { visionBlur: 0, speedMultiplier: 1 };
  const severity = 1 - oxygen / LOW_OXYGEN_THRESHOLD; // 0 at threshold, 1 at zero oxygen
  return { visionBlur: severity, speedMultiplier: 1 - severity * 0.45 };
}

/** Short traversal dash through water — same shape as the land dash but drag-limited so it decays quickly underwater. */
export function boostImpulse(yaw: number, strength = 1.5): { x: number; z: number } {
  return { x: Math.sin(yaw) * strength, z: Math.cos(yaw) * strength };
}
