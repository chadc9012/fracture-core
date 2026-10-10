import { describe, expect, test } from "bun:test";
import { SHAFT_CELL, SHAFT_POOL, forestPresence, shaftStrength, shaftsAround } from "./light-shafts";

describe("light shafts", () => {
  const all = () => true;
  test("placement is deterministic, pooled and nearest-first", () => {
    const a = shaftsAround(100, -40, all), b = shaftsAround(100, -40, all);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(3);
    expect(a.length).toBeLessThanOrEqual(SHAFT_POOL);
    const d = a.map((s) => Math.hypot(s.x - 100, s.z + 40));
    expect(d).toEqual([...d].sort((x, y) => x - y));
  });
  test("a shaft stays put as the camera moves (grid-keyed)", () => {
    const a = shaftsAround(0, 0, all), b = shaftsAround(SHAFT_CELL * 0.4, 5, all);
    const shared = a.filter((s) => b.some((t) => t.id === s.id));
    expect(shared.length).toBeGreaterThan(2);
    for (const s of shared) expect(b.find((t) => t.id === s.id)).toEqual(s);
  });
  test("the acceptance test filters spots", () => {
    expect(shaftsAround(0, 0, () => false)).toEqual([]);
    for (const s of shaftsAround(0, 0, (x) => x > 0)) expect(s.x).toBeGreaterThan(0);
  });
  test("strength: no sun, no beam; clouds dim it; outside the forest it vanishes", () => {
    expect(shaftStrength(-0.2, 0, 1)).toBe(0);
    expect(shaftStrength(0.4, 0, 1)).toBeGreaterThan(0.8);
    expect(shaftStrength(0.4, 1, 1)).toBeLessThan(shaftStrength(0.4, 0, 1) * 0.2);
    expect(shaftStrength(0.4, 0, 0)).toBe(0);
    expect(forestPresence(0, 100)).toBe(1);
    expect(forestPresence(120, 100)).toBe(0);
  });
});
