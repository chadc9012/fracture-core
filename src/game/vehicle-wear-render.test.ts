import { describe, expect, test } from "bun:test";
import { wearLook, flatWheelIndices, wearKey } from "./vehicle-wear-render";
describe("vehicle wear render", () => {
  test("fresh car has no flats and no sag", () => { const l = wearLook({ tires: 0, suspension: 0 }); expect(l.flatCount).toBe(0); expect(l.sag).toBe(0); expect(l.flatSink).toBe(0); });
  test("flat tyres rise monotonically with wear, capped at 4", () => {
    let last = 0;
    for (let t = 0; t <= 150; t += 5) { const n = wearLook({ tires: t, suspension: 0 }).flatCount; expect(n).toBeGreaterThanOrEqual(last); last = n; }
    expect(last).toBe(4);
  });
  test("sag scales with suspension damage and clamps", () => {
    expect(wearLook({ tires: 0, suspension: 50 }).sag).toBeCloseTo(0.5);
    expect(wearLook({ tires: 0, suspension: 400 }).sag).toBe(1);
  });
  test("bad input is treated as no wear", () => { expect(wearLook({ tires: NaN, suspension: NaN })).toEqual({ flatCount: 0, flatSink: 0, sag: 0 }); });
  test("flat wheel indices are stable prefixes and fit the wheel count", () => {
    expect(flatWheelIndices(2, 4)).toEqual([3, 0]);
    expect(flatWheelIndices(4, 4)).toEqual([3, 0, 2, 1]);
    expect(flatWheelIndices(4, 2)).toEqual([0, 1]);
    expect(flatWheelIndices(0, 4)).toEqual([]);
  });
  test("key changes only when the look changes visibly", () => { expect(wearKey(wearLook({ tires: 40, suspension: 50 }))).toBe(wearKey(wearLook({ tires: 41, suspension: 50.4 }))); });
});
