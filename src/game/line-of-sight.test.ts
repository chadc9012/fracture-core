import { describe, expect, test } from "bun:test";
import { canSee, enemyHitChance, obstacleHeight, sightLine } from "./line-of-sight";
import { addObstacle, queryObstacles, resetObstacles } from "./obstacles";
import { createSim, stepSim, type Machine } from "./sim";
import { walkHeight } from "./terrain";
import { removeModelSolid, setModelSolid } from "./environment-collision";

const flat = { ground: () => 0 };
const eye = (x: number, z: number) => ({ x, y: 1.6, z });

describe("sight line", () => {
  test("open flat ground: clear", () => {
    expect(canSee(eye(0, 0), eye(0, 40), flat)).toBe(true);
  });
  test("a ridge between blocks; one below the line does not", () => {
    const ridge = (h: number) => ({ ground: (_x: number, z: number) => (z > 18 && z < 22 ? h : 0) });
    const r = sightLine(eye(0, 0), eye(0, 40), ridge(3));
    expect(r.blocked).toBe(true);
    if (r.blocked) { expect(r.by).toBe("ground"); expect(r.at.z).toBeGreaterThan(17); expect(r.at.z).toBeLessThan(23); }
    expect(canSee(eye(0, 0), eye(0, 40), ridge(1))).toBe(true);
  });
  test("buildings and trunks block; a low rock blocks a crouched line but not a standing one over it", () => {
    resetObstacles();
    addObstacle("tower", 0, 20, 4, 600, 3);
    expect(sightLine(eye(0, 0), eye(0, 40), { ...flat, obstaclesNear: queryObstacles }).blocked).toBe(true);
    resetObstacles();
    addObstacle("rock", 0, 20, 0.8, 50, 1); // ~1.2 m tall
    expect(obstacleHeight({ kind: "rock", r: 0.8 })).toBeCloseTo(1.2, 6);
    expect(canSee(eye(0, 0), eye(0, 40), { ...flat, obstaclesNear: queryObstacles })).toBe(true);
    expect(canSee({ x: 0, y: 0.9, z: 0 }, { x: 0, y: 0.9, z: 40 }, { ...flat, obstaclesNear: queryObstacles })).toBe(false);
    resetObstacles();
  });
  test("a cover wall (solid box) blocks; stepping out from behind it clears the line", () => {
    const wall = { x: 0, y: 1, z: 10, w: 4, h: 2, d: 0.4 };
    const r = sightLine({ x: 0, y: 1.6, z: 0 }, { x: 0, y: 1.2, z: 30 }, { ...flat, solids: [wall] });
    expect(r.blocked && r.by).toBe("solid");
    if (r.blocked) expect(r.at.z).toBeCloseTo(9.8, 1);
    expect(canSee({ x: 5, y: 1.6, z: 0 }, { x: 5, y: 1.2, z: 30 }, { ...flat, solids: [wall] })).toBe(true);
  });
});

describe("enemy hit chance", () => {
  test("closer is likelier; a standing target in the open at mid range is near the old flat 25%", () => {
    expect(enemyHitChance(5, 40, 0)).toBeGreaterThan(enemyHitChance(35, 40, 0));
    expect(enemyHitChance(20, 40, 0)).toBeGreaterThan(0.22);
    expect(enemyHitChance(20, 40, 0)).toBeLessThan(0.3);
  });
  test("moving, crouched and prone targets are harder to hit", () => {
    const still = enemyHitChance(20, 40, 0);
    expect(enemyHitChance(20, 40, 30)).toBeLessThan(still * 0.8);
    expect(enemyHitChance(20, 40, 0, "CROUCH")).toBeLessThan(still);
    expect(enemyHitChance(20, 40, 0, "PRONE")).toBeLessThan(enemyHitChance(20, 40, 0, "CROUCH"));
  });
});

