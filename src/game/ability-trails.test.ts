import { describe, expect, test } from "bun:test";
import { AFTERIMAGE_COUNT, AFTERIMAGE_SECONDS, afterimages, shieldShell, shockwave, streak, vortex } from "./ability-trails";

describe("ability trails", () => {
  test("dash afterimages lie on the path and fade start-first", () => {
    const g = afterimages(0, 0, 10, 0, 0.01);
    expect(g.length).toBe(AFTERIMAGE_COUNT);
    for (const ghost of g) { expect(ghost.z).toBe(0); expect(ghost.x).toBeGreaterThanOrEqual(0); expect(ghost.x).toBeLessThan(10); }
    const late = afterimages(0, 0, 10, 0, AFTERIMAGE_SECONDS * 0.6);
    expect(late.length).toBeLessThan(AFTERIMAGE_COUNT);
    expect(Math.min(...late.map((x) => x.x))).toBeGreaterThan(0);
    expect(afterimages(0, 0, 10, 0, AFTERIMAGE_SECONDS)).toEqual([]);
  });
  test("no afterimages for a standing cast or reduced motion", () => {
    expect(afterimages(3, 3, 3.2, 3, 0.1)).toEqual([]);
    expect(afterimages(0, 0, 10, 0, 0.1, true)).toEqual([]);
  });
  test("streak thins out and ends", () => {
    expect(streak(0).width).toBeGreaterThan(streak(0.3).width);
    expect(streak(AFTERIMAGE_SECONDS).opacity).toBe(0);
  });
  test("vortex rings stay inside the real radius and stop at the duration", () => {
    for (const r of vortex(0.5, 12, 3)) { expect(r.r).toBeLessThanOrEqual(12); expect(r.r).toBeGreaterThan(0); }
    expect(vortex(3, 12, 3)).toEqual([]);
  });
  test("shield shell lasts exactly the barrier duration", () => {
    expect(shieldShell(4.9, 5).visible).toBe(true);
    expect(shieldShell(5, 5).visible).toBe(false);
  });
  test("shockwave reaches the real radius and never beyond", () => {
    for (let a = 0; a < 0.7; a += 0.05) for (const w of shockwave(a, 12)) expect(w.r).toBeLessThanOrEqual(12);
    expect(shockwave(0.7, 12)).toEqual([]);
  });
});
