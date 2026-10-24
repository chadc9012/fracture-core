/** Headless driving + collision test. Runs the REAL handling, collision and condition modules with the same per-frame
 * order Scene.tsx uses (step -> move -> sweep against solids -> bounce -> impactVehicle -> forced exit). Nothing here is
 * rendered; it proves the rules, not the look. */
import { describe, expect, test } from "bun:test";
import { HANDLING, canExitVehicle, stepVehicle, type HandlingKind, type VehicleInput, type VehicleState } from "./vehicle-handling";
import { sweepSolids, type SolidBox } from "./environment-collision";
import { FRESH_VEHICLE, conditionEffects, impactVehicle, recoverVehicle, repairPrice, type VehicleCondition } from "./vehicle-condition";
import { damageLook } from "./vehicle-damage-render";

const DT = 1 / 60;
const GROUND = { grip: 1, slope: 0, floor: 0, water: -5, overWater: false };
const none: VehicleInput = { throttle: 0, brake: 0, steer: 0, ascend: 0, descend: 0, handbrake: false, boost: false };
type Car = { x: number; z: number; yaw: number; speed: number; st: VehicleState; cond: VehicleCondition; hits: number; maxSpeed: number; forcedOut: boolean };
const car = (o: Partial<Car> = {}): Car => ({ x: 0, z: 0, yaw: 0, speed: 0, st: { speed: 0, yaw: 0, y: 1.9, vy: 0, airborne: false, slip: 0, roll: 0, pitch: 0 }, cond: FRESH_VEHICLE, hits: 0, maxSpeed: 0, forcedOut: false, ...o });
const wall = (z: number, w = 40, d = 0.6): SolidBox => ({ x: 0, y: 2, z, w, h: 6, d });

/** one frame, in Scene's order */
function frame(c: Car, kind: HandlingKind, input: VehicleInput, boxes: SolidBox[], mode: "world" | "casual" | "competitive" = "world", env = GROUND) {
  const fx = conditionEffects(c.cond);
  if (c.forcedOut) return;
  const r = stepVehicle(HANDLING[kind], { ...c.st, speed: c.speed, yaw: c.yaw }, input, env, 62 * fx.speed, DT);
  c.st = r; c.yaw = r.yaw;
  const pre = r.speed;
  const from = { x: c.x, z: c.z };
  const body = { x: c.x + Math.sin(c.yaw) * pre * DT, z: c.z + Math.cos(c.yaw) * pre * DT };
  const hit = sweepSolids(body, from, 0, 2.2, 2.6, boxes);
  c.x = body.x; c.z = body.z;
  c.speed = hit ? pre * -0.18 : pre;                        // Scene: body.vSpeed *= -0.18
  if (Math.abs(pre - c.speed) > 2) { c.cond = impactVehicle(c.cond, Math.abs(pre - c.speed), mode); c.hits++; }
  c.maxSpeed = Math.max(c.maxSpeed, Math.abs(c.speed));
  const blocked = Math.abs(pre) > 4 && Math.abs(c.speed) < Math.abs(pre) * 0.4;
  if (conditionEffects(c.cond).disabled) c.forcedOut = true;
  return blocked;
}
const drive = (c: Car, kind: HandlingKind, input: VehicleInput, secs: number, boxes: SolidBox[] = [], mode: "world" | "casual" | "competitive" = "world", env = GROUND) => { for (let i = 0; i < secs * 60; i++) frame(c, kind, input, boxes, mode, env); return c; };
const full = { ...none, throttle: 1 };
/** hit a wall once, coasting at `speed` (no throttle, so the impact speed is what we asked for), then stop counting */
function crashAt(speed: number, kind: HandlingKind = "OFFROAD", mode: "world" | "casual" | "competitive" = "world") {
  const c = car({ z: 52, speed, st: { ...car().st, speed } });
  const W = wall(60);
  for (let i = 0; i < 240 && c.hits === 0; i++) frame(c, kind, none, [W], mode);
  return c;
}

