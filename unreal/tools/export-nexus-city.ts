/**
 * Exports Nexus City's layout from the web build into unreal/DataTables/NexusCity.json for AWFNexusCity.
 *
 * Nothing here invents a layout: every placement comes from the same pure functions the web build draws
 * (nexus-districts.ts buildings / facadeKit / lamps / streetLights / parkedCars, nexus-signs.ts, city-streets.ts,
 * building-models.ts nexusHubTowers). Units are rules metres, x/z on the ground, y up. The Unreal map has no terrain
 * yet, so the city is levelled: each building (and every facade piece and sign on it) keeps its height above its own
 * ground, and everything stands on one flat Z=0 slab. `Datum` is the hub's terrain height the web build stands on.
 *
 * Run from the repo root:
 *   npx esbuild unreal/tools/export-nexus-city.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/nc.mjs && node /tmp/nc.mjs
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEXUS, CITY_INNER, CITY_OUTER, BLOCK, STREET, buildings, facadeKit, lamps, streetLights, parkedCars, SHOP_TINTS, type FacadeBox } from "../../src/game/nexus-districts";
import { nexusSigns, SIGN_COLORS } from "../../src/game/nexus-signs";
import { cityStreets } from "../../src/game/city-streets";
import { BUILDING_MODELS, NEXUS_HUB_RING, NEXUS_HUB_ROAD_R, NEXUS_HUB_ROAD_HALF, NEXUS_HUB_PROMENADE, NEXUS_HUB_SPAWN, nexusHubTowers } from "../../src/game/building-models";
import { heightAt } from "../../src/game/terrain";

const r2 = (v: number) => Math.round(v * 100) / 100;
const datum = heightAt(NEXUS.x, NEXUS.z);
const BUILDINGS = buildings();
/** the ground a point's building stands on (buildings are sunk 1 m below their lowest corner), else the terrain there */
function groundAt(x: number, z: number): number {
  let best: { g: number; d: number } | null = null;
  for (const b of BUILDINGS) {
    if (Math.abs(x - b.x) > b.w / 2 + 2.5 || Math.abs(z - b.z) > b.d / 2 + 2.5) continue;
    // distance to the footprint (0 inside): a balcony rail 1 m off a wall belongs to that wall's building, not the lot's neighbour
    const d = Math.hypot(Math.max(0, Math.abs(x - b.x) - b.w / 2), Math.max(0, Math.abs(z - b.z) - b.d / 2));
    if (!best || d < best.d) best = { g: b.base + 1, d };
  }
  return best ? best.g : heightAt(x, z);
}
/** a height levelled onto the flat city slab */
const y = (v: number, x: number, z: number) => r2(v - groundAt(x, z));

// one flat array per kind keeps the file small: boxes are [x, y, z, sx, sy, sz, tint]
const boxes = (list: FacadeBox[]) => list.map((b) => [r2(b.x), y(b.y, b.x, b.z), r2(b.z), r2(b.sx), r2(b.sy), r2(b.sz), b.tint]);

const kit = facadeKit();
const signs = nexusSigns();
const streets = cityStreets("nexus");

