import { expect, test } from "bun:test";
import { glitchAnomalies, leafHover, ripples } from "./glitch-anomalies";
import { isReserved, TRAIL_HALF_WIDTH, trailInfo } from "./verdant";

test("glitch anomalies sit beside the trail, never on it or in a clearing", () => {
  const a = glitchAnomalies();
  expect(a.length).toBe(3);
  for (const g of a) {
    expect(isReserved(g.x, g.z)).toBe(false);
    const d = trailInfo(g.x, g.z).dist;
    expect(d).toBeGreaterThan(TRAIL_HALF_WIDTH + 1);
    expect(d).toBeLessThan(16); // close enough to be seen from the trail
  }
});

test("leaf is nearly frozen with periodic skips; ripples expand and fade", () => {
  let skips = 0;
  for (let t = 0; t < 8.4; t += 0.05) { const h = leafHover(t, 0); expect(Math.abs(h.dy)).toBeLessThan(0.11); if (h.skip) skips++; }
  expect(skips).toBeGreaterThan(0);
  const r = ripples(1);
  expect(r.length).toBe(3);
  for (const x of r) { expect(x.r).toBeGreaterThan(0); expect(x.o).toBeLessThanOrEqual(0.8); }
});
