import { afterEach, describe, expect, test } from "bun:test";
import { addObstacle, collideBody, OBSTACLE_HEIGHT, resetObstacles } from "./obstacles";

describe("aircraft clear the trees and rocks below them", () => {
  afterEach(() => resetObstacles());
  test("a tree stops a car at ground level but not a gunship flying over it", () => {
    resetObstacles();
    addObstacle("tree", 0, 0, 1.2, 100, 1);
    const car = { x: 1, z: 0 };
    expect(collideBody(car, 3.1, 30, 2.4, 0).hit).toBe(true);
    const heli = { x: 1, z: 0 };
    expect(collideBody(heli, 3.1, 30, 2.4, OBSTACLE_HEIGHT.tree + 5).hit).toBe(false);
    expect(heli.x).toBe(1); // not pushed sideways either
  });
  test("a jump that only just leaves the ground still hits a rock; clearing it misses", () => {
    resetObstacles();
    addObstacle("rock", 0, 0, 1.5, 100, 1);
    expect(collideBody({ x: 1, z: 0 }, 3.1, 30, 2.4, 1).hit).toBe(true);
    expect(collideBody({ x: 1, z: 0 }, 3.1, 30, 2.4, OBSTACLE_HEIGHT.rock + 0.5).hit).toBe(false);
  });
});
