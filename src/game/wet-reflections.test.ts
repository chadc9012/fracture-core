import { describe, expect, test } from "bun:test";
import { WET, cityGlints, streak, wetness } from "./wet-reflections";

describe("wet street reflections", () => {
  const glints = cityGlints();
  test("every city street lamp gets a glint, Nexus warm and Neon in its sign colour", () => {
    expect(glints.length).toBeGreaterThan(50);
    for (const g of glints) { expect(g.color).toMatch(/^#[0-9a-f]{6}$/i); expect(g.h).toBeGreaterThan(5); }
  });
  test("a streak starts under the light and runs toward the viewer, longer for a farther light, capped by the light height", () => {
    const g = { x: 0, z: 0, h: 7, color: "#ffffff", w: 1 };
    const near = streak(0, 10, g)!, far = streak(0, 60, g)!;
    expect(near.cz).toBeGreaterThan(0);                       // centre lies between the light and the camera
    expect(near.cz).toBeLessThan(10);
    expect(far.len).toBeGreaterThan(near.len);
    expect(far.len).toBeLessThanOrEqual(7 * WET.perHeight + 1e-9);
    expect(Math.abs(near.yaw)).toBeLessThan(1e-9);            // camera straight down +z
    expect(streak(0, WET.range + 1, g)).toBeNull();
    expect(streak(0, 0.5, g)).toBeNull();
  });
  test("streets are soaked at night and in rain, only damp on a dry day", () => {
    expect(wetness(0, 0)).toBeLessThan(0.4);
    expect(wetness(1, 0)).toBeGreaterThan(0.75);
    expect(wetness(0, 1)).toBeGreaterThan(0.8);
    expect(wetness(1, 1)).toBeLessThanOrEqual(1);
  });
});
