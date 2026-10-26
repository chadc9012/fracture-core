import { describe, expect, it } from "bun:test";
import { HILLS, hillPlantable, nexusHillTrees, type HillRules } from "./nexus-hills";
import { heightAt, slopeAt, WATER_LEVEL } from "./terrain";
import { nearestTwo } from "./continent-borders";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { REGIONS } from "./world";

const NEX = REGIONS.find((r) => r.id === "nexus")!, home = nearestTwo(NEX.x, NEX.z).a.id;
const rules: HillRules = { height: heightAt, slope: slopeAt, water: WATER_LEVEL, onIsland: (x, z) => nearestTwo(x, z).a.id === home, clear: (x, z) => distanceToRoad(x, z) > LANE_HALF_WIDTH + 3 };

describe("Nexus hill trees", () => {
  const trees = nexusHillTrees(rules, 1);
  it("plants a real wood on the island", () => { expect(trees.length).toBeGreaterThan(150); });
  it("every tree is on the island, out of the city, off the beach and off the roads", () => {
    for (const t of trees) {
      expect(Math.hypot(t.x - NEX.x, t.z - NEX.z)).toBeGreaterThanOrEqual(HILLS.inner);
      expect(heightAt(t.x, t.z)).toBeGreaterThan(WATER_LEVEL + HILLS.minAbove);
      expect(distanceToRoad(t.x, t.z)).toBeGreaterThan(LANE_HALF_WIDTH + 3);
      expect(rules.onIsland(t.x, t.z)).toBe(true);
    }
  });
  it("is seeded (same wood every load) and thins on low tiers", () => {
    expect(nexusHillTrees(rules, 1).length).toBe(trees.length);
    expect(nexusHillTrees(rules, 0.5).length).toBeLessThan(trees.length);
    expect(hillPlantable(NEX.x, NEX.z, rules)).toBe(false);
  });
});
