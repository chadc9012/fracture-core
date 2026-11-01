// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { CLEAR_MS, DAZED_MS, NUDGE_MS, advanceBreach, breachHint, breachPowers, breachWave, slotAwake, startBreach } from "./breach";

const keys = { fire: "Space", primary: "Q", dash: "Alt" };
const hints = (s: Parameters<typeof breachHint>[0]) => breachHint(s, keys);

describe("the Breach: powers wake under pressure during the escape", () => {
  it("cinematic, then unarmed on the street, then each threat wakes the next layer", () => {
    let r = startBreach(0, true);
    expect(r.state).toBe("CINE");
    expect(breachPowers(r.state)).toBe(0);
    r = advanceBreach(r, { type: "THREAT", now: 1 }, hints);
    expect(r.state).toBe("CINE"); // nothing happens until the cinematic ends
    r = advanceBreach(r, { type: "CINE_DONE", now: 10 }, hints);
    expect(r.state).toBe("DAZED");
    expect(breachPowers(r.state)).toBe(0);
    r = advanceBreach(r, { type: "THREAT", now: 20 }, hints);
    expect(r.state).toBe("SURGE");
    expect(breachPowers(r.state)).toBe(1);
    expect(r.hint).toBe("Space · fire");
    expect(r.lines[0]!.speaker).toBe("NOVA");
    r = advanceBreach(r, { type: "USED", now: 21 }, hints);
    expect(r.hint).toBe("");
    r = advanceBreach(r, { type: "WAVE_CLEAR", now: 30 }, hints);
    expect(r.state).toBe("ANCHOR");
    expect(breachPowers(r.state)).toBe(2);
    expect(r.hint).toContain("Q");
    r = advanceBreach(r, { type: "ANCHOR_DOWN", now: 40 }, hints);
    expect(r.state).toBe("CLEAR");
    expect(breachPowers(r.state)).toBe(3);
    r = advanceBreach(r, { type: "TICK", now: 40 + CLEAR_MS - 1 }, hints);
    expect(r.state).toBe("CLEAR");
    r = advanceBreach(r, { type: "TICK", now: 40 + CLEAR_MS }, hints);
    expect(r.state).toBe("DONE");
  });
  it("standing still on the street doesn't stall it: the first strike lands anyway", () => {
    const r = startBreach(0, false);
    expect(advanceBreach(r, { type: "TICK", now: DAZED_MS - 1 }).state).toBe("DAZED");
    expect(advanceBreach(r, { type: "TICK", now: DAZED_MS }).state).toBe("SURGE");
  });
  it("a stalled step gets one quiet nudge from NOVA, not a nag", () => {
    let r = advanceBreach(startBreach(0, false), { type: "THREAT", now: 0 });
    r = advanceBreach(r, { type: "TICK", now: NUDGE_MS }, hints);
    expect(r.nudged).toBe(true);
    expect(r.lines).toHaveLength(1);
    const again = advanceBreach(r, { type: "TICK", now: NUDGE_MS * 3 }, hints);
    expect(again).toBe(r);
  });
  it("abilities wake in order: primary first, the rest once the fight is won", () => {
    expect(slotAwake(1, "PRIMARY")).toBe(false);
    expect(slotAwake(2, "PRIMARY")).toBe(true);
    expect(slotAwake(2, "TACTICAL")).toBe(false);
    expect(slotAwake(3, "ULTIMATE")).toBe(true);
  });
  it("small waves: one echo, two more, then the anchor with one escort", () => {
    expect(breachWave("DAZED")).toEqual({ count: 1, elite: 0 });
    expect(breachWave("SURGE")).toEqual({ count: 2, elite: 0 });
    expect(breachWave("ANCHOR")).toEqual({ count: 2, elite: 1 });
    expect(breachWave("CLEAR")).toBeNull();
  });
});
