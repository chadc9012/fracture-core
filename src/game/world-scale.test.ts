import { describe, expect, test } from "bun:test";
import { BASE_WORLD_REGIONS, BASE_WORLD_RADIUS, REGIONS, WORLD_RADIUS, WORLD_SCALE, HEIGHT_K, NEON_OFFSET, scaleSite, regionAt } from "./world";
import { BASE_FOOT_SPEED, FOOT_SCALE, SPRINT_MULT } from "./foot-speed";
import { CRASH_SITE, ENCOUNTER, FOREST_SPAWN, TRAIL, TRAIL_LENGTH, COVER, isReserved } from "./verdant";
import { INTERIORS } from "./interiors";
import { heightAt, WATER_LEVEL, riverAt } from "./terrain";
import { LANES, ROAD_SAMPLES, distanceToRoad, laneSamples, ROAD_FAR } from "./lanes";
import { THALASSIA_CENTER } from "./thalassia-site";

describe("world scale", () => {
  test("scale is within bounds and radius follows it", () => {
    expect(WORLD_SCALE).toBeGreaterThanOrEqual(1);
    expect(WORLD_RADIUS).toBe(BASE_WORLD_RADIUS * WORLD_SCALE);
    expect(HEIGHT_K).toBeGreaterThanOrEqual(1);
    expect(HEIGHT_K).toBeLessThanOrEqual(WORLD_SCALE);
  });
  test("regions: wild ones move apart and grow with the scale, Nexus keeps its authored radius", () => {
    expect(REGIONS.length).toBe(BASE_WORLD_REGIONS.length);
    BASE_WORLD_REGIONS.forEach((b, i) => {
      const r = REGIONS[i]!;
      expect(r.id).toBe(b.id);
      expect(r.x).toBeCloseTo(b.x * WORLD_SCALE, 9);
      expect(r.z).toBeCloseTo(b.z * WORLD_SCALE, 9);
      expect(r.radius).toBeCloseTo(b.id === "nexus" ? b.radius : b.radius * WORLD_SCALE, 9);
      expect(Math.hypot(r.x, r.z) + r.radius).toBeLessThan(WORLD_RADIUS); // every region sits inside the playable disc
    });
  });
  test("scaleSite: a region centre maps to the scaled centre, offsets scale (Nexus 1:1), ocean sites scale from the origin", () => {
    for (const b of BASE_WORLD_REGIONS) {
      const r = REGIONS.find((q) => q.id === b.id)!;
      const c = scaleSite(b.x, b.z);
      expect(c.x).toBeCloseTo(r.x, 9); expect(c.z).toBeCloseTo(r.z, 9);
      const o = scaleSite(b.x + 5, b.z - 3);
      expect(o.x - r.x).toBeCloseTo(b.id === "nexus" ? 5 : 5 * WORLD_SCALE, 9);
      expect(o.z - r.z).toBeCloseTo(b.id === "nexus" ? -3 : -3 * WORLD_SCALE, 9);
    }
    const sea = scaleSite(-97, -208);
    expect(sea.x).toBeCloseTo(-97 * WORLD_SCALE, 9);
    expect(THALASSIA_CENTER).toEqual(sea);
  });
  test("scale 1 is the identity for every authored site", () => {
    if (WORLD_SCALE !== 1) return;
    expect(scaleSite(-40, -50)).toEqual({ x: -40, z: -50 });
    expect(CRASH_SITE.x).toBe(-69); expect(CRASH_SITE.z).toBe(-61);
    expect(ENCOUNTER.x).toBe(-81); expect(ENCOUNTER.z).toBe(-42);
    expect(THALASSIA_CENTER).toEqual({ x: -97, z: -208 });
    expect(NEON_OFFSET).toEqual({ x: 82, z: -38 });
  });
  test("foot speed: slower walk and ~30 sprint on the big map, original values at scale 1", () => {
    if (WORLD_SCALE === 1) { expect(BASE_FOOT_SPEED).toBe(30); expect(SPRINT_MULT).toBe(2.1); expect(FOOT_SCALE).toBe(1); }
    else { expect(BASE_FOOT_SPEED).toBe(14); expect(BASE_FOOT_SPEED * SPRINT_MULT).toBeGreaterThan(28); expect(BASE_FOOT_SPEED * SPRINT_MULT).toBeLessThan(32); }
  });
});

describe("authored sites survive the rescale", () => {
  test("the forest route is on dry land inside the forest and grows with the map", () => {
    const forest = REGIONS.find((r) => r.id === "veridan")!;
    for (const p of TRAIL) {
      expect(Math.hypot(p.x - forest.x, p.z - forest.z)).toBeLessThan(forest.radius);
      expect(heightAt(p.x, p.z)).toBeGreaterThan(WATER_LEVEL + 0.5);
      const rv = riverAt(p.x, p.z);
      expect(!rv || rv.dist > rv.w + 1).toBe(true);
    }
    expect(Math.hypot(TRAIL[0]!.x - FOREST_SPAWN.x, TRAIL[0]!.z - FOREST_SPAWN.z)).toBeLessThan(0.01);
    expect(TRAIL_LENGTH).toBeGreaterThan(40 * WORLD_SCALE);
  });
  test("crash site, clearing and cover keep their authored human-scale layout", () => {
    const end = TRAIL[TRAIL.length - 1]!;
    expect(Math.hypot(CRASH_SITE.x - end.x, CRASH_SITE.z - end.z)).toBeCloseTo(1, 6);
    expect(COVER.every((c) => Math.hypot(c.x - ENCOUNTER.x, c.z - ENCOUNTER.z) < ENCOUNTER.radius + 2)).toBe(true);
    expect(isReserved(CRASH_SITE.x, CRASH_SITE.z)).toBe(true);
    expect(isReserved(FOREST_SPAWN.x, FOREST_SPAWN.z)).toBe(true);
  });
  test("interior doors stand in their regions on dry ground", () => {
    for (const i of INTERIORS) {
      const r = regionAt(i.doorPos.x, i.doorPos.z);
      expect(r).not.toBeNull();
      expect(heightAt(i.doorPos.x, i.doorPos.z)).toBeGreaterThan(WATER_LEVEL);
    }
  });
  test("the bucketed road lookup agrees with a brute-force scan", () => {
    const pts = LANES.flatMap((l) => laneSamples(l, ROAD_SAMPLES));
    let checked = 0;
    for (let k = 0; k < 400; k++) {
      const p = pts[(k * 37) % pts.length]!;
      const x = p.x + ((k * 13) % 41) - 20, z = p.z + ((k * 29) % 37) - 18;
      let best = Infinity;
      for (const q of pts) best = Math.min(best, Math.hypot(q.x - x, q.z - z));
      const d = distanceToRoad(x, z);
      if (best < ROAD_FAR) { expect(d).toBeCloseTo(best, 9); checked++; } else expect(d).toBe(ROAD_FAR);
    }
    expect(checked).toBeGreaterThan(100);
  });
});
