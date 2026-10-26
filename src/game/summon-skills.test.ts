// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { createSim, stepSim, summonScenarioBoss, type Machine } from "./sim";
import { isSummoned } from "./encounter-sim";
import { scenarioById } from "./unique-scenarios";
import { ARCANIST_ORB, MAX_TURRETS, REAVER_STRIKE, TURRET, TURRET_LIFE, skillOf } from "./summon-skills";

let clock = 1000;
let spy: { mockRestore: () => void };
beforeEach(() => { clock = 1000; spy = spyOn(performance, "now").mockImplementation(() => clock * 1000); });
afterEach(() => spy.mockRestore());

const BX = 3000, BZ = 3000;
function arena() {
  const sim = createSim();
  for (const m of sim.machines) m.alive = false;
  expect(summonScenarioBoss(sim, scenarioById("astravore")!, BX, BZ)).toBe(true);
  const boss = sim.machines.find((m) => m.alive && m.boss)!;
  const p = { x: BX + 45, z: BZ };
  let lowest = 100;
  const tick = () => {
    clock += 0.05;
    sim.hp = 100;
    stepSim(sim, { px: p.x, pz: p.z, dt: 0.05, night: 0.5, inVehicle: false });
    lowest = Math.min(lowest, sim.hp);
    boss.x = BX; boss.z = BZ; boss.kx = 0; boss.kz = 0; boss.cool = 99; boss.hp = boss.maxHp!;
    return sim.hp;
  };
  const run = (secs: number, until?: () => boolean) => { for (let i = 0; i < Math.round(secs / 0.05); i++) { tick(); if (until?.()) return true; } return !until; };
  const spawn = (profile: string, x: number, z: number, scale = 1): Machine => {
    const m = sim.machines.find((s) => !s.alive)!;
    Object.assign(m, { alive: true, x, z, y: 0, hp: 50, maxHp: 50, rot: 0, scale, zone: boss.zone, cool: 5, elite: false, boss: false, mission: false, profile, kind: "OVERCLOCKED", drop: "dataShards", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, aim: 0, summoned: true });
    delete m.scenarioId; delete m.decoy;
    return m;
  };
  tick();
  return { sim, boss, p, tick, run, spawn, lowest: () => lowest, resetLowest: () => { lowest = 100; } };
}

describe("Void Reaver flank-and-strike", () => {
  it("telegraphs a point behind the player, then lands there and hurts a player who stayed", () => {
    const a = arena();
    const r = a.spawn("Void Reaver", a.p.x - 10, a.p.z);
    expect(a.run(6, () => skillOf(r)?.st === "TELL")).toBe(true);
    const s = skillOf(r)!;
    expect(s.tx).toBeGreaterThan(a.p.x); // the far side of the player from the Reaver
    a.resetLowest();
    a.run(1.2);
    expect(a.lowest()).toBeLessThan(100);
    expect(Math.hypot(r.x - s.tx, r.z - s.tz)).toBeLessThan(2);
  });
  it("a player who steps out of the circle during the wind-up takes nothing", () => {
    const a = arena();
    const r = a.spawn("Void Reaver", a.p.x - 10, a.p.z);
    a.run(6, () => skillOf(r)?.st === "TELL");
    a.p.z += REAVER_STRIKE.radius + 6;
    a.resetLowest();
    a.run(1.2, () => skillOf(r)?.st === "IDLE");
    expect(a.lowest()).toBe(100);
  });
});

describe("Void Arcanist area orb", () => {
  it("lands on where the player stood, hurts, and leaves a slowing pool", () => {
    const a = arena();
    const m = a.spawn("Void Arcanist", a.p.x - 20, a.p.z);
    expect(a.run(6, () => skillOf(m)?.st === "TELL")).toBe(true);
    a.resetLowest();
    a.run(ARCANIST_ORB.windup + 0.3);
    expect(a.lowest()).toBeLessThan(100);
    expect(a.sim.encounterZones.some((z) => z.name === "Void Orb pool" && z.kind === "SLOW")).toBe(true);
  });
  it("moving away from the marked spot avoids the orb", () => {
    const a = arena();
    const m = a.spawn("Void Arcanist", a.p.x - 20, a.p.z);
    a.run(6, () => skillOf(m)?.st === "TELL");
    a.p.z += ARCANIST_ORB.radius + 6;
    a.resetLowest();
    a.run(ARCANIST_ORB.windup + 0.3);
    expect(a.lowest()).toBe(100);
  });
});

describe("Void Sentinel turrets", () => {
  it("deploys real, shootable, stationary turrets up to the cap, which expire", () => {
    const a = arena();
    const sen = a.spawn("Void Sentinel", a.p.x - 25, a.p.z, 2.6);
    sen.x = a.p.x - 25; sen.z = a.p.z;
    expect(a.run(8, () => a.sim.machines.some((m) => m.alive && m.profile === TURRET))).toBe(true);
    const t = a.sim.machines.find((m) => m.alive && m.profile === TURRET)!;
    expect(isSummoned(t)).toBe(true);
    expect(t.hp).toBeGreaterThan(0);
    const x = t.x, z = t.z;
    a.run(60 / 2, () => false);
    expect(a.sim.machines.filter((m) => m.alive && m.profile === TURRET).length).toBeLessThanOrEqual(MAX_TURRETS);
    if (t.alive) { expect(t.x).toBe(x); expect(t.z).toBe(z); }
    sen.alive = false;
    a.run(TURRET_LIFE + 2);
    expect(a.sim.machines.filter((m) => m.alive && m.profile === TURRET).length).toBe(0);
  });
  it("skill state never leaks into a recycled slot", () => {
    const a = arena();
    const r = a.spawn("Void Reaver", a.p.x - 10, a.p.z);
    a.run(6, () => skillOf(r)?.st === "TELL");
    r.alive = false; a.tick();
    expect(skillOf(r)).toBeUndefined();
  });
});
