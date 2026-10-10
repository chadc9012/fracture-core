// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { applyLightning, applyMachineDamageMods, createSim, defeatMachine, envCredit, PLAYER_CREDIT_WINDOW_S, stepSim, type Machine, type WorldSim } from "./sim";

/** Regression: standing still in a safe zone used to level the player up, because the safe-zone turrets and stability field "killed"
 * machines through the same path as the player's own kills (XP, credits, drops, kill count). */
let clock = 2000;
let spy: { mockRestore: () => void };
beforeEach(() => { clock = 2000; spy = spyOn(performance, "now").mockImplementation(() => clock * 1000); });
afterEach(() => spy.mockRestore());

const empty = () => { const sim = createSim(); for (const m of sim.machines) m.alive = false; return sim; };
function place(sim: WorldSim, x: number, z: number, hp: number, over: Partial<Machine> = {}): Machine {
  const m = sim.machines[0]!;
  Object.assign(m, { alive: true, x, z, hp, rot: 0, scale: 1, cool: 0, elite: false, boss: false, profile: "Test Drone", ...over });
  return m;
}
const totals = (sim: WorldSim) => ({ kills: sim.kills, credits: sim.credits, xp: sim.xpEvents.length, drops: sim.drops.length });

describe("who gets the kill", () => {
  it("a player kill pays kill count, credits, XP and a drop", () => {
    const sim = empty(); const m = place(sim, 3000, 3000, 0);
    defeatMachine(sim, m);
    expect(m.alive).toBe(false);
    expect(totals(sim)).toMatchObject({ kills: 1, xp: 1, drops: 1 });
    expect(sim.credits).toBeGreaterThan(0);
  });
  it("a world (ambient) kill removes the machine and pays nothing", () => {
    const sim = empty(); const m = place(sim, 3000, 3000, 0);
    defeatMachine(sim, m, "world");
    expect(m.alive).toBe(false);
    expect(totals(sim)).toEqual({ kills: 0, credits: 0, xp: 0, drops: 0 });
    expect(Object.keys(sim.materials).length).toBe(0);
  });
  it("a boss is never an ambient kill: it still pays through the normal path", () => {
    const sim = empty(); const m = place(sim, 3000, 3000, 0, { boss: true });
    defeatMachine(sim, m, "world");
    expect(sim.kills).toBe(1);
  });
  it("a safe-zone perimeter turret killing an ambusher awards no XP, credits, drops or kills", () => {
    const sim = empty();
    const tur = sim.turrets[0]!;
    place(sim, tur.x + 4, tur.z, 0.5);
    for (let i = 0; i < 20 && sim.machines[0]!.alive; i++) { clock += 1; stepSim(sim, { px: tur.x + 900, pz: tur.z + 900, dt: 1, night: 0.5, inVehicle: false }); }
    expect(sim.machines[0]!.alive).toBe(false);
    expect(totals(sim)).toEqual({ kills: 0, credits: 0, xp: 0, drops: 0 });
  });
});

describe("environmental deaths (collision, lightning, burn) are nobody's kill unless the player just hurt the machine", () => {
  it("envCredit is world for an untouched machine and player right after the player damages it", () => {
    const sim = empty(); const m = place(sim, 3000, 3000, 1);
    expect(envCredit(m)).toBe("world");
    m.lastPlayerDamage = clock - 2;
    expect(envCredit(m)).toBe("player");
    m.lastPlayerDamage = clock - (PLAYER_CREDIT_WINDOW_S + 1);
    expect(envCredit(m)).toBe("world");
  });
  it("a mission machine always pays, so scripted missions never stall", () => {
    const sim = empty(); const m = place(sim, 3000, 3000, 1, { mission: true });
    expect(envCredit(m)).toBe("player");
  });
  it("a machine that dies from lightning with no player involvement pays no XP, credits or drops", () => {
    const sim = empty(); const m = place(sim, 3000, 3000, 1);
    applyLightning(sim, { x: 3000, z: 3000, radius: 10 } as never, 0, 0);
    expect(m.alive).toBe(false);
    expect(totals(sim)).toEqual({ kills: 0, credits: 0, xp: 0, drops: 0 });
  });
  it("the same lightning kill still pays when the player had just shot the machine", () => {
    const sim = empty(); const m = place(sim, 3000, 3000, 1);
    m.lastPlayerDamage = clock - 1;
    applyLightning(sim, { x: 3000, z: 3000, radius: 10 } as never, 0, 0);
    expect(m.alive).toBe(false);
    expect(totals(sim)).toMatchObject({ kills: 1, xp: 1 });
  });
  it("a machine that dies by colliding with the world while the player stands still pays nothing", () => {
    const sim = empty(); const m = place(sim, 3000, 3000, 0);
    // the catch-all in stepSim: hp <= 0 after environment damage, with no recorded player damage
    for (let i = 0; i < 3 && m.alive; i++) { clock += 1; stepSim(sim, { px: 3040, pz: 3000, dt: 1, night: 0.5, inVehicle: false }); }
    expect(m.alive).toBe(false);
    expect(totals(sim)).toEqual({ kills: 0, credits: 0, xp: 0, drops: 0 });
  });
  it("player damage through applyMachineDamageMods marks the machine", () => {
    const sim = empty(); const m = place(sim, 3000, 3000, 5);
    expect(m.lastPlayerDamage).toBeUndefined();
    applyMachineDamageMods(sim, m, 1, "KINETIC", 0, 0);
    expect(m.lastPlayerDamage).toBe(clock);
  });
});
