/** Headless "drive a whole race" playtest: a real chassis is driven by a pursuit-steering pilot through stepVehicle (the same handling Scene.tsx
 * runs), the run goes through the real activity pipeline (startActivity -> stepRun -> tickRace -> completeActivity -> applyRaceResult),
 * rivals come from rivalPositions, track obstacles from raceObstacles, and the result must pay out exactly once.
 * Terrain collision is not simulated (Scene does that); the pilot just has to hold the line the checkpoints define. */
import { describe, expect, test } from "bun:test";
import { RACES, applyRaceResult, livePlace, raceById, raceObstacles, raceSpeedFactor, rivalPositions, worldPoint, type RaceDef, type RaceRun } from "./racing";
import { activityById, completeActivity, startActivity, stepRun, type Run } from "./activities";
import { DEFAULT_PROGRESSION } from "./progression";
import { handlingFor, stepVehicle, type VehicleInput } from "./vehicle-handling";
import { vehicleById, VEHICLES, type VehicleId } from "./vehicles";
import { walkHeight } from "./terrain";

const DT = 1 / 30, T0 = Date.UTC(2026, 9, 25, 12, 0, 0);
const CAR: VehicleId = VEHICLES.find((v) => handlingFor(v).kind === "RACER" && v.seats > 0)!.id;

type Log = { run: Run; rr: RaceRun; seconds: number; maxSpeed: number; placeMin: number; places: number[]; recovered: number; samples: number[] };
/** drive one race to its end; `avoid` steers round obstacles like a player would, otherwise the pilot drives straight through them */
function playRace(id: string, o: { avoid?: boolean; ram?: boolean; difficulty?: string; p?: typeof DEFAULT_PROGRESSION; at?: number } = {}) {
  const def = raceById(id)!, act = activityById(id)!, p = o.p ?? structuredClone(DEFAULT_PROGRESSION), t0 = o.at ?? T0;
  const s = startActivity(p, id, t0, o.difficulty) as { progression: typeof p; run: Run };
  if ("error" in s) throw new Error(`${id}: ${(s as unknown as { error: string }).error}`);
  const run = s.run, v = vehicleById(CAR), prof = handlingFor(v), top = 62 * 0.9 * v.speed;
  const start = worldPoint(def, 0), first = worldPoint(def, 1);
  const car = { x: start.x, z: start.z, yaw: Math.atan2(first.x - start.x, first.z - start.z), speed: 0, vy: 0, y: walkHeight(start.x, start.z) + 1.9, st: { airborne: false, slip: 0, roll: 0, pitch: 0 } };
  const log: Log = { run, rr: null as never, seconds: 0, maxSpeed: 0, placeMin: 99, places: [], recovered: 0, samples: [] };
  let now = t0;
  for (let i = 0; i < 60 * 30 / DT && run.status === "active"; i++) {
    const rr = run.race as RaceRun | undefined, next = rr && rr.phase === "running" ? rr.next : rr?.phase === "countdown" ? 1 : 1;
    const tgt = worldPoint(def, Math.min(def.points.length - 1, next)), prev = worldPoint(def, Math.max(0, next - 1));
    let aimX = tgt.x, aimZ = tgt.z;
    // pursuit: look a little ahead of the car along the leg so it holds the line instead of cutting the corner
    const dx = tgt.x - prev.x, dz = tgt.z - prev.z, len = Math.hypot(dx, dz) || 1, along = ((car.x - prev.x) * dx + (car.z - prev.z) * dz) / len;
    const look = Math.min(len, along + 25); aimX = prev.x + (dx / len) * look; aimZ = prev.z + (dz / len) * look;
    if (Math.hypot(tgt.x - car.x, tgt.z - car.z) < 40) { aimX = tgt.x; aimZ = tgt.z; }
    if (o.avoid && rr) for (const ob of raceObstacles(def)) if (ob.segment === next && Math.hypot(ob.x - car.x, ob.z - car.z) < 22) { const nx = -(tgt.z - prev.z) / len, nz = (tgt.x - prev.x) / len, side = (ob.x - (prev.x + dx * 0.52)) * nx + (ob.z - (prev.z + dz * 0.52)) * nz > 0 ? -1 : 1; aimX += nx * side * 6; aimZ += nz * side * 6; }
    if (o.ram && rr) for (const ob of raceObstacles(def)) if (ob.segment === next && !rr.hitObstacles?.includes(ob.id) && Math.hypot(ob.x - car.x, ob.z - car.z) < 30) { aimX = ob.x; aimZ = ob.z; }
    let err = Math.atan2(aimX - car.x, aimZ - car.z) - car.yaw; err = Math.atan2(Math.sin(err), Math.cos(err));
    // speed control: slow for the gate ahead and for sharp turn-ins, floor at a corner pace so a short leg never stalls the pilot
    const gateDist = Math.hypot(tgt.x - car.x, tgt.z - car.z), want = Math.max(9, Math.min(top, gateDist * 0.9, Math.abs(err) > 0.5 ? 10 : top));
    const go = rr?.phase === "running" || !rr;
    const input: VehicleInput = { throttle: go && car.speed < want ? 1 : 0, brake: go && car.speed > want * 1.15 ? 0.6 : 0, steer: Math.max(-1, Math.min(1, err * 2.2)), ascend: 0, descend: 0, handbrake: false, boost: false };
    const ceil = top * raceSpeedFactor(rr?.impact);
    const res = stepVehicle(prof, { speed: car.speed, yaw: car.yaw, y: car.y, vy: car.vy, ...car.st }, input, { grip: 0.9 * v.handling, slope: 0, floor: walkHeight(car.x, car.z), water: -50, overWater: false }, ceil, DT);
    car.speed = Math.min(res.speed, ceil); car.yaw = res.yaw; car.st = res; car.y = walkHeight(car.x, car.z) + 1.9;
    car.x += Math.sin(car.yaw) * car.speed * DT; car.z += Math.cos(car.yaw) * car.speed * DT;
    now += DT * 1000;
    stepRun(act, run, { x: car.x, z: car.z, dt: DT, now, kills: 0, elites: 0, bosses: 0, hp: 100, deaths: 0, mode: "vehicle", y: car.y });
    const r2 = run.race as RaceRun;
    if (r2.recover) { car.x = r2.recover.x; car.z = r2.recover.z; car.speed = 0; r2.recover = null; log.recovered++; }
    log.maxSpeed = Math.max(log.maxSpeed, car.speed);
    if (r2.phase === "running") { const lp = livePlace(def, r2, car.x, car.z); log.places.push(lp.place); log.placeMin = Math.min(log.placeMin, lp.place); }
    log.seconds = r2.time;
  }
  log.rr = run.race as RaceRun;
  return { def, act, p: s.progression, run, log, now };
}

