import { describe, expect, test } from "bun:test";
import { SKY_LANES, vehicleAt } from "./sky-traffic";
import { buildings } from "./nexus-districts";
import { heightAt } from "./terrain";

describe("sky traffic", () => {
  test("vehicles stay above the Nexus skyline and well above the ground, for a whole lap", () => {
    const bs = buildings();
    for (const l of SKY_LANES) for (let k = 0; k < l.count; k++) for (let t = 0; t < 120; t += 1.5) {
      const v = vehicleAt(l, k, t);
      expect(v.y - heightAt(v.x, v.z)).toBeGreaterThan(40);
      for (const b of bs) if (Math.abs(v.x - b.x) < b.w / 2 + 4 && Math.abs(v.z - b.z) < b.d / 2 + 4) expect(v.y).toBeGreaterThan(b.top + 6);
    }
  });
  test("heading follows the direction of travel", () => {
    const l = SKY_LANES[0]!, a = vehicleAt(l, 0, 10), b = vehicleAt(l, 0, 10.05);
    const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw), mx = b.x - a.x, mz = b.z - a.z;
    expect((fx * mx + fz * mz) / Math.hypot(mx, mz)).toBeGreaterThan(0.95);
  });
});
