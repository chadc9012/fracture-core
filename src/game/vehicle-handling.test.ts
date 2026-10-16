import { describe, expect, test } from "bun:test";
import { HANDLING, canExitVehicle, handlingFor, stepVehicle, type VehicleState } from "./vehicle-handling";
import { surfaceAt, surfaceGrip } from "./vehicle-surface";
import { vehicleById } from "./vehicles";

const st = (o: Partial<VehicleState> = {}): VehicleState => ({ speed: 0, yaw: 0, y: 2, vy: 0, airborne: false, slip: 0, roll: 0, pitch: 0, ...o });
const env = { grip: 1, slope: 0, floor: 0, water: 0, overWater: false };
const none = { throttle: 0, brake: 0, steer: 0, ascend: 0, descend: 0, handbrake: false, boost: false };
const run = (p = HANDLING.JET, s = st(), input = none, e = env, secs = 1) => { let r = { ...s, landed: false, hardLanding: false, blocked: false, skidding: false }; for (let i = 0; i < secs * 60; i++) r = stepVehicle(p, r, input, e, 62, 1 / 60); return r; };

describe("vehicle handling", () => {
  test("each vehicle gets its own type", () => {
    expect(handlingFor(vehicleById("vanguard-jet")).kind).toBe("JET");
    expect(handlingFor(vehicleById("rift-helicopter")).kind).toBe("HELI");
    expect(handlingFor(vehicleById("scrap-patrol-boat")).kind).toBe("BOAT");
    expect(handlingFor(vehicleById("hydro-sub-skiff")).kind).toBe("SUB");
    expect(handlingFor(vehicleById("goliath-tank")).kind).toBe("TANK");
  });
  test("jet can't take off below takeoff speed", () => {
    expect(run(HANDLING.JET, st({ speed: 10 }), { ...none, ascend: 1 }).airborne).toBe(false);
    expect(run(HANDLING.JET, st({ speed: 40 }), { ...none, throttle: 1, ascend: 1 }).airborne).toBe(true);
  });
  test("helicopter lifts off from a standstill", () => expect(run(HANDLING.HELI, st(), { ...none, ascend: 1 }).airborne).toBe(true));
  test("boat grinds to a stop on land", () => {
    const r = run(HANDLING.BOAT, st({ speed: 20 }), none, { ...env, overWater: false });
    expect(r.blocked).toBe(true);
    expect(r.speed).toBeLessThan(1);
  });
  test("tank turns on the spot, a car doesn't", () => {
    expect(Math.abs(run(HANDLING.TANK, st(), { ...none, steer: 1 }).yaw)).toBeGreaterThan(0.5);
    expect(Math.abs(run(HANDLING.RACER, st(), { ...none, steer: 1 }).yaw)).toBeLessThan(0.3);
  });
  test("can't exit at speed or in the air", () => {
    expect(canExitVehicle(HANDLING.RACER, { speed: 30, airborne: false }, false).ok).toBe(false);
    expect(canExitVehicle(HANDLING.JET, { speed: 0, airborne: true }, false).ok).toBe(false);
    expect(canExitVehicle(HANDLING.BOAT, { speed: 0, airborne: false }, true).ok).toBe(false);
    expect(canExitVehicle(HANDLING.RACER, { speed: 2, airborne: false }, false).ok).toBe(true);
  });
  test("ice grips less than road", () => {
    expect(surfaceGrip(surfaceAt("frostspire", 60, 0), 0)).toBeLessThan(surfaceGrip(surfaceAt("nexus", 10, 0), 0));
  });
  test("handbrake at speed starts a drift", () => {
    expect(run(HANDLING.RACER, st({ speed: 40 }), { ...none, throttle: 1, steer: 1, handbrake: true }, env, 0.5).skidding).toBe(true);
  });
});
