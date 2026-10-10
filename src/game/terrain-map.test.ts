import { describe, expect, test } from "bun:test";
import { MAP_EXTENT, createMapJob, mapLand, oceanColor, terrainMapPixels } from "./terrain-map";
import { WORLD_RADIUS, scaleSite } from "./world";

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
    const e = scaleSite(-52, 16), s = scaleSite(-18, 76), ember = at(e.x, e.z), solara = at(s.x, s.z);
    expect(Math.abs(ember[0] - solara[0]) + Math.abs(ember[1] - solara[1]) + Math.abs(ember[2] - solara[2])).toBeGreaterThan(60);
  });
  test("the resumable job paints exactly what the one-shot call paints, however small the time slices", () => {
    const job = createMapJob(48);
    let slices = 0;
    while (!job.step(0)) { slices++; expect(job.progress()).toBeLessThan(1); }
    expect(slices).toBeGreaterThan(48);
    expect(job.progress()).toBe(1);
    expect(Array.from(job.pixels)).toEqual(Array.from(terrainMapPixels(48)));
  });
  test("ocean gets darker with depth and land colours are lifted, not blown out", () => {
    const shallow = oceanColor(1), deep = oceanColor(40);
    expect(shallow[0] + shallow[1] + shallow[2]).toBeGreaterThan(deep[0] + deep[1] + deep[2]);
    const lifted = mapLand(0.2, 0.3, 0.2);
    expect(lifted[1]).toBeGreaterThan(0.3);
    expect(Math.max(...mapLand(1, 1, 1))).toBeLessThanOrEqual(1);
  });
});
