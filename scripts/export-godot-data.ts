/**
 * Exports the web game's world data for the Godot project (godot-world-fracture/): the continents and oceans on the globe, every
 * street map's bounds and vector features (buildings, roads, paved ground, rings, places, area names), the styles they are drawn
 * with, and copies of the baked images (the globe texture, each map's land-cover image and satellite data). The web game stays
 * the single source of truth; Godot reads what this writes. The generated folder is gitignored and rebuilt by the APK workflow.
 *
 *   bun scripts/export-godot-data.ts
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONTINENTS, OCEANS, AIR_ROUTES, PLANET } from "../src/game/planet";
import { CONTINENT_GLOBE, CONTINENT_MAPS, OCEAN_GLOBE } from "../src/game/globe";
import { CARTO_MAPS, COVER_COLOR, COVER_LABEL, SAT_COLOR, cartoBounds, cartoSource } from "../src/game/carto-maps";
import { WATER_LEVEL, heightAt } from "../src/game/terrain";
import { STORM_ISLAND_SITES, stormSiteWorld } from "../src/game/storm-islands";
import { islandRadius, islandTop } from "../src/game/storm-quests";
import { png } from "./lib/png";

/** each map's ground as a height grid for the Godot 3D views: 16 bits per sample (R high byte, G low byte) between lo and hi */
const HEIGHT_N = 257;
function heightGrid(m: (typeof CARTO_MAPS)[number]): { png: Buffer; lo: number; hi: number } {
  const b = cartoBounds(m), src = cartoSource(m), h = (x: number, z: number) => (src ? src.height(x, z) : heightAt(x, z));
  const vals = new Float32Array(HEIGHT_N * HEIGHT_N);
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < HEIGHT_N; j++) for (let i = 0; i < HEIGHT_N; i++) {
    const v = h(b.x0 + (i / (HEIGHT_N - 1)) * b.span, b.z0 + (j / (HEIGHT_N - 1)) * b.span);
    vals[j * HEIGHT_N + i] = v; if (v < lo) lo = v; if (v > hi) hi = v;
  }
  if (hi - lo < 1) hi = lo + 1;
  const px = new Uint8Array(HEIGHT_N * HEIGHT_N * 4);
  for (let k = 0; k < vals.length; k++) { const q = Math.round(((vals[k]! - lo) / (hi - lo)) * 65535); px[k * 4] = q >> 8; px[k * 4 + 1] = q & 255; px[k * 4 + 2] = 0; px[k * 4 + 3] = 255; }
  return { png: png(px, HEIGHT_N), lo, hi };
}
import { POI_GROUPS, POI_STYLE, USE_STYLE, cartoFeatures } from "../src/game/carto-features";

const ROOT = process.cwd();
const OUT = join(ROOT, "godot-world-fracture", "generated");
mkdirSync(join(OUT, "maps"), { recursive: true });
const r1 = (v: number) => Math.round(v * 10) / 10;

const planet = {
  planet: PLANET,
  continents: CONTINENTS.map((c) => ({
    id: c.id, n: c.n, name: c.name, tagline: c.tagline, epithet: c.epithet, tier: c.tier, world: c.world, capital: c.capital, look: c.look,
    color: c.color, climate: c.climate, places: c.places.map((p) => ({ name: p.name, kind: p.kind, live: !!p.live })),
    lat: CONTINENT_GLOBE[c.id].lat, lon: CONTINENT_GLOBE[c.id].lon, maps: CONTINENT_MAPS[c.id],
  })),
  oceans: OCEANS.map((o) => ({ id: o.id, n: o.n, name: o.name, character: o.character, lat: OCEAN_GLOBE[o.id]!.lat, lon: OCEAN_GLOBE[o.id]!.lon })),
  routes: AIR_ROUTES.map(([a, b]) => [a, b]),
};
writeFileSync(join(OUT, "planet.json"), JSON.stringify(planet));

const covers = Object.keys(COVER_COLOR);
const styles = { covers, coverColor: COVER_COLOR, satColor: SAT_COLOR, coverLabel: COVER_LABEL, use: USE_STYLE, poi: Object.fromEntries(Object.entries(POI_STYLE).map(([k, v]) => [k, { color: v.color, label: v.label }])), groups: POI_GROUPS };
writeFileSync(join(OUT, "styles.json"), JSON.stringify(styles));

const index: unknown[] = [];
for (const m of CARTO_MAPS) {
  const f = cartoFeatures(m), b = cartoBounds(m);
  const out = {
    id: m.id, name: m.name, sub: m.sub, kind: m.kind, bounds: b,
    buildings: f.buildings.map((x) => [r1(x.x), r1(x.z), r1(x.hx), r1(x.hz), Math.round(x.yaw * 1000) / 1000, x.use, Math.round(x.h * 100) / 100, x.name ?? "", r1(x.m ?? 0)]),
    roads: f.roads.map((x) => ({ cls: x.cls, w: r1(x.width), name: x.name ?? "", color: x.color ?? "", pts: x.pts.map(([px, pz]) => [r1(px), r1(pz)]) })),
    pavements: f.pavements.map((x) => [r1(x.x), r1(x.z), r1(x.hx), r1(x.hz), Math.round(x.yaw * 1000) / 1000, x.kind]),
    rings: f.rings.map((x) => [r1(x.x), r1(x.z), r1(x.r), x.kind, x.name ?? ""]),
    pois: f.pois.map((x) => ({ id: x.id, name: x.name, cat: x.cat, x: r1(x.x), z: r1(x.z), rank: x.rank, blurb: x.blurb ?? "" })),
    areas: f.areas.map((x) => ({ name: x.name, x: r1(x.x), z: r1(x.z), kind: x.kind, rank: x.rank })),
    water: WATER_LEVEL,
    heights: { n: HEIGHT_N, lo: 0, hi: 0 },
    // the Storm Islands float: each island's centre, radius and top (the 3D view builds them in the sky)
    floating: m.id === "storm" ? STORM_ISLAND_SITES.map((s) => { const w = stormSiteWorld(s); return { id: s.id, name: s.name, kind: s.kind, x: r1(w.x), z: r1(w.z), r: islandRadius(s), top: r1(islandTop(s)) }; }) : [],
  };
  const hg = heightGrid(m);
  out.heights = { n: HEIGHT_N, lo: Math.round(hg.lo * 100) / 100, hi: Math.round(hg.hi * 100) / 100 };
  writeFileSync(join(OUT, "maps", `${m.id}.height.pngb`), hg.png);
  writeFileSync(join(OUT, "maps", `${m.id}.json`), JSON.stringify(out));
  for (const ext of ["png", "data.png"]) {
    const src = join(ROOT, "public", "maps", "carto", `${m.id}.${ext}`);
    // a ".pngb" extension keeps Godot from importing (and compressing) them: the game loads the raw PNG bytes itself
    if (existsSync(src)) copyFileSync(src, join(OUT, "maps", `${m.id}.${ext === "png" ? "map" : "data"}.pngb`));
  }
  index.push({ id: m.id, name: m.name, sub: m.sub, kind: m.kind });
}
writeFileSync(join(OUT, "maps", "index.json"), JSON.stringify(index));
copyFileSync(join(ROOT, "public", "maps", "globe", "veyra.jpg"), join(OUT, "veyra.jpgb"));
console.log("exported", CARTO_MAPS.length, "maps and the planet to", OUT);
