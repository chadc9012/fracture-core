/** Headless "drive and shoot / fly and shoot" playtest. Each frame replays Scene.tsx in its own order:
 *   1. the vehicle-fire block (`vehicle hardpoints (vehicle-weapons.ts)`): muzzle = vehiclePoint(pose, offset) with pose.y = s.y - 1.9,
 *      aim = aimFor(mount, pose, s.yaw, s.pitch, ...), primary -> fireBullet(..., { speed, inherit: vehicleVelocity }) or fireOrdnance for
 *      shells, secondary salvo -> fireOrdnance;
 *   2. stepVehicle(handlingFor(v), ...) with topSpeed = 62 x biome grip x vehicle speed, then s.x/z += heading x speed x dt;
 *   3. stepSim(sim, { px, pz, inVehicle: true }).
 * Spread jitter is left out so runs are deterministic. Model-bounds clamping (`fit`) is skipped: it needs the GLB. */
import { describe, expect, test } from "bun:test";
import { createSim, fireBullet, fireOrdnance, HEAT_PER_SHOT_VEHICLE, stepSim, type Machine, type WorldSim } from "./sim";
import { heightAt, walkHeight, WATER_LEVEL } from "./terrain";
import { vehicleById, VEHICLES, type VehicleId } from "./vehicles";
import { handlingFor, stepVehicle, type StepResult, type VehicleInput } from "./vehicle-handling";
import { aimFor, armamentFor, vehiclePoint, vehicleVelocity } from "./vehicle-weapons";
import { ordnanceById } from "./ordnance";
import { FLEET } from "./fleet";

/** bun runs test.todo (skipped unless `bun test --todo`); the repo's bun:test type shim does not declare it */
const todo = (test as unknown as { todo: (name: string, fn: () => void) => void }).todo;
const DT = 1 / 60;
const PX = -240, PZ = -230; // flat 19.8 m plain, nothing within 200 m north
const SEA = { x: -1080, z: 0 }; // open ocean, seabed ~-37
const RIDE = 1.9;
const none: VehicleInput = { throttle: 0, brake: 0, steer: 0, ascend: 0, descend: 0, handbrake: false, boost: false };

function arena(): WorldSim {
  const sim = createSim();
  for (const t of sim.trucks) t.alive = false;
  for (const m of sim.machines) m.alive = false;
  sim.emergencyQuest = { ...sim.emergencyQuest, state: "DORMANT", timer: 1e9 };
  return sim;
}
function grunt(sim: WorldSim, x: number, z: number, o: Partial<Machine> = {}): Machine {
  const m = sim.machines.find((e) => !e.alive)!;
  Object.assign(m, { alive: true, x, z, y: walkHeight(x, z), hp: 3.5, maxHp: 3.5, rot: 0, scale: 0.95, zone: "wastelands", cool: 99, elite: false, boss: false, profile: "Test Grunt", kind: "RAIDER", drop: "scrapMetal", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, mission: false, react: undefined }, o);
  delete m.ai; delete m.lastPlayerDamage;
  return m;
}

type Ride = {
  id: VehicleId; x: number; y: number; z: number; yaw: number; speed: number; vy: number; camPitch: number;
  st: Pick<StepResult, "airborne" | "slip" | "roll" | "pitch">;
  vf: { cool: number; secCool: number; salvoCool: number; salvoLeft: number; barrel: number; podBarrel: number };
  /** every primary/secondary launch: where it left from and the vehicle pose at that moment */
  shots: { kind: "bullet" | "round"; muzzle: { x: number; y: number; z: number }; vehicle: { x: number; y: number; z: number; yaw: number }; ok: boolean }[];
};
function ride(id: VehicleId, at = { x: PX, z: PZ }, o: Partial<Ride> = {}): Ride {
  const p = handlingFor(vehicleById(id));
  const floor = p.mode === "WATER" ? WATER_LEVEL + 0.6 : walkHeight(at.x, at.z) + RIDE;
  return { id, x: at.x, y: floor, z: at.z, yaw: 0, speed: 0, vy: 0, camPitch: 0, st: { airborne: false, slip: 0, roll: 0, pitch: 0 }, vf: { cool: 0, secCool: 0, salvoCool: 0, salvoLeft: 0, barrel: 0, podBarrel: 0 }, shots: [], ...o };
}

