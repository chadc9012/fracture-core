import { describe, expect, test } from "bun:test";
import { lunarIllumination, moonAngle, sunAngle, starVisibility, moonlight, LUNAR_CYCLE_DAYS } from "./celestial";

describe("celestial", () => {
  test("full moon sits opposite the sun halfway through the cycle", () => {
    const t = LUNAR_CYCLE_DAYS / 2;
    expect(lunarIllumination(t)).toBeCloseTo(1);
    expect(Math.cos(moonAngle(t) - sunAngle(t))).toBeCloseTo(-1);
  });
  test("new moon is dark", () => { expect(lunarIllumination(0)).toBeCloseTo(0); });
  test("no stars in daylight or under overcast", () => {
    expect(starVisibility(0.8, 0)).toBe(0);
    expect(starVisibility(-0.6, 0)).toBe(1);
    expect(starVisibility(-0.6, 1)).toBe(0);
  });
  test("no moonlight while the moon is below the horizon", () => {
    // full-moon day at noon: moon opposite a high sun, so it is down
    expect(moonlight(LUNAR_CYCLE_DAYS / 2 + 0.5, 0)).toBe(0);
  });
});
