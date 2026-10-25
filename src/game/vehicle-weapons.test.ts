import { describe, expect, test } from "bun:test";
import { aimFor, armamentFor, vehiclePoint, vehicleVelocity } from "./vehicle-weapons";
import { HANDLING, handlingFor } from "./vehicle-handling";
import { VEHICLES, vehicleById } from "./vehicles";
import { FLEET } from "./fleet";
import { ordnanceById } from "./ordnance";

describe("vehicle armament", () => {
  test("every catalogue vehicle has a primary gun with at least one barrel, and its ordnance exists", () => {
    for (const v of VEHICLES) {
      const a = armamentFor(v.id, handlingFor(v).kind);
      expect(a.primary).not.toBeNull();
      expect(a.primary!.muzzles.length).toBeGreaterThan(0);
      expect(a.primary!.rate).toBeGreaterThan(0);
      if (a.secondary) expect(ordnanceById(a.secondary.ordnance)).toBeDefined();
    }
  });
  test("vehicle classes feel different: the tank cannon is slow and heavy, the chain gun fast", () => {
    const tank = armamentFor("goliath-tank", "TANK").primary!, heli = armamentFor("rift-helicopter", "HELI").primary!;
    expect(tank.rate).toBeGreaterThan(heli.rate * 10);
    expect(tank.damage).toBeGreaterThan(heli.damage * 5);
  });
  test("individual builds override their class (hoverbike pulse emitters)", () => {
    expect(armamentFor("aether-hoverbike", HANDLING.RACER.kind).primary!.name).toBe("Twin pulse emitters");
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

describe("fleet builds fire their own hardpoints", () => {
  test("every fleet build resolves to a sane armament on its chassis", () => {
    for (const f of FLEET) {
      const a = armamentFor(f.base, handlingFor(vehicleById(f.base)).kind, f.id);
      if (f.id === "civic-rover") { expect(a.primary).toBeNull(); continue; }
      expect(a.primary, f.id).not.toBeNull();
      expect(a.primary!.rate).toBeGreaterThan(0);
      expect(a.primary!.muzzles.length).toBeGreaterThan(0);
      if (a.secondary) expect(ordnanceById(a.secondary.ordnance), f.id).toBeDefined();
    }
  });
  test("every armed build's primary is named after one of its own hardpoints", () => {
    for (const f of FLEET) {
      const a = armamentFor(f.base, handlingFor(vehicleById(f.base)).kind, f.id);
      if (!a.primary) continue;
      const words = (t: string) => t.toLowerCase().replace(/^[a-z -]+: /, "").split(/[^a-z0-9]+/).filter((w) => w.length > 3);
      const named = words(a.primary.name);
      expect(f.hardpoints.some((h) => words(h).some((w) => named.includes(w))), `${f.id}: ${a.primary.name} vs ${f.hardpoints.join(" / ")}`).toBe(true);
    }
  });
  test("two builds on one chassis no longer fire the same guns", () => {
    const k = handlingFor(vehicleById("aether-hoverbike")).kind;
    const nomad = armamentFor("aether-hoverbike", k, "nomad-bike").primary!, ghost = armamentFor("aether-hoverbike", k, "ghost-ray").primary!;
    expect(nomad.name).not.toBe(ghost.name);
    expect(ghost.damage).toBeGreaterThan(nomad.damage * 3);
    expect(ghost.rate).toBeGreaterThan(nomad.rate * 3);
  });
  test("the Aegis Siege Breaker fires its pintle machine gun on the secondary trigger", () => {
    const a = armamentFor("goliath-tank", "TANK", "aegis-siege");
    expect(a.primary!.shell).toBeGreaterThan(0);
    expect(a.secondary).toBeNull();
    expect(a.secondaryGun?.name).toContain("pulse machine gun");
  });
  test("no build means the chassis armament (unchanged)", () => {
    expect(armamentFor("goliath-tank", "TANK", null)).toEqual(armamentFor("goliath-tank", "TANK"));
  });
});
