import { describe, expect, test } from "bun:test";
import { STORM, stormGlow, stormStrike } from "./fracture-storm";
import { SPIRE, VORTEX } from "./neon-tiers";

describe("fracture storm", () => {
  test("hangs above the Neon Spire's own vortex and is a real band", () => {
    expect(STORM.y).toBeGreaterThan(VORTEX.y + 20);
    expect(STORM.y).toBeGreaterThan(SPIRE.height);
    expect(STORM.outer).toBeGreaterThan(STORM.inner + 50);
  });
  test("lightning strikes a few times a minute, briefly", () => {
    let onFrames = 0, strikes = new Set<number>();
    for (let i = 0; i < 60 * 60; i++) { const s = stormStrike(i / 60); if (s.on) { onFrames++; strikes.add(s.seed); expect(s.k).toBeGreaterThan(0); expect(s.k).toBeLessThanOrEqual(1); } }
    expect(strikes.size).toBeGreaterThan(8);
    expect(onFrames / 3600).toBeLessThan(0.15);
  });
  test("glows by day, brighter at night and in storms", () => {
    expect(stormGlow(0, false)).toBeGreaterThan(0.4);
    expect(stormGlow(1, false)).toBeGreaterThan(stormGlow(0, false));
    expect(stormGlow(1, true)).toBeGreaterThan(stormGlow(1, false));
  });
});

import { CITY_NIGHT, atmosphereAt } from "./atmosphere";
describe("city night air", () => {
  test("Nexus and Neon turn violet after dark, the wilds do not", () => {
    expect(atmosphereAt("nexus", undefined, 1).fogTint).toBe(CITY_NIGHT.fogTint);
    expect(atmosphereAt("neon", undefined, 1).skyMix).toBeCloseTo(CITY_NIGHT.skyMix);
    expect(atmosphereAt("nexus", undefined, 0).fogTint).not.toBe(CITY_NIGHT.fogTint);
    expect(atmosphereAt("solara", undefined, 1).fogTint).not.toBe(CITY_NIGHT.fogTint);
  });
});
