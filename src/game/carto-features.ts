/** The vector layer of the street maps (carto-maps.ts draws the ground under it): every building the world builds, sorted by use
 * (apartments, houses, stores, malls, schools, entertainment, offices, civic, industrial, transport), the roads and streets, bridges,
 * the runway and boardwalks, points of interest and the place names a street map prints (districts, peaks, lakes, lava fields,
 * deserts, forests). Everything comes from the same layout modules the world is built from. Pure and cached per map. */
import { CARTO_MAPS, cartoBounds, type CartoMap } from "./carto-maps";
import { NEXUS, buildings, districtAt } from "./nexus-districts";
import { BUILDING_MODELS, nexusHubTowers } from "./building-models";
import { CASINO_PLOT, TOWER_FOOTPRINT, neonLayoutWorld } from "./neon-layout";
import { venueLots } from "./nightlife";
import { footprint, garageRect, neonKeepOut, residences } from "./residences";
import { REGIONAL_SHOPS } from "./regional-shops";
import { SITES, type Site, type SiteKind } from "./region-atlas";
import { cityStreets } from "./city-streets";
import { LANES, LANE_HALF_WIDTH, laneSamples } from "./lanes";
import { roadKind } from "./road-dressing";
import { BRIDGES, bridgeFrame } from "./nexus-bridge";
import { AIRPORT, AIRPORT_BUILDINGS, airportPoint } from "./nexus-airport";
import { LANDMARKS } from "./landmarks";
import { boardwalks } from "./swamp-dressing";
import { CRATER_R } from "./ember-dressing";
import { THALASSIA_CENTER } from "./thalassia-site";
import { CITY_RADIUS, CORE, DOCK, RING } from "./thalassia-sectors";
import { GARAGES } from "./fleet";
import { HEIGHT_K, WATER_LEVEL, heightAt, waterNetwork } from "./terrain";
import { NEON_SITE, REGIONS, RIVERDALE } from "./world";
import { STORM_ISLAND_SITES, stormSiteWorld } from "./storm-islands";
import { reclaimedCity } from "./reclaimed-city";
import { HULL } from "./crash-layout";
import { CRASH_SITE, TRAIL, TRAIL_HALF_WIDTH } from "./verdant";
import { RIVERDALE_HALL } from "./world";
import { BOARDWALK_W, boardwalk, townBoxes } from "./riverdale";
import { ruins as wasteRuins, pylons } from "./waste-dressing";
import { STUNT_PARK } from "./stunt-park";
import { ARENA, RUST_RUN, VAULT_GATE } from "./wasteland-activities";
import { HOLLOW_CROWN } from "./godforge";
import { camps as frostCamps, frozenFall } from "./frost-dressing";
import { pillars as solaraPillars, ribcage } from "./solara-dressing";
import { wreckField } from "./set-pieces";
import { HAZARD_ZONES } from "./hazard-zones";
import { skylineLookout, LEDGE } from "./skyline-lookout";
import { railLines, SKYRAIL } from "./nexus-skyrail";
import { CHECKPOINT, DECK, SKYBRIDGES, SPIRE, undercity } from "./neon-tiers";
import { worldMaglev } from "./maglev";
import { GRID_WALKWAYS } from "./neon-districts";
import { ELEVATOR_PLATFORM_R, TERMINALS, thalassiaElevator } from "./travel";
import { riverCrossings } from "./terrain";
import { NEXUS_HUB_ROAD_R } from "./building-models";
import { newLand } from "./new-lands";
import { islandRadius } from "./storm-quests";

export type BuildingUse = "apartment" | "house" | "store" | "mall" | "school" | "entertainment" | "office" | "civic" | "industrial" | "transport" | "garage" | "dome";
export type CartoBuilding = { x: number; z: number; hx: number; hz: number; yaw: number; use: BuildingUse; /** 0..1 how tall, for the roof shading */ h: number; name?: string; /** its real height in metres when known (the 3D views) */ m?: number };
export type RoadClass = "highway" | "main" | "street" | "track" | "runway" | "taxiway" | "bridge" | "boardwalk" | "rail" | "trail" | "powerline" | "race" | "skybridge" | "ferry";
export type CartoRoad = { cls: RoadClass; pts: [number, number][]; /** full width in metres */ width: number; name?: string; /** a line colour of its own (the maglev lines) */ color?: string };
/** a paved area drawn under the roads (street segments, junctions, the square, the apron) */
export type CartoPavement = { x: number; z: number; hx: number; hz: number; yaw: number; kind: "street" | "plaza" | "apron" };
export type PoiCat = "store" | "mall" | "school" | "university" | "entertainment" | "casino" | "nightclub" | "park" | "transit" | "dock" | "civic" | "landmark" | "garage"
  | "village" | "camp" | "cave" | "ruins" | "peak" | "lake" | "falls" | "lava" | "research" | "temple" | "spire" | "airport" | "outpost"
  | "terminal" | "port" | "station" | "hazard" | "arena" | "viewpoint" | "wreck";
export type CartoPoi = { id: string; name: string; cat: PoiCat; x: number; z: number; /** 0 always shown .. 3 only close up */ rank: number; blurb?: string };
export type AreaKind = "city" | "district" | "mountain" | "valley" | "lake" | "desert" | "forest" | "lava" | "sea" | "snow" | "marsh" | "river" | "hazard";
export type CartoArea = { name: string; x: number; z: number; kind: AreaKind; rank: number };
export type CartoFeatures = { buildings: CartoBuilding[]; roads: CartoRoad[]; pavements: CartoPavement[]; rings: { x: number; z: number; r: number; kind: "dome" | "ring" | "dock" | "hazard" | "arena" | "pad" | "fence"; name?: string }[]; pois: CartoPoi[]; areas: CartoArea[] };

