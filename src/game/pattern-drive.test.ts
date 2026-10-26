// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { createSim, stepSim, type Machine } from "./sim";
import { MOVES } from "./enemy-patterns";

let clock = 1000;
let spy: { mockRestore: () => void };
beforeEach(() => { clock = 1000; spy = spyOn(performance, "now").mockImplementation(() => clock * 1000); });
afterEach(() => spy.mockRestore());

const P = { x: 3000, z: 3000 };
function world(kind: string, offsetX: number, index = 0) {
  const sim = createSim();
  for (const m of sim.machines) m.alive = false;
  const m: Machine = sim.machines[index]!;
  Object.assign(m, { alive: true, x: P.x + offsetX, z: P.z, y: 0, hp: 50, maxHp: 50, rot: 0, scale: 1, zone: "wilds", cool: 5, elite: false, boss: false, mission: false, profile: "Test Unit", kind, drop: "dataShards", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, aim: 0 });
  delete m.scenarioId; delete m.decoy; delete m.summoned;
  let lowest = 100, tells = 0;
  const pl = { ...P };
  const tick = () => {
    clock += 0.05;
    sim.hp = 34; // under 35 the machines are always alert within 40 m
    stepSim(sim, { px: pl.x, pz: pl.z, dt: 0.05, night: 0.5, inVehicle: false });
    lowest = Math.min(lowest, sim.hp);
    if (m.patternTell) tells++;
  };
  const run = (secs: number, until?: () => boolean) => { for (let i = 0; i < Math.round(secs / 0.05); i++) { tick(); if (until?.()) return true; } return false; };
  return { sim, m, pl, run, lowest: () => lowest, tells: () => tells, reset: () => { lowest = 100; } };
}

describe("patterns running in the real sim", () => {
  it("a Charger shows a lane tell, charges, hurts a player who stays in the lane, then is exposed to extra damage", () => {
    const w = world("ABERRATION", 22);
    expect(w.run(20, () => w.m.patternTell?.kind === "LANE")).toBe(true);
    w.reset();
    const exposed = w.run(8, () => w.m.vulnUntil > clock && w.m.vulnMult === MOVES.charge.exposeMult);
    expect(w.lowest()).toBeLessThan(34);
    expect(exposed).toBe(true);
  });
  it("a Charger misses a player who sidesteps once the lane is locked", () => {
    const w = world("ABERRATION", 22);
    w.run(20, () => w.m.patternTell?.kind === "LANE");
    w.pl.z += 9; // out of the lane
    w.reset();
    w.run(5, () => w.m.vulnUntil > clock);
    expect(w.lowest()).toBeGreaterThanOrEqual(34);
  });
  it("a machine whose kind has no pattern is untouched by the layer", () => {
    const w = world("MYSTERY", 20);
    w.run(2);
    expect(w.m.patternTell).toBeUndefined();
  });
  it("bosses, mission units and summons never get patterns", () => {
    for (const flag of ["boss", "mission", "summoned"] as const) {
      const w = world("ABERRATION", 22);
      (w.m as unknown as Record<string, unknown>)[flag] = true;
      w.run(8);
      expect(w.tells()).toBe(0);
    }
  });
  it("an Artillery shell lands on where the player stood, not where they went", () => {
    const w = world("RAIDER", 36, 1);
    w.m.elite = true; // index 1 + elite RAIDER = ARTILLERY
    w.run(15, () => w.m.patternTell?.kind === "RING");
    expect(w.m.patternTell?.kind).toBe("RING");
    w.pl.z += 14;
    w.reset();
    w.run(3);
    expect(w.lowest()).toBeGreaterThanOrEqual(34);
  });
});
