import { describe, expect, test } from "bun:test";
import { CULL_RADIUS, movedEnough, nearIndices } from "./foliage-cull";

describe("foliage culling", () => {
  const items = [{ x: 0, z: 0 }, { x: 50, z: 0 }, { x: 0, z: 200 }, { x: -60, z: 80 }];
  test("keeps only instances inside the radius, in order", () => {
    expect(nearIndices(items, 0, 0, 100)).toEqual([0, 1, 3]);
    expect(nearIndices(items, 0, 0, 10)).toEqual([0]);
    expect(nearIndices(items, 0, 190, 20)).toEqual([2]);
    expect(nearIndices([], 0, 0, 100)).toEqual([]);
  });
  test("boundary is inclusive", () => { expect(nearIndices([{ x: 30, z: 40 }], 0, 0, 50)).toEqual([0]); });
  test("ground cover is culled closer than trees", () => { expect(CULL_RADIUS.fern).toBeLessThan(CULL_RADIUS.fir); });
  test("reselect only after real movement", () => { expect(movedEnough(0, 0, 2, 2)).toBe(false); expect(movedEnough(0, 0, 6, 1)).toBe(true); });
});
