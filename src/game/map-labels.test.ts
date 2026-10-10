import { describe, expect, test } from "bun:test";
import { graticule, labelWidth, placeLabels, scaleBarMeters } from "./map-labels";
import { REGIONS } from "./world";
import { MAP_EXTENT } from "./terrain-map";

const regs = REGIONS.map((r) => ({ id: r.id, name: r.name.toUpperCase(), x: r.x, z: r.z }));
const fontSize = MAP_EXTENT * 0.034, markerRadius = MAP_EXTENT * 0.011;

describe("map labels", () => {
  const placed = placeLabels(regs, { extent: MAP_EXTENT, fontSize, markerRadius });
  test("every region gets exactly one label, in input order", () => {
    expect(placed.map((p) => p.id)).toEqual(regs.map((r) => r.id));
  });
  test("no two labels overlap, and none covers a region marker", () => {
    const hit = (a: typeof placed[number]["box"], b: typeof placed[number]["box"]) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) expect(hit(placed[i]!.box, placed[j]!.box)).toBe(false);
      for (const r of regs) expect(hit(placed[i]!.box, { x0: r.x - markerRadius, y0: r.z - markerRadius, x1: r.x + markerRadius, y1: r.z + markerRadius })).toBe(false);
    }
  });
  test("labels stay inside the map frame", () => {
    for (const p of placed) { expect(p.box.x0).toBeGreaterThanOrEqual(-MAP_EXTENT); expect(p.box.x1).toBeLessThanOrEqual(MAP_EXTENT); expect(p.box.y0).toBeGreaterThanOrEqual(-MAP_EXTENT); expect(p.box.y1).toBeLessThanOrEqual(MAP_EXTENT); }
  });
  test("a lone label goes right of its marker", () => {
    const [p] = placeLabels([{ id: "a", name: "ALPHA", x: 0, z: 0 }], { extent: 500, fontSize: 20, markerRadius: 8 });
    expect(p!.anchor).toBe("start");
    expect(p!.box.x1 - p!.box.x0).toBeCloseTo(labelWidth("ALPHA", 20), 5);
  });
  test("crowded neighbours are pushed apart", () => {
    const out = placeLabels([{ id: "a", name: "ONE", x: 0, z: 0 }, { id: "b", name: "TWO", x: 10, z: 5 }, { id: "c", name: "THREE", x: -10, z: 5 }], { extent: 500, fontSize: 20, markerRadius: 6 });
    const hit = (a: any, b: any) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    expect(hit(out[0]!.box, out[1]!.box) || hit(out[0]!.box, out[2]!.box) || hit(out[1]!.box, out[2]!.box)).toBe(false);
  });
  test("scale bar and graticule are sensible", () => {
    expect([100, 200, 250, 500, 1000]).toContain(scaleBarMeters(MAP_EXTENT));
    const g = graticule(MAP_EXTENT, 200);
    expect(g).toContain(0);
    expect(g.every((v) => Math.abs(v) < MAP_EXTENT)).toBe(true);
  });
});
