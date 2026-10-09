import { describe, expect, test } from "bun:test";
import { FURROW, aroundScatter, inFurrow, vegetationOk, COVER, CRASH_SITE, ENCOUNTER, FOREST_SPAWN, NEW_INVESTIGATION, TRAIL, TRAIL_HALF_WIDTH, forestScatter, isReserved, shouldWakePatrol, stepInvestigation, trailEdgeScatter, trailInfo, trailMask } from "./verdant";
import { REGIONS } from "./world";
import { clusterAround } from "./foliage";
import { heightAt, slopeAt, WATER_LEVEL } from "./terrain";
const mulberry32 = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const forest = REGIONS.find((r) => r.id === "veridan")!;

describe("verdant trail", () => {
  test("starts at the spawn and ends at the crash site", () => {
    expect(Math.hypot(TRAIL[0]!.x - FOREST_SPAWN.x, TRAIL[0]!.z - FOREST_SPAWN.z)).toBeLessThan(0.01);
    const end = TRAIL[TRAIL.length - 1]!;
    expect(Math.hypot(end.x - CRASH_SITE.x, end.z - CRASH_SITE.z)).toBeLessThan(CRASH_SITE.radius);
  });
  test("is walkable: dry, inside the region and never steeper than traction allows", () => {
    for (const p of TRAIL) {
      expect(Math.hypot(p.x - forest.x, p.z - forest.z)).toBeLessThan(forest.radius);
      expect(heightAt(p.x, p.z)).toBeGreaterThan(WATER_LEVEL + 1.5);
      expect(slopeAt(p.x, p.z)).toBeLessThan(0.45);
    }
  });
  test("the encounter and crash clearings are dry and gentle", () => {
    for (const c of [ENCOUNTER, CRASH_SITE]) {
      expect(heightAt(c.x, c.z)).toBeGreaterThan(WATER_LEVEL + 1.5);
      expect(slopeAt(c.x, c.z)).toBeLessThan(0.45);
    }
  });
  test("the ambush clearing sits beside the trail", () => {
    expect(trailInfo(ENCOUNTER.x, ENCOUNTER.z).dist).toBeLessThan(ENCOUNTER.radius);
  });
  test("trail mask is 1 on the centre-line and 0 well off it", () => {
    const mid = TRAIL[Math.floor(TRAIL.length / 2)]!;
    expect(trailMask(mid.x, mid.z)).toBe(1);
    expect(trailMask(forest.x + 60, forest.z)).toBe(0);
  });
});

describe("verdant reserved ground", () => {
  test("spawn, trail and crash pad are reserved; open woods are not", () => {
    expect(isReserved(FOREST_SPAWN.x + 3, FOREST_SPAWN.z)).toBe(true);
    expect(isReserved(CRASH_SITE.x, CRASH_SITE.z)).toBe(true);
    expect(isReserved(TRAIL[30]!.x, TRAIL[30]!.z)).toBe(true);
    expect(isReserved(forest.x + 28, forest.z + 8)).toBe(false);
  });
  test("scattered scenery never lands on reserved ground", () => {
    const pts = forestScatter(200, mulberry32(5), () => true, 0.5);
    expect(pts.length).toBeGreaterThan(100);
    for (const p of pts) expect(isReserved(p.x, p.z)).toBe(false);
  });
  test("trail-edge scatter hugs the trail but stays off the walkable strip", () => {
    const pts = trailEdgeScatter(80, mulberry32(9), TRAIL_HALF_WIDTH + 0.8, TRAIL_HALF_WIDTH + 6, () => true);
    for (const p of pts) {
      const d = trailInfo(p.x, p.z).dist;
      expect(d).toBeGreaterThan(TRAIL_HALF_WIDTH);
    }
  });
  test("cover objects leave the trail itself open", () => {
    for (const c of COVER) expect(trailInfo(c.x, c.z).dist).toBeGreaterThan(TRAIL_HALF_WIDTH + c.r);
  });
});

describe("crash-site investigation", () => {
  test("announces on approach, fills while scanning, completes once", () => {
    let s = NEW_INVESTIGATION;
    const far = stepInvestigation(s, 0.1, 80);
    expect(far.event).toBeNull();
    const near = stepInvestigation(far.next, 0.1, CRASH_SITE.radius + 10);
    expect(near.event).toBe("APPROACH");
    s = near.next;
    let done = 0;
    for (let i = 0; i < 100; i++) {
      const r = stepInvestigation(s, 0.1, 2);
      s = r.next;
      if (r.event === "COMPLETE") done++;
    }
    expect(done).toBe(1);
    expect(s.done).toBe(true);
  });
  test("scan drains when the player leaves", () => {
    const half = stepInvestigation(NEW_INVESTIGATION, 2, 1).next;
    expect(half.scan).toBeGreaterThan(0.4);
    expect(stepInvestigation(half, 1, 40).next.scan).toBeLessThan(half.scan);
  });
  test("the patrol wakes once", () => {
    expect(shouldWakePatrol(ENCOUNTER.triggerRadius - 1, false)).toBe(true);
    expect(shouldWakePatrol(ENCOUNTER.triggerRadius - 1, true)).toBe(false);
    expect(shouldWakePatrol(ENCOUNTER.triggerRadius + 5, false)).toBe(false);
  });
});

describe("crash-site surroundings", () => {
  const dry = (x: number, z: number) => heightAt(x, z) > WATER_LEVEL + 2 && slopeAt(x, z) < 0.6;
  test("the furrow is dry, gentle and clear of the trail", () => {
    for (let a = 5; a <= FURROW.length; a += 1.5) { // the first metres are the hull itself, where the trail ends
      const x = CRASH_SITE.x + FURROW.dx * a, z = CRASH_SITE.z + FURROW.dz * a;
      expect(dry(x, z)).toBe(true);
      expect(slopeAt(x, z)).toBeLessThan(0.45);
      expect(trailInfo(x, z).dist).toBeGreaterThan(TRAIL_HALF_WIDTH + FURROW.width / 2);
    }
  });
  test("plants ringing the wreck stay off the trail, furrow and hull", () => {
    const pts = aroundScatter(120, mulberry32(3), 8.5, 15, dry);
    expect(pts.length).toBeGreaterThan(60);
    for (const p of pts) {
      expect(Math.hypot(p.x - CRASH_SITE.x, p.z - CRASH_SITE.z)).toBeGreaterThanOrEqual(8.5);
      expect(trailInfo(p.x, p.z).dist).toBeGreaterThan(TRAIL_HALF_WIDTH);
      expect(inFurrow(p.x, p.z)).toBe(false);
    }
  });
  test("clustered undergrowth never lands where vegetation is not allowed", () => {
    const parents = forestScatter(30, mulberry32(8), dry, 1);
    const kids = clusterAround(parents, 6, mulberry32(9), (x, z) => dry(x, z) && vegetationOk(x, z), { minRadius: 0.4, maxRadius: 3 });
    expect(kids.length).toBeGreaterThan(50);
    for (const k of kids) { expect(isReserved(k.x, k.z)).toBe(false); expect(inFurrow(k.x, k.z)).toBe(false); }
  });
});