function frame(sim: WorldSim, r: Ride, input: VehicleInput, fire = false, secondary = false, dt = DT) {
  const v = vehicleById(r.id), p = handlingFor(v), arm = armamentFor(r.id, p.kind);
  // 1. fire (Scene's vehicle hardpoint block)
  const vf = r.vf;
  vf.cool -= dt; vf.secCool -= dt; vf.salvoCool -= dt;
  if (!sim.overheated) {
    const air = p.mode === "AIR";
    const pose = { x: r.x, y: r.y - RIDE, z: r.z, yaw: r.yaw, pitch: air ? r.st.pitch : 0, roll: air ? r.st.roll : 0 };
    const carry = vehicleVelocity(r.yaw, r.speed, air || p.mode === "WATER" ? r.vy : 0);
    const g = arm.primary;
    if (fire && vf.cool <= 0) {
      vf.cool = g.rate / sim.mods.fireRate;
      const muzzle = vehiclePoint(pose, g.muzzles[vf.barrel++ % g.muzzles.length]!);
      const aim = aimFor(g.mount, pose, r.yaw, r.camPitch, g.pitchAssist, muzzle, g.converge);
      const ok = g.shell
        ? fireOrdnance(sim, { id: "cannon-shell", kind: "ROCKET", name: g.name, speed: g.speed, turnRate: 0, life: 3, splashRadius: g.shell, damage: 1, proximity: 1.6, domain: "ANY", fits: [r.id] }, muzzle.x, muzzle.y, muzzle.z, aim.yaw, aim.pitch, g.damage, Math.max(0, r.speed), g.knock)
        : fireBullet(sim, muzzle.x, muzzle.y, muzzle.z, aim.yaw, true, aim.pitch, g.damage, g.knock, g.heat, undefined, g.damage >= 3 ? "PELLET" : "BULLET", { speed: g.speed, inherit: carry });
      r.shots.push({ kind: g.shell ? "round" : "bullet", muzzle, vehicle: { x: r.x, y: r.y, z: r.z, yaw: r.yaw }, ok });
    }
    const sec = arm.secondary;
    if (sec) {
      if (secondary && vf.secCool <= 0 && vf.salvoLeft <= 0) { vf.secCool = sec.rate; vf.salvoLeft = sec.salvo; vf.salvoCool = 0; }
      if (vf.salvoLeft > 0 && vf.salvoCool <= 0) {
        const def = ordnanceById(sec.ordnance)!;
        const muzzle = vehiclePoint(pose, sec.muzzles[vf.podBarrel++ % sec.muzzles.length]!);
        const aim = aimFor(sec.mount, pose, r.yaw, r.camPitch, 0.25, muzzle, 0);
        const ok = fireOrdnance(sim, def, muzzle.x, muzzle.y, muzzle.z, aim.yaw, aim.pitch, sec.damage, Math.max(0, r.speed));
        r.shots.push({ kind: "round", muzzle, vehicle: { x: r.x, y: r.y, z: r.z, yaw: r.yaw }, ok });
        vf.salvoLeft--; vf.salvoCool = sec.salvoGap;
      }
    }
  }
  // 2. handling + move
  const overWater = heightAt(r.x, r.z) < WATER_LEVEL - 0.3;
  const floorH = p.mode === "WATER" ? heightAt(r.x, r.z) : walkHeight(r.x, r.z);
  const top = 62 * 0.9 * sim.mods.vehicleSpeed * v.speed; // 0.9 = biome grip outside a region (Scene: here?.speed ?? 0.9)
  const res = stepVehicle(p, { speed: r.speed, yaw: r.yaw, y: r.y, vy: r.vy, ...r.st }, input, { grip: 0.9 * v.handling, slope: 0, floor: floorH, water: WATER_LEVEL, overWater }, top, dt);
  r.speed = res.speed; r.yaw = res.yaw; r.st = res;
  if (p.mode !== "GROUND") { r.y = res.y; r.vy = res.vy; } else r.y = walkHeight(r.x, r.z) + RIDE;
  r.x += Math.sin(r.yaw) * r.speed * dt;
  r.z += Math.cos(r.yaw) * r.speed * dt;
  // 3. sim
  stepSim(sim, { px: r.x, pz: r.z, dt, night: 0, inVehicle: true, yaw: r.yaw });
}
/** position of a point relative to the vehicle: along = ahead of it, side = to its right, up = above its body centre */
const rel = (r: { x: number; y: number; z: number; yaw: number }, q: { x: number; y: number; z: number }) => {
  const dx = q.x - r.x, dz = q.z - r.z;
  return { along: dx * Math.sin(r.yaw) + dz * Math.cos(r.yaw), side: -dx * Math.cos(r.yaw) + dz * Math.sin(r.yaw), up: q.y - r.y };
};
const live = (sim: WorldSim) => sim.bullets.filter((b) => b.alive);
const LAND: VehicleId[] = VEHICLES.filter((v) => handlingFor(v).mode === "GROUND" && v.seats > 0).map((v) => v.id);

