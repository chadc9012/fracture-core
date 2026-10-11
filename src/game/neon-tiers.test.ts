import { describe, expect, test } from "bun:test";
import { CHECKPOINT, DECK, DRONE_LANES, SPIRE, deckPillars, laneAt, lanePerimeter, neonWeather, undercity } from "./neon-tiers";

describe("Neon City tiers", () => {
  test("drone lanes are closed loops that never cut through the Spire", () => {
    for (const l of DRONE_LANES) {
      const per = lanePerimeter(l);
      const a = laneAt(l, 0), b = laneAt(l, per);
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1e-6);
      for (let s = 0; s < per; s += 2) { const p = laneAt(l, s); expect(Math.hypot(p.x - SPIRE.x, p.z - SPIRE.z)).toBeGreaterThan(SPIRE.base + 2); }
    }
  });
  test("the checkpoint stands between the market and the Spire, outside the deck ring", () => {
    expect(CHECKPOINT.z).toBeLessThan(-DECK.halfZ);
    expect(CHECKPOINT.z).toBeGreaterThan(SPIRE.z);
  });
  test("deck pillars sit on the ring, never in the market avenue", () => {
    for (const p of deckPillars()) {
      expect(Math.abs(Math.abs(p.x) - DECK.halfX) < 1e-9 || Math.abs(Math.abs(p.z) - DECK.halfZ) < 1e-9).toBe(true);
      expect(Math.abs(p.x)).toBeGreaterThan(10);
    }
  });
  test("undercity kit stays out of the avenue centre", () => { for (const d of undercity()) expect(Math.abs(d.x)).toBeGreaterThan(9.5); });
  test("weather is full inside and fades out", () => {
    expect(neonWeather(0, 0)).toBe(1);
    expect(neonWeather(200, 0)).toBe(0);
    const mid = neonWeather(90, 0); expect(mid).toBeGreaterThan(0); expect(mid).toBeLessThan(1);
  });
});

import { VORTEX, facadeArc, SPIRE as SPIRE_V } from "./neon-tiers";
test("fracture vortex hangs above the Spire crown and facade arcs are brief and periodic", () => {
  expect(VORTEX.y).toBeGreaterThan(SPIRE_V.height + 30);
  let on = 0, n = 0;
  for (let t = 0; t < 55; t += 0.05) { n++; if (facadeArc(t).on) on++; }
  expect(on / n).toBeGreaterThan(0.08);
  expect(on / n).toBeLessThan(0.2);
});
