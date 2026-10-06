// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { airJump, createMoveState, glideVy, land, movementFov, SLIDE_MIN_SPEED, startSlide, stepSlide } from "./movement";

describe("class air mobility", () => {
  it("gives each class its own air jumps and refills on landing", () => {
    const s = createMoveState();
    land(s, "HUNTER");
    expect(airJump(s, "HUNTER")).toBeCloseTo(0.9);
    expect(airJump(s, "HUNTER")).toBeCloseTo(0.9);
    expect(airJump(s, "HUNTER")).toBeNull();
    land(s, "TITAN");
    expect(airJump(s, "TITAN")).toBeCloseTo(0.8);
    expect(airJump(s, "TITAN")).toBeNull();
  });
  it("only warlocks glide, and only while falling fast and holding jump", () => {
    expect(glideVy(-9, "WARLOCK", true)).toBe(-2.2);
    expect(glideVy(-9, "WARLOCK", false)).toBe(-9);
    expect(glideVy(-9, "TITAN", true)).toBe(-9);
    expect(glideVy(-1, "WARLOCK", true)).toBe(-1);
  });
});

describe("slide", () => {
  it("needs speed, runs its length, decays, then cools down", () => {
    const s = createMoveState();
    expect(startSlide(s, SLIDE_MIN_SPEED - 1, 0)).toBe(false);
    expect(startSlide(s, 40, 0)).toBe(true);
    const first = stepSlide(s, 0.016);
    expect(first).toBeGreaterThan(40);
    let last = first;
    for (let i = 0; i < 40; i++) last = stepSlide(s, 0.016);
    expect(last).toBeLessThan(first);
    for (let i = 0; i < 30; i++) stepSlide(s, 0.016);
    expect(stepSlide(s, 0.016)).toBe(0);
    expect(startSlide(s, 40, 0)).toBe(false); // cooling down
    for (let i = 0; i < 60; i++) stepSlide(s, 0.016);
    expect(startSlide(s, 40, 0)).toBe(true);
  });
  it("widens FOV for sprint and slide but tightens on aim", () => {
    expect(movementFov(false, true, false)).toBeGreaterThan(movementFov(false, false, false));
    expect(movementFov(false, true, true)).toBeGreaterThan(movementFov(false, true, false));
    expect(movementFov(true, true, true)).toBe(48);
  });
});
