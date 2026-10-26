// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { DPR_FLOOR, PHONE_DPR, phoneTier, defaultFrameRate, dprDown, dprFloor, dprUp, frameInterval, monitorBounds, onDecline } from "./quality-governor";

describe("frame pacing", () => {
  it("phones default to a steady 30 fps, desktops uncapped", () => {
    expect(defaultFrameRate(true)).toBe(30);
    expect(defaultFrameRate(false)).toBe("max");
    expect(frameInterval(30)).toBeCloseTo(33.33, 1);
    expect(frameInterval("max")).toBeNull();
  });
  it("the monitor only declines when the cap itself can't be held", () => {
    const [lo, hi] = monitorBounds(30);
    expect(lo).toBeLessThan(30); expect(hi).toBeLessThan(30); expect(lo).toBeGreaterThan(20);
    expect(monitorBounds("max")).toEqual([45, 58]);
  });
  it("phones keep a clean resolution: never under 1, and never step back up (no flip-flop)", () => {
    expect(dprFloor(true)).toBe(1.25);
    expect(dprFloor(false)).toBe(DPR_FLOOR);
    let d = PHONE_DPR;
    for (let i = 0; i < 6; i++) d = dprDown(d, true);
    expect(d).toBe(1.25);
    expect(dprUp(1.25, true)).toBe(1.25);
    expect(dprUp(1.25, false)).toBe(1.5);
  });
  it("the tier only steps down once resolution is at the floor", () => {
    expect(onDecline({ dpr: 1.5, chosen: "HIGH", cap: null, secondsSinceLastStep: 60 })).toBeNull();
    expect(onDecline({ dpr: DPR_FLOOR, chosen: "HIGH", cap: null, secondsSinceLastStep: 60 })).toBe("MEDIUM");
  });
  it("phones run MEDIUM at most, so the automatic step-down never remounts the world mid-play", () => {
    expect(phoneTier("HIGH", true)).toBe("MEDIUM");
    expect(phoneTier("ULTRA", true)).toBe("MEDIUM");
    expect(phoneTier("LOW", true)).toBe("LOW");
    expect(phoneTier("HIGH", false)).toBe("HIGH");
  });
});
