/** Per-type vehicle handling (pure). Scene feeds input + ground under the vehicle and applies the result; collisions,
 * damage and forced exits stay in Scene. Every vehicle maps to one HandlingKind from its id/domain, so a jet climbs,
 * a boat floats and a tank pivots instead of all sharing one car script. Fuel is intentionally absent. */
import type { VehicleDefinition, VehicleId } from "./vehicles";

export type HandlingKind = "RACER" | "OFFROAD" | "TANK" | "JET" | "HELI" | "BOAT" | "SUB";
export type Mode = "GROUND" | "AIR" | "WATER";

export type HandlingProfile = {
  kind: HandlingKind; mode: Mode;
  /** top speed multiplier on the base 62 m/s, acceleration m/s², braking m/s², reverse cap */
  top: number; accel: number; brake: number; reverse: number;
  /** yaw rate rad/s at full lock; tanks can pivot at standstill */
  steer: number; pivot: boolean;
  /** 0-1 sideways grip; below 1 the car slides out when cornering hard */
  grip: number;
  /** AIR: speed needed to lift off (0 = VTOL), climb rate m/s */
  takeoff: number; climb: number;
  /** safe exit/landing speed */
  safeExit: number;
};

const P = (p: Partial<HandlingProfile> & Pick<HandlingProfile, "kind" | "mode">): HandlingProfile => ({ top: 1, accel: 52, brake: 70, reverse: 18, steer: 1.5, pivot: false, grip: 0.9, takeoff: 0, climb: 0, safeExit: 6, ...p });

export const HANDLING: Record<HandlingKind, HandlingProfile> = {
  RACER: P({ kind: "RACER", mode: "GROUND", top: 1.1, accel: 60, brake: 80, steer: 1.7, grip: 0.95 }),
  OFFROAD: P({ kind: "OFFROAD", mode: "GROUND", top: 0.9, accel: 48, steer: 1.5, grip: 0.85 }),
  TANK: P({ kind: "TANK", mode: "GROUND", top: 0.55, accel: 22, brake: 40, reverse: 10, steer: 0.9, pivot: true, grip: 1 }),
  JET: P({ kind: "JET", mode: "AIR", top: 1.6, accel: 40, brake: 25, reverse: 0, steer: 1.0, grip: 1, takeoff: 32, climb: 22, safeExit: 4 }),
  HELI: P({ kind: "HELI", mode: "AIR", top: 0.8, accel: 30, brake: 40, reverse: 10, steer: 1.6, grip: 1, takeoff: 0, climb: 9, safeExit: 4 }),
  BOAT: P({ kind: "BOAT", mode: "WATER", top: 0.75, accel: 30, brake: 30, reverse: 8, steer: 1.2, grip: 0.7 }),
  SUB: P({ kind: "SUB", mode: "WATER", top: 0.5, accel: 18, brake: 24, reverse: 8, steer: 1.0, grip: 0.9, climb: 4 }),
};

const BY_ID: Partial<Record<VehicleId, HandlingKind>> = {
  "scrap-interceptor": "RACER", "aether-hoverbike": "RACER", "ai-interceptor": "JET", "raider-buggy": "OFFROAD", "wasteland-jeep": "OFFROAD",
  "tech-transport": "OFFROAD", "goliath-tank": "TANK", "fracture-behemoth": "TANK", "rift-helicopter": "HELI", "vanguard-jet": "JET",
  "void-skimmer": "JET", "scrap-patrol-boat": "BOAT", leviathan: "BOAT", "hydro-sub-skiff": "SUB",
};
export function handlingFor(v: Pick<VehicleDefinition, "id" | "domain">): HandlingProfile {
  const k = BY_ID[v.id] ?? (v.domain === "AIR" || v.domain === "SPACE" ? "JET" : v.domain === "WATER" ? "BOAT" : v.domain === "AMPHIBIOUS" ? "SUB" : "OFFROAD");
  return HANDLING[k];
}

export type VehicleInput = { throttle: number; brake: number; steer: number; ascend: number; descend: number; handbrake: boolean; boost: boolean };
export type VehicleEnv = { /** surface grip 0-1 (vehicle-surface.ts) */ grip: number; slope: number; /** ground (or water surface for boats) height */ floor: number; water: number; /** is the ground under the vehicle water? */ overWater: boolean };
export type VehicleState = { speed: number; yaw: number; y: number; vy: number; airborne: boolean; /** sideways slip, >0.3 = drifting */ slip: number; roll: number; pitch: number };

export type StepResult = VehicleState & { landed: boolean; hardLanding: boolean; blocked: boolean; skidding: boolean };

const RIDE = 1.9;

