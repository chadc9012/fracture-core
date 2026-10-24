// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it, test } from "bun:test";
import { atmosphereAt, INSTABILITY_FOG, instabilityBleed, NEUTRAL_ATMOSPHERE, REGION_ATMOSPHERE } from "./atmosphere";
import { REGIONS } from "./world";

describe("atmosphereAt", () => {
  it("grades every authored region and leaves unknown ground neutral", () => {
    for (const r of REGIONS) expect(REGION_ATMOSPHERE[r.id]).toBeDefined();
    expect(atmosphereAt(undefined, "CLEAR", 0)).toEqual(NEUTRAL_ATMOSPHERE);
  });
  it("swamp air is thicker than solara air", () => {
    expect(atmosphereAt("swamps", "CLEAR", 0).fogScale).toBeLessThan(atmosphereAt("solara", "CLEAR", 0).fogScale);
  });
  it("fog thickens the air and night mutes tints", () => {
    expect(atmosphereAt("veridan", "FOG", 0).fogScale).toBeLessThan(atmosphereAt("veridan", "CLEAR", 0).fogScale);
    expect(atmosphereAt("veridan", "CLEAR", 1).lightMix).toBeLessThan(atmosphereAt("veridan", "CLEAR", 0).lightMix);
  });
  it("storms mute the light tint", () => {
    expect(atmosphereAt("ember", "STORM", 0).lightMix).toBeLessThan(atmosphereAt("ember", "CLEAR", 0).lightMix);
  });
  it("each region has its own sky colour and haze", () => {
    const skies = new Set(REGIONS.map((r) => REGION_ATMOSPHERE[r.id]!.skyTint));
    expect(skies.size).toBe(REGIONS.length);
    // ember smoke is the haziest air, frostspire the clearest
    expect(atmosphereAt("ember", "CLEAR", 0).haze).toBeGreaterThan(atmosphereAt("frostspire", "CLEAR", 0).haze);
  });
  it("storms add haze and night fades the sky tint", () => {
    expect(atmosphereAt("solara", "STORM", 0).haze).toBeGreaterThan(atmosphereAt("solara", "CLEAR", 0).haze);
    expect(atmosphereAt("wastelands", "CLEAR", 1).skyMix).toBeLessThan(atmosphereAt("wastelands", "CLEAR", 0).skyMix);
  });
});

import { cityNightFill, cityPresence, CITY_NIGHT_FILL } from "./atmosphere";
describe("city glow bounce", () => {
  it("lights a city's streets at night only, fading out past its edge", () => {
    expect(cityNightFill(1, 1)).toBeCloseTo(CITY_NIGHT_FILL);
    expect(cityNightFill(1, 0)).toBe(0);
    expect(cityPresence(50, 100)).toBe(1); expect(cityPresence(130, 100)).toBeCloseTo(0.5); expect(cityPresence(400, 100)).toBe(0);
  });
});

describe("instability fog bleed", () => {
  // Regression: the fracturing-zone cue lerped the fog 35% toward #ff2d55, so Frostspire and Ember nights went flat mauve-pink
  // (measured #a05374 fog under a #556888 sky in the owner's preview).
  test("is the Fracture violet, capped well below the old 35%", () => {
    const hex = INSTABILITY_FOG.color.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    expect(b).toBeGreaterThan(r); // violet, not red/pink
    expect(b).toBeGreaterThan(g);
    expect(instabilityBleed(1)).toBeLessThanOrEqual(0.25);
  });
  test("starts at the same threshold and grows with instability", () => {
    expect(instabilityBleed(0.1)).toBe(0);
    expect(instabilityBleed(0.2)).toBe(0);
    expect(instabilityBleed(0.5)).toBeGreaterThan(0);
    expect(instabilityBleed(0.8)).toBeCloseTo(INSTABILITY_FOG.max, 5);
    expect(instabilityBleed(0.5)).toBeLessThan(instabilityBleed(0.8));
  });
});
