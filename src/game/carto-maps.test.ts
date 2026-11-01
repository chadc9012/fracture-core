import { describe, expect, test } from "bun:test";
import { CARTO_MAPS, cartoBounds, cartoMapAt, coverAt, paintCarto, type Cover } from "./carto-maps";
import { allCartoFeatures, cartoFeatures, POI_STYLE, USE_STYLE } from "./carto-features";
import { cartoScaleBar, clampView, placeCartoLabels, viewWindow, zoomAt } from "./carto-view";
import { heightAt, slopeAt } from "./terrain";
import { REGIONS } from "./world";

const R = (id: string) => REGIONS.find((r) => r.id === id)!;
const cover = (x: number, z: number): Cover => coverAt(x, z, heightAt(x, z), slopeAt(x, z), null);

describe("street maps: the list", () => {
  test("every city and every wild region has a map", () => {
    const ids = CARTO_MAPS.map((m) => m.id);
    for (const id of ["nexus", "neon-city", "riverdale", "thalassia", "veridan", "frostspire", "ember", "wastelands", "solara", "swamps"]) expect(ids).toContain(id);
  });
  test("a point picks the smallest map it lies in", () => {
    expect(cartoMapAt(R("ember").x, R("ember").z)?.id).toBe("ember");
    expect(cartoMapAt(R("nexus").x, R("nexus").z)?.id).toBe("nexus");
  });
});

describe("street maps: the ground", () => {
  test("each region paints its own ground", () => {
    const tally = (id: string) => { const r = R(id), seen: Record<string, number> = {}; for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) { const c = cover(r.x + i * r.radius * 0.18, r.z + j * r.radius * 0.18); seen[c] = (seen[c] ?? 0) + 1; } return seen; };
    const has = (seen: Record<string, number>, ...cs: Cover[]) => cs.some((c) => (seen[c] ?? 0) > 0);
    expect(has(tally("frostspire"), "snow", "ice")).toBe(true);
    expect(has(tally("ember"), "ash", "lava", "basalt")).toBe(true);
    expect(has(tally("solara"), "desert", "dunes")).toBe(true);
    expect(has(tally("wastelands"), "dirt", "scrub")).toBe(true);
    expect(has(tally("veridan"), "forest", "denseForest")).toBe(true);
    expect(has(tally("swamps"), "marsh")).toBe(true);
  });
  test("the crater is a magma pool and city ground is city", () => {
    const e = R("ember"), n = R("nexus");
    expect(coverAt(e.x, e.z, heightAt(e.x, e.z), 0, "magma")).toBe("magma");
    expect(cover(n.x + 30, n.z)).toBe("urban");
  });
  test("the painter fills every pixel", () => {
    const m = CARTO_MAPS.find((c) => c.id === "ember")!;
    const px = paintCarto(24, cartoBounds(m));
    for (let i = 3; i < px.length; i += 4) expect(px[i]).toBe(255);
  });
});

describe("street maps: what is on them", () => {
  test("the cities show apartments, houses, stores, a mall, schools and entertainment", () => {
    const uses = new Set(allCartoFeatures().flatMap((f) => f.buildings.map((b) => b.use)));
    for (const u of ["apartment", "house", "store", "mall", "school", "entertainment"] as const) expect(uses.has(u)).toBe(true);
  });
  test("every building and place has a style, and sits on its map", () => {
    for (const f of allCartoFeatures()) {
      const b = cartoBounds(f.map);
      for (const bd of f.buildings) { expect(USE_STYLE[bd.use]).toBeDefined(); expect(bd.x).toBeGreaterThanOrEqual(b.x0); expect(bd.x).toBeLessThanOrEqual(b.x0 + b.span); }
      for (const p of f.pois) expect(POI_STYLE[p.cat]).toBeDefined();
    }
  });
  test("Neon City's nightlife and casino are entertainment, named", () => {
    const neon = cartoFeatures(CARTO_MAPS.find((m) => m.id === "neon-city")!);
    expect(neon.buildings.filter((b) => b.use === "entertainment" && b.name).length).toBeGreaterThan(2);
  });
  test("Ember Peaks marks its magma pool and the mountains their peaks", () => {
    const ember = cartoFeatures(CARTO_MAPS.find((m) => m.id === "ember")!);
    expect(ember.pois.some((p) => p.cat === "lava")).toBe(true);
    const frost = cartoFeatures(CARTO_MAPS.find((m) => m.id === "frostspire")!);
    expect(frost.pois.some((p) => p.cat === "peak")).toBe(true);
  });
});

describe("street maps: the view", () => {
  const b = { x0: 0, z0: 0, span: 400 };
  test("zooming about a point keeps it under the finger", () => {
    const v = { cx: 200, cz: 200, zoom: 2 }, w0 = viewWindow(b, v, 400, 800);
    const sx = 100, sy = 300, wx = w0.x0 + sx / w0.ppm, wz = w0.z0 + sy / w0.ppm;
    const v2 = zoomAt(b, v, 400, 800, sx, sy, 1.5), w1 = viewWindow(b, v2, 400, 800);
    expect(w1.x0 + sx / w1.ppm).toBeCloseTo(wx, 4);
    expect(w1.z0 + sy / w1.ppm).toBeCloseTo(wz, 4);
  });
  test("the view stays on the map", () => {
    const v = clampView(b, { cx: -500, cz: 900, zoom: 99 });
    expect(v.cx).toBe(0); expect(v.cz).toBe(400); expect(v.zoom).toBeLessThanOrEqual(18);
  });
  test("labels never overlap", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ id: `l${i}`, text: `Place number ${i}`, x: (i % 6) * 10, z: Math.floor(i / 6) * 4, rank: i % 3, size: 12, pin: i % 2 === 0 }));
    const out = placeCartoLabels(items, (x, z) => [20 + x * 5, 20 + z * 5], 400, 300, 3);
    const box = (l: (typeof out)[number]) => { const w = l.text.length * l.size * 0.56, x0 = l.anchor === "start" ? l.sx : l.anchor === "end" ? l.sx - w : l.sx - w / 2; return [x0, l.sy - l.size * 0.92, x0 + w, l.sy + l.size * 0.23]; };
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) { const a = box(out[i]!), c = box(out[j]!); expect(a[0]! < c[2]! && a[2]! > c[0]! && a[1]! < c[3]! && a[3]! > c[1]!).toBe(false); }
    expect(out.length).toBeGreaterThan(5);
  });
  test("the scale bar is a round distance", () => {
    expect([1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000]).toContain(cartoScaleBar(1.3).m);
  });
});
