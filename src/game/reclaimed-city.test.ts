import { describe, expect, test } from "bun:test";
import { CITY, citySolids, footprint, inReclaimedCity, insideTower, reclaimedCity, towerPieces, towerVines } from "./reclaimed-city";
import { heightAt, WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { isReserved } from "./verdant";
import { siteById, SITES } from "./region-atlas";

describe("reclaimed city", () => {
  const c = reclaimedCity()!;
  test("stands on the Ancient Ruins site with a block of towers around an open plaza", () => {
    const site = siteById(CITY.siteId)!;
    expect(c).not.toBeNull();
    expect(c.cx).toBe(site.x);
    expect(c.towers.length).toBeGreaterThanOrEqual(2);
    for (const t of c.towers) expect(Math.hypot(t.x - c.cx, t.z - c.cz) - Math.max(t.w, t.d) * 0.7).toBeGreaterThanOrEqual(CITY.plaza);
    expect(c.towers.filter((t) => t.lean !== 0).length).toBe(1);
  });
  test("no footprint touches a road, the forest trail, water or another named site", () => {
    for (const t of c.towers) for (const p of footprint(t, 1)) {
      expect(distanceToRoad(p.x, p.z)).toBeGreaterThan(LANE_HALF_WIDTH);
      expect(isReserved(p.x, p.z, 1)).toBe(false);
      expect(heightAt(p.x, p.z)).toBeGreaterThan(WATER_LEVEL);
      for (const s of SITES) if (s.id !== CITY.siteId) expect(Math.hypot(s.x - p.x, s.z - p.z)).toBeGreaterThan(s.radius);
    }
  });
  test("towers do not overlap and their foot is never above the ground", () => {
    for (const [i, a] of c.towers.entries()) {
      for (const b of c.towers.slice(i + 1)) for (const p of footprint(b)) expect(insideTower(a, p.x, p.z)).toBe(false);
      for (const p of footprint(a)) expect(a.base).toBeLessThanOrEqual(heightAt(p.x, p.z));
    }
  });
  test("street trees, wrecks and the plaza stay out of the shells; vegetation is kept out too", () => {
    for (const tr of c.trees.filter((q) => !q.roof)) for (const t of c.towers) expect(insideTower(t, tr.x, tr.z)).toBe(false);
    for (const w of c.wrecks) for (const t of c.towers) expect(insideTower(t, w.x, w.z, 1)).toBe(false);
    for (const t of c.towers) expect(inReclaimedCity(t.x, t.z)).toBe(true);
    expect(inReclaimedCity(c.cx, c.cz)).toBe(true);
    expect(inReclaimedCity(c.cx + 500, c.cz)).toBe(false);
  });
  test("every footprint is filled with solid circles", () => {
    const solids = citySolids(c);
    for (const t of c.towers) {
      const inside = solids.filter((s) => insideTower(t, s.x, s.z, 0.01));
      expect(inside.length).toBeGreaterThanOrEqual(4);
      // the footprint centre is within a circle (nothing walks into the middle of a shell)
      expect(solids.some((s) => Math.hypot(s.x - t.x, s.z - t.z) < s.r + 1.2)).toBe(true);
    }
  });
  test("pieces build a broken frame: a slab per storey, columns, window bands, a jagged top; vines hang above ground", () => {
    for (const t of c.towers) {
      const ps = towerPieces(t), top = t.floors * CITY.storey;
      expect(ps.filter((p) => p.g === "slab").length).toBe(t.floors + 1);
      expect(ps.filter((p) => p.g === "column").length).toBeGreaterThan(t.floors * 4);
      expect(ps.some((p) => p.g === "spandrel")).toBe(true);
      expect(ps.some((p) => p.g === "shard" && p.y > top)).toBe(true);
      for (const p of ps) expect(p.y).toBeLessThan(top + CITY.storey * 1.6);
      for (const v of towerVines(t)) { expect(v.y - v.len).toBeGreaterThanOrEqual(0); expect(v.y).toBeLessThanOrEqual(top + 0.5); }
    }
  });
  test("deterministic", () => {
    expect(towerPieces(c.towers[0]!)).toEqual(towerPieces(c.towers[0]!));
  });
});
