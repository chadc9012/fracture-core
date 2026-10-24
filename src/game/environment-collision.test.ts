import { describe, expect, test } from "bun:test";
import { addObstacle, collideBodySwept, resetObstacles } from "./obstacles";
import { clampToFloor, registeredModelSolids, removeModelSolid, roomSolids, setModelSolid, structureSolids, sweepSolids } from "./environment-collision";
import { buildInterior } from "./destruction";
import { DOOR_RADIUS, INTERIORS, INTERIOR_ALTITUDE } from "./interiors";
import { REGIONS } from "./world";
import { walkHeight } from "./terrain";

describe("player and vehicle environment collision", () => {
  test("model bounds block their full footprint and unmount removes collision", () => {
    setModelSolid("test-building", { x: 0, y: 5, z: 0, w: 10, h: 10, d: 10 });
    const body = { x: 20, z: 4 };
    expect(sweepSolids(body, { x: -20, z: 4 }, 0, 2, 1, registeredModelSolids())).toBe(true);
    expect(body.x).toBeLessThanOrEqual(-6);
    removeModelSolid("test-building");
    expect(registeredModelSolids()).toHaveLength(0);
  });
  for (const radius of [1, 3.1]) {
    test(`radius ${radius}: fast travel cannot tunnel through a prop or crossed grid cell`, () => {
      resetObstacles(); addObstacle("tower", -24, 0, 1, 400, 2);
      const body = { x: 60, z: 0 };
      expect(collideBodySwept(body, { x: -90, z: 0 }, radius, 100, 2.4).hit).toBe(true);
      expect(body.x).toBeLessThan(-24 - radius - 1);
      resetObstacles();
    });
    test(`radius ${radius}: thin walls block fast motion from both sides`, () => {
      const wall = [{ x: 0, y: 2, z: 0, w: 0.2, h: 4, d: 20 }];
      for (const sign of [-1, 1]) {
        const body = { x: sign * 20, z: 0 };
        expect(sweepSolids(body, { x: -sign * 20, z: 0 }, 0, 2, radius, wall)).toBe(true);
        expect(body.x * sign).toBeLessThanOrEqual(-radius - .1);
      }
    });
    test(`radius ${radius}: never below real terrain in any region`, () => {
      for (const r of REGIONS) for (let i = -10; i <= 10; i++) {
        const floor = walkHeight(r.x + i, r.z + i), offset = radius === 1 ? 1.6 : 1.9;
        const body = { y: floor - 30, vy: -100 };
        expect(clampToFloor(body, floor, offset)).toBe(true);
        expect(body.y).toBeGreaterThanOrEqual(floor + offset);
        expect(body.vy).toBe(0);
      }
    });
  }
  test("exact-center overlap separates instead of leaving the body embedded", () => {
    resetObstacles(); addObstacle("rock", 0, 0, 2, 400, 1);
    const body = { x: 0, z: 0 };
    collideBodySwept(body, body, 1, 8);
    expect(Math.hypot(body.x, body.z)).toBeGreaterThanOrEqual(3);
    resetObstacles();
  });
  test("empty path and airborne wall clearance remain traversable", () => {
    resetObstacles(); const body = { x: 20, z: 0 };
    expect(collideBodySwept(body, { x: 0, z: 0 }, 1, 8).hit).toBe(false);
    expect(body.x).toBeCloseTo(20);
    expect(sweepSolids(body, { x: -20, z: 0 }, 10, 2, 1, [{ x: 0, y: 2, z: 0, w: 1, h: 4, d: 10 }])).toBe(false);
    expect(body.x).toBeCloseTo(20);
  });
  test("room side walls block movement, but exit gap remains open", () => {
    const room = INTERIORS[0]; if (!room) throw new Error("Missing room");
    const boxes = roomSolids(room, INTERIOR_ALTITUDE);
    const body = { x: room.origin.x + 15, z: room.origin.z };
    expect(sweepSolids(body, room.origin, INTERIOR_ALTITUDE, 1.8, 1, boxes)).toBe(true);
    expect(body.x).toBeLessThanOrEqual(room.origin.x + 3.85);
    const exit = { x: room.origin.x, z: room.origin.z + 7 };
    expect(sweepSolids(exit, room.origin, INTERIOR_ALTITUDE, 1.8, 1, boxes)).toBe(false);
  });
  test("destroyed structural walls no longer block movement", () => {
    const s = buildInterior("test", 0, 0, 0), wall = s.nodes.get("wall-north");
    if (!wall) throw new Error("Missing wall");
    expect(structureSolids(s.nodes.values())).toContain(wall);
    wall.isDestroyed = true;
    expect(structureSolids(s.nodes.values())).not.toContain(wall);
  });
});
describe("pocket rooms at life size", () => {
  test("every interior spawns the player clear of its own exit marker", () => {
    for (const i of INTERIORS) expect(Math.hypot(i.spawnOffset.x - i.exitOffset.x, i.spawnOffset.z - i.exitOffset.z)).toBeGreaterThan(DOOR_RADIUS + 0.5);
  });
  test("a three-room home: every room is reachable through the internal doorways, and the outer shell still holds", () => {
    const room = INTERIORS.find((i) => i.kind === "HOME")!;
    const boxes = roomSolids(room, INTERIOR_ALTITUDE, 3);
    const o = room.origin;
    const walker = { x: o.x + 20, z: o.z };
    expect(sweepSolids(walker, { x: o.x, z: o.z }, INTERIOR_ALTITUDE, 1.85, 0.5, boxes)).toBe(false);
    expect(walker.x).toBeCloseTo(o.x + 20);
    const wall = { x: o.x + 10, z: o.z - 4 };
    expect(sweepSolids(wall, { x: o.x, z: o.z - 4 }, INTERIOR_ALTITUDE, 1.85, 0.5, boxes)).toBe(true);
    const out = { x: o.x + 40, z: o.z };
    expect(sweepSolids(out, { x: o.x + 20, z: o.z }, INTERIOR_ALTITUDE, 1.85, 0.5, boxes)).toBe(true);
    expect(out.x).toBeLessThan(o.x + 25);
  });
});
