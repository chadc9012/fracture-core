import { describe, expect, test } from "bun:test";
import { CURSOR, edgePan, nearestTarget, stepCursor } from "./map-cursor";

const T = [{ id: "a", x: 100, z: 0 }];

describe("gamepad map cursor", () => {
  test("a resting stick inside the deadzone does not drift", () => {
    const c = stepCursor({ x: 0, z: 0, hover: null }, { x: 0.1, y: -0.1 }, 0.1, 1000, []);
    expect(c.x).toBe(0); expect(c.z).toBe(0);
  });
  test("full stick moves about `speed` screens per second", () => {
    const c = stepCursor({ x: 0, z: 0, hover: null }, { x: 1, y: 0 }, 1, 1000, []);
    expect(c.x).toBeCloseTo(CURSOR.speed * 1000);
  });
  test("near a marker the cursor slows (friction) and reports the hover", () => {
    const free = stepCursor({ x: 0, z: 300, hover: null }, { x: 1, y: 0 }, 0.05, 1000, T);
    const near = stepCursor({ x: 90, z: 0, hover: null }, { x: 1, y: 0 }, 0.05, 1000, T);
    expect(near.x - 90).toBeCloseTo((free.x - 0) * CURSOR.friction);
    expect(near.hover).toBe("a");
  });
  test("released near a marker it settles onto it", () => {
    let c = { x: 85, z: 10, hover: null as string | null };
    for (let i = 0; i < 30; i++) c = stepCursor(c, { x: 0, y: 0 }, 0.05, 1000, T);
    expect(Math.hypot(c.x - 100, c.z)).toBeLessThan(0.5);
    expect(c.hover).toBe("a");
    expect(nearestTarget(0, 0, T, 10)).toBeNull();
  });
  test("the view follows a cursor that reaches the edge", () => {
    expect(edgePan({ x: 0, z: 0 }, { cx: 0, cz: 0 }, 100)).toEqual({ dx: 0, dz: 0 });
    expect(edgePan({ x: 50, z: 0 }, { cx: 0, cz: 0 }, 100).dx).toBeCloseTo(10);
  });
});
