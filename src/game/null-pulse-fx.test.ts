// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { PULSE_FX_REDUCED_SECONDS, PULSE_FX_SECONDS, pulseFrame } from "./null-pulse-fx";

const o = { reducedMotion: false, tier: "HIGH" as const };
describe("pulseFrame", () => {
  it("is inactive before it fires and after it ends (nothing lingers)", () => {
    expect(pulseFrame(-0.1, o).active).toBe(false);
    expect(pulseFrame(PULSE_FX_SECONDS, o).active).toBe(false);
    expect(pulseFrame(Number.NaN, o).active).toBe(false);
  });
  it("expands to the real radius and fades out", () => {
    const a = pulseFrame(0.05, o), b = pulseFrame(PULSE_FX_SECONDS * 0.9, o);
    expect(b.ringScale).toBeGreaterThan(a.ringScale);
    expect(b.ringScale).toBeLessThanOrEqual(1);
    expect(b.ringOpacity).toBeLessThan(a.ringOpacity);
  });
  it("reduced motion: no expansion, shorter, no dome", () => {
    const r = pulseFrame(0.1, { reducedMotion: true, tier: "HIGH" });
    expect(r).toMatchObject({ active: true, ringScale: 1, domeOpacity: 0 });
    expect(pulseFrame(PULSE_FX_REDUCED_SECONDS, { reducedMotion: true, tier: "HIGH" }).active).toBe(false);
  });
  it("LOW tier drops the dome layer but keeps the ring", () => {
    const l = pulseFrame(0.1, { reducedMotion: false, tier: "LOW" });
    expect(l.active).toBe(true);
    expect(l.domeOpacity).toBe(0);
    expect(pulseFrame(0.1, o).domeOpacity).toBeGreaterThan(0);
  });
});