describe("driving and shooting (every drivable land vehicle)", () => {
  for (const id of LAND) {
    test(`${id}: full throttle + steering while firing — rounds leave ahead of the hull, keep pace, and kill what is ahead`, () => {
      const sim = arena();
      const r = ride(id);
      const arm = armamentFor(id, handlingFor(vehicleById(id)).kind);
      // 2 s straight run-up firing; a fresh round is always ahead of the moving vehicle (it keeps pace)
      for (let f = 0; f < 120; f++) frame(sim, r, { ...none, throttle: 1 }, true);
      expect(r.speed).toBeGreaterThan(10);
      if (!arm.primary.shell) for (const b of live(sim)) expect(rel(r, b).along).toBeGreaterThan(-1);
      // then a 1.5 s hard left turn, still firing
      for (let f = 0; f < 90; f++) frame(sim, r, { ...none, throttle: 1, steer: 1 }, true);
      expect(r.shots.length).toBeGreaterThan(2);
      for (const s of r.shots) {
        const q = rel(s.vehicle, s.muzzle);
        expect(q.along).toBeGreaterThan(0); // never behind the driver's seat
        expect(s.muzzle.y - walkHeight(s.muzzle.x, s.muzzle.z)).toBeGreaterThan(0.35); // never under the ground
      }
      // no round struck the dirt right in front of the bumper on flat ground (see the converge note below for the 40-60 m dive)
      for (const e of sim.impacts.filter((x) => x.id > 0 && x.kind === "ground")) expect(Math.hypot(e.x - r.x, e.z - r.z)).toBeGreaterThan(15);

      // and a grunt 22 m dead ahead of a parked vehicle dies (closer than every converge dive, see the note below)
      const sim2 = arena();
      const m = grunt(sim2, PX, PZ + 22, { mission: true });
      const r2 = ride(id);
      // the driver puts the crosshair on the grunt's chest (a tall turret aimed at the horizon rightly passes over it)
      const mz = arm.primary.muzzles[0]!;
      r2.camPitch = -Math.atan2(walkHeight(PX, PZ) + mz[1] - (walkHeight(PX, PZ + 22) + 1.1), 22 - mz[2]);
      for (let f = 0; f < 60 * 5 && m.alive; f++) { m.x = PX; m.z = PZ + 22; frame(sim2, r2, none, true); }
      expect(m.alive).toBe(false);
    });
  }

  const FIXED_CARS = ["scrap-interceptor", "aether-hoverbike", "raider-buggy"] as const;
  test("converging car/bike guns stay level past the converge distance (hits beyond 40-60 m)", () => {
    for (const id of FIXED_CARS) expect(groundHitDistance(id)).toBeGreaterThan(150);
  });
  function groundHitDistance(id: VehicleId) {
    const sim = arena();
    const r = ride(id);
    frame(sim, r, none, true);
    for (let f = 0; f < 60; f++) frame(sim, r, none);
    const e = sim.impacts.find((x) => x.id > 0 && x.kind === "ground");
    return e ? Math.hypot(e.x - r.x, e.z - r.z) : Infinity;
  }

  test("a strafing car's bullet inherits the car's velocity (no drift behind it)", () => {
    const sim = arena();
    const r = ride("scrap-interceptor");
    for (let f = 0; f < 120; f++) frame(sim, r, { ...none, throttle: 1 });
    for (const b of sim.bullets) b.alive = false;
    frame(sim, r, { ...none, throttle: 1 }, true);
    const b = live(sim)[0]!;
    const g = armamentFor("scrap-interceptor", "RACER").primary;
    expect(Math.hypot(b.vx, b.vz)).toBeGreaterThan(g.speed + r.speed * 0.95);
  });

  test("tank: 120mm shells are slow-firing splash ordnance that one-shot a grunt and don't overheat", () => {
    const sim = arena();
    const m = grunt(sim, PX, PZ + 60);
    const r = ride("goliath-tank");
    let shells = 0;
    for (let f = 0; f < 60 * 3 && m.alive; f++) { const n = r.shots.length; frame(sim, r, none, true); if (r.shots.length > n) shells++; }
    expect(m.alive).toBe(false);
    expect(shells).toBe(1);
    expect(sim.burstEvents.length).toBe(1);
    expect(sim.overheated).toBe(false);
    // 4 seconds of held fire: 1.4 s between shells
    const r2 = ride("goliath-tank"), sim2 = arena();
    for (let f = 0; f < 240; f++) frame(sim2, r2, none, true);
    expect(r2.shots.length).toBe(3);
  });

  test("tank pivots on the spot (steer, no throttle) and its cannon tracks the new heading", () => {
    const sim = arena();
    const r = ride("goliath-tank");
    for (let f = 0; f < 60; f++) frame(sim, r, { ...none, steer: 1 }, f === 59);
    expect(r.yaw).toBeGreaterThan(0.3); // 0.9 rad/s x grip 0.45 (0.9 terrain x 0.5 tank handling) = 0.4 rad/s
    expect(Math.hypot(r.x - PX, r.z - PZ)).toBeLessThan(0.01);
    const shell = sim.rounds.find((q) => q.alive)!;
    expect(Math.atan2(shell.dx, shell.dz)).toBeCloseTo(r.shots.at(-1)!.vehicle.yaw, 6);
  });
});

