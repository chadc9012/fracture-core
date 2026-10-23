import { describe, expect, test } from "bun:test";
import { SKY_STOPS, phaseFor, sunElevation } from "./world";

describe("day cycle: sky, phase and sun agree", () => {
  test("daytime palette only while the sun is well up, night palette only while it is down", () => {
    for (let i = 0; i < 240; i++) {
      const t = i / 240, phase = phaseFor(t), sun = sunElevation(t);
      if (phase === "Day") expect(sun).toBeGreaterThan(0.3);
      if (phase === "Night" || phase === "Moonlight") expect(sun).toBeLessThan(0);
      if (phase === "Dawn" || phase === "Sunset") expect(Math.abs(sun)).toBeLessThan(0.5);
    }
  });
  test("noon is Day and midnight is Moonlight; stops are ordered and cover the whole day", () => {
    expect(phaseFor(0.5)).toBe("Day");
    expect(phaseFor(0)).toBe("Moonlight");
    expect(SKY_STOPS[0]!.t).toBe(0); expect(SKY_STOPS.at(-1)!.t).toBe(1);
    for (let i = 1; i < SKY_STOPS.length; i++) expect(SKY_STOPS[i]!.t).toBeGreaterThan(SKY_STOPS[i - 1]!.t);
  });
});
