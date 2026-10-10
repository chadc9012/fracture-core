// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { forestRelief, IMPACT_PIT, openWoods, pitRelief } from "./forest-relief";
import { heightAt, slopeAt, WATER_LEVEL } from "./terrain";
import { CRASH_SITE, ENCOUNTER, FOREST_SPAWN, TRAIL, TRAIL_HALF_WIDTH, trailInfo } from "./verdant";
import { REGIONS } from "./world";

const forest = REGIONS.find((r) => r.id === "veridan")!;

describe("forest relief", () => {
  test("hills are exactly zero outside the forest region, so neighbours are untouched (only the pit may reach past the rim)", () => {
    for (const [x, z] of [[forest.x + forest.radius + 1, forest.z], [0, 0], [forest.x, forest.z - forest.radius - 30]]) expect(forestRelief(x!, z!)).toBe(0);
  });
  test("is deterministic", () => {
    expect(forestRelief(-40, -20)).toBe(forestRelief(-40, -20));
  });
  test("adds real shape in open woods but stays within a few metres", () => {
    let lo = Infinity, hi = -Infinity;
    for (let x = forest.x - forest.radius; x < forest.x + forest.radius; x += 6) for (let z = forest.z - forest.radius; z < forest.z + forest.radius; z += 6) {
      if (openWoods(x, z) < 1) continue;
      const r = forestRelief(x, z) - pitRelief(x, z);
      lo = Math.min(lo, r); hi = Math.max(hi, r);
    }
    expect(hi - lo).toBeGreaterThan(1.8);
    expect(Math.max(Math.abs(lo), Math.abs(hi))).toBeLessThan(4);
  });
  test("the authored ground stays level: no relief at the spawn, the ambush clearing centre or on the trail centre-line", () => {
    expect(openWoods(FOREST_SPAWN.x, FOREST_SPAWN.z)).toBe(0);
    expect(openWoods(ENCOUNTER.x, ENCOUNTER.z)).toBe(0);
    for (const p of TRAIL) expect(openWoods(p.x, p.z)).toBe(0);
    for (const p of TRAIL) expect(Math.abs(forestRelief(p.x, p.z))).toBeLessThan(0.5);
  });
  test("the trail, spawn and ambush clearing remain walkable and dry", () => {
    for (const p of TRAIL) { expect(slopeAt(p.x, p.z)).toBeLessThan(0.45); expect(heightAt(p.x, p.z)).toBeGreaterThan(WATER_LEVEL + 1.5); }
    for (const c of [FOREST_SPAWN, ENCOUNTER]) { expect(slopeAt(c.x, c.z)).toBeLessThan(0.45); expect(heightAt(c.x, c.z)).toBeGreaterThan(WATER_LEVEL + 1.5); }
  });
  test("ground is continuous: no step steeper than ~1.1 m of rise per 1 m anywhere in the forest", () => {
    let worst = 0;
    for (let x = forest.x - forest.radius; x < forest.x + forest.radius; x += 1.5) for (let z = forest.z - forest.radius; z < forest.z + forest.radius; z += 1.5) {
      if (Math.hypot(x - forest.x, z - forest.z) > forest.radius * 0.95) continue;
      worst = Math.max(worst, Math.abs(heightAt(x + 1, z) - heightAt(x, z)), Math.abs(heightAt(x, z + 1) - heightAt(x, z)));
    }
    expect(worst).toBeLessThan(1.1);
  });
});

describe("impact pit", () => {
  test("the pit is continuous everywhere, including where it crosses the forest region's rim", () => {
    let worst = 0;
    for (let x = IMPACT_PIT.x - 16; x <= IMPACT_PIT.x + 16; x += 0.25) for (let z = IMPACT_PIT.z - 16; z <= IMPACT_PIT.z + 16; z += 0.25) {
      worst = Math.max(worst, Math.abs(heightAt(x + 0.25, z) - heightAt(x, z)), Math.abs(heightAt(x, z + 0.25) - heightAt(x, z)));
    }
    expect(worst).toBeLessThan(0.5); // 0.25 m step: 2:1 slope at the very most (a rim cut-off was a 1.5 m cliff)
  });
  test("is a real hollow with a raised rim, and its floor is lower than the ground just outside", () => {
    expect(pitRelief(IMPACT_PIT.x, IMPACT_PIT.z)).toBeLessThan(-1.2);
    let rim = -Infinity;
    for (let a = 0; a < 6.28; a += 0.2) rim = Math.max(rim, pitRelief(IMPACT_PIT.x + Math.cos(a) * IMPACT_PIT.radius * 1.2, IMPACT_PIT.z + Math.sin(a) * IMPACT_PIT.radius * 1.2));
    expect(rim).toBeGreaterThan(0.15);
    expect(pitRelief(IMPACT_PIT.x + IMPACT_PIT.radius * 2.2, IMPACT_PIT.z)).toBe(0);
  });
  test("never cuts the trail: the centre-line within reach of the pit is untouched", () => {
    for (const p of TRAIL) expect(Math.abs(pitRelief(p.x, p.z))).toBeLessThan(0.05);
  });
  test("the pit is within the scan radius, so the wreck belongs to the investigation", () => {
    expect(Math.hypot(IMPACT_PIT.x - CRASH_SITE.x, IMPACT_PIT.z - CRASH_SITE.z)).toBeLessThan(CRASH_SITE.scanRadius);
    expect(trailInfo(IMPACT_PIT.x, IMPACT_PIT.z).dist).toBeGreaterThan(TRAIL_HALF_WIDTH);
  });
});
