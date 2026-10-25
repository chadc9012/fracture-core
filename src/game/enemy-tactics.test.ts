import { describe, expect, spyOn, test } from "bun:test";
import { findFlankSpot, GRENADE, grenadeDamage, lobVelocity, stepGrenade, throwsGrenades, beepEvery, type Grenade } from "./enemy-tactics";
import { canSee } from "./line-of-sight";
import { createSim, stepSim, type Machine } from "./sim";
import { walkHeight } from "./terrain";
import { registeredModelSolids, removeModelSolid, setModelSolid } from "./environment-collision";
import { queryObstacles } from "./obstacles";

const flat = { ground: () => 0 };

describe("tactics rules", () => {
  test("a flank spot round a wall sees the player; with nowhere that sees them there is none", () => {
    const player = { x: 0, y: 1.6, z: 0 };
    const wall = { x: 0, y: 1.25, z: 3, w: 6, h: 2.5, d: 0.5 }; // between the player and a trooper at z=20
    const world = { ...flat, solids: [wall] };
    expect(canSee({ x: 0, y: 1.55, z: 20 }, { x: 0, y: 1.25, z: 0 }, world)).toBe(false);
    const spot = findFlankSpot(0, 20, player, 1, world)!;
    expect(spot).not.toBeNull();
    expect(canSee({ x: spot.x, y: 1.55, z: spot.z }, { x: 0, y: 1.25, z: 0 }, world)).toBe(true);
    // boxed in on every side: no spot
    const box = [wall, { ...wall, z: -3 }, { x: 3, y: 1.25, z: 0, w: 0.5, h: 2.5, d: 6 }, { x: -3, y: 1.25, z: 0, w: 0.5, h: 2.5, d: 6 }];
    expect(findFlankSpot(0, 20, player, 1, { ...flat, solids: box })).toBeNull();
  });
  test("a lob lands where it was aimed and arcs high enough to clear cover", () => {
    const from = { x: 0, y: 1.7, z: 0 }, to = { x: 0, y: 0, z: 20 };
    const v = lobVelocity(from, to);
    let x = from.x, y = from.y, z = from.z, vy = v.vy, apex = y;
    for (let t = 0; t < v.t - 1e-9; t += 0.001) { vy -= GRENADE.gravity * 0.001; x += v.vx * 0.001; y += vy * 0.001; z += v.vz * 0.001; apex = Math.max(apex, y); }
    expect(Math.hypot(x - to.x, z - to.z)).toBeLessThan(0.1);
    expect(Math.abs(y - to.y)).toBeLessThan(0.15);
    expect(apex).toBeGreaterThan(from.y + 3);
  });
  test("a grenade bounces, rolls to a stop and never sinks; its fuse beeps faster as it runs down", () => {
    const g: Grenade = { x: 0, y: 2, z: 0, vx: 4, vy: -6, vz: 0, fuse: GRENADE.fuse, id: 1, rest: false };
    for (let i = 0; i < 240 && !g.rest; i++) { stepGrenade(g, 1 / 60, () => 0); expect(g.y).toBeGreaterThanOrEqual(0.08 - 1e-9); }
    expect(g.rest).toBe(true);
    expect(beepEvery(2)).toBeGreaterThan(beepEvery(0.3));
  });
  test("blast damage falls off to the edge and cover soaks most of it", () => {
    expect(grenadeDamage(0, false)).toBe(GRENADE.damage);
    expect(grenadeDamage(GRENADE.radius / 2, false)).toBeCloseTo(GRENADE.damage / 2, 6);
    expect(grenadeDamage(GRENADE.radius, false)).toBe(0);
    expect(grenadeDamage(1, true)).toBeLessThan(grenadeDamage(1, false) * 0.5);
  });
  test("raiders and vanguard carry grenades; cyber troopers and creatures don't", () => {
    expect(throwsGrenades("RAIDER")).toBe(true);
    expect(throwsGrenades("VANGUARD")).toBe(true);
    expect(throwsGrenades("OVERCLOCKED")).toBe(false);
    expect(throwsGrenades("ABERRATION")).toBe(false);
  });
});

