import { describe, expect, test } from "bun:test";
import { SITES, SITE_STYLE, legendKinds, siteAt, sitesIn } from "./region-atlas";
import { REGIONS } from "./world";
import { heightAt, WATER_LEVEL } from "./terrain";

describe("region atlas", () => {
  test("ids unique; every board region and both cities have their named places", () => {
    expect(new Set(SITES.map((s) => s.id)).size).toBe(SITES.length);
    for (const id of ["neon", "nexus", "thalassia", "veridan", "wastelands", "frostspire", "ember", "solara"]) expect(sitesIn(id).length).toBeGreaterThanOrEqual(6);
    for (const name of ["Casino Row", "The Strip", "Nightlife District", "Harbor & Docks", "Capital District", "Nexus Mall", "Dust Rose", "Lumina Falls", "Frosthold", "Fire Spire", "Crystal Spire", "Royal Palace"]) expect(SITES.some((s) => s.name === name)).toBe(true);
  });
  test("wilderness sites stand on dry ground inside their region", () => {
    for (const s of SITES) {
      const r = REGIONS.find((g) => g.id === s.regionId);
      if (!r || s.regionId === "nexus") continue; // Nexus City spreads past its 26 m safe-zone radius (nexus-districts.ts CITY_OUTER)
      expect(Math.hypot(s.x - r.x, s.z - r.z)).toBeLessThan(r.radius);
      if (s.regionId !== "nexus") expect(heightAt(s.x, s.z)).toBeGreaterThan(WATER_LEVEL);
    }
  });
  test("siteAt prefers the venue inside its district and is null in the open", () => {
    const venue = SITES.find((s) => s.id === "neon-pulse-array")!;
    expect(siteAt(venue.x, venue.z)?.id).toBe("neon-pulse-array");
    const far = REGIONS.find((r) => r.id === "wastelands")!;
    expect(siteAt(far.x + far.radius * 5, far.z)).toBeNull();
  });
  test("every kind on the map has a legend glyph", () => {
    for (const k of legendKinds()) expect(SITE_STYLE[k].glyph.length).toBeGreaterThan(0);
  });
});
