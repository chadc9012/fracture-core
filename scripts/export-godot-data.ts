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
import { CARTO_MAPS, COVER_COLOR, COVER_LABEL, SAT_COLOR, cartoBounds } from "../src/game/carto-maps";
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
    buildings: f.buildings.map((x) => [r1(x.x), r1(x.z), r1(x.hx), r1(x.hz), Math.round(x.yaw * 1000) / 1000, x.use, Math.round(x.h * 100) / 100, x.name ?? ""]),
    roads: f.roads.map((x) => ({ cls: x.cls, w: r1(x.width), name: x.name ?? "", color: x.color ?? "", pts: x.pts.map(([px, pz]) => [r1(px), r1(pz)]) })),
    pavements: f.pavements.map((x) => [r1(x.x), r1(x.z), r1(x.hx), r1(x.hz), Math.round(x.yaw * 1000) / 1000, x.kind]),
    rings: f.rings.map((x) => [r1(x.x), r1(x.z), r1(x.r), x.kind, x.name ?? ""]),
    pois: f.pois.map((x) => ({ id: x.id, name: x.name, cat: x.cat, x: r1(x.x), z: r1(x.z), rank: x.rank, blurb: x.blurb ?? "" })),
    areas: f.areas.map((x) => ({ name: x.name, x: r1(x.x), z: r1(x.z), kind: x.kind, rank: x.rank })),
  };
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