describe("a squad against a player hiding behind a wall", () => {
  const PX = -240, PZ = -230;
  // grenade aim and hit rolls use Math.random: seed it so these runs are repeatable
  const seeded = <T,>(seed: number, fn: () => T): T => {
    const real = Math.random; let x = seed >>> 0 || 1;
    Math.random = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
    try { return fn(); } finally { Math.random = real; }
  };
  // the sim's cooldowns (grenade, flank) read performance.now(): give it a clock that advances with the steps, not the wall
  function fight(kind: "RAIDER" | "OVERCLOCKED", seconds: number) {
    const spy = spyOn(performance, "now").mockImplementation(() => clock * 1000);
    try { return seeded(4242, () => fightUnseeded(kind, seconds)); } finally { spy.mockRestore(); }
  }
  let clock = 1000;
  function fightUnseeded(kind: "RAIDER" | "OVERCLOCKED", seconds: number) {
    const sim = createSim();
    for (const t of sim.trucks) t.alive = false;
    for (const o of sim.machines) o.alive = false;
    const troops = sim.machines.slice(0, 3);
    troops.forEach((m, k) => {
      const x = PX + (k - 1) * 3, z = PZ + 22;
      Object.assign(m, { alive: true, x, z, y: walkHeight(x, z) + 2.2 * 0.95, hp: 1e6, maxHp: 1e6, rot: Math.PI, scale: 0.95, zone: "wastelands", cool: 0, elite: false, boss: false, profile: "Test Grunt", kind, drop: "scrapMetal", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, mission: true, react: undefined }) as Machine;
      delete m.ai; delete m.los; m.hiddenFor = 0; m.flank = undefined; m.grenadeAt = 0;
    });
    // a long wall just in front of the player, between them and the squad
    setModelSolid("tactics-wall", { x: PX, y: walkHeight(PX, PZ + 3) + 1.4, z: PZ + 3, w: 14, h: 2.8, d: 0.6 });
    const world = { ground: walkHeight, obstaclesNear: queryObstacles, solids: registeredModelSolids() };
    const eye = { x: PX, y: walkHeight(PX, PZ) + 1.7, z: PZ };
    let thrown = 0, landedNear = 0, flankers = 0, sawPlayer = 0, hpLost = 0;
    const seen = new Set<number>();
    try {
      for (let f = 0; f < 60 * seconds; f++) {
        const hp0 = sim.hp;
        clock += 1 / 60;
        stepSim(sim, { px: PX, pz: PZ, dt: 1 / 60, night: 0, inVehicle: false, yaw: 0, py: eye.y, pspeed: 0, stance: "STAND" });
        hpLost += Math.max(0, hp0 - sim.hp); sim.hp = 100;
        for (const g of sim.grenades) { if (!seen.has(g.id)) { seen.add(g.id); thrown++; } if (g.rest && Math.hypot(g.x - PX, g.z - PZ) < 5) landedNear++; }
        for (const m of troops) { if (m.flank) flankers = Math.max(flankers, troops.filter((t) => t.flank).length); if (canSee({ x: m.x, y: walkHeight(m.x, m.z) + 1.55, z: m.z }, { x: PX, y: eye.y - 0.35, z: PZ }, world)) sawPlayer++; }
      }
    } finally { removeModelSolid("tactics-wall"); }
    return { thrown, landedNear, flankers, sawPlayer, hpLost };
  }
  test("raiders lob grenades over the wall and send flankers round it", () => {
    const r = fight("RAIDER", 20);
    expect(r.thrown).toBeGreaterThan(0);
    expect(r.thrown).toBeLessThanOrEqual(Math.ceil(20 / GRENADE.squadCooldown) + 1); // a flush, not a spam
    expect(r.landedNear).toBeGreaterThan(0);
    expect(r.flankers).toBeGreaterThan(0);
    expect(r.flankers).toBeLessThanOrEqual(2);
    expect(r.sawPlayer).toBeGreaterThan(0); // someone got round to a line
    expect(r.hpLost).toBeGreaterThan(0);
  });
  test("cyber troopers never throw (they still flank)", () => {
    const r = fight("OVERCLOCKED", 14);
    expect(r.thrown).toBe(0);
    expect(r.flankers).toBeGreaterThan(0);
  });
});
