// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { SWIM_AMP, SWIM_GLSL, SWIM_WAVES, swimAmp, swimOffset, swimRate } from "./abyssal-swim";

describe("abyssal swimming wave", () => {
  test("the head stays put and the tail does the work", () => {
    for (let p = 0; p < 6.3; p += 0.7) expect(Math.abs(swimOffset(0, 3, p, SWIM_AMP))).toBeLessThan(1e-9);
    const tail = Math.max(...Array.from({ length: 64 }, (_, i) => Math.abs(swimOffset(1, 3, (i / 64) * 2 * Math.PI, SWIM_AMP))));
    const mid = Math.max(...Array.from({ length: 64 }, (_, i) => Math.abs(swimOffset(0.5, 3, (i / 64) * 2 * Math.PI, SWIM_AMP))));
    expect(tail).toBeCloseTo(SWIM_AMP * 3, 2);
    expect(mid).toBeLessThan(tail / 3);
  });
  test("the wave travels from head to tail as the phase advances", () => {
    // the crest moves toward the tail: the point of zero crossing shifts to larger u when phase grows
    const zero = (phase: number) => { for (let u = 0.05; u < 1; u += 0.001) if (Math.sign(swimOffset(u, 1, phase, 1)) !== Math.sign(swimOffset(u + 0.001, 1, phase, 1))) return u; return 1; };
    expect(zero(1.5)).toBeGreaterThan(zero(1.0)); // zeros at u = phase / (2π·waves): 0.14 then 0.21
  });
  test("faster swimming beats faster and wider; a hovering creature still sways", () => {
    expect(swimRate(6)).toBeGreaterThan(swimRate(0));
    expect(swimAmp(6)).toBeCloseTo(SWIM_AMP, 6);
    expect(swimAmp(0)).toBeGreaterThan(0);
    expect(swimAmp(0)).toBeLessThan(swimAmp(6));
  });
  test("the shader uses the same wave", () => {
    expect(SWIM_GLSL).toContain(SWIM_WAVES.toFixed(4));
    expect(SWIM_GLSL).toContain("transformed.x");
  });
});
