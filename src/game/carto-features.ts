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

export type BuildingUse = "apartment" | "house" | "store" | "mall" | "school" | "entertainment" | "office" | "civic" | "industrial" | "transport" | "garage" | "dome";
export type CartoBuilding = { x: number; z: number; hx: number; hz: number; yaw: number; use: BuildingUse; /** 0..1 how tall, for the roof shading */ h: number; name?: string };
export type RoadClass = "highway" | "main" | "street" | "track" | "runway" | "taxiway" | "bridge" | "boardwalk";
export type CartoRoad = { cls: RoadClass; pts: [number, number][]; /** full width in metres */ width: number; name?: string };
/** a paved area drawn under the roads (street segments, junctions, the square, the apron) */
export type CartoPavement = { x: number; z: number; hx: number; hz: number; yaw: number; kind: "street" | "plaza" | "apron" };
export type PoiCat = "store" | "mall" | "school" | "university" | "entertainment" | "casino" | "nightclub" | "park" | "transit" | "dock" | "civic" | "landmark" | "garage"
  | "village" | "camp" | "cave" | "ruins" | "peak" | "lake" | "falls" | "lava" | "research" | "temple" | "spire" | "airport" | "outpost";
export type CartoPoi = { id: string; name: string; cat: PoiCat; x: number; z: number; /** 0 always shown .. 3 only close up */ rank: number; blurb?: string };
export type AreaKind = "city" | "district" | "mountain" | "valley" | "lake" | "desert" | "forest" | "lava" | "sea" | "snow" | "marsh";
export type CartoArea = { name: string; x: number; z: number; kind: AreaKind; rank: number };
export type CartoFeatures = { buildings: CartoBuilding[]; roads: CartoRoad[]; pavements: CartoPavement[]; rings: { x: number; z: number; r: number; kind: "dome" | "ring" | "dock" }[]; pois: CartoPoi[]; areas: CartoArea[] };

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
};
/** filter groups for the map's chips */
export const POI_GROUPS: { id: string; label: string; cats: PoiCat[] }[] = [
  { id: "shopping", label: "Shopping", cats: ["store", "mall"] },
  { id: "schools", label: "Schools", cats: ["school", "university"] },
  { id: "fun", label: "Entertainment", cats: ["entertainment", "casino", "nightclub"] },
  { id: "transit", label: "Transit", cats: ["transit", "dock", "airport", "garage"] },
  { id: "civic", label: "Civic", cats: ["civic", "park", "landmark", "research"] },
  { id: "nature", label: "Nature", cats: ["peak", "lake", "falls", "lava", "cave", "spire"] },
  { id: "places", label: "Places", cats: ["village", "camp", "ruins", "temple", "outpost"] },
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
  for (const t of nexusHubTowers(NEXUS)) { const m = BUILDING_MODELS[t.model]; out.push({ x: t.x, z: t.z, hx: m.w / 2, hz: m.d / 2, yaw: t.rot, use: "civic", h: Math.min(1, m.height / 60) }); }
  // the airport: terminal, control tower, hangar
  const A = AIRPORT_BUILDINGS, yaw = -Math.atan2(AIRPORT.dirZ, AIRPORT.dirX);
  for (const [k, b] of [["Terminal", A.terminal], ["Hangar", A.hangar]] as const) { const p = airportPoint(b.along, b.across); out.push({ x: p.x, z: p.z, hx: b.length / 2, hz: b.depth / 2, yaw, use: "transport", h: b.height / 60, name: `Nexus Airport ${k}` }); }
  { const p = airportPoint(A.tower.along, A.tower.across); out.push({ x: p.x, z: p.z, hx: A.tower.radius, hz: A.tower.radius, yaw, use: "transport", h: 0.45 }); }
  nameBuildings(out, "nexus");
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
  // the casino resort on its own plot
  out.push({ x: NEON_SITE.x + CASINO_PLOT.x, z: NEON_SITE.z + CASINO_PLOT.z, hx: CASINO_PLOT.r * 0.62, hz: CASINO_PLOT.r * 0.5, yaw: 0, use: "entertainment", h: 1, name: "Skyline Casino Resort" });
  nameBuildings(out, "neon");
  return out;
}

