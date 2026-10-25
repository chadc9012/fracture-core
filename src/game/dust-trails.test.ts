import { describe, expect, test } from "bun:test";
import { DUST, dustAlpha, dustRate } from "./dust-trails";

describe("vehicle dust", () => {
  const offRoad = () => false, paved = () => true;
  test("only the dry regions raise dust, and only when moving", () => {
    expect(dustRate("wastelands", 15, 0, 0, offRoad)).toBeGreaterThan(0);
    expect(dustRate("veridan", 15, 0, 0, offRoad)).toBe(0);
    expect(dustRate("wastelands", DUST.minSpeed - 0.1, 0, 0, offRoad)).toBe(0);
  });
  test("faster raises more, up to a cap; paved roads raise much less", () => {
    expect(dustRate("solara", 20, 0, 0, offRoad)).toBeGreaterThan(dustRate("solara", 8, 0, 0, offRoad));
    expect(dustRate("solara", 400, 0, 0, offRoad)).toBe(DUST.maxRate);
    expect(dustRate("solara", 20, 0, 0, paved)).toBeCloseTo(dustRate("solara", 20, 0, 0, offRoad) * DUST.pavedFactor, 6);
  });
  test("a puff fades in quickly and out slowly, never above 1", () => {
    expect(dustAlpha(0)).toBe(0);
    expect(dustAlpha(1)).toBe(0);
    expect(dustAlpha(0.12)).toBeGreaterThan(dustAlpha(0.03));
    for (let k = 0; k <= 1; k += 0.01) { expect(dustAlpha(k)).toBeLessThanOrEqual(1); expect(dustAlpha(k)).toBeGreaterThanOrEqual(0); }
  });
});