describe("flying and shooting", () => {
  test("helicopter: VTOL climb to ~30 m, hover, chin gun follows camera pitch down onto a grunt below and kills it", () => {
    const sim = arena();
    const m = grunt(sim, PX, PZ + 40);
    const r = ride("rift-helicopter");
    for (let f = 0; f < 60 * 5; f++) frame(sim, r, { ...none, ascend: 1 });
    const alt = r.y - RIDE - walkHeight(r.x, r.z);
    expect(alt).toBeGreaterThan(25);
    // the gunner keeps the chin gun on the grunt (it walks in under the helicopter during the climb)
    const hold = { x: m.x, z: m.z };
    for (let f = 0; f < 60 * 3 && m.alive; f++) {
      m.x = hold.x; m.z = hold.z; m.kx = 0; m.kz = 0; // a stationary target for a deterministic run
      const d = Math.max(1, Math.hypot(m.x - r.x, m.z - r.z) - 2.6);
      r.camPitch = -Math.atan2(r.y - RIDE + 0.55 - (walkHeight(m.x, m.z) + 1.1), d);
      frame(sim, r, none, true);
    }
    expect(m.alive).toBe(false);
    // shots left from the chin, below the airframe and ahead of it, at altitude
    const s = r.shots[0]!;
    expect(rel(s.vehicle, s.muzzle).along).toBeGreaterThan(2);
    expect(s.muzzle.y - walkHeight(s.muzzle.x, s.muzzle.z)).toBeGreaterThan(20);
  });

  test("jet: takes off only past 32 m/s, climbs, and its fixed guns follow the aircraft's pitch and heading", () => {
    const sim = arena();
    const r = ride("vanguard-jet");
    for (let f = 0; f < 30; f++) frame(sim, r, { ...none, throttle: 1, ascend: 1 });
    expect(r.st.airborne).toBe(false); // still rolling, too slow
    for (let f = 0; f < 60 * 4; f++) frame(sim, r, { ...none, throttle: 1, ascend: 1, steer: f > 120 ? 0.6 : 0 });
    expect(r.st.airborne).toBe(true);
    expect(r.st.pitch).toBeGreaterThan(0.3); // nose up in the climb
    for (const b of sim.bullets) b.alive = false;
    frame(sim, r, { ...none, throttle: 1, ascend: 1 }, true);
    const b = live(sim)[0]!, shot = r.shots.at(-1)!;
    const g = armamentFor("vanguard-jet", "JET").primary;
    // the round's own (muzzle) direction = heading + aircraft pitch; the climb rate rides on top
    const own = { vx: b.vx - Math.sin(shot.vehicle.yaw) * r.speed, vy: b.vy - r.vy, vz: b.vz - Math.cos(shot.vehicle.yaw) * r.speed };
    expect(Math.hypot(own.vx, own.vy, own.vz)).toBeCloseTo(g.speed, 0);
    expect(Math.asin(own.vy / g.speed)).toBeGreaterThan(0.3);
    expect(Math.abs(Math.atan2(own.vx, own.vz) - shot.vehicle.yaw)).toBeLessThan(0.02); // converged wing gun, ~0.3 degrees off the nose
    // spawns at the wing at altitude, not at the pilot's seat or ground height
    expect(shot.muzzle.y - walkHeight(shot.muzzle.x, shot.muzzle.z)).toBeGreaterThan(10);
  });

  test("jet missiles lock a target in the forward cone and track it from altitude", () => {
    const sim = arena();
    const r = ride("vanguard-jet", { x: PX, z: PZ - 300 });
    for (let f = 0; f < 60 * 4; f++) frame(sim, r, { ...none, throttle: 1, ascend: f < 150 ? 1 : 0 });
    const m = grunt(sim, r.x + 10, r.z + 220, { hp: 30, maxHp: 30 });
    frame(sim, r, none, false, true);
    frame(sim, r, none, false, true);
    for (let f = 0; f < 12; f++) frame(sim, r, none, false, true);
    const rounds = r.shots.filter((s) => s.kind === "round");
    expect(rounds.length).toBe(2); // salvo of two
    expect(sim.rounds.some((q) => q.alive && q.target === sim.machines.indexOf(m))).toBe(true);
    for (let f = 0; f < 60 * 4; f++) frame(sim, r, none);
    expect(m.hp).toBeLessThan(30);
  });

  test("bullets fired from altitude fall into the terrain and log a ground impact, not one on the aircraft", () => {
    const sim = arena();
    const r = ride("rift-helicopter");
    for (let f = 0; f < 60 * 4; f++) frame(sim, r, { ...none, ascend: 1 });
    r.camPitch = -0.6;
    for (let f = 0; f < 30; f++) frame(sim, r, none, f === 0);
    const hit = sim.impacts.find((e) => e.id > 0 && e.kind === "ground")!;
    expect(hit).toBeDefined();
    expect(Math.abs(hit.y - heightAt(hit.x, hit.z))).toBeLessThan(2.5);
    expect(Math.hypot(hit.x - r.x, hit.z - r.z)).toBeGreaterThan(20);
  });

  test("a landed jet / helicopter fires clear of the ground at its own nose", () => {
    for (const id of ["vanguard-jet", "rift-helicopter"] as const) {
      const sim = arena();
      const r = ride(id);
      frame(sim, r, none, true);
      frame(sim, r, none);
      expect(sim.impacts.filter((e) => e.id > 0 && e.kind === "ground").length).toBe(0);
    }
  });
  test("level fire from ~100 m altitude passes over a grunt on the ground below", () => {
    const { sim, m } = levelPass();
    expect(m.hp).toBe(3.5);
  });
  test("level fire from ~100 m up never touches a grunt on the ground below", () => {
    const { m, alt } = levelPass();
    expect(alt).toBeGreaterThan(80);
    expect(m.hp).toBe(3.5);
  });
  function levelPass() {
    const sim = arena();
    const r = ride("rift-helicopter", { x: PX, z: PZ - 60 });
    for (let f = 0; f < 60 * 14; f++) frame(sim, r, { ...none, ascend: 1 });
    const alt = r.y - RIDE - walkHeight(r.x, r.z);
    const m = grunt(sim, r.x, r.z + 60);
    r.camPitch = 0;
    for (let f = 0; f < 60 * 3; f++) frame(sim, r, none, true);
    return { sim, m, alt };
  }

  test("a jet's dead-on gun pass never flies straight through a grunt (swept hits)", () => {
    expect(jetPassMisses()).toBe(0);
  });
  function jetPassMisses() {
    // a jet at top speed: 260 m/s gun + 62 x 0.9 x 1.8 (speed) x 1.6 (JET top) = ~160 m/s airspeed -> ~420 m/s, 7 m per 60 fps frame.
    // Fire one round dead at a grunt held still at 40 different sub-frame offsets; count rounds that pass it without a hit.
    let misses = 0;
    for (let k = 0; k < 40; k++) {
      const sim = arena();
      const m = grunt(sim, PX, PZ + 100 + k * 0.17, { hp: 1e6, maxHp: 1e6, mission: true });
      fireBullet(sim, PX, walkHeight(PX, PZ + 100) + 1.2, PZ, 0, true, 0, 1, 1, 0.1, undefined, "BULLET", { speed: 260, inherit: vehicleVelocity(0, 160, 0) });
      for (let f = 0; f < 30; f++) { m.x = PX; m.z = PZ + 100 + k * 0.17; stepSim(sim, { px: PX, pz: PZ, dt: DT, night: 0, inVehicle: true, yaw: 0 }); }
      if (m.hp === 1e6) misses++;
    }
    return misses;
  }
});

