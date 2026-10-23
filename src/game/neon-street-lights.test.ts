import { describe, expect, test } from "bun:test";
import { neonLayout, neonClearance, neonStreetLights, BLOCK, TOWER_FOOTPRINT } from "./neon-layout";

describe("Neon street lamps", () => {
  const lamps = neonStreetLights();
  const towers = neonLayout().towers;
  test("there are lamps across the grid, each standing where the city allows a post", () => {
    expect(lamps.length).toBeGreaterThan(towers.length);
    const clear = neonClearance();
    for (const l of lamps) expect(clear(l.x, l.z, 0.6, 0.6)).toBe(true);
  });
  test("no lamp stands inside a tower podium, and no two share a spot", () => {
    for (const l of lamps) for (const t of towers) {
      const [hx, hz] = TOWER_FOOTPRINT[t.variant]; const ex = t.rot % 2 ? hz : hx, ez = t.rot % 2 ? hx : hz;
      expect(Math.abs(l.x - t.x) < ex + 0.3 && Math.abs(l.z - t.z) < ez + 0.3).toBe(false);
    }
    const keys = new Set(lamps.map((l) => `${Math.round(l.x)},${Math.round(l.z)}`));
    expect(keys.size).toBe(lamps.length);
  });
  test("each lamp is at a block corner, its arm reaching out over the street", () => {
    for (const l of lamps) expect(Math.hypot(Math.sin(l.yaw), Math.cos(l.yaw))).toBeCloseTo(1, 9);
    expect(BLOCK * 0.36).toBeGreaterThan(9); // past the largest podium half-extent
  });
});
