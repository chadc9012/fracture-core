import { describe, expect, test } from "bun:test";
import { createSim, defeatMachine } from "./sim";
import { ARENA_RADIUS, CRUCIBLE_MODES, RIVAL_RESPAWN_S, clearRivals, newCrucible, rivalLineup, stepRivals } from "./crucible";
import { activityById, activityState, newRun, periodKey, stepRun, type Tick } from "./activities";

const center = { x: 100, z: -40 };
const rivals = (sim: ReturnType<typeof createSim>) => sim.machines.filter((m) => m.alive && m.rival);
const tick = (over: Partial<Tick> = {}): Tick => ({ x: 0, z: 0, dt: 0.1, now: Date.now(), kills: 0, elites: 0, bosses: 0, hp: 100, deaths: 0, rivalKills: 0, ...over });

describe("Crucible lineup and rivals", () => {
  test("a duel never fields your own operator; a skirmish fields all three", () => {
    expect(rivalLineup("duel", "TITAN")).toEqual(["HUNTER"]);
    expect(rivalLineup("duel", "HUNTER")[0]).not.toBe("HUNTER");
    expect(rivalLineup("skirmish", "WARLOCK").sort()).toEqual(["HUNTER", "TITAN", "WARLOCK"]);
  });
  test("rivals spawn at the arena edge, keep the lineup full, and respawn after the delay", () => {
    const sim = createSim();
    for (const m of sim.machines) m.alive = false;
    const st = newCrucible("skirmish");
    stepRivals(sim, st, center, "TITAN", 0.1, () => 0.5);
    expect(rivals(sim).length).toBe(3);
    for (const m of rivals(sim)) expect(Math.hypot(m.x - center.x, m.z - center.z)).toBeCloseTo(ARENA_RADIUS * 0.8, 3);
    stepRivals(sim, st, center, "TITAN", 0.1);
    expect(rivals(sim).length).toBe(3); // no duplicates while they are alive
    const victim = rivals(sim)[0]!;
    victim.hp = 0; defeatMachine(sim, victim, "player");
    expect(sim.rivalKills).toBe(1);
    expect(victim.rival).toBeUndefined();
    stepRivals(sim, st, center, "TITAN", RIVAL_RESPAWN_S / 2);
    expect(rivals(sim).length).toBe(2);
    stepRivals(sim, st, center, "TITAN", RIVAL_RESPAWN_S);
    expect(rivals(sim).length).toBe(3);
  });
  test("rival kills pay no loot or generic kill credit; clearing the match removes them without score", () => {
    const sim = createSim();
    for (const m of sim.machines) m.alive = false;
    const st = newCrucible("duel");
    stepRivals(sim, st, center, "TITAN", 0.1);
    const before = { kills: sim.kills, drops: sim.drops.length };
    const r = rivals(sim)[0]!; r.hp = 0; defeatMachine(sim, r, "player");
    expect(sim.kills).toBe(before.kills);
    expect(sim.drops.length).toBe(before.drops);
    stepRivals(sim, st, center, "TITAN", RIVAL_RESPAWN_S + 0.1);
    expect(clearRivals(sim)).toBe(1);
    expect(rivals(sim).length).toBe(0);
    expect(sim.rivalKills).toBe(1);
  });
});

describe("Crucible as an activity", () => {
  for (const id of ["crucible-duel", "crucible-skirmish"]) {
    test(`${id}: reaching the target wins, the rivals reaching it first loses`, () => {
      const def = activityById(id)!;
      const target = CRUCIBLE_MODES[id === "crucible-duel" ? "duel" : "skirmish"].target;
      const win = newRun(def, 0);
      stepRun(def, win, tick({ rivalKills: 7 }));
      stepRun(def, win, tick({ rivalKills: 7 + target - 1 }));
      expect(win.status).toBe("active");
      expect(win.progress).toBe(target - 1);
      stepRun(def, win, tick({ rivalKills: 7 + target }));
      expect(win.status).toBe("complete");
      const lose = newRun(def, 0);
      stepRun(def, lose, tick({ deaths: 2 }));
      stepRun(def, lose, tick({ deaths: 2 + target, rivalKills: 1 }));
      expect(lose.status).toBe("failed");
      expect(lose.theirScore).toBe(target);
    });
  }
});

describe("PvP match limits", () => {
  test("matches are unlimited: still available after fifty plays today", () => {
    const now = Date.UTC(2026, 9, 18, 12);
    for (const id of ["crucible-duel", "crucible-skirmish"]) {
      const def = activityById(id)!;
      const p = { earnedRewards: [], missionRuns: { [`act:${id}`]: { day: periodKey(def, now), count: 50, last: now - 1000 } } };
      const st = activityState(p, def, now);
      expect(st.available).toBe(true);
      expect(Number.isFinite(st.attemptsLeft)).toBe(false);
    }
  });
});