const out = {
  Source: "src/game: nexus-districts.ts, nexus-signs.ts, city-streets.ts, building-models.ts",
  Units: "rules metres; x,z ground (Unreal X = x*100, Y = z*100), y up above the levelled city slab",
  Datum: r2(datum),
  Hub: {
    X: r2(NEXUS.x), Z: r2(NEXUS.z), Radius: NEXUS.radius, CityInner: CITY_INNER, CityOuter: CITY_OUTER, Block: BLOCK, Street: STREET,
    RoadR: NEXUS_HUB_ROAD_R, RoadHalf: NEXUS_HUB_ROAD_HALF, Promenade: NEXUS_HUB_PROMENADE, SpawnX: NEXUS_HUB_SPAWN.x, SpawnZ: NEXUS_HUB_SPAWN.z, RingR: NEXUS_HUB_RING.r,
  },
  ShopTints: SHOP_TINTS,
  SignColors: SIGN_COLORS,
  // authored GLB towers in the web build: Unreal gets their footprint and height until the meshes are imported
  HubTowers: nexusHubTowers(NEXUS).map((t) => { const m = BUILDING_MODELS[t.model]; return [r2(t.x), r2(t.z), m.w, m.d, m.height, r2(t.rot), t.model]; }),
  // [x, z, w, d, yaw, base, top, floors, style 0 glass 1 concrete 2 industrial, district 0 spire 1 market 2 arcology 3 shipyard, crown 0/1, roof]
  Buildings: BUILDINGS.map((b) => [r2(b.x), r2(b.z), r2(b.w), r2(b.d), r2(b.yaw), -1, r2(b.top - (b.base + 1)), b.floors,
    ["glass", "concrete", "industrial"].indexOf(b.style), ["spire", "market", "arcology", "shipyard"].indexOf(b.district), b.crown ? 1 : 0,
    ["none", "tanks", "hvac", "antenna", "helipad", "garden"].indexOf(b.roof)]),
  Facade: {
    Plinths: boxes(kit.plinths), Ledges: boxes(kit.ledges), Fins: boxes(kit.fins), Shopfronts: boxes(kit.shopfronts), Awnings: boxes(kit.awnings),
    Balconies: boxes(kit.balconies), Rails: boxes(kit.rails), Portals: boxes(kit.portals), Lobbies: boxes(kit.lobbies), Blades: boxes(kit.blades),
  },
  // [x, z, yaw]
  CornerLamps: lamps().map((l) => [r2(l.x), r2(l.z), r2(l.yaw)]),
  StreetLights: streetLights().map((l) => [r2(l.x), r2(l.z), r2(l.yaw)]),
  // [x, z, yaw, tint]
  Cars: parkedCars().map((c) => [r2(c.x), r2(c.z), r2(c.yaw), c.tint]),
  // [x, y, z, yaw, w, h, colorIndex]
  Banners: signs.banners.map((b) => [r2(b.x), y(b.y, b.x, b.z), r2(b.z), r2(b.yaw), r2(b.w), r2(b.h), SIGN_COLORS.indexOf(b.color as never)]),
  Screens: signs.screens.map((b) => [r2(b.x), y(b.y, b.x, b.z), r2(b.z), r2(b.yaw), r2(b.w), r2(b.h), SIGN_COLORS.indexOf(b.color as never)]),
  // [x, z, y0, y1, colorIndex]
  Strips: signs.strips.map((s) => [r2(s.x), r2(s.z), y(s.y0, s.x, s.z), y(s.y1, s.x, s.z), SIGN_COLORS.indexOf(s.color as never)]),
  // rects [x, z, hx, hz]
  Segments: streets.segments.map((s) => [r2(s.x), r2(s.z), r2(s.hx), r2(s.hz), s.along === "x" ? 0 : 1]),
  Junctions: streets.junctions.map((j) => [r2(j.x), r2(j.z), j.arms.length]),
  Slabs: streets.slabs.map((s) => [r2(s.x), r2(s.z), r2(s.hx), r2(s.hz)]),
  Kerbs: streets.kerbs.map((k) => [r2(k.x), r2(k.z), r2(k.hx), r2(k.hz), k.low ? 1 : 0]),
  // [x, z, hx, hz, kind 0 zebra 1 stop 2 centre 3 edge 4 tactile]
  Paint: streets.paint.map((p) => [r2(p.x), r2(p.z), r2(p.hx), r2(p.hz), ["zebra", "stop", "centre", "edge", "tactile"].indexOf(p.kind)]),
  // [x, z, yaw, kind 0 bench 1 bin 2 bollard 3 planter 4 hydrant 5 shelter 6 signal 7 sign]
  Props: streets.props.map((p) => [r2(p.x), r2(p.z), r2(p.yaw), ["bench", "bin", "bollard", "planter", "hydrant", "shelter", "signal", "sign"].indexOf(p.kind)]),
  // [x, z, sx, sz, yaw]
  Puddles: streets.puddles.map((p) => [r2(p.x), r2(p.z), r2(p.sx), r2(p.sz), r2(p.yaw)]),
};

const file = join(process.cwd(), "unreal", "DataTables", "NexusCity.json");
writeFileSync(file, JSON.stringify(out) + "\n");
const counts = Object.entries(out).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k} ${(v as unknown[]).length}`);
const facade = Object.entries(out.Facade).map(([k, v]) => `${k} ${v.length}`);
console.log(`NexusCity.json: ${counts.join(", ")}; facade ${facade.join(", ")}`);