describe("enemies in the sim respect cover", () => {
  const PX = -240, PZ = -230;
  function setup(withWall: boolean) {
    const sim = createSim();
    for (const t of sim.trucks) t.alive = false;
    for (const o of sim.machines) o.alive = false;
    const m = sim.machines[0]!;
    const g = walkHeight(PX, PZ + 25);
    Object.assign(m, { alive: true, x: PX, z: PZ + 25, y: g + 2.2 * 0.95, hp: 1e6, maxHp: 1e6, rot: Math.PI, scale: 0.95, zone: "wastelands", cool: 0, elite: false, boss: false, profile: "Test Grunt", kind: "RAIDER", drop: "scrapMetal", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, mission: true, react: undefined }) as Machine;
    delete m.ai; delete m.los;
    if (withWall) setModelSolid("los-test-wall", { x: PX, y: walkHeight(PX, PZ + 6) + 1.5, z: PZ + 6, w: 30, h: 3, d: 0.5 }); else removeModelSolid("los-test-wall");
    return { sim, m };
  }
  const run = (withWall: boolean) => {
    // enemy fire rolls Math.random; a seeded stream keeps "some rounds land" from flaking on an unlucky streak
    const realRandom = Math.random; let seed = 12345; Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    try {
    const { sim, m } = setup(withWall);
    let fired = 0, hits = 0, blocked = 0;
    for (let f = 0; f < 60 * 40; f++) {
      m.x = PX; m.z = PZ + 25; m.kx = 0; m.kz = 0; sim.hp = 100; sim.weaponHeat = 0;
      stepSim(sim, { px: PX, pz: PZ, dt: 1 / 60, night: 0, inVehicle: false, yaw: 0, py: walkHeight(PX, PZ) + 1.7, pspeed: 0, stance: "STAND" });
      for (const s of sim.enemyShots.splice(0)) { fired++; if (s.hit) hits++; if (s.blockAt) blocked++; }
    }
    removeModelSolid("los-test-wall");
    return { fired, hits, blocked };
    } finally { Math.random = realRandom; }
  };
  test("in the open, a mission trooper fires and some rounds land", () => {
    const r = run(false);
    expect(r.fired).toBeGreaterThan(5);
    expect(r.hits).toBeGreaterThan(0);
    expect(r.blocked).toBe(0);
  });
  test("behind a wall, every round the trooper fires hits the wall, none hit the player", () => {
    const r = run(true);
    expect(r.fired).toBeGreaterThan(0);
    expect(r.hits).toBe(0);
    expect(r.blocked).toBe(r.fired);
  });
});

describe("enemies do not see through walls (hearing still works)", () => {
  const PX = -240, PZ = -230;
  const watch = (withWall: boolean, noisy: boolean) => {
    const sim = createSim();
    for (const t of sim.trucks) t.alive = false;
    for (const o of sim.machines) o.alive = false;
    const m = sim.machines[0]!;
    Object.assign(m, { alive: true, x: PX, z: PZ + 22, y: walkHeight(PX, PZ + 22) + 2.2 * 0.95, hp: 1e6, maxHp: 1e6, rot: Math.PI, scale: 0.95, zone: "wastelands", cool: 99, elite: false, boss: false, profile: "Test Grunt", kind: "RAIDER", drop: "scrapMetal", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, mission: false, react: undefined }) as Machine;
    delete m.ai; delete m.los;
    if (withWall) setModelSolid("los-test-wall-2", { x: PX, y: walkHeight(PX, PZ + 6) + 1.5, z: PZ + 6, w: 30, h: 3, d: 0.5 });
    for (let f = 0; f < 60 * 6; f++) {
      m.x = PX; m.z = PZ + 22; m.rot = Math.PI; sim.combatHeat = 0; sim.playerNoise = noisy ? 1 : 0;
      stepSim(sim, { px: PX, pz: PZ, dt: 1 / 60, night: 0, inVehicle: false, yaw: 0, py: walkHeight(PX, PZ) + 1.7 });
    }
    removeModelSolid("los-test-wall-2");
    return (m.ai as { state: string } | undefined)?.state;
  };
  test("a facing trooper spots a quiet player in the open", () => { expect(watch(false, false)).toBe("ALERT"); });
  test("the same trooper does not see a quiet player behind a wall", () => { expect(watch(true, false)).not.toBe("ALERT"); });
  test("gunfire behind the wall is still heard", () => { expect(["SUSPICIOUS", "ALERT", "SEARCH"]).toContain(watch(true, true)); });
});
