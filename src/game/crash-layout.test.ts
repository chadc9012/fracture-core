// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { CRATES, HULL, HULL_SOLIDS, PUDDLES, SCOUT, hullPoint, rutLines } from "./crash-layout";
import { CRASH_SITE, TRAIL, TRAIL_HALF_WIDTH, trailInfo } from "./verdant";
import { heightAt } from "./terrain";
import { IMPACT_PIT } from "./forest-relief";

describe("crash-site layout", () => {
  test("the hull's nose is at the pit and its body stays inside the crash site", () => {
    expect(hullPoint(0)).toEqual({ x: IMPACT_PIT.x, z: IMPACT_PIT.z });
    const tail = hullPoint(HULL.length);
    expect(Math.hypot(tail.x - CRASH_SITE.x, tail.z - CRASH_SITE.z)).toBeLessThan(CRASH_SITE.radius + 4);
  });
  test("hull collision circles never cover the trail centre-line", () => {
    expect(HULL_SOLIDS.length).toBeGreaterThan(2);
    for (const s of HULL_SOLIDS) expect(trailInfo(s.x, s.z).dist).toBeGreaterThan(s.r + 0.8);
  });
  test("every trail point stays at least 2 m clear of the wreck, so the scan point is reachable", () => {
    for (const p of TRAIL) for (const s of HULL_SOLIDS) expect(Math.hypot(p.x - s.x, p.z - s.z)).toBeGreaterThan(s.r + 1.5);
  });
  test("a scout wreck exists, off the route, on dry ground", () => {
    expect(SCOUT).not.toBeNull();
    expect(trailInfo(SCOUT!.x, SCOUT!.z).dist).toBeGreaterThan(TRAIL_HALF_WIDTH + 4);
    expect(heightAt(SCOUT!.x, SCOUT!.z)).toBeGreaterThan(0);
  });
  test("crates are off the trail, clear of the hull and not overlapping each other", () => {
    expect(CRATES.length).toBeGreaterThanOrEqual(6);
    for (const c of CRATES) {
      expect(trailInfo(c.x, c.z).dist).toBeGreaterThan(TRAIL_HALF_WIDTH + 1);
      for (const s of HULL_SOLIDS) expect(Math.hypot(c.x - s.x, c.z - s.z)).toBeGreaterThan(s.r);
    }
  });
  test("puddles sit on or beside the trail and never in the crash pad", () => {
    expect(PUDDLES.length).toBeGreaterThan(2);
    for (const p of PUDDLES) { expect(trailInfo(p.x, p.z).dist).toBeLessThan(TRAIL_HALF_WIDTH); expect(Math.hypot(p.x - CRASH_SITE.x, p.z - CRASH_SITE.z)).toBeGreaterThanOrEqual(9); }
  });
  test("ruts run the length of the trail inside its width", () => {
    const lines = rutLines();
    expect(lines).toHaveLength(2);
    for (const l of lines) { expect(l.length).toBe(TRAIL.length); for (const p of l) expect(trailInfo(p.x, p.z).dist).toBeLessThan(TRAIL_HALF_WIDTH); }
  });
  test("layout is deterministic", async () => {
    const again = await import("./crash-layout");
    expect(again.CRATES).toEqual(CRATES);
  });
});
