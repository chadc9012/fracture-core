// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { NEUTRAL_WATER, REGION_WATER, waterStyleAt } from "./water-style";
import { REGIONS } from "./world";

describe("waterStyleAt", () => {
  it("styles every authored region and leaves unknown ground neutral", () => {
    for (const r of REGIONS) expect(REGION_WATER[r.id]).toBeDefined();
    expect(waterStyleAt(undefined, "CLEAR")).toEqual(NEUTRAL_WATER);
  });
  it("swamp water is murkier and calmer than frostspire water", () => {
    expect(waterStyleAt("swamps", "CLEAR").murk).toBeGreaterThan(waterStyleAt("frostspire", "CLEAR").murk);
    expect(waterStyleAt("swamps", "CLEAR").chop).toBeLessThan(waterStyleAt("frostspire", "CLEAR").chop);
  });
  it("storms roughen the surface and fog stills it", () => {
    expect(waterStyleAt("nexus", "STORM").chop).toBeGreaterThan(waterStyleAt("nexus", "CLEAR").chop);
    expect(waterStyleAt("nexus", "FOG").chop).toBeLessThan(waterStyleAt("nexus", "CLEAR").chop);
  });
  it("each region has its own water colour", () => {
    const deeps = new Set(REGIONS.map((r) => REGION_WATER[r.id]!.deep));
    expect(deeps.size).toBe(REGIONS.length);
  });
});