/** display style of each use: roof colour and outline (light street-map buildings, coloured by what they are) */
export const USE_STYLE: Record<BuildingUse, { fill: string; stroke: string; label: string }> = {
  apartment: { fill: "#e4dccd", stroke: "#cbbfa9", label: "Apartments" }, house: { fill: "#efe5d6", stroke: "#d4c4ab", label: "Houses" },
  store: { fill: "#d9e6fb", stroke: "#9fbbea", label: "Stores" }, mall: { fill: "#c8dafb", stroke: "#7aa2e6", label: "Malls" },
  school: { fill: "#f2e3c4", stroke: "#cfae6c", label: "Schools" }, entertainment: { fill: "#f6d6e8", stroke: "#de8ab8", label: "Entertainment" },
  office: { fill: "#dfe2e8", stroke: "#b9bfcb", label: "Offices" }, civic: { fill: "#e8e2f4", stroke: "#b6a6d8", label: "Civic" },
  industrial: { fill: "#dcd8d2", stroke: "#b5ada2", label: "Industrial" }, transport: { fill: "#d6e2ec", stroke: "#9db3c6", label: "Transport" },
  garage: { fill: "#e1e1e1", stroke: "#bdbdbd", label: "Garages" }, dome: { fill: "#bfe6f0", stroke: "#5fb4cc", label: "Domes" },
};
export const POI_STYLE: Record<PoiCat, { color: string; glyph: string; label: string }> = {
  store: { color: "#1a73e8", glyph: "🛍", label: "Store" }, mall: { color: "#1a73e8", glyph: "🏬", label: "Mall" }, school: { color: "#a16f1d", glyph: "🎒", label: "School" },
  university: { color: "#a16f1d", glyph: "🎓", label: "University" }, entertainment: { color: "#d0287f", glyph: "🎭", label: "Entertainment" },
  casino: { color: "#d0287f", glyph: "🎰", label: "Casino" }, nightclub: { color: "#d0287f", glyph: "🎵", label: "Nightclub" }, park: { color: "#188038", glyph: "🌳", label: "Park" },
  transit: { color: "#3367d6", glyph: "🚇", label: "Transit" }, dock: { color: "#3367d6", glyph: "⚓", label: "Harbor" }, civic: { color: "#7b5fb8", glyph: "🏛", label: "Civic" },
  landmark: { color: "#5f6368", glyph: "★", label: "Landmark" }, garage: { color: "#5f6368", glyph: "🅿", label: "Garage" }, village: { color: "#8d6e63", glyph: "🏘", label: "Village" },
  camp: { color: "#c5221f", glyph: "⛺", label: "Camp" }, cave: { color: "#5f6368", glyph: "🕳", label: "Cave" }, ruins: { color: "#8d6e63", glyph: "🏚", label: "Ruins" },
  peak: { color: "#6d4c41", glyph: "▲", label: "Peak" }, lake: { color: "#1967d2", glyph: "💧", label: "Lake" }, falls: { color: "#1967d2", glyph: "〰", label: "Waterfall" },
  lava: { color: "#e8590c", glyph: "🌋", label: "Lava / magma" }, research: { color: "#00897b", glyph: "⚗", label: "Research" }, temple: { color: "#8d6e63", glyph: "⛩", label: "Temple" },
  spire: { color: "#6d4c41", glyph: "◆", label: "Spire" }, airport: { color: "#3367d6", glyph: "✈", label: "Airport" }, outpost: { color: "#8d6e63", glyph: "⛫", label: "Outpost" },
  terminal: { color: "#3367d6", glyph: "✈", label: "Transit terminal" }, port: { color: "#3367d6", glyph: "⛴", label: "Seaport" }, station: { color: "#3367d6", glyph: "🚝", label: "Rail station" },
  hazard: { color: "#d93025", glyph: "⚠", label: "Hazard" }, arena: { color: "#d0287f", glyph: "🏁", label: "Arena / track" }, viewpoint: { color: "#188038", glyph: "👁", label: "Viewpoint" },
  wreck: { color: "#5f6368", glyph: "✦", label: "Wreck" },
};
/** filter groups for the map's chips */
export const POI_GROUPS: { id: string; label: string; cats: PoiCat[] }[] = [
  { id: "shopping", label: "Shopping", cats: ["store", "mall"] },
  { id: "schools", label: "Schools", cats: ["school", "university"] },
  { id: "fun", label: "Entertainment", cats: ["entertainment", "casino", "nightclub"] },
  { id: "transit", label: "Transit", cats: ["transit", "dock", "airport", "garage", "terminal", "port", "station"] },
  { id: "civic", label: "Civic", cats: ["civic", "park", "landmark", "research"] },
  { id: "nature", label: "Nature", cats: ["peak", "lake", "falls", "lava", "cave", "spire", "viewpoint"] },
  { id: "places", label: "Places", cats: ["village", "camp", "ruins", "temple", "outpost", "wreck", "arena"] },
  { id: "hazards", label: "Hazards", cats: ["hazard"] },
];

const SITE_POI: Partial<Record<SiteKind, PoiCat>> = {
  shop: "store", mall: "mall", campus: "university", school: "school", nightclub: "nightclub", lounge: "entertainment", casino: "casino", metro: "transit", dock: "dock",
  garage: "garage", plaza: "park", palace: "civic", government: "civic", farm: "park", research: "research", camp: "camp", outpost: "outpost", cave: "cave", temple: "temple",
  ruins: "ruins", village: "village", spire: "spire", lake: "lake", falls: "falls", crater: "lava", station: "transit", grove: "park", forge: "landmark", scrapyard: "landmark", highway: "landmark",
};
/** which building use a city site gives the towers inside it */
const SITE_USE: Partial<Record<SiteKind, BuildingUse>> = { mall: "mall", campus: "school", school: "school", nightclub: "entertainment", lounge: "entertainment", casino: "entertainment", government: "civic", palace: "civic", scrapyard: "industrial", dock: "industrial", shop: "store" };
const DISTRICT_USE: Record<string, BuildingUse> = {
  "neon-downtown": "office", "neon-luxury": "apartment", "neon-residential": "apartment", "neon-strip": "entertainment", "neon-industrial": "industrial", "neon-harbor": "industrial",
  "nexus-business": "office", "nexus-residential": "apartment", "nexus-capital": "civic", "nexus-government": "civic", "nexus-harbor": "industrial",
};

