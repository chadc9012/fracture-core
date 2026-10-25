import { describe, expect, test } from "bun:test";
import { nexusSigns, streetFaces } from "./nexus-signs";
import { buildings } from "./nexus-districts";

describe("Nexus night signage", () => {
  const s = nexusSigns(), bs = buildings();
  test("banners, holo screens and tower strips exist near the hub", () => {
    expect(s.banners.length).toBeGreaterThan(10);
    expect(s.screens.length).toBeGreaterThan(3);
    expect(s.strips.length).toBeGreaterThan(8);
  });
  test("every sign hangs just off a building wall, above the shopfronts and below the roof", () => {
    for (const b of [...s.banners, ...s.screens]) {
      const host = bs.find((h) => Math.abs(Math.abs(b.x - h.x) - (h.w / 2 + 0.35)) < 0.01 && Math.abs(b.z - h.z) <= h.d / 2 + 0.01 || Math.abs(Math.abs(b.z - h.z) - (h.d / 2 + 0.35)) < 0.01 && Math.abs(b.x - h.x) <= h.w / 2 + 0.01);
      expect(host).toBeDefined();
      expect(b.y - b.h / 2).toBeGreaterThan(host!.base + 4);
      expect(b.y + b.h / 2).toBeLessThan(host!.top + 0.5);
    }
  });
  test("signs face outward from their block, onto a street", () => {
    const f = streetFaces({ ...bs[0]!, x: 10, z: 0 }, { x: 0, z: 0 });
    expect(f).toEqual([{ nx: 1, nz: 0 }]);
  });
});
