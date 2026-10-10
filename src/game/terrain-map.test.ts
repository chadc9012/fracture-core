import { describe, expect, test } from "bun:test";
import { MAP_EXTENT, terrainMapPixels } from "./terrain-map";
import { WORLD_RADIUS } from "./world";

describe("terrain map raster", () => {
  const size = 96, px = terrainMapPixels(size);
  const at = (x: number, z: number) => { const step = (2 * MAP_EXTENT) / size, i = Math.floor((x + MAP_EXTENT) / step), j = Math.floor((z + MAP_EXTENT) / step), k = (j * size + i) * 4; return [px[k]!, px[k + 1]!, px[k + 2]!] as const; };
  test("has the right size and is opaque", () => {
    expect(px.length).toBe(size * size * 4);
    for (let k = 3; k < px.length; k += 4) expect(px[k]).toBe(255);
  });
  test("the open ocean beyond the coast is blue and the land is not", () => {
    const [r, , b] = at(-MAP_EXTENT + 3, -MAP_EXTENT + 3);
    expect(b).toBeGreaterThan(r + 40);
    const nexus = at(78, 6);
    expect(nexus[0] + nexus[1] + nexus[2]).toBeGreaterThan(60);
  });
  test("is deterministic and the extent covers the whole world", () => {
    expect(Array.from(terrainMapPixels(size).slice(0, 400))).toEqual(Array.from(px.slice(0, 400)));
    expect(MAP_EXTENT).toBeGreaterThan(WORLD_RADIUS);
  });
  test("the volcano and the desert have different colours", () => {
    const ember = at(-52, 16), solara = at(-18, 76);
    expect(Math.abs(ember[0] - solara[0]) + Math.abs(ember[1] - solara[1]) + Math.abs(ember[2] - solara[2])).toBeGreaterThan(60);
  });
});
