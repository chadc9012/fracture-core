import { describe, expect, test } from "bun:test";
import { CHUNK, GRASS, GRASS_REACH, chunkClumps, chunkOf, chunksAround } from "./grass-field";
import { REGIONS, NEON_SITE } from "./world";
import { WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";

const at = (id: string) => REGIONS.find((r) => r.id === id)!;
const grow = (x: number, z: number, reach = 2) => chunksAround(x, z, reach).flatMap((c) => chunkClumps(c.cx, c.cz));

describe("near grass field", () => {
  test("a chunk always grows the same grass (walking away and back changes nothing)", () => {
    const v = at("veridan"), { cx, cz } = chunkOf(v.x + 40, v.z - 30);
    expect(chunkClumps(cx, cz)).toEqual(chunkClumps(cx, cz));
  });
  test("chunks around the camera are nearest first and cover the reach", () => {
    const cs = chunksAround(5, 5, 2);
    expect(cs.length).toBe(25); expect(cs[0]).toEqual(chunkOf(5, 5));
  });
  test("the forest is lush, the deserts sparse, Neon City bare", () => {
    const forest = grow(at("veridan").x + 60, at("veridan").z + 40).length;
    const waste = grow(at("wastelands").x, at("wastelands").z).length;
    expect(forest).toBeGreaterThan(waste * 3);
    expect(grow(NEON_SITE.x, NEON_SITE.z, 1).length).toBe(0);
  });
  test("grass never grows underwater or on a road, and stays within its chunk", () => {
    const v = at("veridan");
    for (const c of chunksAround(v.x, v.z, 3)) for (const g of chunkClumps(c.cx, c.cz)) {
      expect(g.y).toBeGreaterThan(WATER_LEVEL);
      expect(distanceToRoad(g.x, g.z)).toBeGreaterThan(LANE_HALF_WIDTH - 1.5); // 2 m rule grid
      expect(Math.floor(g.x / CHUNK)).toBe(c.cx); expect(Math.floor(g.z / CHUNK)).toBe(c.cz);
    }
  });
  test("LOW draws no grass; every region spec has colours", () => {
    expect(GRASS_REACH.LOW.chunks).toBe(0);
    for (const s of Object.values(GRASS)) expect(s.colors.length).toBeGreaterThan(0);
  });
});
