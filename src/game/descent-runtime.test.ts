// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { createSim, defeatMachine, stepSim } from "./sim";
import { activeDescent, gatesForDay, liveDescentGroundAt, type FractureGate } from "./fracture-gates";
import { bossExit, createDescentRuntime, descentDeath, drainEndedRuns, stepDescentRuntime, thresholdExit, type DescentEmit } from "./descent-runtime";
import { tierPlan } from "./descent-run";

const NOW = Date.UTC(2026, 9, 21, 12);
const quiet = () => { const sim = createSim(); for (const m of sim.machines) m.alive = false; return sim; };

/** drive a whole descent the way Scene does: walk into the gate, take each teleport, stand on each floor, kill each wave,
 * fall through each drop, kill the boss, take the exit */
function play(gate: FractureGate) {
  const sim = quiet();
  const rt = createDescentRuntime();
  const emits: DescentEmit[] = [];
  const pos = { x: gate.x + 12, y: gate.y + 1.6, z: gate.z };
  const step = (now = NOW) => {
    const r = stepDescentRuntime(rt, sim, { now, px: pos.x, py: pos.y, pz: pos.z, inVehicle: false, blocked: false, earnedRewards: [], gates: () => [gate] });
    emits.push(...r.emits, ...drainEndedRuns().map((run) => ({ type: "END" as const, run })));
    if (r.teleport) { pos.x = r.teleport.x; pos.y = r.teleport.y; pos.z = r.teleport.z; }
    return r;
  };
  const killAll = () => { for (const m of sim.machines) if (m.alive && m.living?.startsWith("rift:")) { m.hp = 0; defeatMachine(sim, m, "player"); } };
  return { sim, rt, emits, pos, step, killAll };
}

describe("Fracture Gate descent against the real sim", () => {
  const gate: FractureGate = { ...gatesForDay(NOW).find((g) => g.dungeonId === "rootbound-labyrinth")!, shownRank: "C", trueRank: "C" };

  it("walks in, descends floor by floor, kills the boss and comes back out cleared", () => {
    const g = play(gate);
    g.step();
    expect(g.rt.run).toBeNull(); // not at the gate yet
    g.pos.x = gate.x; g.pos.z = gate.z;
    const enter = g.step();
    expect(enter.teleport).not.toBeNull();
    const run0 = g.rt.run!;
    expect(activeDescent()).not.toBeNull();
    const layout = run0.layout;
    expect(g.pos.y).toBeCloseTo(layout.tiers[0]!.floorY + 1.6, 5);
    expect(liveDescentGroundAt(g.pos.x, g.pos.z, g.pos.y - 1.6)).toBe(layout.tiers[0]!.floorY);

    for (const tier of layout.tiers) {
      // stand on the floor: waves come, get killed, until the tier is done
      g.pos.x = tier.landing.x; g.pos.z = tier.landing.z; g.pos.y = tier.floorY + 1.6;
      const plan = tierPlan(tier, "C");
      for (let w = 0; w < plan.waves.length + 1; w++) {
        g.step();
        const troops = g.sim.machines.filter((m) => m.alive && m.living?.startsWith("rift:"));
        if (troops.length) {
          for (const m of troops) expect(Math.abs(m.y - 2.2 * m.scale - tier.floorY)).toBeLessThan(0.01);
          // they stay up on the floor through a sim step (not dropped to the terrain far below)
          stepSim(g.sim, { dt: 0.05, px: g.pos.x, pz: g.pos.z, py: g.pos.y, night: 0, inVehicle: false });
          for (const m of g.sim.machines.filter((x) => x.alive && x.living?.startsWith("rift:"))) expect(m.y - 2.2 * m.scale).toBeGreaterThan(tier.floorY - 3.5);
        }
        g.killAll();
      }
      g.step();
      if (tier.kind === "BOSS") break;
      // the drop is open: fall through it onto the next floor
      expect(liveDescentGroundAt(tier.drop!.x, tier.drop!.z, tier.floorY)).toBeLessThan(tier.floorY);
    }
    const run = g.rt.run!;
    expect(run.bossDown).toBe(true);
    expect(run.status).toBe("ACTIVE");
    const exit = bossExit(run);
    g.pos.x = exit.x; g.pos.z = exit.z;
    const out = g.step();
    expect(out.teleport).not.toBeNull();
    expect(g.rt.run).toBeNull();
    expect(activeDescent()).toBeNull();
    const end = g.emits.find((e) => e.type === "END")!;
    expect(end.run.status).toBe("CLEARED");
    expect(g.emits.filter((e) => e.type === "TIER_LOOT").length).toBe(layout.tiers.filter((t) => t.kind === "ENCOUNTER" || t.kind === "GATEKEEPER").length);
    expect(Math.hypot(g.pos.x - gate.x, g.pos.z - gate.z)).toBeGreaterThan(3); // back outside the gate's trigger
  });

  it("a gated tier keeps its drop shut until its waves are dead", () => {
    const g = play(gate);
    g.pos.x = gate.x; g.pos.z = gate.z; g.step();
    const layout = g.rt.run!.layout;
    const enc = layout.tiers.find((t) => t.kind === "ENCOUNTER")!;
    // jump straight to the encounter floor (as if every drop above was taken)
    g.pos.x = enc.landing.x; g.pos.z = enc.landing.z; g.pos.y = enc.floorY + 1.6;
    g.step();
    expect(g.sim.machines.some((m) => m.alive && m.living === `rift:${enc.index}`)).toBe(true);
    expect(liveDescentGroundAt(enc.drop!.x, enc.drop!.z, enc.floorY)).toBe(enc.floorY);
  });

  it("dying spends a life and puts you back on your tier; the last life sends you out", () => {
    const g = play(gate);
    g.pos.x = gate.x; g.pos.z = gate.z; g.step();
    const t0 = g.rt.run!.layout.tiers[0]!;
    const first = descentDeath(g.rt, g.sim)!;
    expect(first.respawn.y).toBeCloseTo(t0.floorY + 1.6, 5);
    expect(g.rt.run!.lives).toBe(2);
    descentDeath(g.rt, g.sim);
    const last = descentDeath(g.rt, g.sim)!;
    expect(g.rt.run).toBeNull();
    expect(Math.hypot(last.respawn.x - gate.x, last.respawn.z - gate.z)).toBeLessThan(15);
    expect(drainEndedRuns()[0]!.status).toBe("FAILED");
  });

  it("an unsealed gate can be walked back out of from the threshold; a sealed one cannot", () => {
    const g = play(gate);
    g.pos.x = gate.x; g.pos.z = gate.z; g.step();
    const te = thresholdExit(g.rt.run!);
    g.step(); // standing on the landing re-arms the exit
    g.pos.x = te.x; g.pos.z = te.z;
    g.step();
    expect(g.rt.run).toBeNull();
    expect(g.emits.find((e) => e.type === "END")!.run.status).toBe("LEFT");

    const sealedGate: FractureGate = { ...gatesForDay(NOW).find((x) => x.dungeonId === "crucible-fallen")!, shownRank: "A", trueRank: "A" };
    const s = play(sealedGate);
    s.pos.x = sealedGate.x; s.pos.z = sealedGate.z; s.step();
    const te2 = thresholdExit(s.rt.run!);
    s.step();
    s.pos.x = te2.x; s.pos.z = te2.z;
    s.step();
    expect(s.rt.run).not.toBeNull();
  });
});
