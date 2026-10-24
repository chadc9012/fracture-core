import { describe, expect, test } from "bun:test";
import { badlands, formationFits, nearCourse, wastelands } from "./badlands";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { landmarksIn } from "./landmarks";
import { RUST_RUN } from "./wasteland-activities";

describe("Wastelands badlands", () => {
  const f = badlands();
  test("a valley of rock towers: several clusters of tall buttes with spires among them", () => {
    expect(f.filter((x) => x.kind === "butte").length).toBeGreaterThanOrEqual(10);
    expect(f.filter((x) => x.kind === "spire").length).toBeGreaterThanOrEqual(6);
    expect(Math.max(...f.map((x) => x.h))).toBeGreaterThan(60);
    expect(badlands()).toEqual(f);
  });
  test("nothing blocks a road, a landmark, the rally loop or a race route, and towers never overlap", () => {
    const w = wastelands();
    for (const a of f) {
      expect(Math.hypot(a.x - w.x, a.z - w.z)).toBeLessThan(w.radius);
      expect(distanceToRoad(a.x, a.z)).toBeGreaterThan(LANE_HALF_WIDTH + a.r);
      expect(nearCourse(a.x, a.z, a.r + 10)).toBe(false);
      for (const l of landmarksIn("wastelands")) expect(Math.hypot(a.x - l.x, a.z - l.z)).toBeGreaterThan(a.r + 30);
      for (const b of f) if (b !== a) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.r + b.r);
    }
    for (const c of RUST_RUN.checkpoints) expect(formationFits(c.x, c.z, 3)).toBe(false);
  });
});
