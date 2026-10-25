import { describe, expect, test } from "bun:test";
import { RIDGES, ridgeProfile } from "./horizon-ridges";

describe("horizon ridges", () => {
  const near = ridgeProfile("near"), far = ridgeProfile("far");
  test("heights stay in each ring's range and the far range stands taller", () => {
    for (const h of near) { expect(h).toBeGreaterThanOrEqual(RIDGES.nearHeight[0]); expect(h).toBeLessThanOrEqual(RIDGES.nearHeight[1]); }
    for (const h of far) { expect(h).toBeGreaterThanOrEqual(RIDGES.farHeight[0]); expect(h).toBeLessThanOrEqual(RIDGES.farHeight[1]); }
    expect(Math.max(...far)).toBeGreaterThan(Math.max(...near));
  });
  test("the ridgeline wraps without a seam and has real relief (peaks and saddles)", () => {
    for (const p of [near, far]) {
      expect(Math.abs(p[0]! - p[p.length - 1]!)).toBeLessThan(25);
      expect(Math.max(...p) - Math.min(...p)).toBeGreaterThan(80);
    }
  });
  test("both rings sit inside the camera far plane (1800 m)", () => {
    expect(RIDGES.far + 50).toBeLessThan(1800);
    expect(RIDGES.near).toBeLessThan(RIDGES.far);
  });
});
