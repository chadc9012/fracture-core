import { describe, expect, test } from "bun:test";
import { DIVE, diveBones, diveDirection, fleeDirection, reactsInTime, REACT_MIN, roundThreat } from "./enemy-evasion";
import { createSim, fireLauncher, stepSim, type Machine } from "./sim";
import { walkHeight } from "./terrain";

const flat = () => 0;
const rocket = (x: number, z: number, dx: number, dz: number, dy = 0) => {
  const l = Math.hypot(dx, dy, dz);
  return { x, y: 1.5, z, dx: dx / l, dy: dy / l, dz: dz / l, age: 0, def: { speed: 75, splashRadius: 7, proximity: 1.6, life: 4 } };
};

describe("reading an incoming round", () => {
  test("a rocket aimed at a trooper bursts beside it, soon; one aimed well away is no threat", () => {
    const th = roundThreat(rocket(0, 0, 0, 1), 0, 30, flat)!;
    expect(th).not.toBeNull();
    expect(Math.hypot(th.x, th.z - 30)).toBeLessThan(4);
    expect(th.t).toBeCloseTo(28.5 / 75, 1);
    expect(roundThreat(rocket(0, 0, 1, 0), 0, 30, flat)).toBeNull();
  });
  test("a rocket fired into the ground at its feet is a threat too (ground burst inside the splash)", () => {
    const th = roundThreat(rocket(0, 0, 0, 1, -0.06), 2, 26, flat)!;
    expect(th).not.toBeNull();
    expect(Math.hypot(th.x - 2, th.z - 26)).toBeLessThan(7.75);
  });
  test("dive away from the burst; sideways off the line when it lands on top of the body", () => {
    const d = diveDirection(5, 0, { x: 0, z: 0 }, 0, 1, 1);
    expect(d.x).toBeCloseTo(1, 6);
    const s = diveDirection(0, 10, { x: 0, z: 10 }, 0, 1, 1);
    expect(Math.abs(s.x)).toBeCloseTo(1, 6);
    expect(Math.abs(s.z)).toBeLessThan(1e-9);
  });
  test("no dodging a round already on top of you; elites read it better", () => {
    expect(reactsInTime(REACT_MIN * 0.9, true, 0)).toBe(false);
    expect(reactsInTime(1, false, 0.6)).toBe(false);
    expect(reactsInTime(1, true, 0.6)).toBe(true);
  });
  test("the dive pose eases in and out; out of a strike circle is straight out from its centre", () => {
    expect(diveBones(0).dip).toBeCloseTo(0, 6);
    expect(diveBones(0.5).dip).toBeCloseTo(1, 6);
    expect(diveBones(1).dip).toBeCloseTo(0, 6);
    expect(fleeDirection(3, 0, 0, 0, 0.2).x).toBeCloseTo(1, 6);
  });
});

describe("in the sim", () => {
  const PX = -240, PZ = -230;
  // the reaction rolls use Math.random: seed it so these runs are repeatable
  const seeded = <T,>(seed: number, fn: () => T): T => {
    const real = Math.random; let x = seed >>> 0 || 1;
    Math.random = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
    try { return fn(); } finally { Math.random = real; }
  };
  function arena(kind: "RAIDER" | "VANGUARD" = "RAIDER", n = 1, at = 30) {
    const sim = createSim();
    for (const t of sim.trucks) t.alive = false;
    for (const o of sim.machines) o.alive = false;
    const ms = sim.machines.slice(0, n);
    ms.forEach((m, k) => {
      const x = PX + (k - (n - 1) / 2) * 2.5, z = PZ + at;
      Object.assign(m, { alive: true, x, z, y: walkHeight(x, z) + 2.2 * 0.95, hp: 1e6, maxHp: 1e6, rot: Math.PI, scale: 0.95, zone: "wastelands", cool: 99, elite: false, boss: false, profile: "Test Grunt", kind, drop: "scrapMetal", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, mission: true, react: undefined }) as Machine;
      delete m.ai; delete m.los; m.evade = undefined; m.evadeCool = 0;
    });
    return { sim, ms };
  }
  const step = (sim: ReturnType<typeof createSim>, frames: number) => { for (let f = 0; f < frames; f++) { sim.hp = 100; stepSim(sim, { px: PX, pz: PZ, dt: 1 / 60, night: 0, inVehicle: false, yaw: 0, py: walkHeight(PX, PZ) + 1.7, pspeed: 0, stance: "STAND" }); } };
  test("troopers dive out of rockets fired from range, often enough to matter but not always", () => seeded(12345, () => {
    let dived = 0, trials = 30, hurtWhenDived = 0, hurtWhenNot = 0, notDived = 0;
    for (let k = 0; k < trials; k++) {
      const { sim, ms } = arena("RAIDER", 1, 45);
      const m = ms[0]!;
      step(sim, 30); // settle and notice the player
      const hp0 = m.hp;
      const g = walkHeight(PX, PZ) + 1.5, ty = walkHeight(m.x, m.z) + 1.2;
      fireLauncher(sim, "ROCKET", PX, g, PZ, Math.atan2(m.x - PX, m.z - PZ), Math.atan2(ty - g, Math.hypot(m.x - PX, m.z - PZ)), 10);
      step(sim, 60);
      const lost = hp0 - m.hp;
      if (m.evade?.dive) { dived++; hurtWhenDived += lost; } else { notDived++; hurtWhenNot += lost; }
    }
    expect(dived).toBeGreaterThan(trials * 0.25);
    expect(dived).toBeLessThan(trials * 0.8);
    expect(hurtWhenDived / Math.max(1, dived)).toBeLessThan(hurtWhenNot / Math.max(1, notDived)); // the dive actually helps
  }));
  test("a rocket from point blank can't be dodged", () => {
    let dived = 0;
    for (let k = 0; k < 15; k++) {
      const { sim, ms } = arena("RAIDER", 1, 9);
      const m = ms[0]!;
      step(sim, 30);
      const g = walkHeight(PX, PZ) + 1.5, ty = walkHeight(m.x, m.z) + 1.2;
      fireLauncher(sim, "ROCKET", PX, g, PZ, Math.atan2(m.x - PX, m.z - PZ), Math.atan2(ty - g, Math.hypot(m.x - PX, m.z - PZ)), 10);
      step(sim, 40);
      if (m.evade?.dive) dived++;
    }
    expect(dived).toBe(0);
  });
  test("some alert troopers run out of an orbital strike circle before it lands", () => seeded(777, () => {
    const { sim, ms } = arena("VANGUARD", 6, 22);
    step(sim, 30);
    const cx = PX, cz = PZ + 22;
    const b = sim.beacons[0]!;
    Object.assign(b, { alive: true, kind: "ORBITAL_STRIKE", state: "ARMED", x: cx, y: walkHeight(cx, cz), z: cz, vx: 0, vy: 0, vz: 0, timer: 3, radius: 9 });
    step(sim, 60 * 2.5);
    // count who ran (an obstacle left by another test can stop a runner short of the edge, so judge the decision, not the position)
    const out = ms.filter((m) => m.evade && !m.evade.dive).length;
    expect(out).toBeGreaterThan(0);
    expect(out).toBeLessThan(6);
    expect(DIVE.seconds).toBeLessThan(1);
  }));
});
