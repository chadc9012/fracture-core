import { describe, expect, test } from "bun:test";
import { cardinalOf, headingFromYaw, headingLabel, headingTo, relativeDeg } from "./compass";

describe("compass", () => {
  test("yaw -> heading matches the game's forward vector (sin yaw, cos yaw) and north = -z", () => {
    const facing = (yaw: number) => headingTo(0, 0, Math.sin(yaw) * 10, Math.cos(yaw) * 10);
    for (const yaw of [0, 0.5, 1.2, 2.5, -1, -2.9, Math.PI]) expect(headingFromYaw(yaw)).toBeCloseTo(facing(yaw), 6);
    expect(cardinalOf(headingFromYaw(0))).toBe("S");            // yaw 0 faces +z
    expect(cardinalOf(headingFromYaw(Math.PI))).toBe("N");
    expect(cardinalOf(headingFromYaw(Math.PI / 2))).toBe("E");  // +x is east
    expect(cardinalOf(headingFromYaw(-Math.PI / 2))).toBe("W");
  });
  test("headingTo uses the map's orientation", () => {
    expect(headingTo(0, 0, 0, -10)).toBeCloseTo(0, 6);   // up the map
    expect(headingTo(0, 0, 10, 0)).toBeCloseTo(90, 6);   // right
    expect(headingTo(0, 0, 0, 10)).toBeCloseTo(180, 6);
    expect(headingTo(0, 0, -10, 0)).toBeCloseTo(270, 6);
  });
  test("relative bearing is signed, wraps, and is 0 when the target is dead ahead", () => {
    expect(relativeDeg(90, 0)).toBe(90);
    expect(relativeDeg(350, 10)).toBe(-20);
    expect(relativeDeg(10, 350)).toBe(20);
    expect(relativeDeg(180, 0)).toBe(180);
    const yaw = 0.7, h = headingFromYaw(yaw);
    expect(relativeDeg(headingTo(0, 0, Math.sin(yaw) * 50, Math.cos(yaw) * 50), h)).toBeCloseTo(0, 6);
  });
  test("labels", () => { expect(headingLabel(45)).toBe("NE 045°"); expect(headingLabel(359.6)).toBe("N 000°"); });
});
