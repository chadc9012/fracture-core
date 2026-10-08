// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { hazardAt, FLARE_PERIOD } from "./region-hazards";

const base = { t: 0, dt: 1, sheltered: false, exposure: 0 };

describe("region hazards", () => {
  test("fracture zone gravity swings between light and heavy", () => {
    const heavy = hazardAt({ ...base, regionId: "ember", t: 3 });
    const light = hazardAt({ ...base, regionId: "ember", t: 9 });
    expect(heavy.gravityMul).toBeCloseTo(1.6, 2);
    expect(light.gravityMul).toBeCloseTo(0.35, 2);
  });
  test("frozen exposure builds outside and hurts only past the threshold", () => {
    expect(hazardAt({ ...base, regionId: "frostspire", exposure: 0.3 }).damagePerSec).toBe(0);
    expect(hazardAt({ ...base, regionId: "frostspire", exposure: 0.9 }).damagePerSec).toBeGreaterThan(0);
    expect(hazardAt({ ...base, regionId: "frostspire", exposure: 0.9, sheltered: true }).exposure).toBeLessThan(0.9);
  });
  test("solar flare burns only unsheltered players", () => {
    const t = FLARE_PERIOD - 1;
    expect(hazardAt({ ...base, regionId: "solara", t }).damagePerSec).toBe(6);
    expect(hazardAt({ ...base, regionId: "solara", t, sheltered: true }).damagePerSec).toBe(0);
  });
  test("safe zone has no hazard", () => {
    const e = hazardAt({ ...base, regionId: "nexus" });
    expect([e.gravityMul, e.speedMul, e.damagePerSec]).toEqual([1, 1, 0]);
  });
});
