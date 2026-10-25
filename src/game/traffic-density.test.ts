// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { activeCars, carIsOut, trafficDensity } from "./traffic-density";

describe("traffic density", () => {
  it("peaks at the rushes, is thin overnight, and stays within 0..1", () => {
    expect(trafficDensity(8)).toBe(1);
    expect(trafficDensity(18)).toBe(1);
    expect(trafficDensity(4)).toBeLessThan(0.3);
    expect(trafficDensity(13)).toBeLessThan(trafficDensity(8));
    for (let h = 0; h <= 24; h += 0.25) { const d = trafficDensity(h); expect(d).toBeGreaterThan(0); expect(d).toBeLessThanOrEqual(1); }
  });
  it("is continuous across midnight and wraps hours", () => {
    expect(trafficDensity(0)).toBeCloseTo(trafficDensity(24));
    expect(trafficDensity(26)).toBeCloseTo(trafficDensity(2));
    expect(trafficDensity(-1)).toBeCloseTo(trafficDensity(23));
  });
  it("runs the whole fleet with no clock, always at least one car, never more than the fleet", () => {
    expect(activeCars(6, null)).toBe(6);
    expect(activeCars(6, 4)).toBeGreaterThanOrEqual(1);
    expect(activeCars(6, 8)).toBe(6);
    expect(activeCars(0, 8)).toBe(0);
  });
  it("switches cars on in index order", () => {
    const out = [0, 1, 2, 3, 4, 5].map((i) => carIsOut(i, 6, 4));
    expect(out.indexOf(false)).toBeGreaterThan(0);
    for (let i = out.indexOf(false); i < out.length; i++) expect(out[i]).toBe(false);
  });
});
