/**
 * Nexus City stealth/surveillance: the safe-zone perimeter turrets sim.ts already tracks
 * (`sim.turrets`, filtered to zone "nexus") double as the surveillance sensors here — their
 * `rot` (facing) + `range` already describe exactly the cone a detection check needs, so this
 * doesn't invent a parallel drone-entity system. Pure functions; Scene.tsx owns the live
 * per-player detection meter and hack-progress state, the same shape as the existing
 * mission state machines' `hack: number` field (see src/game/missions/broken-signal.ts).
 */

export type DetectionState = "GREEN" | "YELLOW" | "RED";
export type LockdownTier = "MONITORING" | "DRONE_TRACKING" | "INTERCEPTION" | "LOCKDOWN_PURGE";

export type Sensor = { x: number; z: number; rot: number; range: number };

const VISION_HALF_ANGLE = Math.PI / 5; // ~36° half-angle == ~72° cone, matching a patrol camera's field of view

/** True if (px, pz) sits inside a sensor's forward-facing vision cone (sensor.rot is the atan2(dx, dz) convention sim.ts's turrets already use). */
export function inVisionCone(sensor: Sensor, px: number, pz: number, halfAngle = VISION_HALF_ANGLE): boolean {
  const dx = px - sensor.x;
  const dz = pz - sensor.z;
  const dist = Math.hypot(dx, dz);
  if (dist > sensor.range) return false;
  if (dist < 0.05) return true;
  const angleToPlayer = Math.atan2(dx, dz);
  const delta = Math.atan2(Math.sin(angleToPlayer - sensor.rot), Math.cos(angleToPlayer - sensor.rot));
  return Math.abs(delta) <= halfAngle;
}

export function anySensorSees(sensors: readonly Sensor[], px: number, pz: number): boolean {
  return sensors.some((sensor) => inVisionCone(sensor, px, pz));
}

/** Pulls the Nexus-zone subset of sim.turrets into the plain {x,z,rot,range} shape this module needs. */
export function nexusSensors(turrets: readonly { x: number; z: number; rot: number; range: number; zone: string }[]): Sensor[] {
  return turrets.filter((t) => t.zone === "nexus").map((t) => ({ x: t.x, z: t.z, rot: t.rot, range: t.range * 0.75 }));
}

const DETECTION_RISE_PER_SEC = 22;
const DETECTION_FALL_PER_SEC = 14;

/** 0-100 detection meter: climbs while seen (faster mid-hack — you're standing still and exposed), decays once out of every cone. */
export function stepDetectionMeter(meter: number, dt: number, seen: boolean, hacking: boolean): number {
  const rise = DETECTION_RISE_PER_SEC * (hacking ? 1.6 : 1);
  const next = seen ? meter + rise * dt : meter - DETECTION_FALL_PER_SEC * dt;
  return Math.max(0, Math.min(100, next));
}

export function detectionStateFor(meter: number): DetectionState {
  if (meter >= 75) return "RED";
  if (meter >= 30) return "YELLOW";
  return "GREEN";
}

export const LOCKDOWN_RESPONSE: Record<LockdownTier, { label: string; response: string }> = {
  MONITORING: { label: "MONITORING", response: "Passive surveillance sweep" },
  DRONE_TRACKING: { label: "DRONE TRACKING", response: "Drones re-tasked to your last known position" },
  INTERCEPTION: { label: "INTERCEPTION", response: "Security units moving to intercept" },
  LOCKDOWN_PURGE: { label: "LOCKDOWN · PURGE", response: "Sector sealed — purge protocol engaged" },
};

export function lockdownTierFor(meter: number): LockdownTier {
  if (meter >= 90) return "LOCKDOWN_PURGE";
  if (meter >= 75) return "INTERCEPTION";
  if (meter >= 30) return "DRONE_TRACKING";
  return "MONITORING";
}

export function lockdownStatus(meter: number): { tier: LockdownTier; label: string; response: string } {
  const tier = lockdownTierFor(meter);
  return { tier, ...LOCKDOWN_RESPONSE[tier] };
}

const HACK_PROGRESS_PER_SEC = 28;

/** Hacking (disable cameras / open doors / spoof ID all plug into this one 0-100 meter, same shape as broken-signal's HACKING state): stalls under YELLOW, actively degrades under RED — getting spotted costs you progress, not just time. */
export function stepHackProgress(progress: number, dt: number, detection: DetectionState): number {
  if (detection === "RED") return Math.max(0, progress - HACK_PROGRESS_PER_SEC * 0.8 * dt);
  const rate = detection === "YELLOW" ? HACK_PROGRESS_PER_SEC * 0.5 : HACK_PROGRESS_PER_SEC;
  return Math.min(100, progress + rate * dt);
}

export function hackComplete(progress: number): boolean {
  return progress >= 100;
}
