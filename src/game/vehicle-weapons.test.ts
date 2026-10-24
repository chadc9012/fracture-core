import { describe, expect, test } from "bun:test";
import { aimFor, armamentFor, vehiclePoint, vehicleVelocity } from "./vehicle-weapons";
import { HANDLING, handlingFor } from "./vehicle-handling";
import { VEHICLES } from "./vehicles";
import { ordnanceById } from "./ordnance";

describe("vehicle armament", () => {
  test("every catalogue vehicle has a primary gun with at least one barrel, and its ordnance exists", () => {
    for (const v of VEHICLES) {
      const a = armamentFor(v.id, handlingFor(v).kind);
      expect(a.primary.muzzles.length).toBeGreaterThan(0);
      expect(a.primary.rate).toBeGreaterThan(0);
      if (a.secondary) expect(ordnanceById(a.secondary.ordnance)).toBeDefined();
    }
  });
  test("vehicle classes feel different: the tank cannon is slow and heavy, the chain gun fast", () => {
    const tank = armamentFor("goliath-tank", "TANK").primary, heli = armamentFor("rift-helicopter", "HELI").primary;
    expect(tank.rate).toBeGreaterThan(heli.rate * 10);
    expect(tank.damage).toBeGreaterThan(heli.damage * 5);
  });
  test("individual builds override their class (hoverbike pulse emitters)", () => {
    expect(armamentFor("aether-hoverbike", HANDLING.RACER.kind).primary.name).toBe("Twin pulse emitters");
  });
});

describe("muzzles and aim", () => {
  const pose = { x: 10, y: 5, z: -3, yaw: 0, pitch: 0, roll: 0 };
  test("forward offset moves along the facing; right offset to the vehicle's right (-x at yaw 0)", () => {
    const p = vehiclePoint(pose, [0, 0, 4]);
    expect(p.z).toBeCloseTo(1, 6); expect(p.x).toBeCloseTo(10, 6);
    const r = vehiclePoint(pose, [1, 0, 0]);
    expect(r.x).toBeCloseTo(9, 6);
    const turned = vehiclePoint({ ...pose, yaw: Math.PI / 2 }, [0, 0, 4]);
    expect(turned.x).toBeCloseTo(14, 6); expect(turned.z).toBeCloseTo(-3, 6);
  });
  test("a pitched-up nose raises the forward barrels", () => {
    expect(vehiclePoint({ ...pose, pitch: 0.3 }, [0, 0, 4]).y).toBeGreaterThan(pose.y + 1);
  });
  test("turrets follow the camera, fixed guns follow the nose with limited pitch help", () => {
    const m = vehiclePoint(pose, [0, 0, 3]);
    expect(aimFor("TURRET", pose, 1.2, -0.4, 0.1, m, 0)).toEqual({ yaw: 1.2, pitch: -0.4 });
    const fixed = aimFor("FIXED", { ...pose, pitch: 0.2 }, 1.2, -0.4, 0.1, m, 0);
    expect(fixed.yaw).toBe(0);
    expect(fixed.pitch).toBeCloseTo(0.1, 6);
  });
  test("wing guns converge on a point ahead", () => {
    const left = vehiclePoint(pose, [-1.1, 0, 3]), right = vehiclePoint(pose, [1.1, 0, 3]);
    const a = aimFor("FIXED", pose, 0, 0, 0, left, 200), b = aimFor("FIXED", pose, 0, 0, 0, right, 200);
    expect(Math.sign(a.yaw)).toBe(-Math.sign(b.yaw));
    expect(Math.abs(a.yaw)).toBeLessThan(0.02);
  });
  test("vehicle velocity points along the heading", () => {
    const v = vehicleVelocity(Math.PI / 2, 30, 2);
    expect(v.vx).toBeCloseTo(30, 6); expect(v.vz).toBeCloseTo(0, 6); expect(v.vy).toBe(2);
  });
});