describe("driving", () => {
  test("a car accelerates, tops out, and faster classes beat slower ones", () => {
    const racer = drive(car(), "RACER", full, 12), jeep = drive(car(), "OFFROAD", full, 12), tank = drive(car(), "TANK", full, 12);
    expect(racer.speed).toBeGreaterThan(jeep.speed); expect(jeep.speed).toBeGreaterThan(tank.speed);
    expect(racer.speed).toBeLessThanOrEqual(62 * HANDLING.RACER.top + 1e-6);
    expect(drive(car(), "RACER", full, 1).speed).toBeGreaterThan(20);
  });
  test("steering turns a moving car; handbrake at speed drifts; low grip slides more", () => {
    const c = drive(car({ speed: 30 }), "RACER", { ...full, steer: 1 }, 1);
    expect(Math.abs(c.yaw)).toBeGreaterThan(0.3);
    const hb = drive(car({ speed: 35 }), "RACER", { ...full, steer: 1, handbrake: true }, 1);
    expect(hb.st.skidding).toBe(true);
    const grippy = drive(car({ speed: 40 }), "OFFROAD", { ...none, steer: 1 }, 0.3, [], "world", { ...GROUND, grip: 1 });
    const icy = drive(car({ speed: 40 }), "OFFROAD", { ...none, steer: 1 }, 0.3, [], "world", { ...GROUND, grip: 0.3 });
    expect(icy.st.slip).toBeGreaterThan(grippy.st.slip);
  });
  test("brakes stop the car and it can reverse, capped", () => {
    const c = drive(car({ speed: 40 }), "RACER", { ...none, brake: 1 }, 6);
    expect(c.speed).toBeLessThanOrEqual(0); expect(c.speed).toBeGreaterThanOrEqual(-HANDLING.RACER.reverse - 1e-6);
  });
});

describe("collision", () => {
  test("a car can never pass through a wall, at any speed including boost", () => {
    for (const speed of [8, 25, 50, 62, 87]) {
      const c = car({ speed }); const W = wall(40, 40, 0.4);
      for (let i = 0; i < 400; i++) frame(c, "RACER", { ...full, boost: speed > 62 }, [W]);
      expect(c.z).toBeLessThan(40 - 0.2 - 2.6 + 0.5);
    }
  });
  test("hitting a wall bounces the car back slowly and keeps it outside the wall", () => {
    const c = crashAt(40);
    expect(c.hits).toBeGreaterThan(0);
    expect(c.z).toBeLessThan(60);
  });
  test("damage scales with impact speed; a scrape costs next to nothing", () => {
    const [s3, s20, s45] = [crashAt(3), crashAt(20), crashAt(45)];
    expect(s20.hits).toBe(1); expect(s45.hits).toBe(1); // both really reached the wall
    const scrape = s3.cond.body, mid = s20.cond.body, hard = s45.cond.body;
    expect(scrape).toBeLessThan(1); expect(mid).toBeGreaterThan(scrape); expect(hard).toBeGreaterThan(mid);
    expect(hard).toBeLessThanOrEqual(100);
  });
  test("a hard hit damages engine, tyres and suspension too, in proportion", () => {
    const k = crashAt(45).cond;
    expect(k.body).toBeGreaterThan(k.engine); expect(k.engine).toBeGreaterThan(k.tires); expect(k.suspension).toBeGreaterThan(0);
  });
  test("difficulty modes: casual < world < competitive", () => {
    const [a, b, d] = (["casual", "world", "competitive"] as const).map((m) => car({ cond: impactVehicle(FRESH_VEHICLE, 25, m) }).cond.body);
    expect(a!).toBeLessThan(b!); expect(b!).toBeLessThan(d!);
  });
  test("sliding along a wall keeps moving along it", () => {
    const c = car({ yaw: 0.35, speed: 25 }); const W = wall(30, 200);
    const startX = c.x;
    for (let i = 0; i < 120; i++) frame(c, "RACER", full, [W]);
    expect(Math.abs(c.x - startX)).toBeGreaterThan(5); expect(c.z).toBeLessThan(30);
  });
  test("repeated crashes wreck the car: top speed falls, then it is disabled and the driver is thrown out", () => {
    const c = car({ speed: 45 }); const W = wall(40);
    const tops: number[] = [];
    for (let n = 0; n < 8 && !c.forcedOut; n++) {
      c.x = 0; c.z = 0; c.yaw = 0; c.speed = 45; c.st = { ...c.st, speed: 45, yaw: 0, slip: 0 };
      for (let i = 0; i < 300 && c.z < 38; i++) frame(c, "OFFROAD", full, [W]);
      tops.push(conditionEffects(c.cond).speed);
    }
    expect(c.forcedOut).toBe(true); expect(conditionEffects(c.cond).disabled).toBe(true);
    for (let i = 1; i < tops.length; i++) expect(tops[i]!).toBeLessThanOrEqual(tops[i - 1]!);
    expect(tops[tops.length - 1]!).toBeLessThan(1);
  });
  test("a damaged engine really drives slower", () => {
    const fresh = drive(car(), "OFFROAD", full, 15).speed;
    const hurt = drive(car({ cond: { ...FRESH_VEHICLE, engine: 70 } }), "OFFROAD", full, 15).speed;
    expect(hurt).toBeLessThan(fresh * 0.75);
  });
});

