import { describe, expect, test } from "bun:test";
import { MAP_ART_ASPECT, MAP_ART_SPOTS } from "./map-art";
import { REGIONS } from "./world";

describe("illustrated map hotspots", () => {
  test("every region has a hotspot inside the picture, and none share a spot", () => {
    for (const r of REGIONS) { const s = MAP_ART_SPOTS[r.id]; expect(s).toBeDefined(); expect(s!.x).toBeGreaterThan(0); expect(s!.x).toBeLessThan(100); expect(s!.y).toBeGreaterThan(0); expect(s!.y).toBeLessThan(100); }
    const spots = REGIONS.map((r) => MAP_ART_SPOTS[r.id]!);
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i]!.x - spots[j]!.x, spots[i]!.y - spots[j]!.y)).toBeGreaterThan(10);
  });
  test("the layout matches the real world: north is up, and regions keep their relative order", () => {
    const by = (id: string) => ({ w: REGIONS.find((r) => r.id === id)!, a: MAP_ART_SPOTS[id]! });
    // world -z is north, art y grows downward: a region further north in the world must be higher up in the picture
    expect(by("frostspire").a.y).toBeLessThan(by("wastelands").a.y);
    expect(by("wastelands").a.y).toBeLessThan(by("solara").a.y);
    expect(by("nexus").a.x).toBeGreaterThan(by("veridan").a.x); // east is right
    expect(by("swamps").a.x).toBeGreaterThan(by("solara").a.x);
    expect(MAP_ART_ASPECT).toBeGreaterThan(1);
  });
});
