// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { atmosphereAt, NEUTRAL_ATMOSPHERE, REGION_ATMOSPHERE } from "./atmosphere";
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
