import { describe, expect, test } from "bun:test";
import { RACE_GATES, RACE_IDLE, RACE_START, RACE_TIME_LIMIT_S, raceReward, stepRace, NEON_DISTRICTS } from "./neon-districts";
import { clearDecks, districtDeckAt, registerDeck } from "./district-decks";

describe("Neon districts", () => {
  test("three named districts exist", () => {
    expect(NEON_DISTRICTS.map((d) => d.id)).toEqual(["aegis-spire", "the-grid", "rust-muck"]);
  });
  test("walkway deck ramps up from base to top", () => {
    clearDecks();
    registerDeck({ id: "t", x: 0, z: 0, dirX: 1, dirZ: 0, length: 40, width: 4, top: 6, base: 0, ramp: 10 });
    expect(districtDeckAt(0, 0)).toBe(6);
    expect(districtDeckAt(-15, 0)).toBeCloseTo(3);
    expect(districtDeckAt(0, 5)).toBe(-Infinity);
    clearDecks();
  });
});

describe("Rust-Muck race", () => {
  const run = () => {
    let s = stepRace(RACE_IDLE, RACE_START.dx, RACE_START.dz, 0).state;
    expect(s.phase).toBe("COUNTDOWN");
    s = stepRace(s, RACE_START.dx, RACE_START.dz, 3).state;
    expect(s.phase).toBe("RUNNING");
    return s;
  };
  test("gates must be cleared in order and finish reports time", () => {
    let s = run();
    // skipping ahead to gate 3 does nothing
    expect(stepRace(s, RACE_GATES[3]!.dx, RACE_GATES[3]!.dz, 4).event).toBeNull();
    let last = null;
    RACE_GATES.forEach((g, i) => { const r = stepRace(s, g.dx, g.dz, 4 + i); s = r.state; last = r.event; });
    expect(last).toEqual({ kind: "FINISH", time: 4 + RACE_GATES.length - 1 - 3 });
  });
  test("time limit abandons the race", () => {
    const s = run();
    expect(stepRace(s, 0, 0, 3 + RACE_TIME_LIMIT_S + 1).event).toEqual({ kind: "TIMEOUT" });
  });
  test("rewards: 500 first finish, 250 new best, 150 otherwise", () => {
    expect(raceReward(60, null)).toEqual({ credits: 500, newBest: true });
    expect(raceReward(50, 60)).toEqual({ credits: 250, newBest: true });
    expect(raceReward(70, 60)).toEqual({ credits: 150, newBest: false });
  });
});