describe("vehicle weapon heat", () => {
  test("a full helicopter rocket-pod salvo does not overheat the aircraft", () => {
    const { sim } = heliSalvo();
    expect(sim.overheated).toBe(false);
  });
  function heliSalvo() {
    const sim = arena();
    const r = ride("rift-helicopter");
    for (let f = 0; f < 60 * 3; f++) frame(sim, r, { ...none, ascend: 1 });
    sim.weaponHeat = 0;
    for (let f = 0; f < 60; f++) frame(sim, r, none, false, f === 0);
    return { sim, fired: r.shots.filter((s) => s.kind === "round" && s.ok).length };
  }

  test("sustained fire time before overheat: every vehicle gun fires ~3 s or more before venting", () => {
    const out: Record<string, number> = {};
    for (const id of ["scrap-interceptor", "wasteland-jeep", "rift-helicopter", "vanguard-jet", "ai-interceptor", "scrap-patrol-boat"] as const) {
      const sim = arena();
      const r = ride(id, handlingFor(vehicleById(id)).mode === "WATER" ? SEA : { x: PX, z: PZ });
      let t = 0;
      for (; t < 20 && !sim.overheated; t += DT) frame(sim, r, none, true);
      out[id] = Math.round(t * 10) / 10;
    }
    // every vehicle gun sustains at least ~3 s of fire before venting (heli/jet/interceptor used to lock in 1.5-2 s)
    for (const [id, t] of Object.entries(out)) expect(t, id).toBeGreaterThan(2.9);
    expect(HEAT_PER_SHOT_VEHICLE).toBe(11);
  });
});

