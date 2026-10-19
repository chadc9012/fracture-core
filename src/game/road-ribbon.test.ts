import { describe, expect, test } from "bun:test";
import { LANES } from "./lanes";
import { ROAD_COLS, ROAD_HALF, ROAD_LIFT, roadRibbon } from "./road-ribbon";
import { WATER_LEVEL, heightAt, riverCrossings } from "./terrain";

describe("road ribbons", () => {
  const ribbons = LANES.map((l) => roadRibbon(l));
  test("every triangle faces up (seen from above it is front-facing, not culled)", () => {
    for (const r of ribbons) for (let i = 0; i < r.indices.length; i += 3) {
      const [a, b, c] = [r.indices[i]!, r.indices[i + 1]!, r.indices[i + 2]!].map((k) => [r.positions[k * 3]!, r.positions[k * 3 + 1]!, r.positions[k * 3 + 2]!]);
      const e1 = [b![0]! - a![0]!, b![1]! - a![1]!, b![2]! - a![2]!], e2 = [c![0]! - a![0]!, c![1]! - a![1]!, c![2]! - a![2]!];
      expect(e1[2]! * e2[0]! - e1[0]! * e2[2]!).toBeGreaterThan(0); // y of e1 x e2
    }
  });
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
  test("each quad joins two consecutive samples (no strip spans a gap or a bridge), rows a road-width across", () => {
    const bridges = riverCrossings().filter((c) => c.resolved);
    for (const r of ribbons) {
      for (let i = 0; i < r.indices.length; i += 6) {
        const a = r.indices[i]!, b = r.indices[i + 1]!;
        expect(b - a).toBe(ROAD_COLS);
        const ax = r.positions[a * 3]!, az = r.positions[a * 3 + 2]!, bx = r.positions[b * 3]!, bz = r.positions[b * 3 + 2]!;
        expect(Math.hypot(ax - bx, az - bz)).toBeLessThan(ROAD_HALF * 3);
        for (const c of bridges) expect(Math.hypot(ax - c.x, az - c.z)).toBeGreaterThan(c.length / 2 - ROAD_HALF);
      }
      for (let row = 0; row < r.points; row++) {
        const a = row * ROAD_COLS, z = a + ROAD_COLS - 1;
        expect(Math.hypot(r.positions[a * 3]! - r.positions[z * 3]!, r.positions[a * 3 + 2]! - r.positions[z * 3 + 2]!)).toBeCloseTo(ROAD_HALF * 2, 1);
      }
    }
  });
});
