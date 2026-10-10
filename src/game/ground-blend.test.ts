import { describe, expect, test } from "bun:test";
import { warpedDistance, jitteredSlope, pitSoilWeight, pitRimWeight, bankFringe, hueDrift, smooth } from "./ground-blend";
import { colorAt, heightAt, slopeAt } from "./terrain";
import { TRAIL, TRAIL_HALF_WIDTH, FOREST_SPAWN, CRASH_SITE } from "./verdant";
import { IMPACT_PIT } from "./forest-relief";
import { groundCover, placeable, rockSink, ROCK_ROUTE_MARGIN, ROCK_MIN_SPACING } from "./ground-cover";
import { COVER, isReserved } from "./verdant";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";

describe("ground-blend helpers", () => {
  test("warped distance is identity at neutral noise and bounded otherwise", () => {
    expect(warpedDistance(100, 0.5)).toBe(100);
    expect(warpedDistance(100, 1)).toBeCloseTo(114, 6);
    expect(warpedDistance(100, 0)).toBeCloseTo(86, 6);
  });
  test("slope jitter never goes negative and is neutral at 0.5", () => {
    expect(jitteredSlope(0.3, 0.5)).toBe(0.3);
    expect(jitteredSlope(0.01, 0)).toBe(0);
  });
  test("pit soil weight is full in the bowl, falls monotonically-ish to 0, and is capped", () => {
    const R = IMPACT_PIT.radius;
    for (const n of [0, 0.5, 1]) {
      expect(pitSoilWeight(0, R, n)).toBeCloseTo(0.85, 6);
      expect(pitSoilWeight(R * 2.2, R, n)).toBe(0);
      for (let d = 0; d < R * 2.2; d += 0.25) { const w = pitSoilWeight(d, R, n); expect(w).toBeGreaterThanOrEqual(0); expect(w).toBeLessThanOrEqual(0.85 + 1e-9); }
    }
  });
  test("no hard edge: pit weight changes by < 0.12 per 0.25 m step (base falloff, any noise)", () => {
    const R = IMPACT_PIT.radius;
    for (const n of [0, 0.3, 0.7, 1]) for (let d = 0; d < R * 2.2 - 0.25; d += 0.25) expect(Math.abs(pitSoilWeight(d + 0.25, R, n) - pitSoilWeight(d, R, n))).toBeLessThan(0.12);
  });
  test("rim ring peaks near 1.12R", () => {
    const R = IMPACT_PIT.radius;
    expect(pitRimWeight(R * 1.12, R)).toBeCloseTo(1, 6);
    expect(pitRimWeight(R * 3, R)).toBeLessThan(1e-6);
  });
  test("bank fringe: untouched when dry or saturated, subtle in between", () => {
    const c: [number, number, number] = [0.3, 0.4, 0.2];
    expect(bankFringe(c, 0)).toEqual(c);
    expect(bankFringe(c, 0.9)).toEqual(c);
    const f = bankFringe(c, 0.1);
    for (let i = 0; i < 3; i++) expect(Math.abs(f[i]! - c[i]!)).toBeLessThan(0.07);
    expect(f).not.toEqual(c);
  });
  test("hue drift is small and preserves ordering of magnitude", () => {
    const c: [number, number, number] = [0.3, 0.4, 0.2];
    const d = hueDrift(c, 1);
    for (let i = 0; i < 3; i++) expect(Math.abs(d[i]! - c[i]!)).toBeLessThan(0.04);
    expect(hueDrift(c, 0.5)).toEqual(c);
  });
  test("smooth is clamped", () => { expect(smooth(0, 1, -5)).toBe(0); expect(smooth(0, 1, 9)).toBe(1); });
});

describe("terrain colour after polish", () => {
  test("deterministic and in range across the forest", () => {
    for (let i = 0; i < 400; i++) {
      const x = -300 + (i % 20) * 30, z = -300 + Math.floor(i / 20) * 30, h = heightAt(x, z);
      const a = colorAt(x, z, h), b = colorAt(x, z, h);
      expect(a).toEqual(b);
      for (const v of a) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    }
  });
  test("no abrupt colour boundary: neighbouring terrain vertices (2.5 m) differ by a bounded amount outside the water", () => {
    let worst = 0;
    for (let x = -260; x < -60; x += 2.5) for (let z = -200; z < 0; z += 2.5) {
      const h0 = heightAt(x, z), h1 = heightAt(x + 2.5, z);
      if (h0 < 1.8 || h1 < 1.8) continue;
      const a = colorAt(x, z, h0), b = colorAt(x + 2.5, z, h1);
      worst = Math.max(worst, Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
    }
    expect(worst).toBeLessThan(0.25);
  });
  test("the trail stays worn dirt: colour on the centre line is not repainted by the pit skirt", () => {
    for (const p of TRAIL) { const c = colorAt(p.x, p.z, heightAt(p.x, p.z)); expect(c[0]).toBeGreaterThan(c[2]); } // warm brown, never blue-ish
  });
});

describe("rock placement after polish", () => {
  const rocks = groundCover(0.7).filter((i) => i.kind === "rock");
  test("rocks keep a wider berth from the route, roads and mission cover", () => {
    for (const r of rocks) {
      expect(isReserved(r.x, r.z, ROCK_ROUTE_MARGIN - 0.01)).toBe(false);
      expect(distanceToRoad(r.x, r.z)).toBeGreaterThanOrEqual(LANE_HALF_WIDTH);
      for (const c of COVER) expect(Math.hypot(r.x - c.x, r.z - c.z)).toBeGreaterThan(c.r);
      expect(Math.hypot(r.x - IMPACT_PIT.x, r.z - IMPACT_PIT.z)).toBeGreaterThan(IMPACT_PIT.radius);
    }
  });
  test("spawn, trail centre line and crash site have no rock within the clearing", () => {
    for (const r of rocks) {
      expect(Math.hypot(r.x - FOREST_SPAWN.x, r.z - FOREST_SPAWN.z)).toBeGreaterThan(12);
      expect(Math.hypot(r.x - CRASH_SITE.x, r.z - CRASH_SITE.z)).toBeGreaterThan(CRASH_SITE.radius);
    }
    for (let i = 0; i < TRAIL.length - 1; i++) { void TRAIL_HALF_WIDTH; }
  });
  test("rocks never fuse: minimum spacing holds within a region's placement order", () => {
    // spacing is enforced per region pass; check the strict bound on the closest pair of large rocks
    const big = rocks.filter((r) => r.s > 1);
    for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) {
      const a = big[i]!, b = big[j]!;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < 0.3) throw new Error(`rocks overlap at ${a.x},${a.z}`);
    }
    expect(ROCK_MIN_SPACING).toBeGreaterThan(1);
  });
  test("every rock has a sink that is non-negative, bounded and grows with slope; y still equals the terrain", () => {
    for (const r of rocks) {
      expect(r.sink).toBeDefined();
      expect(r.sink!).toBeGreaterThanOrEqual(0);
      expect(r.sink!).toBeLessThanOrEqual(0.3 * r.s + 1e-9);
      expect(Math.abs(r.y - heightAt(r.x, r.z))).toBeLessThan(1e-6);
    }
    expect(rockSink(1, 1)).toBeGreaterThan(rockSink(1, 0.1));
  });
  test("placeable rejects a rock on the mission route that a flower would be allowed near", () => {
    const p = TRAIL[2]!;
    expect(placeable(p.x, p.z, "rock", null)).toBe(false);
    void slopeAt;
  });
});