const inMap = (m: CartoMap, x: number, z: number, pad = 0) => Math.abs(x - m.x) <= m.reach + pad && Math.abs(z - m.z) <= m.reach + pad;
/** the smallest city site whose circle covers a point (a venue inside a district wins) */
function citySiteAt(regionId: string, x: number, z: number): Site | null {
  let best: Site | null = null;
  for (const s of SITES) if (s.regionId === regionId && Math.hypot(x - s.x, z - s.z) <= s.radius && (!best || s.radius < best.radius)) best = s;
  return best;
}
function useFromSites(regionId: string, x: number, z: number, fallback: BuildingUse): BuildingUse {
  const s = citySiteAt(regionId, x, z);
  if (!s) return fallback;
  return SITE_USE[s.kind] ?? DISTRICT_USE[s.id] ?? fallback;
}

/** name a building after the venue or school standing on it: the one site of that kind nearest the footprint */
/** the two tallest buildings in the game (owner, Nov 9 2026): the Nexus Core Spire, then the Neon City Grand Casino */
export const CORE_SPIRE_M = 420;
export const CASINO_TOWER_M = 380;

function nameBuildings(list: CartoBuilding[], regionId: string) {
  for (const s of SITES) {
    if (s.regionId !== regionId || !["mall", "school", "campus", "casino", "nightclub", "lounge"].includes(s.kind)) continue;
    let best: CartoBuilding | null = null, bd = Infinity;
    for (const b of list) { if (b.use === "house" || b.use === "garage") continue; const d = Math.hypot(b.x - s.x, b.z - s.z); if (d < bd && d < s.radius + 14) { bd = d; best = b; } }
    if (best) { best.name = s.name; best.use = SITE_USE[s.kind] ?? best.use; }
  }
}

function nexusBuildings(): CartoBuilding[] {
  const out: CartoBuilding[] = [];
  for (const b of buildings()) {
    const d = districtAt(b.x, b.z);
    const base: BuildingUse = d === "shipyard" ? "industrial" : d === "market" ? "store" : d === "arcology" ? "apartment" : "office";
    out.push({ x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2, yaw: b.yaw, use: useFromSites("nexus", b.x, b.z, base), h: Math.min(1, (b.top - b.base) / 120) });
  }
  for (const t of nexusHubTowers(NEXUS)) { const m = BUILDING_MODELS[t.model]; out.push({ x: t.x, z: t.z, hx: m.w / 2, hz: m.d / 2, yaw: t.rot, use: "civic", h: Math.min(1, m.height / 60), m: m.height }); }
  // the airport: terminal, control tower, hangar
  const A = AIRPORT_BUILDINGS, yaw = -Math.atan2(AIRPORT.dirZ, AIRPORT.dirX);
  for (const [k, b] of [["Terminal", A.terminal], ["Hangar", A.hangar]] as const) { const p = airportPoint(b.along, b.across); out.push({ x: p.x, z: p.z, hx: b.length / 2, hz: b.depth / 2, yaw, use: "transport", h: b.height / 60, m: b.height, name: `Nexus Airport ${k}` }); }
  { const p = airportPoint(A.tower.along, A.tower.across); out.push({ x: p.x, z: p.z, hx: A.tower.radius, hz: A.tower.radius, yaw, use: "transport", h: 0.45, m: 26 }); }
  nameBuildings(out, "nexus");
  // the Nexus Core Spire: the biggest of the Spire district's towers, on the axis north of the hub, made the tallest
  // building in the game (owner, Nov 9 2026: Nexus at 420 m, the Neon casino next at 380 m)
  let core: CartoBuilding | null = null;
  for (const b of out) if (!b.name && b.hx >= 5 && Math.abs(b.x - NEXUS.x) < 8 && b.z < NEXUS.z - 30 && b.z > NEXUS.z - 70 && (!core || b.hx * b.hz > core.hx * core.hz)) core = b;
  if (core) { core.m = CORE_SPIRE_M; core.h = 1; core.use = "civic"; core.name = "Nexus Core Spire"; }
  return out;
}

function neonBuildings(): CartoBuilding[] {
  const out: CartoBuilding[] = [];
  const towers = neonLayoutWorld(neonKeepOut()).towers;
  for (const t of towers) {
    const [hx, hz] = TOWER_FOOTPRINT[t.variant];
    out.push({ x: t.x, z: t.z, hx: t.rot % 2 ? hz : hx, hz: t.rot % 2 ? hx : hz, yaw: 0, use: useFromSites("neon", t.x, t.z, "store"), h: 0.8 });
  }
  for (const l of venueLots(towers)) {
    const b = out.find((o) => Math.hypot(o.x - l.tower.x, o.z - l.tower.z) < 0.5);
    if (b) { b.use = "entertainment"; b.name = l.venue.name; }
  }
  // the casino resort on its own plot: the Neon City Grand Casino (owner, Nov 9 2026), the second-tallest building in the
  // game at CASINO_TOWER_M, below only the Nexus Core Spire (Godot draws both as landmarks: region_3d.gd)
  out.push({ x: NEON_SITE.x + CASINO_PLOT.x, z: NEON_SITE.z + CASINO_PLOT.z, hx: CASINO_PLOT.r * 0.62, hz: CASINO_PLOT.r * 0.5, yaw: 0, use: "entertainment", h: 1, m: CASINO_TOWER_M, name: "Neon City Grand Casino" });
  nameBuildings(out, "neon");
  return out;
}

function residenceBuildings(m: CartoMap): CartoBuilding[] {
  const out: CartoBuilding[] = [];
  for (const r of residences()) {
    if (!inMap(m, r.x, r.z)) continue;
    const f = footprint(r);
    const flats = r.style === "apartment" || r.style === "condo" || r.style === "loft";
    out.push({ x: r.x, z: r.z, hx: f.hx, hz: f.hz, yaw: 0, use: flats ? "apartment" : "house", h: flats ? 0.4 : 0.2, m: flats ? 14 : 7 });
    if (r.garage) { const g = garageRect(r.garage); out.push({ x: g.x, z: g.z, hx: g.hx, hz: g.hz, yaw: 0, use: "garage", h: 0.1, m: 3 }); }
  }
  return out;
}

