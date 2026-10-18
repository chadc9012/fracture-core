import { describe, expect, test } from "bun:test";
import { DOOR_RADIUS, HOME_INTERIORS, INTERIORS, doorAt, exitPosition } from "./interiors";
import { heightAt, WATER_LEVEL } from "./terrain";
import { regionAt } from "./world";

describe("home doors", () => {
  test("every home door stands inside a region on dry ground", () => {
    for (const it of HOME_INTERIORS) {
      expect(regionAt(it.doorPos.x, it.doorPos.z), `${it.id} is outside every region`).not.toBeNull();
      expect(heightAt(it.doorPos.x, it.doorPos.z), `${it.id} is in water`).toBeGreaterThan(WATER_LEVEL);
    }
  });
  test("no two doors share a trigger, so one walk-up can never be ambiguous", () => {
    for (const a of INTERIORS) for (const b of INTERIORS) {
      if (a === b) continue;
      expect(Math.hypot(a.doorPos.x - b.doorPos.x, a.doorPos.z - b.doorPos.z), `${a.id} vs ${b.id}`).toBeGreaterThan(DOOR_RADIUS * 2);
    }
  });
  test("pocket rooms never share an origin", () => {
    const keys = INTERIORS.map((i) => `${i.origin.x},${i.origin.z}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("leaving a building", () => {
  test("the exit position is outside the door trigger so you are not pulled straight back in", () => {
    for (const it of INTERIORS) {
      for (const back of [{ x: it.doorPos.x, z: it.doorPos.z }, { x: it.doorPos.x + 0.5, z: it.doorPos.z - 0.4 }, { x: it.doorPos.x + 9, z: it.doorPos.z }]) {
        const out = exitPosition(it.doorPos, back);
        expect(Math.hypot(out.x - it.doorPos.x, out.z - it.doorPos.z)).toBeGreaterThanOrEqual(DOOR_RADIUS);
        expect(doorAt(out.x, out.z)?.id).not.toBe(it.id);
      }
    }
  });
  test("a spot already well outside the door is left alone", () => {
    const out = exitPosition({ x: 0, z: 0 }, { x: 10, z: 0 });
    expect(out).toEqual({ x: 10, z: 0 });
  });
});
