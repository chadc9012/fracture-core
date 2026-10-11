import { describe, expect, test } from "bun:test";
import { devilAt, dustDevils, hoodoos, mesas, oasis, pillars, placeable, ribcage } from "./solara-dressing";

describe("Solara dressing", () => {
  test("every prop sits on valid open desert (off roads, quicksand orbit, array site and water)", () => {
    for (const set of [mesas(), hoodoos(), pillars()]) {
      expect(set.length).toBeGreaterThan(4);
      for (const p of set) expect(placeable(p.x, p.z, 0)).toBe(true);
    }
  });
  test("there is one oasis with palms around its pool, and a ribcage landmark", () => {
    const o = oasis()!;
    expect(o).not.toBeNull();
    expect(placeable(o.x, o.z, 0)).toBe(true);
    for (const p of o.palms) expect(Math.hypot(p.x - o.x, p.z - o.z)).toBeGreaterThan(o.pool);
    expect(ribcage()).not.toBeNull();
  });
  test("dust devils wander but stay near their dune field", () => {
    for (const d of dustDevils()) for (let t = 0; t < 500; t += 37) { const p = devilAt(d, t); expect(Math.hypot(p.x - d.cx, p.z - d.cz)).toBeLessThanOrEqual(d.orbit * Math.sqrt(1.49) + 1e-9); }
  });
  test("deterministic", () => { expect(mesas()).toEqual(mesas()); expect(oasis()).toEqual(oasis()); });
});
