// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { advanceAwakening, AWAKENING, type AwakeningRun } from "./awakening";
import { missionSuite } from "./mission-suite";

missionSuite("Awakening state machine", {
  id: "awakening", advance: advanceAwakening as never, initial: AWAKENING, payState: "COMPLETE", questId: "fd-01", materials: { dataShards: 2 },
  script: [
    [{ type: "START" }, "DROP"], [{ type: "ANCHOR", x: 10, z: 20 }, "PATROL"], [{ type: "CLEAR" }, "ESCALATION"], [{ type: "CLEAR" }, "LOOT"],
    [{ type: "ACK" }, "CAPTURE"], [{ type: "ARRIVED" }, "HOLD"], [{ type: "HOLD", progress: 100 }, "EXTRACT"], [{ type: "ARRIVED" }, "COMPLETE"],
  ],
});

describe("Awakening specifics", () => {
  test("the capture and extraction points are derived from the anchor", () => {
    let m = advanceAwakening(AWAKENING, { type: "START" });
    m = advanceAwakening(m, { type: "ANCHOR", x: 10, z: 20 });
    m = advanceAwakening(advanceAwakening(advanceAwakening(m, { type: "CLEAR" }), { type: "CLEAR" }), { type: "ACK" });
    expect(m.target).toEqual({ x: 40, z: 2 });
    m = advanceAwakening(advanceAwakening(m, { type: "ARRIVED" }), { type: "HOLD", progress: 100 });
    expect(m.target).toEqual({ x: 14, z: 36 });
  });
  test("hold progress accumulates without leaving HOLD until 100", () => {
    let m: AwakeningRun = { ...AWAKENING, state: "HOLD", target: { x: 0, z: 0 } };
    m = advanceAwakening(m, { type: "HOLD", progress: 40 });
    expect(m).toMatchObject({ state: "HOLD", hold: 40 });
    expect(advanceAwakening(m, { type: "HOLD", progress: 99 }).state).toBe("HOLD");
  });
  test("a CLEAR tagged with its wave cannot be replayed to skip the next wave", () => {
    let m = advanceAwakening(advanceAwakening(AWAKENING, { type: "START" }), { type: "ANCHOR", x: 0, z: 0 });
    m = advanceAwakening(m, { type: "CLEAR", from: "PATROL" });
    expect(m.state).toBe("ESCALATION");
    expect(advanceAwakening(m, { type: "CLEAR", from: "PATROL" }).state).toBe("ESCALATION"); // duplicate delivery
    expect(advanceAwakening(m, { type: "CLEAR", from: "ESCALATION" }).state).toBe("LOOT");
  });
  test("an untagged CLEAR (older saves, other callers) still advances as before", () => {
    const m = advanceAwakening(advanceAwakening(advanceAwakening(AWAKENING, { type: "START" }), { type: "ANCHOR", x: 0, z: 0 }), { type: "CLEAR" });
    expect(m.state).toBe("ESCALATION");
  });
});
