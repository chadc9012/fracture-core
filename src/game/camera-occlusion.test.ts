import { afterEach, describe, expect, test } from "bun:test";
import { CAMERA_MIN_T, boomClearance } from "./camera-occlusion";
import { addObstacle, resetObstacles } from "./obstacles";
import { clearWalls, setWalls } from "./walls";

afterEach(() => { resetObstacles(); clearWalls(); });

describe("camera boom occlusion", () => {
  test("a clear boom stays full length", () => {
    expect(boomClearance({ x: 0, y: 2, z: 0 }, { x: 0, y: 4, z: -6 })).toBe(1);
  });
  test("a tree trunk behind the player pulls the camera in front of it", () => {
    addObstacle("tree", 0, -4, 0.8, 100, 1);
    const t = boomClearance({ x: 0, y: 2, z: 0 }, { x: 0, y: 4, z: -6 });
    expect(t).toBeLessThan(0.5);
    expect(t).toBeGreaterThanOrEqual(CAMERA_MIN_T);
  });
  test("a wall below the camera height does not block, one across the boom does", () => {
    setWalls("test", [{ ax: -5, az: -3, bx: 5, bz: -3, half: 0.2, base: 0, top: 1 }]);
    expect(boomClearance({ x: 0, y: 2, z: 0 }, { x: 0, y: 4, z: -6 })).toBe(1);
    setWalls("test", [{ ax: -5, az: -3, bx: 5, bz: -3, half: 0.2, base: 0, top: 10 }]);
    expect(boomClearance({ x: 0, y: 2, z: 0 }, { x: 0, y: 4, z: -6 })).toBeLessThan(0.5);
  });
});
