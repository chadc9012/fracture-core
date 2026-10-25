import { describe, expect, test } from "bun:test";
import { SKYRAIL, buildingClearance, deckAt, legs, linePoint, piers, railLines, trainAt } from "./nexus-skyrail";
import { NEXUS, CITY_INNER } from "./nexus-districts";
import { nexusHubTowers, BUILDING_MODELS } from "./building-models";
import { heightAt } from "./terrain";

describe("Nexus sky-rail", () => {
  const lines = railLines().map((l) => ({ l, ps: piers(l) }));
  test("two lines with a pier every block", () => {
    expect(lines.length).toBe(2);
    for (const { ps } of lines) expect(ps.length).toBeGreaterThan(5);
  });
  test("every leg stands in the street, clear of every building and hub tower", () => {
    const hub = nexusHubTowers(NEXUS);
    for (const { ps } of lines) for (const p of ps) for (const g of legs(p)) {
      expect(buildingClearance(g.x, g.z)).toBeGreaterThan(1);
      for (const t of hub) expect(Math.hypot(g.x - t.x, g.z - t.z)).toBeGreaterThan(Math.max(BUILDING_MODELS[t.model].w, BUILDING_MODELS[t.model].d) / 2 + 1);
    }
  });
  test("the deck band never cuts through a building and stays out of the hub plaza", () => {
    for (const { l } of lines) {
      const len = Math.hypot(l.bx - l.ax, l.bz - l.az);
      for (let s = 0; s <= len; s += 2) {
        const p = linePoint(l, s);
        expect(buildingClearance(p.x, p.z)).toBeGreaterThan(SKYRAIL.width / 2);
        expect(Math.hypot(p.x - NEXUS.x, p.z - NEXUS.z)).toBeGreaterThan(CITY_INNER);
      }
    }
  });
  test("the deck rides at least the clearance above the street everywhere", () => {
    for (const { l, ps } of lines) {
      const len = Math.hypot(l.bx - l.ax, l.bz - l.az);
      for (let s = 0; s <= len; s += 3) { const p = linePoint(l, s); expect(deckAt(l, ps, s) - heightAt(p.x, p.z)).toBeGreaterThan(SKYRAIL.clearance - 2.5); }
    }
  });
  test("the train shuttles within the line and moves smoothly", () => {
    const { l } = lines[0]!, len = Math.hypot(l.bx - l.ax, l.bz - l.az);
    let prev = trainAt(l, 0);
    for (let t = 0.1; t < 120; t += 0.1) {
      const s = trainAt(l, t);
      expect(s).toBeGreaterThanOrEqual(SKYRAIL.cars * SKYRAIL.carLen - 1e-6);
      expect(s).toBeLessThanOrEqual(len + 1e-6);
      expect(Math.abs(s - prev)).toBeLessThan(SKYRAIL.speed * 0.1 * 1.7 + 1e-6);
      prev = s;
    }
  });
});
