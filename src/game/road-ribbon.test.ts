import { describe, expect, test } from "bun:test";
import { LANES } from "./lanes";
import { ROAD_HALF, ROAD_LIFT, roadRibbon } from "./road-ribbon";
import { WATER_LEVEL, heightAt, riverCrossings } from "./terrain";

describe("road ribbons", () => {
  const ribbons = LANES.map((l) => roadRibbon(l));
  test("every supply road gets a surfaced strip along most of its length", () => {
    for (const r of ribbons) expect(r.points).toBeGreaterThan(50);
  });
  test("the strip sits just above the ground and never over water", () => {
    for (const r of ribbons) for (let v = 0; v < r.positions.length / 3; v++) {
      const x = r.positions[v * 3]!, y = r.positions[v * 3 + 1]!, z = r.positions[v * 3 + 2]!;
      const ground = heightAt(x, z);
      expect(Math.abs(y - ground - ROAD_LIFT)).toBeLessThan(0.05); // float32 storage nudges the sample point a little
      expect(ground).toBeGreaterThan(WATER_LEVEL);
    }
  });
  test("each quad joins two consecutive samples a road-width apart (no strip spans a gap or a bridge)", () => {
    const bridges = riverCrossings().filter((c) => c.resolved);
    for (const r of ribbons) for (let i = 0; i < r.indices.length; i += 6) {
      const a = r.indices[i]!, b = r.indices[i + 2]!;
      expect(b - a).toBe(2);
      const ax = r.positions[a * 3]!, az = r.positions[a * 3 + 2]!, bx = r.positions[b * 3]!, bz = r.positions[b * 3 + 2]!;
      expect(Math.hypot(ax - bx, az - bz)).toBeLessThan(ROAD_HALF * 3);
      const lx = r.positions[(a + 1) * 3]!, lz = r.positions[(a + 1) * 3 + 2]!;
      expect(Math.hypot(ax - lx, az - lz)).toBeCloseTo(ROAD_HALF * 2, 1);
      const mx = (ax + lx) / 2, mz = (az + lz) / 2;
      for (const c of bridges) expect(Math.hypot(mx - c.x, mz - c.z)).toBeGreaterThan(c.length / 2);
    }
  });
});
