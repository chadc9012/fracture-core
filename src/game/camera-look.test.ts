import { describe, expect, test } from "bun:test";
import { PITCH_LIMIT, STICK_DEADZONE, clampPitch, lookDelta, stickCurve } from "./camera-look";

const none = { left: false, right: false, up: false, down: false, stickX: 0, stickY: 0 };

describe("camera look", () => {
  test("no input, no movement", () => expect(lookDelta(none, 0.016)).toEqual({ dyaw: 0, dpitch: 0 }));
  test("left arrow turns left, right arrow turns right, opposite keys cancel", () => {
    expect(lookDelta({ ...none, left: true }, 0.1).dyaw).toBeGreaterThan(0);
    expect(lookDelta({ ...none, right: true }, 0.1).dyaw).toBeLessThan(0);
    expect(lookDelta({ ...none, left: true, right: true }, 0.1).dyaw).toBe(0);
  });
  test("up arrow looks up, down arrow looks down", () => {
    expect(lookDelta({ ...none, up: true }, 0.1).dpitch).toBeGreaterThan(0);
    expect(lookDelta({ ...none, down: true }, 0.1).dpitch).toBeLessThan(0);
  });
  test("stick right turns right; stick up (negative axis) looks up", () => {
    expect(lookDelta({ ...none, stickX: 1 }, 0.1).dyaw).toBeLessThan(0);
    expect(lookDelta({ ...none, stickY: -1 }, 0.1).dpitch).toBeGreaterThan(0);
  });
  test("stick drift inside the deadzone is ignored and the curve is gentle near centre", () => {
    expect(stickCurve(STICK_DEADZONE * 0.9)).toBe(0);
    expect(stickCurve(0.5)).toBeLessThan(0.25);
    expect(stickCurve(1)).toBe(1);
  });
  test("turn speed scales with frame time, not frame rate", () => {
    expect(lookDelta({ ...none, left: true }, 0.2).dyaw).toBeCloseTo(2 * lookDelta({ ...none, left: true }, 0.1).dyaw, 6);
  });
  test("pitch is clamped", () => {
    expect(clampPitch(5)).toBe(PITCH_LIMIT);
    expect(clampPitch(-5)).toBe(-PITCH_LIMIT);
  });
});
