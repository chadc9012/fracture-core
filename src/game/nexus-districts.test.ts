import { describe, expect, test } from "bun:test";
import { BLOCK, CITY_INNER, CITY_OUTER, NEXUS, blocks, buildings, districtAt, lamps, parkedCars } from "./nexus-districts";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { heightAt, WATER_LEVEL } from "./terrain";

describe("Nexus districts", () => {
  test("districts by bearing (north = −z)", () => {
    expect(districtAt(NEXUS.x, NEXUS.z - 50)).toBe("spire");
    expect(districtAt(NEXUS.x + 50, NEXUS.z)).toBe("market");
    expect(districtAt(NEXUS.x - 50, NEXUS.z)).toBe("arcology");
    expect(districtAt(NEXUS.x, NEXUS.z + 50)).toBe("shipyard");
  });
  test("blocks sit in the ring, off roads and water, and never overlap the safe-zone hub", () => {
    const bs = blocks();
    expect(bs.length).toBeGreaterThan(15);
    for (const b of bs) {
      const d = Math.hypot(b.x - NEXUS.x, b.z - NEXUS.z);
      expect(d).toBeGreaterThanOrEqual(CITY_INNER);
      expect(d).toBeLessThanOrEqual(CITY_OUTER);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = b.x + dx! * BLOCK / 2, z = b.z + dz! * BLOCK / 2;
        expect(distanceToRoad(x, z)).toBeGreaterThan(LANE_HALF_WIDTH);
        expect(heightAt(x, z)).toBeGreaterThan(WATER_LEVEL);
      }
    }
  });
  test("buildings stand on their lowest corner and the skyline is tallest in the Spire district", () => {
    const bs = buildings();
    for (const b of bs) {
      expect(b.top).toBeGreaterThan(b.base);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) expect(b.base).toBeLessThanOrEqual(heightAt(b.x + dx! * b.w / 2, b.z + dz! * b.d / 2));
    }
    const avg = (d: string) => { const l = bs.filter((b) => b.district === d); return l.reduce((s, b) => s + b.floors, 0) / Math.max(1, l.length); };
    expect(avg("spire")).toBeGreaterThan(avg("shipyard"));
  });
  test("lamps and parked cars are off the supply roads", () => {
    for (const l of lamps()) expect(distanceToRoad(l.x, l.z)).toBeGreaterThan(LANE_HALF_WIDTH - 3);
    for (const c of parkedCars()) expect(distanceToRoad(c.x, c.z)).toBeGreaterThanOrEqual(LANE_HALF_WIDTH);
  });
});
