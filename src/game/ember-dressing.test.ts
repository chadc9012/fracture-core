import { describe, expect, test } from "bun:test";
import { heightAt } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { basaltClusters, deadTrees, ember, lavaFlows, obsidianSpires, placeable, vents, CRATER_R } from "./ember-dressing";

describe("Ember Peaks dressing", () => {
  test("lava flows start at the rim and run downhill", () => {
    const flows = lavaFlows();
    expect(flows.length).toBeGreaterThanOrEqual(2);
    const e = ember();
    for (const f of flows) {
      expect(Math.hypot(f[0]!.x - e.x, f[0]!.z - e.z)).toBeLessThan(CRATER_R * 1.3);
      expect(heightAt(f[f.length - 1]!.x, f[f.length - 1]!.z)).toBeLessThan(heightAt(f[0]!.x, f[0]!.z));
      for (const p of f) expect(distanceToRoad(p.x, p.z)).toBeGreaterThanOrEqual(LANE_HALF_WIDTH - 3);
    }
  });
  test("props are placed only on valid ground and are deterministic", () => {
    for (const set of [basaltClusters(), obsidianSpires(), deadTrees()]) {
      expect(set.length).toBeGreaterThan(5);
      for (const p of set) expect(placeable(p.x, p.z, 0)).toBe(true);
    }
    expect(deadTrees()).toEqual(deadTrees());
  });
  test("one great plume over the crater plus flank vents", () => {
    const v = vents();
    expect(v.filter((x) => x.big).length).toBe(1);
    expect(v.length).toBeGreaterThan(3);
  });
});
