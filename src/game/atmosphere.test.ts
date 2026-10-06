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
});