/** a saved racer with every race medalled, so rank gates never hide a course from the playtest (records for the race under test are left out) */
const veteran = (except: string) => { const p = structuredClone(DEFAULT_PROGRESSION); for (const r of RACES) if (r.id !== except) for (const d of ["standard", "advanced", "legendary"]) p.earnedRewards.push(`race-medal:${r.id}:${d}:gold`); return p; };
const VEHICLE_RACES = RACES.filter((r) => r.mode === "vehicle" && !r.hidden);

describe("a complete race, driven by a real vehicle", () => {
  test("Midnight Circuit: staging, countdown, every checkpoint in order, a valid result", () => {
    const { run, log, def } = playRace("nc-circuit", { avoid: true });
    expect(run.status).toBe("complete");
    expect(log.rr.phase).toBe("finished");
    expect(log.rr.result?.valid).toBe(true);
    expect(log.rr.passed.length).toBeGreaterThanOrEqual(def.points.length - 1 - (log.rr.viaShortcut ? def.shortcuts.length * 8 : 0));
    expect(log.maxSpeed).toBeGreaterThan(20);
    expect(log.rr.recoveries).toBe(0);
  });
  test("the field is racing too: rivals are ahead at the start and on the same course", () => {
    const def = raceById("nc-circuit")!, field = rivalPositions(def, "standard", 5);
    expect(field.length).toBe(def.rivals);
    for (const r of field) { expect(r.progress).toBeGreaterThan(0); expect(Number.isFinite(r.x)).toBe(true); }
    const { log } = playRace("nc-circuit", { avoid: true });
    expect(log.places.length).toBeGreaterThan(50);
    expect(log.places.every((p) => p >= 1 && p <= def.rivals + 1)).toBe(true);
  });
  test("scenery has teeth: driving through a hazard obstacle costs a collision and speed", () => {
    const hazard = VEHICLE_RACES.find((r) => raceObstacles(r).length > 0);
    expect(hazard).toBeTruthy();
    const careless = playRace(hazard!.id, { ram: true }), careful = playRace(hazard!.id, { avoid: true, at: T0 + 86_400_000 * 3 });
    expect(careless.log.rr.collisions).toBeGreaterThan(0);
    expect(careful.log.rr.collisions).toBeLessThan(careless.log.rr.collisions);
    expect(careless.log.rr.result!.penalties).toBeGreaterThan(careful.log.rr.result!.penalties);
  });
  test("rewards: one payout, a recorded personal best, and replaying the same run pays nothing twice", () => {
    const a = playRace("nc-circuit", { avoid: true });
    expect(a.run.status).toBe("complete");
    const paid = completeActivity(a.p, a.act, a.run, a.now, () => 0.99) as { progression: typeof a.p; payout: { nex: number } };
    expect("error" in paid).toBe(false);
    expect(paid.payout.nex).toBeGreaterThan(0);
    const rec = applyRaceResult(paid.progression, a.act, a.run) as { progression: typeof a.p; reward: { personalBest: boolean; nexBonus: number } };
    expect("error" in rec).toBe(false);
    expect(rec.reward.personalBest).toBe(true);
    expect((applyRaceResult(rec.progression, a.act, a.run) as { error?: string }).error).toBe("Already recorded");
    expect((completeActivity(rec.progression, a.act, a.run, a.now + 1000) as { error?: string }).error).toBe("Already claimed");
  });
  test("driving away from the line never starts a race, and a race left open fails instead of hanging", () => {
    const act = activityById("nc-circuit")!, def = raceById("nc-circuit")!;
    const s = startActivity(structuredClone(DEFAULT_PROGRESSION), "nc-circuit", T0) as { run: Run };
    const far = worldPoint(def, 3);
    for (let i = 0; i < 200; i++) stepRun(act, s.run, { x: far.x, z: far.z, dt: 0.1, now: T0 + i * 100, kills: 0, elites: 0, bosses: 0, hp: 100, deaths: 0, mode: "vehicle" });
    expect((s.run.race as RaceRun).phase).toBe("staging");
    expect(s.run.status).toBe("active");
  });
});

describe("every vehicle race on the board can be finished by a pilot using real handling", () => {
  for (const r of VEHICLE_RACES) {
    test(`${r.id} (${r.name})`, () => {
      const { log } = playRace(r.id, { avoid: true, p: veteran(r.id) });
      expect(`${r.id}:${log.rr.phase}:${log.rr.failReason ?? ""}`).toBe(`${r.id}:finished:`);
      expect(log.rr.result?.valid).toBe(true);
    });
  }
});