function residenceBuildings(m: CartoMap): CartoBuilding[] {
  const out: CartoBuilding[] = [];
  for (const r of residences()) {
    if (!inMap(m, r.x, r.z)) continue;
    const f = footprint(r);
    const flats = r.style === "apartment" || r.style === "condo" || r.style === "loft";
    out.push({ x: r.x, z: r.z, hx: f.hx, hz: f.hz, yaw: 0, use: flats ? "apartment" : "house", h: flats ? 0.4 : 0.2 });
    if (r.garage) { const g = garageRect(r.garage); out.push({ x: g.x, z: g.z, hx: g.hx, hz: g.hz, yaw: 0, use: "garage", h: 0.1 }); }
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

const cache = new Map<string, CartoFeatures>();
export function cartoFeatures(m: CartoMap): CartoFeatures {
  const hit = cache.get(m.id);
  if (hit) return hit;
  const buildingsOut: CartoBuilding[] = [], roads: CartoRoad[] = [], pavements: CartoPavement[] = [], rings: CartoFeatures["rings"] = [], pois: CartoPoi[] = [], areas: CartoArea[] = [];
  // buildings
  if (m.id === "nexus") { buildingsOut.push(...nexusBuildings(), ...residenceBuildings(m)); pavements.push(...streetPavements("nexus")); }
  if (m.id === "neon-city") { buildingsOut.push(...neonBuildings(), ...residenceBuildings(m)); pavements.push(...streetPavements("neon")); }
  if (m.id === "riverdale") {
    buildingsOut.push(...residenceBuildings(m));
    const len = RIVERDALE.r * 2 - 4;
    for (const k of [-13, 13]) { pavements.push({ x: RIVERDALE.x + k, z: RIVERDALE.z, hx: 3, hz: len / 2, yaw: 0, kind: "street" }, { x: RIVERDALE.x, z: RIVERDALE.z + k, hx: len / 2, hz: 3, yaw: 0, kind: "street" }); }
    pavements.push({ x: RIVERDALE.x, z: RIVERDALE.z, hx: RIVERDALE.square, hz: RIVERDALE.square, yaw: 0, kind: "plaza" });
    buildingsOut.push({ x: RIVERDALE.x, z: RIVERDALE.z, hx: 2.8, hz: 2.8, yaw: 0, use: "civic", h: 0.4, name: "Clock Tower" });
    pois.push({ id: "riverdale-square", name: "Town Square", cat: "park", x: RIVERDALE.x, z: RIVERDALE.z, rank: 1 });
  }
  if (m.id === "thalassia") {
    const c = THALASSIA_CENTER;
    rings.push({ x: c.x, z: c.z, r: CITY_RADIUS, kind: "dome" }, { x: c.x, z: c.z, r: RING.outer, kind: "ring" }, { x: c.x, z: c.z, r: RING.inner, kind: "ring" }, { x: c.x, z: c.z, r: CORE.r * 0.6, kind: "ring" }, { x: c.x + DOCK.dx, z: c.z + DOCK.dz, r: DOCK.r, kind: "dock" });
  }
  // shops everywhere get a storefront
  for (const s of REGIONAL_SHOPS) if (inMap(m, s.x, s.z)) {
    if (!buildingsOut.some((b) => Math.abs(s.x - b.x) < b.hx && Math.abs(s.z - b.z) < b.hz)) buildingsOut.push({ x: s.x, z: s.z, hx: 2.6, hz: 2.6, yaw: 0, use: "store", h: 0.12 });
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
  if (m.id === "swamps") for (const run of boardwalks()) roads.push({ cls: "boardwalk", pts: run.map((p) => [p.x, p.z]), width: 2.2 });
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
  areas.push({ name: m.name, x: m.x, z: m.z - m.reach * (m.kind === "city" ? 0.72 : 0.82), kind: m.kind === "city" ? "city" : m.regionId === "frostspire" ? "mountain" : m.regionId === "solara" || m.regionId === "wastelands" ? "desert" : m.regionId === "swamps" ? "marsh" : m.regionId === "ember" ? "lava" : "forest", rank: 0 });
  const feats: CartoFeatures = { buildings: buildingsOut.filter((b) => inMap(m, b.x, b.z)), roads, pavements: pavements.filter((p) => inMap(m, p.x, p.z, 20)), rings, pois, areas };
  cache.set(m.id, feats);
  return feats;
}

/** every map's features (tests) */
export const allCartoFeatures = () => CARTO_MAPS.map((m) => ({ map: m, ...cartoFeatures(m) }));