/** One frame of handling. `topSpeed` is the already-tuned max (base 62 × vehicle × upgrades × damage). */
export function stepVehicle(p: HandlingProfile, st: VehicleState, input: VehicleInput, env: VehicleEnv, topSpeed: number, dt: number): StepResult {
  let { speed, yaw, y, vy, airborne, slip, roll, pitch } = st;
  const ground = p.mode === "AIR" ? 1 : p.mode === "WATER" ? 1 : env.grip;
  const max = topSpeed * p.top * (input.boost ? 1.4 : 1);
  // longitudinal
  if (input.throttle > 0) speed += p.accel * ground * input.throttle * dt;
  else if (input.brake > 0) speed -= (speed > 0.5 ? p.brake : p.accel * 0.8) * input.brake * dt;
  else speed *= Math.exp(-(p.mode === "AIR" && airborne ? 0.15 : p.mode === "WATER" ? 1.0 : 1.4) * dt);
  if (p.mode === "GROUND") speed *= Math.exp(-(0.22 + env.slope * 1.6) * dt);
  speed = Math.max(-p.reverse, Math.min(max, speed));
  // a jet in the air keeps a minimum airspeed or it stalls down
  // steering
  const speedFactor = p.pivot ? 1 : Math.min(1, Math.max(0.15, Math.abs(speed) / 14));
  const handbrake = input.handbrake && p.mode === "GROUND" && Math.abs(speed) > 8;
  const steerGrip = p.mode === "GROUND" ? ground : 1;
  const yawRate = p.steer * steerGrip * speedFactor * (handbrake ? 1.6 : 1) * (p.kind === "JET" && !airborne ? 0.5 : 1);
  yaw += input.steer * yawRate * dt * (p.pivot ? 1 : Math.sign(speed || 1));
  // drift: lateral grip vs cornering load
  const load = Math.abs(input.steer) * Math.abs(speed) / 30;
  const hold = p.grip * (p.mode === "GROUND" ? env.grip : 1) * (handbrake ? 0.45 : 1);
  slip = slip + (Math.max(0, load - hold) - slip) * (1 - Math.exp(-6 * dt));
  if (slip > 0.3 && p.mode === "GROUND") speed *= Math.exp(-0.5 * slip * dt);
  roll += ((p.mode === "AIR" ? -input.steer * 0.6 : -input.steer * Math.min(0.12, load * 0.1)) - roll) * (1 - Math.exp(-5 * dt));

  // vertical
  let landed = false, hardLanding = false;
  const blocked = (p.mode === "WATER" && !env.overWater) || (p.mode !== "WATER" && p.mode !== "AIR" && false);
  if (p.mode === "GROUND") {
    y = env.floor + RIDE; vy = 0; airborne = false; pitch = 0;
  } else if (p.mode === "WATER") {
    const surface = env.water + 0.6;
    if (p.kind === "SUB") {
      vy = (input.ascend - input.descend) * p.climb;
      y = Math.min(surface, Math.max(env.floor + 1.2, y + vy * dt));
    } else { y = surface; vy = 0; }
    pitch = 0;
    if (blocked) speed *= Math.exp(-6 * dt); // beached: grinds to a halt in the shallows
  } else {
    const floor = env.floor + RIDE;
    const canLift = p.takeoff === 0 || speed >= p.takeoff;
    if (!airborne) {
      y = floor; vy = 0;
      if (canLift && input.ascend > 0) { airborne = true; vy = p.climb * 0.4; }
    } else {
      const want = (input.ascend - input.descend) * p.climb;
      // a jet below takeoff speed sinks; a helicopter hovers
      const sink = p.takeoff > 0 && speed < p.takeoff * 0.7 ? -8 : 0;
      vy += (want + sink - vy) * (1 - Math.exp(-2.5 * dt));
      y += vy * dt;
      if (y <= floor) {
        hardLanding = vy < -7 || Math.abs(speed) > p.takeoff + 12;
        y = floor; vy = 0; airborne = false; landed = true;
        if (hardLanding) speed *= 0.4;
      }
    }
    pitch += ((airborne ? Math.max(-0.35, Math.min(0.35, vy / 40)) : 0) - pitch) * (1 - Math.exp(-4 * dt));
  }
  return { speed, yaw, y, vy, airborne, slip, roll, pitch, landed, hardLanding, blocked, skidding: slip > 0.3 || (handbrake && Math.abs(speed) > 10) };
}

/** Safe exit: slow enough, and not in the air or (for non-boats) over deep water. Boats/subs may exit only near shore. */
export function canExitVehicle(p: HandlingProfile, st: Pick<VehicleState, "speed" | "airborne">, deepWater: boolean): { ok: true } | { ok: false; reason: string } {
  if (st.airborne) return { ok: false, reason: p.kind === "JET" ? "Land first" : "Set down first" };
  if (Math.abs(st.speed) > p.safeExit) return { ok: false, reason: "Too fast to get out" };
  if (deepWater && p.mode === "WATER") return { ok: false, reason: "Pull up to the shore first" };
  return { ok: true };
}

/** Chase camera per type: aircraft sit higher and further back, boats low. */
export function vehicleCamera(p: HandlingProfile): { distance: number; height: number } {
  return p.mode === "AIR" ? { distance: 22, height: 7 } : p.mode === "WATER" ? { distance: 13, height: 3.5 } : p.kind === "TANK" ? { distance: 15, height: 6 } : { distance: 14, height: 5 };
}
