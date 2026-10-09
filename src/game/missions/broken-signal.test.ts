// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { advanceMission, BROKEN_SIGNAL } from "./broken-signal";

describe("Mission 01 — Broken Signal end-to-end state progression", () => {
  test("cannot skip required steps with out-of-order events", () => {
    const unchanged = advanceMission(BROKEN_SIGNAL, { type: "CLEAR" });
    expect(unchanged.state).toBe("IDLE");
  });

  test("reaches the signal trace only after both combat waves and the node route", () => {
    let run = advanceMission(BROKEN_SIGNAL, { type: "START" });
    expect(run.state).toBe("TRIGGERED");
    run = advanceMission(run, { type: "ANCHOR", x: 12, z: 24 });
    expect(run.state).toBe("DISCOVERY");
    run = advanceMission(run, { type: "ARRIVED" });
    expect(run.state).toBe("TRAVERSAL");
    run = advanceMission(run, { type: "ARRIVED" });
    expect(run.state).toBe("COMBAT_1");
    run = advanceMission(run, { type: "CLEAR" });
    expect(run.state).toBe("HACKING");
    run = advanceMission(run, { type: "HACK", progress: 50 });
    expect(run.state).toBe("COMBAT_2");
    run = advanceMission(run, { type: "CLEAR" });
    expect(run.state).toBe("HACKING");
    expect(run.wave2Done).toBe(true);
    run = advanceMission(run, { type: "HACK", progress: 100 });
    expect(run.state).toBe("COMPLETE");
    run = advanceMission(run, { type: "ACK" });
    expect(run.state).toBe("WORLD_UPDATE");
  });

  test("does not complete the node route before the escalation wave is cleared", () => {
    let run = advanceMission(BROKEN_SIGNAL, { type: "START" });
    run = advanceMission(run, { type: "ANCHOR", x: 0, z: 0 });
    run = advanceMission(run, { type: "ARRIVED" });
    run = advanceMission(run, { type: "ARRIVED" });
    run = advanceMission(run, { type: "CLEAR" });
    run = advanceMission(run, { type: "HACK", progress: 100 });
    expect(run.state).toBe("COMBAT_2");
  });
});
