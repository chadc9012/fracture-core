import { describe, expect, test } from "bun:test";
import { MAP_ART_ASPECT, MAP_ART_LEGEND_LEFT, MAP_ART_SPOTS, MAP_ART_TITLE_BOTTOM, artSpotForWorld, hiresArtUsable } from "./map-art";
import { CITY_DESTINATIONS } from "./destinations";
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

describe("high-resolution art", () => {
  test("a candidate image is used only when it is large enough and the same shape", () => {
    expect(hiresArtUsable(4096, Math.round(4096 / MAP_ART_ASPECT))).toBe(true);
    expect(hiresArtUsable(1158, 791)).toBe(false); // the bundled image is never "upgraded"
    expect(hiresArtUsable(4096, 4096)).toBe(false); // wrong shape would stretch
    expect(hiresArtUsable(0, 0)).toBe(false);
    expect(hiresArtUsable(Number.NaN, 100)).toBe(false);
  });
});

describe("world position on the painting", () => {
  test("every region centre maps back near its hotspot, so the fit can be trusted for other positions", () => {
    for (const r of REGIONS) {
      const a = artSpotForWorld(r.x, r.z), h = MAP_ART_SPOTS[r.id]!;
      expect(Math.hypot(a.x - h.x, a.y - h.y)).toBeLessThan(4);
    }
  });
  test("a position under the legend, title or off the picture is pinned inside the free map area and flagged", () => {
    for (const c of CITY_DESTINATIONS) {
      const a = artSpotForWorld(c.x, c.z);
      expect(a.x).toBeLessThanOrEqual(MAP_ART_LEGEND_LEFT);
      expect(a.y).toBeGreaterThanOrEqual(MAP_ART_TITLE_BOTTOM);
      expect(a.y).toBeLessThanOrEqual(100);
    }
    // both authored cities sit outside the painted area today (Neon City under the legend, Thalassia north of the picture), so neither may be drawn as exact
    expect(artSpotForWorld(CITY_DESTINATIONS.find((c) => c.id === "thalassia")!.x, CITY_DESTINATIONS.find((c) => c.id === "thalassia")!.z).clamped).toBe(true);
    const nexus = REGIONS.find((r) => r.id === "nexus")!;
    expect(artSpotForWorld(nexus.x, nexus.z).clamped).toBe(false);
  });
});