/** a street rect from the city's grid as a pavement */
function streetPavements(city: "nexus" | "neon"): CartoPavement[] {
  const st = cityStreets(city);
  const out: CartoPavement[] = [];
  for (const s of st.segments) out.push({ x: s.x, z: s.z, hx: s.hx, hz: s.hz, yaw: 0, kind: "street" });
  for (const j of st.junctions) out.push({ x: j.x, z: j.z, hx: st.street / 2, hz: st.street / 2, yaw: 0, kind: "street" });
  return out;
}

function peaks(m: CartoMap, n: number): CartoPoi[] {
  // the highest dry points on a coarse grid, kept apart
  const b = cartoBounds(m), step = b.span / 40, found: { x: number; z: number; h: number }[] = [];
  for (let j = 1; j < 40; j++) for (let i = 1; i < 40; i++) { const x = b.x0 + i * step, z = b.z0 + j * step, h = heightAt(x, z); if (h > WATER_LEVEL + 18 * HEIGHT_K) found.push({ x, z, h }); }
  found.sort((a, c) => c.h - a.h);
  const kept: typeof found = [];
  for (const p of found) if (kept.every((k) => Math.hypot(k.x - p.x, k.z - p.z) > m.reach * 0.45)) { kept.push(p); if (kept.length >= n) break; }
  return kept.map((p, i) => ({ id: `${m.id}-peak-${i}`, name: `Peak · ${Math.round(p.h - WATER_LEVEL)} m`, cat: "peak" as const, x: p.x, z: p.z, rank: i === 0 ? 1 : 2 }));
}

/** the site set pieces SiteMarkers.tsx builds (rotated by its group's yaw), as footprints */
function siteFootprints(s: Site): CartoBuilding[] {
  const th = (s.x * 0.013) % (Math.PI * 2), c = Math.cos(th), sn = Math.sin(th);
  const at = (lx: number, lz: number, hx: number, hz: number, use: BuildingUse, h: number, name?: string): CartoBuilding => ({ x: s.x + lx * c + lz * sn, z: s.z - lx * sn + lz * c, hx, hz, yaw: th, use, h, m: Math.max(2.5, h * 30), ...(name ? { name } : {}) });
  switch (s.kind) {
    case "village": return Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2, d = 11.5; return { ...at(Math.cos(a) * d, Math.sin(a) * d, 2.5, 2.5, "house", 0.2), yaw: th - a }; });
    case "camp": return Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2; return at(Math.cos(a) * 8, Math.sin(a) * 8, 1.6, 1.6, "house", 0.08); });
    case "temple": return [at(0, 0, 7, 7, "civic", 0.4, s.name)];
    case "forge": return [at(0, 0, 6, 5, "industrial", 0.3, s.name)];
    case "outpost": return [at(0, 0, 6, 6, "industrial", 0.25, s.name), at(10, -10, 1.6, 1.6, "industrial", 0.35)];
    case "lounge": return [at(0, 0, 9, 6, "entertainment", 0.3, s.name)];
    default: return [];
  }
}

/** everything else the world builds that a street map should show: the wild regions' set pieces and towns, the reclaimed city,
 * the crash, the Wastelands' ruins, power line, stunt park, arena and vault, Frostspire's camps, Solara's ribcage, the
 * Smoldering Trench's wrecks, hazard zones, transit terminals and the Thalassia elevator, the Nexus skyrail and hub ring, Neon
 * City's spire, deck, skybridges and maglev lines, the Verdant trail, Riverdale's hall and boardwalk, the Rust Run, the bridges
 * where roads cross rivers, and the names of the rivers and streams. Each from the module its renderer reads. */
