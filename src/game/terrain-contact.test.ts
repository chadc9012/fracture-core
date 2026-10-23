import { describe, expect, test } from "bun:test";
import { terrainContactNormal, terrainContactPosition } from "./terrain-contact";

describe("terrain contact (wasteland overhaul phase 9)", () => {
  test("flat ground faces up with a predictable offset", () => {
    expect(terrainContactNormal(2, 3, () => 10)).toEqual({ x: 0, y: 1, z: 0 });
    expect(terrainContactPosition(2, 3, () => 10, 0.05)).toEqual({ x: 2, y: 10.05, z: 3 });
  });
  test("a slope gives a unit normal pointing up and against the gradient", () => {
    const n = terrainContactNormal(0, 0, (x, z) => 2 * x + z);
    expect(n.x < 0 && n.z < 0 && n.y > 0).toBe(true);
    expect(Math.abs(Math.hypot(n.x, n.y, n.z) - 1)).toBeLessThan(1e-9);
  });
});
