import { describe, expect, test } from "bun:test";
import { BLOCK, TOWER_FOOTPRINT, neonTowers, neonTowersWorld } from "./neon-layout";
import { RACE_GATES } from "./neon-districts";
import { NEON_FLAT, NEON_SITE } from "./world";
import { REGIONAL_SHOPS } from "./regional-shops";
import { INTERIORS } from "./interiors";

const reachOf = (t: ReturnType<typeof neonTowers>[number]) => Math.hypot(...TOWER_FOOTPRINT[t.variant]);

describe("Neon City tower blocks", () => {
  const keep = [...REGIONAL_SHOPS.map((s) => ({ x: s.x, z: s.z, r: 8 })), ...INTERIORS.map((i) => ({ x: i.doorPos.x, z: i.doorPos.z, r: 6 }))];
  const towers = neonTowersWorld(keep);
  test("fills the plateau with a real skyline, deterministically", () => {
    // a real skyline for the plateau the map has room for: 160 m at the default scale, 135 m on the ?worldScale=4 map
    // (a few outer blocks hold walk-in residences instead, residences.ts, and the Skyline Casino plot takes a few more)
    expect(towers.length).toBeGreaterThan(NEON_FLAT >= 150 ? 30 : NEON_FLAT >= 120 ? 12 : 0);
    expect(neonTowersWorld(keep)).toEqual(towers);
  });
  test("every tower stands on the plateau, on the street grid, without overlapping another", () => {
    for (const t of towers) {
      const lx = t.x - NEON_SITE.x, lz = t.z - NEON_SITE.z;
      expect(Math.hypot(lx, lz) + reachOf(t)).toBeLessThanOrEqual(NEON_FLAT - 10 + 1e-9);
      expect(Math.abs(lx / BLOCK - Math.round(lx / BLOCK))).toBeLessThan(1e-9);
      expect(Math.abs(lz / BLOCK - Math.round(lz / BLOCK))).toBeLessThan(1e-9);
    }
    for (let a = 0; a < towers.length; a++) for (let b = a + 1; b < towers.length; b++) {
      expect(Math.hypot(towers[a]!.x - towers[b]!.x, towers[a]!.z - towers[b]!.z)).toBeGreaterThanOrEqual(BLOCK - 1e-9);
    }
  });
  test("the race loop stays open, and no shop counter or door is walled in", () => {
    for (const t of towers) {
      const lx = t.x - NEON_SITE.x, lz = t.z - NEON_SITE.z;
      for (const g of RACE_GATES) expect(Math.hypot(lx - g.dx, lz - g.dz)).toBeGreaterThan(14);
      for (const k of keep) expect(Math.hypot(t.x - k.x, t.z - k.z)).toBeGreaterThan(k.r);
    }
  });
});