function addWorldDetail(m: CartoMap, bOut: CartoBuilding[], roads: CartoRoad[], pav: CartoPavement[], rings: CartoFeatures["rings"], pois: CartoPoi[], areas: CartoArea[]) {
  const R2 = (id: string) => REGIONS.find((r) => r.id === id)!;
  // atlas set pieces
  for (const s of SITES) if (inMap(m, s.x, s.z) && s.id !== "vf-ruins") {
    bOut.push(...siteFootprints(s));
    if (s.kind === "research") for (const [lx, lz, r] of [[0, 0, 7], [11, 3, 5], [-10, -4, 5]] as const) { const th = (s.x * 0.013) % (Math.PI * 2); rings.push({ x: s.x + lx * Math.cos(th) + lz * Math.sin(th), z: s.z - lx * Math.sin(th) + lz * Math.cos(th), r, kind: "dome" }); }
    if (s.kind === "camp") rings.push({ x: s.x, z: s.z, r: 14, kind: "fence" });
    if (s.kind === "crater") rings.push({ x: s.x, z: s.z, r: 21, kind: "hazard" });
  }
  // the jungle-reclaimed city on the Ancient Ruins
  const rc = reclaimedCity();
  if (rc && inMap(m, rc.cx, rc.cz)) {
    for (const t of rc.towers) bOut.push({ x: t.x, z: t.z, hx: t.w / 2, hz: t.d / 2, yaw: t.yaw, use: "office", h: Math.min(1, t.floors / 12), m: t.floors * 3.4 + 2 });
    areas.push({ name: "Reclaimed City", x: rc.cx, z: rc.cz - 30, kind: "district", rank: 1 });
  }
  // the Verdant Forest: the trail from the clearing to the crash, the crashed ship
  if (TRAIL.length > 1 && TRAIL.some((p) => inMap(m, p.x, p.z))) roads.push({ cls: "trail", pts: TRAIL.map((p) => [p.x, p.z]), width: TRAIL_HALF_WIDTH * 2, name: "Forest trail" });
  if (inMap(m, HULL.x, HULL.z)) {
    bOut.push({ x: HULL.x, z: HULL.z, hx: HULL.length / 2, hz: HULL.radius, yaw: HULL.yaw, use: "industrial", h: 0.12, m: 3.8, name: "Crashed ship" });
    pois.push({ id: "crash-site", name: CRASH_SITE.label, cat: "wreck", x: CRASH_SITE.x, z: CRASH_SITE.z, rank: 1, blurb: "Where you woke up: the wreck of your drop ship." });
  }
  // Riverdale: the town hall, the town's own buildings, the boardwalk to the river
  if (m.id === "riverdale" || inMap(m, RIVERDALE.x, RIVERDALE.z)) {
    const H = RIVERDALE_HALL;
    if (!bOut.some((b) => b.name === "Town Hall")) bOut.push({ x: H.x, z: H.z, hx: H.hx, hz: H.hz, yaw: H.yaw, use: "civic", h: 0.4, m: H.height, name: "Town Hall" });
    for (const tb of townBoxes()) if (tb.sy > 2 && tb.sx * tb.sz > 6) bOut.push({ x: RIVERDALE.x + tb.x, z: RIVERDALE.z + tb.z, hx: tb.sx / 2, hz: tb.sz / 2, yaw: 0, use: "civic", h: Math.min(0.5, tb.sy / 30), m: tb.sy });
    const bw = boardwalk();
    roads.push({ cls: "boardwalk", pts: [[RIVERDALE.x + bw.dirX * bw.start, RIVERDALE.z + bw.dirZ * bw.start], [RIVERDALE.x + bw.dirX * bw.end, RIVERDALE.z + bw.dirZ * bw.end]], width: BOARDWALK_W, name: "River boardwalk" });
  }
  // the Wastelands
  if (m.id === "wastelands") {
    for (const r of wasteRuins()) bOut.push({ x: r.x, z: r.z, hx: r.w / 2, hz: r.d / 2, yaw: r.r, use: "industrial", h: Math.min(0.6, r.floors / 8), m: r.floors * 3.2 });
    const py = pylons(); if (py.length > 1) roads.push({ cls: "powerline", pts: py.map((p) => [p.x, p.z]), width: 1, name: "Power line" });
    const sp = STUNT_PARK, yaw = -Math.atan2(sp.dirZ, sp.dirX);
    pav.push({ x: sp.x, z: sp.z, hx: sp.length / 2, hz: sp.width / 2, yaw, kind: "plaza" });
    pois.push({ id: "stunt-park", name: "Stunt Park", cat: "arena", x: sp.x, z: sp.z, rank: 1 });
    rings.push({ x: ARENA.x, z: ARENA.z, r: ARENA.radius, kind: "arena", name: "Derby Arena" });
    pois.push({ id: "derby-arena", name: "Derby Arena", cat: "arena", x: ARENA.x, z: ARENA.z, rank: 1 });
    rings.push({ x: VAULT_GATE.x, z: VAULT_GATE.z, r: VAULT_GATE.radius, kind: "pad" });
    pois.push({ id: "vault-gate", name: "Vault Gate · Underground City", cat: "transit", x: VAULT_GATE.x, z: VAULT_GATE.z, rank: 1, blurb: "The way down to the underground city." });
    pois.push({ id: "hollow-crown", name: "Hollow Crown", cat: "landmark", x: HOLLOW_CROWN.x, z: HOLLOW_CROWN.z, rank: 2 });
    roads.push({ cls: "race", pts: [[RUST_RUN.start.x, RUST_RUN.start.z], ...RUST_RUN.checkpoints.map((c) => [c.x, c.z] as [number, number])], width: 3, name: "Rust Run rally" });
  }
  // Frostspire's camps and the frozen waterfall
  if (m.id === "frostspire") {
    frostCamps().forEach((c, i) => pois.push({ id: `frost-camp-${i}`, name: "Nomad camp", cat: "camp", x: c.at.x, z: c.at.z, rank: 2 }));
    const ff = frozenFall(); if (ff) pois.push({ id: "frozen-fall", name: "Frozen Waterfall", cat: "falls", x: ff.x, z: ff.z, rank: 1 });
  }
  // Solara: the great ribcage and the colonnade
  if (m.id === "solara") {
    const rb = ribcage(); if (rb) pois.push({ id: "ribcage", name: "The Ribcage", cat: "landmark", x: rb.x, z: rb.z, rank: 1, blurb: "The bones of something enormous, half buried in the sand." });
    const pl = solaraPillars(); if (pl.length) { const cx = pl.reduce((a, p) => a + p.x, 0) / pl.length, cz = pl.reduce((a, p) => a + p.z, 0) / pl.length; pois.push({ id: "colonnade", name: "Sun Colonnade", cat: "ruins", x: cx, z: cz, rank: 2 }); }
  }
  // Ember Peaks: the wreck field by the trench
  if (m.id === "ember") { const wf = wreckField(); if (wf.length) { const cx = wf.reduce((a, w) => a + w.x, 0) / wf.length, cz = wf.reduce((a, w) => a + w.z, 0) / wf.length; pois.push({ id: "wreck-field", name: "Wreck Field", cat: "wreck", x: cx, z: cz, rank: 2 }); for (const w of wf) bOut.push({ x: w.x, z: w.z, hx: 2.3, hz: 1, yaw: w.yaw, use: "garage", h: 0.05, m: 1.6 }); } }
  // hazard zones (circles round their landmarks)
  for (const hz of HAZARD_ZONES) {
    const l = LANDMARKS.find((x) => x.id === hz.landmarkId); if (!l || !inMap(m, l.x, l.z)) continue;
    rings.push({ x: l.x, z: l.z, r: hz.radius, kind: "hazard", name: hz.name });
    pois.push({ id: hz.id, name: hz.name, cat: "hazard", x: l.x, z: l.z + hz.radius * 0.4, rank: 1, blurb: hz.hint });
  }
  // transit: every airport kiosk and seaport, the Thalassia elevator
  for (const t of TERMINALS) if (inMap(m, t.x, t.z)) pois.push({ id: t.id, name: t.name, cat: t.kind === "SEAPORT" ? "port" : "terminal", x: t.x, z: t.z, rank: 1 });
  const el = thalassiaElevator();
  if (inMap(m, el.pier.x, el.pier.z) || inMap(m, el.platform.x, el.platform.z)) {
    roads.push({ cls: "boardwalk", pts: [[el.pier.x, el.pier.z], [el.platform.x, el.platform.z]], width: 4, name: "Thalassia pier" });
    rings.push({ x: el.platform.x, z: el.platform.z, r: ELEVATOR_PLATFORM_R, kind: "pad" });
    pois.push({ id: "thalassia-elevator", name: "Thalassia Elevator", cat: "transit", x: el.platform.x, z: el.platform.z, rank: 0, blurb: "Down to the sunken city." });
  }
  // Nexus City: the skyrail guideways and the hub's ring road, the skyline lookout
  if (m.id === "nexus") {
    for (const l of railLines()) roads.push({ cls: "rail", pts: [[l.ax, l.az], [l.bx, l.bz]], width: SKYRAIL.width, name: "Nexus Skyrail" });
    const N = R2("nexus"), ring: [number, number][] = Array.from({ length: 49 }, (_, i) => { const a = (i / 48) * Math.PI * 2; return [N.x + Math.cos(a) * NEXUS_HUB_ROAD_R, N.z + Math.sin(a) * NEXUS_HUB_ROAD_R]; });
    roads.push({ cls: "street", pts: ring, width: 4.4, name: "Hub Circle" });
  }
  const lk = skylineLookout();
  if (lk && inMap(m, lk.x, lk.z)) { pav.push({ x: lk.x, z: lk.z, hx: LEDGE.length / 2, hz: LEDGE.width / 2, yaw: -Math.atan2(lk.dirZ, lk.dirX), kind: "plaza" }); pois.push({ id: "skyline-lookout", name: "Skyline Lookout", cat: "viewpoint", x: lk.x, z: lk.z, rank: 1 }); }
  // Neon City: the spire, the checkpoint, the elevated deck and its skybridges, the maglev lines and stations, the grid walkways
  if (m.id === "neon-city") {
    const c = NEON_SITE;
    bOut.push({ x: c.x + SPIRE.x, z: c.z + SPIRE.z, hx: SPIRE.base, hz: SPIRE.base, yaw: 0, use: "office", h: 1, m: SPIRE.height, name: "Aegis Spire" });
    pav.push({ x: c.x + CHECKPOINT.x, z: c.z + CHECKPOINT.z, hx: CHECKPOINT.width / 2, hz: 2, yaw: 0, kind: "plaza" });
    const hx = DECK.halfX, hz = DECK.halfZ;
    roads.push({ cls: "skybridge", pts: [[c.x - hx, c.z - hz], [c.x + hx, c.z - hz], [c.x + hx, c.z + hz], [c.x - hx, c.z + hz], [c.x - hx, c.z - hz]], width: DECK.width, name: "Sky Deck" });
    for (const b of SKYBRIDGES) roads.push({ cls: "skybridge", pts: [[c.x - hx, c.z + b.z], [c.x + hx, c.z + b.z]], width: 3.4, name: "Skybridge" });
    for (const { line, rail } of worldMaglev(c)) {
      const pts = rail.pts.map((p) => [p.x, p.z] as [number, number]); if (rail.closed && pts.length) pts.push(pts[0]!);
      roads.push({ cls: "rail", pts, width: 2.4, name: line.name, color: line.color });
      for (const f of line.stations) { const target = f * rail.total; let k = 0; while (k < rail.len.length - 2 && rail.len[k + 1]! < target) k++; const a = rail.pts[k]!, b = rail.pts[(k + 1) % rail.pts.length]!, seg = (rail.len[k + 1] ?? rail.total) - rail.len[k]!, t = seg > 0 ? (target - rail.len[k]!) / seg : 0;
        pois.push({ id: `${line.id}-st-${f}`, name: `${line.name} station`, cat: "station", x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, rank: 2 }); }
    }
    for (const w of GRID_WALKWAYS) { const x = c.x + w.dx, z = c.z + w.dz; roads.push({ cls: "skybridge", pts: [[x - w.dirX * w.length / 2, z - w.dirZ * w.length / 2], [x + w.dirX * w.length / 2, z + w.dirZ * w.length / 2]], width: w.width, name: "Grid walkway" }); }
    const dens = undercity(); if (dens.length) pois.push({ id: "undercity", name: "Undercity", cat: "entertainment", x: c.x + dens[0]!.x, z: c.z + dens[0]!.z, rank: 2, blurb: "Dens and terminals under the streets." });
  }
  // bridges where the supply roads cross rivers and washes
  for (const cr of riverCrossings()) if (cr.resolved && inMap(m, cr.x, cr.z)) { const h = cr.length / 2; roads.push({ cls: "bridge", pts: [[cr.x - cr.dirX * h, cr.z - cr.dirZ * h], [cr.x + cr.dirX * h, cr.z + cr.dirZ * h]], width: cr.width }); }
  // the rivers and streams by name: the widest is a river, the rest streams (dry washes say so)
  if (m.kind === "region") for (const r of waterNetwork().rivers) {
    const inside = r.points.filter((p) => inMap(m, p.x, p.z));
    if (inside.length < 6) continue;
    const mid = inside[Math.floor(inside.length / 2)]!, w = inside.reduce((a, p) => Math.max(a, p.w), 0);
    areas.push({ name: r.dry ? "Dry wash" : w > 5 ? "River" : "Stream", x: mid.x, z: mid.z, kind: "river", rank: 2 });
  }
}