describe("boats", () => {
  test("patrol boat floats on open water, deck gun fires from above the waterline and keeps pace", () => {
    const sim = arena();
    const r = ride("scrap-patrol-boat", SEA);
    for (let f = 0; f < 120; f++) frame(sim, r, { ...none, throttle: 1, steer: 0.5 }, true);
    expect(r.y).toBeCloseTo(WATER_LEVEL + 0.6, 6);
    expect(Math.hypot(r.x - SEA.x, r.z - SEA.z)).toBeGreaterThan(20);
    for (const s of r.shots) expect(s.muzzle.y).toBeGreaterThan(WATER_LEVEL);
  });

  // GAP (sim.ts bullet loop): the only terrain test is heightAt (the seabed), so rounds aimed at the sea surface keep flying underwater
  // with no splash impact until they reach the bottom or expire.
  test("a deck-gun round aimed into the sea splashes at the surface instead of flying on underwater", () => {
    const sim = arena();
    const r = ride("scrap-patrol-boat", SEA, { camPitch: -0.3 });
    frame(sim, r, none, true);
    for (let f = 0; f < 10; f++) frame(sim, r, none);
    expect(sim.bullets.every((b) => !b.alive || b.y > WATER_LEVEL - 0.5)).toBe(true);
    const splash = sim.impacts.find((e) => e.id > 0 && e.kind === "water");
    expect(splash).toBeDefined();
    expect(splash!.y).toBeCloseTo(WATER_LEVEL, 6);
  });
  test("a diver's round fired underwater is not stopped by the surface rule", () => {
    const sim = arena();
    fireBullet(sim, SEA.x, WATER_LEVEL - 4, SEA.z, 0, false, 0);
    for (let f = 0; f < 5; f++) stepSim(sim, { px: SEA.x, pz: SEA.z, dt: DT, night: 0, inVehicle: false, yaw: 0 });
    expect(sim.impacts.some((e) => e.id > 0 && e.kind === "water")).toBe(false);
  });
});

describe("catalogue vs what fires", () => {
});
