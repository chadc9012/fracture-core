import { describe, expect, test } from "bun:test";
import { COVER_SPEC, coverDensityFor, groundCover, placeable } from "./ground-cover";
import { REGIONS } from "./world";
import { WATER_LEVEL, heightAt } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { isReserved } from "./verdant";
import { COVER_CULL_RADIUS, COVER_RESELECT_SECONDS } from "./ground-cover";
import { CULL_RADIUS, nearIndices } from "./foliage-cull";

describe("ground cover", () => {
  const items = groundCover(0.7);
  test("is deterministic and cached", () => {
    expect(groundCover(0.7)).toBe(items);
    expect(groundCover(0.7).length).toBe(items.length);
  });
  test("fills the world: every region gets cover and the total is substantial", () => {
    expect(items.length).toBeGreaterThan(2500);
    for (const r of REGIONS) {
      if (!COVER_SPEC[r.id]) continue;
      expect(items.some((i) => Math.hypot(i.x - r.x, i.z - r.z) <= r.radius)).toBe(true);
    }
  });
  test("has all four kinds, with the swamp reed-heavy and the volcano rock-heavy", () => {
    for (const k of ["flower", "bush", "rock", "reed"] as const) expect(items.some((i) => i.kind === k)).toBe(true);
    const swamp = REGIONS.find((r) => r.id === "swamps")!, ember = REGIONS.find((r) => r.id === "ember")!;
    const near = (r: typeof swamp, k: string) => items.filter((i) => i.kind === k && Math.hypot(i.x - r.x, i.z - r.z) <= r.radius).length;
    expect(near(swamp, "reed")).toBeGreaterThan(near(swamp, "rock"));
    expect(near(ember, "rock")).toBeGreaterThan(near(ember, "flower"));
  });
  test("nothing grows on roads, the forest trail pads, or in deep water; y matches the terrain", () => {
    for (const i of items) {
      expect(distanceToRoad(i.x, i.z)).toBeGreaterThanOrEqual(LANE_HALF_WIDTH);
      expect(isReserved(i.x, i.z, 0) && Math.hypot(i.x - REGIONS.find((r) => r.id === "veridan")!.x, i.z - REGIONS.find((r) => r.id === "veridan")!.z) < 34).toBe(false);
      expect(i.y).toBeGreaterThan(WATER_LEVEL - 0.25 - 1e-9);
      expect(Math.abs(i.y - heightAt(i.x, i.z))).toBeLessThan(1e-6);
    }
  });
  test("denser tiers place more", () => {
    expect(groundCover(1).length).toBeGreaterThan(items.length);
    expect(coverDensityFor("LOW")).toBeLessThan(coverDensityFor("ULTRA"));
  });
  test("the placement rule rejects road and trail positions", () => {
    const v = REGIONS.find((r) => r.id === "veridan")!;
    expect(placeable(v.x, v.z + 12, "flower", v)).toBe(false);
  });
});

describe("ground cover draw distance", () => {
  // Regression: GroundCover drew every shrub, rock, flower and reed in the world each frame (~1M triangles at HIGH).
  test("from anywhere in a region only a small share of the world's cover is inside its draw radius", () => {
    const all = groundCover(1);
    for (const r of REGIONS) {
      let near = 0;
      for (const kind of ["flower", "reed", "bush", "rock"] as const) {
        const items = all.filter((i) => i.kind === kind);
        near += nearIndices(items, r.x, r.z, COVER_CULL_RADIUS[kind]).length;
      }
      expect(near / all.length).toBeLessThan(0.25);
    }
  });
  test("small things fade first; every radius stays inside the trees' draw distance", () => {
    expect(COVER_CULL_RADIUS.flower).toBeLessThan(COVER_CULL_RADIUS.rock);
    for (const v of Object.values(COVER_CULL_RADIUS)) expect(v).toBeLessThanOrEqual(CULL_RADIUS.fir);
    expect(COVER_RESELECT_SECONDS).toBeLessThanOrEqual(0.5);
  });
});