const cache = new Map<string, CartoFeatures>();
export function cartoFeatures(m: CartoMap): CartoFeatures {
  const hit = cache.get(m.id);
  if (hit) return hit;
  const land = newLand(m.id);
  if (land) { const f = land.features(); cache.set(m.id, f); return f; }
  const buildingsOut: CartoBuilding[] = [], roads: CartoRoad[] = [], pavements: CartoPavement[] = [], rings: CartoFeatures["rings"] = [], pois: CartoPoi[] = [], areas: CartoArea[] = [];
  // buildings
  if (m.id === "nexus") { buildingsOut.push(...nexusBuildings(), ...residenceBuildings(m)); pavements.push(...streetPavements("nexus")); }
  if (m.id === "neon-city") { buildingsOut.push(...neonBuildings(), ...residenceBuildings(m)); pavements.push(...streetPavements("neon")); }
  if (m.id === "riverdale") {
    buildingsOut.push(...residenceBuildings(m));
    const len = RIVERDALE.r * 2 - 4;
    for (const k of [-13, 13]) { pavements.push({ x: RIVERDALE.x + k, z: RIVERDALE.z, hx: 3, hz: len / 2, yaw: 0, kind: "street" }, { x: RIVERDALE.x, z: RIVERDALE.z + k, hx: len / 2, hz: 3, yaw: 0, kind: "street" }); }
    pavements.push({ x: RIVERDALE.x, z: RIVERDALE.z, hx: RIVERDALE.square, hz: RIVERDALE.square, yaw: 0, kind: "plaza" });
    buildingsOut.push({ x: RIVERDALE.x, z: RIVERDALE.z, hx: 2.8, hz: 2.8, yaw: 0, use: "civic", h: 0.4, m: 11, name: "Clock Tower" });
    pois.push({ id: "riverdale-square", name: "Town Square", cat: "park", x: RIVERDALE.x, z: RIVERDALE.z, rank: 1 });
  }
  if (m.id === "thalassia") {
    const c = THALASSIA_CENTER;
    rings.push({ x: c.x, z: c.z, r: CITY_RADIUS, kind: "dome" }, { x: c.x, z: c.z, r: RING.outer, kind: "ring" }, { x: c.x, z: c.z, r: RING.inner, kind: "ring" }, { x: c.x, z: c.z, r: CORE.r * 0.6, kind: "ring" }, { x: c.x + DOCK.dx, z: c.z + DOCK.dz, r: DOCK.r, kind: "dock" });
  }
  // shops everywhere get a storefront
  for (const s of REGIONAL_SHOPS) if (inMap(m, s.x, s.z)) {
    if (!buildingsOut.some((b) => Math.abs(s.x - b.x) < b.hx && Math.abs(s.z - b.z) < b.hz)) buildingsOut.push({ x: s.x, z: s.z, hx: 2.6, hz: 2.6, yaw: 0, use: "store", h: 0.12, m: 5 });
    pois.push({ id: s.id, name: s.name, cat: "store", x: s.x, z: s.z, rank: 2, blurb: s.blurb });
  }
  // roads: the supply roads, the bridges, the runway, the boardwalks
  for (const l of LANES) {
    const pts = laneSamples(l, 64).map((p) => [p.x, p.z] as [number, number]);
    if (!pts.some(([x, z]) => inMap(m, x, z, 40))) continue;
    const k = roadKind(l);
    roads.push({ cls: k === "asphalt" ? "highway" : k === "gravel" ? "main" : "track", pts, width: LANE_HALF_WIDTH * (k === "asphalt" ? 1.6 : 1.2), name: l.name });
  }
  for (const b of BRIDGES) {
    const f = bridgeFrame(b), hl = f.length / 2;
    const pts: [number, number][] = [[f.cx - f.dirX * hl, f.cz - f.dirZ * hl], [f.cx + f.dirX * hl, f.cz + f.dirZ * hl]];
    if (pts.some(([x, z]) => inMap(m, x, z, 60)) || inMap(m, f.cx, f.cz, 60)) roads.push({ cls: "bridge", pts, width: b.width, name: b.name });
  }
  if (inMap(m, AIRPORT.x, AIRPORT.z)) {
    const a = AIRPORT, hl = a.length / 2;
    const p0 = airportPoint(-hl + a.ramp, a.runwayOffset), p1 = airportPoint(hl - a.ramp, a.runwayOffset);
    pavements.push({ x: a.x, z: a.z, hx: a.length / 2, hz: a.width / 2, yaw: -Math.atan2(a.dirZ, a.dirX), kind: "apron" });
    roads.push({ cls: "runway", pts: [[p0.x, p0.z], [p1.x, p1.z]], width: a.runwayWidth, name: "Runway 10/28" });
    pois.push({ id: "nexus-airport", name: "Nexus Airport", cat: "airport", x: a.x, z: a.z, rank: 0 });
  }
  if (m.id === "storm") {
    // each island's structures as StormIslands.tsx builds them, and the island itself as a place with its height above the sea
    const STORM_CAT: Record<string, PoiCat> = { landing: "dock", ruins: "ruins", outpost: "outpost", temple: "temple", nest: "camp", "storm-core": "spire" };
    for (const site of STORM_ISLAND_SITES) {
      const w = stormSiteWorld(site), r = islandRadius(site);
      if (site.kind === "landing") buildingsOut.push({ x: w.x + r * 0.9, z: w.z, hx: 9, hz: 2.5, yaw: 0, use: "transport", h: 0.05, m: 1, name: "Airship pier" });
      if (site.kind === "temple") { buildingsOut.push({ x: w.x, z: w.z, hx: 15, hz: 11, yaw: 0, use: "civic", h: 0.5, m: 16, name: site.name }); }
      if (site.kind === "ruins") for (const v of [-1, 0, 1]) for (const sd of [-1, 1]) buildingsOut.push({ x: w.x + v * 9, z: w.z + sd * 6, hx: 1.8, hz: 1.8, yaw: 0, use: "civic", h: 0.15, m: 5 });
      if (site.kind === "outpost") buildingsOut.push({ x: w.x, z: w.z, hx: 3.5, hz: 3.5, yaw: 0, use: "industrial", h: 0.6, m: 28, name: "Storm relay" });
      if (site.kind === "nest") rings.push({ x: w.x, z: w.z, r: 10, kind: "ring" });
      if (site.kind === "storm-core") rings.push({ x: w.x, z: w.z, r: 11, kind: "dome" });
      pois.push({ id: `storm-${site.id}`, name: `${site.name} · ${Math.round(w.y)} m up`, cat: STORM_CAT[site.kind] ?? "landmark", x: w.x, z: w.z + (site.kind === "landing" ? 0 : r * 0.2), rank: site.kind === "landing" || site.kind === "storm-core" ? 0 : 1, blurb: site.description });
    }
    areas.push({ name: "Tempest Ocean", x: m.x - m.reach * 0.55, z: m.z + m.reach * 0.6, kind: "sea", rank: 1 });
  }
  if (m.id === "swamps") for (const run of boardwalks()) roads.push({ cls: "boardwalk", pts: run.map((p) => [p.x, p.z]), width: 2.2 });
  addWorldDetail(m, buildingsOut, roads, pavements, rings, pois, areas);
  // points of interest: the atlas sites, landmarks, garages, nature
  for (const s of SITES) {
    if (!inMap(m, s.x, s.z)) continue;
    const cat = SITE_POI[s.kind];
    if (s.kind === "district" || s.kind === "government" && s.radius > 20) { areas.push({ name: s.name, x: s.x, z: s.z, kind: "district", rank: 1 }); continue; }
    if (s.kind === "field") { areas.push({ name: s.name, x: s.x, z: s.z, kind: m.regionId === "ember" ? "lava" : m.regionId === "frostspire" ? "snow" : m.regionId === "solara" ? "desert" : "valley", rank: 1 }); continue; }
    if (s.kind === "grove" && s.radius > 20) areas.push({ name: s.name, x: s.x, z: s.z, kind: "forest", rank: 2 });
    if (cat) pois.push({ id: s.id, name: s.name, cat, x: s.x, z: s.z, rank: s.radius > 20 ? 1 : 2, blurb: s.blurb });
  }
  for (const l of LANDMARKS) if (inMap(m, l.x, l.z) && !pois.some((p) => Math.hypot(p.x - l.x, p.z - l.z) < 12)) {
    const cat: PoiCat = l.type === "volcano" ? "lava" : l.type === "mountain" ? "peak" : l.type === "lake" ? "lake" : l.type === "outpost" ? "outpost" : l.type === "ruin" ? "ruins" : "landmark";
    if (l.type === "forest" || l.type === "desert" || l.type === "ocean") areas.push({ name: l.name, x: l.x, z: l.z, kind: l.type === "forest" ? "forest" : l.type === "desert" ? "desert" : "sea", rank: 2 });
    else pois.push({ id: l.id, name: l.name, cat, x: l.x, z: l.z, rank: 2, blurb: l.history });
  }
  for (const g of Object.values(GARAGES)) if (inMap(m, g.x, g.z)) pois.push({ id: g.id, name: g.name, cat: "garage", x: g.x, z: g.z, rank: 2 });
  const net = waterNetwork();
  for (const lk of net.lakes) if (inMap(m, lk.x, lk.z) && lk.r > 6 && !pois.some((p) => p.cat === "lake" && Math.hypot(p.x - lk.x, p.z - lk.z) < lk.r * 2)) areas.push({ name: m.regionId === "frostspire" ? "Glacier Lake" : "Lake", x: lk.x, z: lk.z, kind: "lake", rank: 2 });
  for (const r of net.rivers) for (const f of r.falls) if (inMap(m, f.x, f.z)) pois.push({ id: `${r.id}-falls-${Math.round(f.x)}`, name: "Waterfall", cat: "falls", x: f.x, z: f.z, rank: 3 });
  if (m.regionId === "ember") { const e = REGIONS.find((r) => r.id === "ember")!; pois.push({ id: "ember-crater", name: "Magma Pool", cat: "lava", x: e.x, z: e.z + CRATER_R * 1.3, rank: 0, blurb: "The crater's open lake of magma." }); areas.push({ name: "Lava Flows", x: e.x + CRATER_R * 3, z: e.z - CRATER_R * 2.5, kind: "lava", rank: 2 }); }
  if (m.kind === "region") for (const pk of peaks(m, m.regionId === "frostspire" ? 4 : 2)) { const near = pois.find((p) => (p.cat === "spire" || p.cat === "peak" || p.cat === "lava") && Math.hypot(p.x - pk.x, p.z - pk.z) < m.reach * 0.2); if (near) near.name = `${near.name} · ${pk.name.split(" · ")[1]}`; else pois.push(pk); }
  // big names
  areas.push({ name: m.name, x: m.x, z: m.z - m.reach * (m.kind === "city" ? 0.72 : 0.82), kind: m.kind === "city" ? "city" : m.regionId === "storm-islands" ? "sea" : m.regionId === "frostspire" ? "mountain" : m.regionId === "solara" || m.regionId === "wastelands" ? "desert" : m.regionId === "swamps" ? "marsh" : m.regionId === "ember" ? "lava" : "forest", rank: 0 });
  // one pin per place: the same id twice, or the same place under the same name from two sources, keeps the first
  const seen = new Set<string>(), kept: CartoPoi[] = [];
  for (const p of pois) {
    const base = p.name.split(" · ")[0]!;
    if (seen.has(p.id) || kept.some((k) => k.name.split(" · ")[0] === base && Math.hypot(k.x - p.x, k.z - p.z) < 30)) continue;
    seen.add(p.id); kept.push(p);
  }
  const feats: CartoFeatures = { buildings: buildingsOut.filter((b) => inMap(m, b.x, b.z)), roads, pavements: pavements.filter((p) => inMap(m, p.x, p.z, 20)), rings, pois: kept, areas };
  cache.set(m.id, feats);
  return feats;
}

/** every map's features (tests) */
export const allCartoFeatures = () => CARTO_MAPS.map((m) => ({ map: m, ...cartoFeatures(m) }));