describe("landing, water and exit", () => {
  test("a hard jet landing is flagged and costs speed; a gentle one does not", () => {
    const hard = stepVehicle(HANDLING.JET, { speed: 20, yaw: 0, y: 2.5, vy: -14, airborne: true, slip: 0, roll: 0, pitch: 0 }, none, GROUND, 62, DT * 6);
    expect(hard.landed).toBe(true); expect(hard.hardLanding).toBe(true); expect(hard.speed).toBeLessThan(20);
    const soft = stepVehicle(HANDLING.JET, { speed: 10, yaw: 0, y: 2.0, vy: -2, airborne: true, slip: 0, roll: 0, pitch: 0 }, none, GROUND, 62, DT * 6);
    expect(soft.hardLanding).toBe(false);
  });
  test("a boat driven onto land is stopped and flagged blocked", () => {
    const land = drive(car({ speed: 25 }), "BOAT", full, 5, [], "world", { ...GROUND, overWater: false });
    const sea = drive(car({ speed: 25 }), "BOAT", full, 5, [], "world", { ...GROUND, overWater: true });
    expect(land.st.blocked).toBe(true); expect(sea.st.blocked).toBe(false); expect(land.speed).toBeLessThan(sea.speed * 0.3);
  });
  test("you can only get out when slow, grounded and not in deep water", () => {
    expect(canExitVehicle(HANDLING.RACER, { speed: 30, airborne: false }, false).ok).toBe(false);
    expect(canExitVehicle(HANDLING.RACER, { speed: 2, airborne: false }, false).ok).toBe(true);
    expect(canExitVehicle(HANDLING.JET, { speed: 0, airborne: true }, false).ok).toBe(false);
    expect(canExitVehicle(HANDLING.BOAT, { speed: 0, airborne: false }, true).ok).toBe(false);
  });
});

describe("damage carries through to repair and to what you see", () => {
  test("crash damage shows up in the render look and in the repair bill", () => {
    const c = crashAt(45).cond;
    expect(damageLook(c, 1).dentTier).toBeGreaterThanOrEqual(2); expect(repairPrice(c)).toBeGreaterThan(0);
    expect(damageLook(FRESH_VEHICLE, 1).dentTier).toBe(0); expect(repairPrice(FRESH_VEHICLE)).toBe(0);
  });
  test("recovery restores mobility, not looks: dents stay", () => {
    const wreck: VehicleCondition = { body: 100, engine: 100, tires: 80, suspension: 60 };
    const back = recoverVehicle(wreck, true, true);
    expect(conditionEffects(back).disabled).toBe(false);
    expect(damageLook(back, 1).dentTier).toBeGreaterThanOrEqual(3); expect(back.body).toBe(85);
  });
});
