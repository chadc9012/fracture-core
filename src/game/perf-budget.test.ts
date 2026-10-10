import { describe, expect, test } from "bun:test";
import { farProxies, isProxied, PROXY_COLOR, PROXY_RADIUS, PROXY_MAX, foliageTris, heavyShadows, LIGHT_CAP, maxInstances, nearestWithin, pickLights, regionModelTris, setPerfTier, getPerfTier, perfTierVersion } from "./perf-budget";
import { DPR_FLOOR, effectiveTier, MIN_STEP_SECONDS, onDecline, stepDownTier } from "./quality-governor";

describe("budgets", () => {
  test("allowances grow with the tier and stay bounded", () => {
    for (const k of ["fir", "broadleaf", "shrub", "fern", "log", "rock"] as const) {
      expect(foliageTris(k, "LOW")).toBeLessThan(foliageTris(k, "MEDIUM"));
      expect(foliageTris(k, "MEDIUM")).toBeLessThan(foliageTris(k, "HIGH"));
      expect(foliageTris(k, "HIGH")).toBeLessThan(foliageTris(k, "ULTRA"));
    }
    const total = (["fir", "broadleaf", "shrub", "fern", "log", "rock"] as const).reduce((s, k) => s + foliageTris(k, "MEDIUM"), 0);
    expect(total + regionModelTris("MEDIUM")).toBeLessThan(1_300_000);
  });
  test("a heavy model gets few instances; a light one gets many; zero-size is unbounded", () => {
    expect(maxInstances(60_000, 100_000)).toBe(0);
    expect(maxInstances(300_000, 100_000)).toBe(3);
    expect(maxInstances(45_000, 300)).toBe(150);
    expect(maxInstances(10, 0)).toBeGreaterThan(1e9);
  });
  test("nearestWithin keeps the closest, in range, capped", () => {
    const pts = [{ x: 5, z: 0 }, { x: 1, z: 0 }, { x: 3, z: 0 }, { x: 99, z: 0 }];
    expect(nearestWithin(pts, 0, 0, 10, 2)).toEqual([1, 2]);
    expect(nearestWithin(pts, 0, 0, 10, 10).sort()).toEqual([0, 1, 2]);
    expect(nearestWithin(pts, 0, 0, 10, 0)).toEqual([]);
  });
  test("lights: cap respected, nearest win, hysteresis keeps an 'on' light slightly past range", () => {
    const l = [{ id: 1, d: 10, range: 50, on: false }, { id: 2, d: 20, range: 50, on: false }, { id: 3, d: 30, range: 50, on: false }, { id: 4, d: 60, range: 50, on: true }, { id: 5, d: 60, range: 50, on: false }];
    expect([...pickLights(l, 2)].sort()).toEqual([1, 2]);
    expect(pickLights(l, 9).has(4)).toBe(true);
    expect(pickLights(l, 9).has(5)).toBe(false);
    expect(LIGHT_CAP.LOW).toBeLessThan(LIGHT_CAP.ULTRA);
  });
  test("heavy shadows only on HIGH and ULTRA", () => {
    expect([heavyShadows("LOW"), heavyShadows("MEDIUM"), heavyShadows("HIGH"), heavyShadows("ULTRA")]).toEqual([false, false, true, true]);
  });
  test("tier store bumps the version only on change", () => {
    const v = perfTierVersion();
    setPerfTier(getPerfTier());
    expect(perfTierVersion()).toBe(v);
    setPerfTier(getPerfTier() === "LOW" ? "MEDIUM" : "LOW");
    expect(perfTierVersion()).toBe(v + 1);
  });
});

describe("quality governor", () => {
  test("steps down one tier only at the dpr floor and not faster than the rate limit", () => {
    expect(onDecline({ dpr: 1.25, chosen: "HIGH", cap: null, secondsSinceLastStep: 99 })).toBeNull();
    expect(onDecline({ dpr: DPR_FLOOR, chosen: "HIGH", cap: null, secondsSinceLastStep: MIN_STEP_SECONDS - 1 })).toBeNull();
    expect(onDecline({ dpr: DPR_FLOOR, chosen: "HIGH", cap: null, secondsSinceLastStep: 99 })).toBe("MEDIUM");
    expect(onDecline({ dpr: DPR_FLOOR, chosen: "HIGH", cap: "MEDIUM", secondsSinceLastStep: 99 })).toBeNull(); // the automatic cap never goes below MEDIUM
  });
  test("effective tier is the lower of choice and cap; never raises", () => {
    expect(effectiveTier("MEDIUM", "HIGH")).toBe("MEDIUM");
    expect(effectiveTier("ULTRA", "LOW")).toBe("LOW");
    expect(effectiveTier("HIGH", null)).toBe("HIGH");
    expect(stepDownTier("LOW")).toBe("MEDIUM"); // never below the floor (a LOW start is lifted to it only when stepping)
    expect(stepDownTier("MEDIUM")).toBe("MEDIUM");
  });
});

describe("far proxies", () => {
  test("skip what is drawn in detail, nearest first, bounded", () => {
    const pts = [{ x: 1, z: 0 }, { x: 50, z: 0 }, { x: 20, z: 0 }, { x: 400, z: 0 }, { x: 30, z: 0 }];
    expect(farProxies(pts, 0, 0, [0], 100, 10)).toEqual([2, 4, 1]);
    expect(farProxies(pts, 0, 0, [], 100, 2)).toEqual([0, 2]);
    expect(farProxies(pts, 0, 0, [], 100, 0)).toEqual([]);
    expect(PROXY_MAX.LOW).toBeLessThan(PROXY_MAX.ULTRA);
  });
});

describe("far silhouettes", () => {
  test("trees, rocks and standing dead trunks keep a far proxy; plants do not", () => {
    for (const k of ["fir", "broadleaf", "rock", "log"] as const) { expect(isProxied(k)).toBe(true); expect(PROXY_RADIUS[k]).toBeGreaterThan(0); expect(PROXY_COLOR[k]).toMatch(/^#[0-9a-f]{6}$/); }
    for (const k of ["shrub", "fern"] as const) expect(isProxied(k)).toBe(false);
  });
});
