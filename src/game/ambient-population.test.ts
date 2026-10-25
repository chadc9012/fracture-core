// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { AMBIENT_CIVILIANS, OFF_SURFACE_REGIONS, ambientCivilianSpecs, beachSpots, beachgoerSpecs, regionCentre } from "./ambient-population";
import { WATER_LEVEL, heightAt } from "./terrain";

describe("ambient civilians", () => {
  test("22 everyday profiles over all nine destinations, each with an outfit and a line", () => {
    expect(AMBIENT_CIVILIANS.length).toBe(22);
    expect(new Set(AMBIENT_CIVILIANS.map((a) => a.region)).size).toBe(9);
    expect(new Set(AMBIENT_CIVILIANS.map((a) => a.id)).size).toBe(22);
    for (const a of AMBIENT_CIVILIANS) { expect(regionCentre(a.region)).not.toBeNull(); expect(a.clothing.length).toBeGreaterThan(5); expect(a.line.length).toBeGreaterThan(5); }
  });
  test("every surface profile spawns on dry ground; off-surface ones never do", () => {
    const specs = ambientCivilianSpecs();
    expect(specs.length).toBe(AMBIENT_CIVILIANS.filter((a) => !OFF_SURFACE_REGIONS.has(a.region)).length);
    for (const s of specs) expect(heightAt(s.homeX, s.homeZ)).toBeGreaterThan(WATER_LEVEL + 0.4);
    expect(specs.some((s) => s.id.startsWith("th-"))).toBe(false);
  });
  test("never placed on top of someone already living there", () => {
    const first = AMBIENT_CIVILIANS.find((a) => !OFF_SURFACE_REGIONS.has(a.region))!;
    const c = regionCentre(first.region)!;
    const specs = ambientCivilianSpecs([{ homeX: c.x + first.dx + 1, homeZ: c.z + first.dz }]);
    expect(specs.some((s) => s.id === first.id)).toBe(false);
  });
});

describe("beaches", () => {
  const spots = beachSpots();
  test("posts sit on dry, low ground near a real waterline, spread out", () => {
    expect(spots.length).toBeGreaterThan(0); // the default world has gentle shores at Verdant, the Swamps and the Wastelands
    for (const s of spots) {
      const h = heightAt(s.x, s.z);
      expect(h).toBeGreaterThan(WATER_LEVEL + 0.4);
      expect(h).toBeLessThan(WATER_LEVEL + 3);
      // a couple of metres past the edge is water
      expect(heightAt(s.edgeX + Math.sin(s.yaw) * 3, s.edgeZ + Math.cos(s.yaw) * 3)).toBeLessThan(WATER_LEVEL + 0.6);
      for (const o of spots) if (o !== s) expect(Math.hypot(o.x - s.x, o.z - s.z)).toBeGreaterThan(70);
    }
  });
  test("each beach gets a sunbather and a drinks seller", () => {
    const people = beachgoerSpecs(spots);
    expect(people.length).toBe(spots.length * 2);
    expect(new Set(people.map((p) => p.id)).size).toBe(people.length);
  });
});
