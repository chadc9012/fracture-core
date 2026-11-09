/** Street-and-terrain maps of every city and region, in the look of a web street map (owner, Nov 1: "maps for all regions and
 * cities at the same quality level as Google Maps, showing terrains, forest, buildings, apartments, stores, malls, schools,
 * entertainment centers, valleys, lava pools, magma, snow, snowy mountains, cliffs, deserts").
 *
 * Two layers, both read from the same data the world is built from, so a map can never disagree with the ground you walk:
 *  - this file: the land-cover raster (water, beaches, meadows, forest, desert and dunes, rock and cliffs, snow and ice, ash, lava
 *    fields, magma pools and vents, marsh, city ground) with soft hill shading and contour lines. Pure; a resumable job, so the
 *    UI can paint it a few ms per frame when no baked image matches (scripts/bake-carto-maps.ts bakes them for the APK).
 *  - carto-features.ts: the vector layer drawn over it (buildings by use, roads, POIs, labels).
 */
import { HEIGHT_K, WATER_LEVEL, heightAt, neonPlateauWeight, riverAt, riverdaleWeight, solaraValley, suburbWeight, waterNetwork } from "./terrain";
import { NEON_SITE, REGIONS, RIVERDALE } from "./world";
import { CRATER_R, lavaFlows, vents } from "./ember-dressing";
import { badlands } from "./badlands";
import { mesas, oasis } from "./solara-dressing";
import { THALASSIA_CENTER } from "./thalassia-site";
import { airportPoint, AIRPORT } from "./nexus-airport";
import { STORM_ISLAND_SITES, STORM_ISLANDS_CENTER, stormSiteWorld } from "./storm-islands";
import { islandRadius } from "./storm-quests";
import { HILLS } from "./nexus-hills";
import { NEW_LANDS } from "./new-lands";
import { lavaFissures } from "./set-pieces";
import { frozenFall } from "./frost-dressing";

export type CartoBounds = { x0: number; z0: number; span: number };
export type CartoMapId = "nexus" | "nexus-region" | "neon-city" | "riverdale" | "thalassia" | "veridan" | "frostspire" | "ember" | "wastelands" | "solara" | "swamps" | "storm" | "crystal-badlands" | "shattered-reefs" | "goldenreach" | "azure-isles" | "frostveil" | "old-harrow";
export type CartoMap = { id: CartoMapId; name: string; sub: string; kind: "city" | "region"; x: number; z: number; reach: number; regionId: string };

const R = (id: string) => REGIONS.find((r) => r.id === id)!;
const NEXUS = R("nexus");

const REGION_SUB: Record<string, string> = {
  veridan: "Forest · lakes · waterfalls", frostspire: "Snow peaks · glaciers · cliffs", ember: "Volcano · lava fields · magma",
  wastelands: "Badlands · buttes · desert", solara: "Desert · dunes · oasis", swamps: "Marsh · mangroves · bayous",
};

/** every map, cities first. Each is a square `reach` metres from its centre to each edge. */
export const CARTO_MAPS: readonly CartoMap[] = [
  // the hub, its four districts, the residential street and the airport on the south shore
  { id: "nexus", name: "Nexus City", sub: "Capital · safe zone", kind: "city", x: NEXUS.x + 28, z: NEXUS.z + 130, reach: 240, regionId: "nexus" },
  { id: "neon-city", name: "Neon City", sub: "Cyberpunk metropolis", kind: "city", x: NEON_SITE.x, z: NEON_SITE.z, reach: 210, regionId: "neon" },
  { id: "riverdale", name: "Riverdale", sub: "River town", kind: "city", x: RIVERDALE.x, z: RIVERDALE.z, reach: 110, regionId: "veridan" },
  { id: "thalassia", name: "Thalassia", sub: "Underwater city", kind: "city", x: THALASSIA_CENTER.x, z: THALASSIA_CENTER.z, reach: 160, regionId: "thalassia" },
  ...(["veridan", "frostspire", "ember", "wastelands", "solara", "swamps"] as const).map((id): CartoMap => {
    const r = R(id);
    return { id, name: r.name, sub: REGION_SUB[id] ?? "", kind: "region", x: r.x, z: r.z, reach: Math.round(r.radius * 1.15), regionId: id };
  }),
  // the floating chain over the storm sea north-east of Nexus City (storm-islands.ts): its six islands span ~530 m
  { id: "storm", name: "Storm Islands", sub: "Floating islands · storm sea", kind: "region", x: STORM_ISLANDS_CENTER.x + 45, z: STORM_ISLANDS_CENTER.z + 150, reach: 330, regionId: "storm-islands" },
  // the two continents built beyond the playable world (new-lands.ts): their own ground, towns and roads
  ...NEW_LANDS.map((l) => l.map),
];
/** the ground a map is painted from: its own for the new lands, else the live world */
export const cartoSource = (m: CartoMap): CartoSource | undefined => NEW_LANDS.find((l) => l.map.id === m.id)?.source;
export const cartoMap = (id: string) => CARTO_MAPS.find((m) => m.id === id);
export const cartoBounds = (m: CartoMap): CartoBounds => ({ x0: m.x - m.reach, z0: m.z - m.reach, span: m.reach * 2 });
/** the map that shows a world point best: the smallest one it lies inside */
export function cartoMapAt(x: number, z: number): CartoMap | null {
  let best: CartoMap | null = null;
  for (const m of CARTO_MAPS) if (Math.abs(x - m.x) < m.reach * 0.92 && Math.abs(z - m.z) < m.reach * 0.92 && (!best || m.reach < best.reach)) best = m;
  return best;
}

/* ---------------- land cover ---------------- */

export type Cover =
  | "deep" | "sea" | "shallow" | "lake" | "river" | "beach" | "meadow" | "grass" | "forest" | "denseForest" | "scrub" | "dirt"
  | "desert" | "dunes" | "rock" | "sandstone" | "basalt" | "cliff" | "snow" | "ice" | "ash" | "lava" | "magma" | "marsh" | "urban" | "paved" | "town" | "wash" | "crystal" | "rift" | "reef" | "crop";

/** The palette: a light, legible street-map style. Water is a clean light blue, land a warm off-white tinted by what grows
 * on it, cities pale grey blocks for the white streets to sit on; the hot ground of Ember Peaks is the one loud colour. */
export const COVER_COLOR: Record<Cover, readonly [number, number, number]> = {
  deep: [128, 184, 232], sea: [150, 200, 240], shallow: [172, 216, 246], lake: [156, 204, 242], river: [150, 198, 240],
  beach: [246, 236, 200], meadow: [214, 236, 196], grass: [200, 230, 180], forest: [170, 214, 156], denseForest: [146, 198, 132],
  scrub: [222, 216, 176], dirt: [232, 206, 160], desert: [246, 226, 184], dunes: [240, 214, 162], rock: [214, 206, 194], sandstone: [226, 176, 128], basalt: [96, 88, 86], cliff: [190, 180, 168],
  snow: [252, 253, 255], ice: [222, 240, 250], ash: [128, 116, 110], lava: [255, 104, 32], magma: [255, 178, 40], marsh: [182, 206, 172],
  urban: [236, 234, 230], paved: [226, 222, 216], town: [240, 236, 226], wash: [226, 204, 168],
  crystal: [214, 190, 255], rift: [92, 52, 128], reef: [150, 226, 222], crop: [244, 226, 160],
};
export const COVER_LABEL: Record<Cover, string> = {
  deep: "Deep water", sea: "Sea", shallow: "Shallows", lake: "Lake", river: "River", beach: "Beach", meadow: "Meadow", grass: "Grassland",
  forest: "Forest", denseForest: "Old-growth forest", scrub: "Scrub", dirt: "Dirt", desert: "Desert", dunes: "Dunes", rock: "Rock", sandstone: "Sandstone", basalt: "Basalt", cliff: "Cliffs",
  snow: "Snow", ice: "Glacier ice", ash: "Ash plain", lava: "Lava field", magma: "Magma pool", marsh: "Marsh", urban: "City", paved: "Paved", town: "Town", wash: "Dry wash", crystal: "Crystal field", rift: "Void rift", reef: "Reef", crop: "Crop fields",
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** cheap value noise (deterministic, no allocations) */
function hash(ix: number, iz: number): number { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
const fbm2 = (x: number, z: number) => vnoise(x, z) * 0.6 + vnoise(x * 2.03 + 17, z * 2.03 - 9) * 0.28 + vnoise(x * 4.1 - 5, z * 4.1 + 3) * 0.12;

/** which wild region's ground a point belongs to (biome), with ragged borders; null outside them all */
const WILD_REGIONS = ["veridan", "frostspire", "ember", "wastelands", "solara", "swamps"].map(R);
function biomeAt(x: number, z: number): { id: string; w: number } | null {
  const ragged = 1 + (fbm2(x * 0.012, z * 0.012) - 0.5) * 0.28;
  let best: { id: string; w: number } | null = null;
  for (const r of WILD_REGIONS) {
    const d = (Math.hypot(x - r.x, z - r.z) / r.radius) * ragged;
    const w = 1 - smooth(0.92, 1.3, d);
    if (w > 0 && (!best || w > best.w)) best = { id: r.id, w };
  }
  return best;
}

/** features stamped into the raster before colouring (lava flows, the crater, vents, the oasis, buttes and mesas, the runway) */
type Stamp = { cover: Cover; x: number; z: number; r: number } | { cover: Cover; seg: [number, number, number, number]; w: number } | { cover: Cover; quad: [number, number][] };
let stampsCache: Stamp[] | null = null;
export function cartoStamps(): Stamp[] {
  if (stampsCache) return stampsCache;
  const out: Stamp[] = [];
  const e = R("ember");
  for (const flow of lavaFlows()) for (let i = 1; i < flow.length; i++) { const a = flow[i - 1]!, b = flow[i]!; out.push({ cover: "lava", seg: [a.x, a.z, b.x, b.z], w: Math.max(a.w, b.w) * 1.4 }); }
  out.push({ cover: "magma", x: e.x, z: e.z, r: CRATER_R * 0.8 });
  for (const v of vents()) if (!v.big) out.push({ cover: "magma", x: v.x, z: v.z, r: 2.6 });
  const o = oasis();
  if (o) out.push({ cover: "lake", x: o.x, z: o.z, r: o.pool });
  for (const f of badlands()) out.push({ cover: "sandstone", x: f.x, z: f.z, r: f.r });
  for (const m of mesas()) out.push({ cover: "sandstone", x: m.x, z: m.z, r: 13 * m.s });
  // the airport platform (a concrete deck over the shore)
  const a = AIRPORT, hl = a.length / 2, hw = a.width / 2;
  out.push({ cover: "paved", quad: [airportPoint(-hl, -hw), airportPoint(hl, -hw), airportPoint(hl, hw), airportPoint(-hl, hw)].map((p) => [p.x, p.z]) });
  // the Smoldering Trench's lava fissures (set-pieces.ts)
  for (const f of lavaFissures()) { const hx = Math.sin(f.yaw) * f.length / 2, hz = Math.cos(f.yaw) * f.length / 2; out.push({ cover: "lava", seg: [f.x - hx, f.z - hz, f.x + hx, f.z + hz], w: Math.max(1.2, f.width) }); }
  // Frostspire's frozen waterfall: a column of glacier ice down the face
  const ff = frozenFall();
  if (ff) { const hx = Math.sin(ff.yaw) * 8, hz = Math.cos(ff.yaw) * 8; out.push({ cover: "ice", seg: [ff.x - hx, ff.z - hz, ff.x + hx, ff.z + hz], w: 2.6 }); }
  // the Storm Islands float over the sea: a cliff rim round a grassy top (StormIslands.tsx: a grass cap on a rock underside)
  for (const site of STORM_ISLAND_SITES) {
    const w = stormSiteWorld(site), r = islandRadius(site);
    out.push({ cover: "cliff", x: w.x, z: w.z, r }, { cover: site.kind === "storm-core" ? "rock" : "meadow", x: w.x, z: w.z, r: r * 0.84 });
  }
  return (stampsCache = out);
}

function inQuad(q: [number, number][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [xi, zi] = q[i]!, [xj, zj] = q[j]!;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** The land cover at a point. `h` world height, `slope` rise over run, `h0` the height on the original palette scale. */
export function coverAt(x: number, z: number, h: number, slope: number, stamp: Cover | null): Cover {
  if (stamp) return stamp;
  const lakes = waterNetwork().lakes;
  for (const l of lakes) if (Math.hypot(x - l.x, z - l.z) < l.r * 1.4 && h < l.level - 0.05) return biomeAt(x, z)?.id === "frostspire" ? "ice" : "lake";
  const rv = riverAt(x, z);
  if (rv && rv.dist < rv.w * 0.95) return rv.dry ? "wash" : "river";
  if (h < WATER_LEVEL) { const d = WATER_LEVEL - h; return d < 2.2 ? "shallow" : d < 10 ? "sea" : "deep"; }
  const h0 = WATER_LEVEL + (h - WATER_LEVEL) / HEIGHT_K;
  // built ground
  if (neonPlateauWeight(x, z) > 0.55) return "urban";
  if (Math.hypot(x - NEXUS.x, z - NEXUS.z) < 104) return "urban";
  if (suburbWeight(x, z) > 0.5 || riverdaleWeight(x, z) > 0.55) return "town";
  const b = biomeAt(x, z), id = b && b.w > 0.35 ? b.id : null;
  const n = fbm2(x * 0.05, z * 0.05);
  if (h0 < 1.6 && id !== "swamps") return "beach";
  if (slope > 1.6) return id === "frostspire" && h0 > 14 && n > 0.4 ? "snow" : id === "ember" ? "basalt" : id === "solara" || id === "wastelands" ? "sandstone" : "cliff";
  switch (id) {
    case "frostspire":
      if (h0 > 9 + n * 6) return slope > 1.15 && n < 0.45 ? "rock" : "snow";
      return slope > 0.85 ? "rock" : n > 0.55 ? "forest" : "meadow";
    case "ember": {
      if (h0 > 34 + n * 4) return "lava";
      return slope > 0.95 ? "basalt" : n > 0.74 ? "basalt" : "ash";
    }
    case "solara":
      if (solaraValley(x, z) > 0.35) return n > 0.5 ? "forest" : "grass";
      return slope > 0.9 ? "sandstone" : vnoise(x * 0.02, z * 0.02) > 0.42 ? "dunes" : "desert";
    case "wastelands":
      return slope > 0.9 ? "sandstone" : n > 0.66 ? "scrub" : "dirt";
    case "swamps":
      return h0 < WATER_LEVEL + 1.4 ? "marsh" : n > 0.5 ? "denseForest" : "marsh";
    case "veridan":
      if (slope > 0.9) return "rock";
      return n > 0.6 ? "denseForest" : n > 0.33 ? "forest" : "meadow";
    default: {
      if (h0 > 44) return "snow";
      if (h0 > 30 || slope > 0.85) return "rock";
      // the wooded hills ringing Nexus City (nexus-hills.ts HILLS: groves between 135 and 520 m from the hub)
      const dn = Math.hypot(x - NEXUS.x, z - NEXUS.z);
      if (dn > HILLS.inner && dn < HILLS.outer && h0 > WATER_LEVEL + HILLS.minAbove) return n > 0.5 ? "forest" : n > 0.36 ? "grass" : "meadow";
      return n > 0.62 ? "forest" : n > 0.4 ? "grass" : "meadow";
    }
  }
}

/* ---------------- the raster job ---------------- */

/** `data` carries what the satellite view is recoloured from (satelliteFromData): R the cover (COVERS index), G the hill shade
 * (6 bits), B the water depth (m × 6) */
export type CartoJob = { step: (budgetMs: number) => boolean; progress: () => number; pixels: Uint8ClampedArray; data: Uint8ClampedArray; size: number; bounds: CartoBounds };

/** Paint a square of the world. Phase 1 samples the height grid (the cost), phase 2 colours it: cover colour, a texture per
 * cover (canopy speckle, dune ripples, lava veins), north-west hill shading, faint contours every 10 m, and a crisp shoreline. */
/** a land painted from its own ground instead of the live world's (new-lands.ts: lands designed beyond the playable world) */
export type CartoSource = { height: (x: number, z: number) => number; cover: (x: number, z: number, h: number, slope: number) => Cover };
export function createCartoJob(size: number, bounds: CartoBounds, src?: CartoSource): CartoJob {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const data = new Uint8ClampedArray(size * size * 4);
  const G = size + 2, hs = new Float32Array(G * G);
  const mpp = bounds.span / size;
  const wx = (i: number) => bounds.x0 + (i - 0.5) * mpp, wz = (j: number) => bounds.z0 + (j - 0.5) * mpp;
  // stamps that touch this square, rasterised once into a cover index per pixel
  const covers = Object.keys(COVER_COLOR) as Cover[];
  const stampIdx = new Uint8Array(size * size); // 0 = none, else covers index + 1
  for (const s of src ? [] : cartoStamps()) {
    let x0: number, x1: number, z0: number, z1: number;
    if ("seg" in s) { const [ax, az, bx, bz] = s.seg; x0 = Math.min(ax, bx) - s.w; x1 = Math.max(ax, bx) + s.w; z0 = Math.min(az, bz) - s.w; z1 = Math.max(az, bz) + s.w; }
    else if ("quad" in s) { x0 = Math.min(...s.quad.map((p) => p[0])); x1 = Math.max(...s.quad.map((p) => p[0])); z0 = Math.min(...s.quad.map((p) => p[1])); z1 = Math.max(...s.quad.map((p) => p[1])); }
    else { x0 = s.x - s.r; x1 = s.x + s.r; z0 = s.z - s.r; z1 = s.z + s.r; }
    const i0 = Math.max(0, Math.floor((x0 - bounds.x0) / mpp)), i1 = Math.min(size - 1, Math.ceil((x1 - bounds.x0) / mpp));
    const j0 = Math.max(0, Math.floor((z0 - bounds.z0) / mpp)), j1 = Math.min(size - 1, Math.ceil((z1 - bounds.z0) / mpp));
    if (i0 > i1 || j0 > j1) continue;
    const ci = covers.indexOf(s.cover) + 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = bounds.x0 + (i + 0.5) * mpp, z = bounds.z0 + (j + 0.5) * mpp;
      let hit = false;
      if ("seg" in s) { const [ax, az, bx, bz] = s.seg, ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez || 1, t = clamp01(((x - ax) * ex + (z - az) * ez) / L); hit = Math.hypot(x - ax - ex * t, z - az - ez * t) < s.w * (0.8 + 0.4 * vnoise(x * 0.3, z * 0.3)); }
      else if ("quad" in s) hit = inQuad(s.quad, x, z);
      else hit = Math.hypot(x - s.x, z - s.z) < s.r * (0.92 + 0.16 * vnoise(x * 0.25, z * 0.25));
      if (hit) stampIdx[j * size + i] = ci;
    }
  }
  let row = 0, phase = 0, crow = 0;
  const coverIdx = new Uint8Array(size * size);
  const step = (budgetMs: number) => {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    while (phase === 0) {
      for (let i = 0; i < G; i++) hs[row * G + i] = src ? src.height(wx(i), wz(row)) : heightAt(wx(i), wz(row));
      if (++row >= G) { phase = 1; break; }
      if (now() - t0 > budgetMs) return false;
    }
    while (phase === 1) {
      const j = crow;
      for (let i = 0; i < size; i++) {
        const gi = (j + 1) * G + (i + 1), h = hs[gi]!;
        const dx = (hs[gi + 1]! - hs[gi - 1]!) / (2 * mpp), dz = (hs[gi + G]! - hs[gi - G]!) / (2 * mpp);
        const slope = Math.hypot(dx, dz);
        const x = bounds.x0 + (i + 0.5) * mpp, z = bounds.z0 + (j + 0.5) * mpp;
        const si = stampIdx[j * size + i]!;
        const cover = src ? src.cover(x, z, h, slope) : coverAt(x, z, h, slope, si ? covers[si - 1]! : null);
        coverIdx[j * size + i] = covers.indexOf(cover);
        const water = cover === "deep" || cover === "sea" || cover === "shallow" || cover === "lake" || cover === "river" || cover === "ice" || cover === "reef";
        const washBed = cover === "wash";
        let [r, g, b] = COVER_COLOR[cover];
        // texture per cover
        if (cover === "forest" || cover === "denseForest") { const c = vnoise(x * 0.55, z * 0.55), k = (c - 0.5) * (cover === "denseForest" ? 26 : 20); r += k; g += k * 1.1; b += k * 0.8; }
        else if (cover === "dunes") { const rip = Math.sin((x * 0.6 + z * 0.35) * 0.9 + fbm2(x * 0.03, z * 0.03) * 9); r += rip * 7; g += rip * 6; b += rip * 4; }
        else if (cover === "lava") { const v = 1 - Math.abs(vnoise(x * 0.18, z * 0.18) * 2 - 1); const hot = smooth(0.82, 0.97, v); r = r + (255 - r) * hot; g = g + (220 - g) * hot; b = b + (90 - b) * hot; const crust = smooth(0.35, 0.05, v); r -= crust * 120; g -= crust * 70; b -= crust * 20; }
        else if (cover === "magma") { const d = vnoise(x * 0.4, z * 0.4); g += (d - 0.5) * 50; }
        else if (cover === "ash") { const c = vnoise(x * 0.3, z * 0.3); r += (c - 0.5) * 18; g += (c - 0.5) * 16; b += (c - 0.5) * 14; }
        else if (cover === "marsh") { if (vnoise(x * 0.22, z * 0.22) > 0.62) { r = 160; g = 196; b = 196; } }
        else if (cover === "crystal") { const c = vnoise(x * 0.7, z * 0.7); if (c > 0.72) { r = 245; g = 232; b = 255; } else { r += (c - 0.5) * 30; b += (c - 0.5) * 20; } }
        else if (cover === "rift") { const c = vnoise(x * 0.4, z * 0.4); r += c * 40; b += c * 60; }
        else if (cover === "reef") { const c = vnoise(x * 0.35, z * 0.35); if (c > 0.6) { r = 236; g = 214; b = 196; } }
        else if (washBed) { const c = vnoise(x * 0.9, z * 0.9) - 0.5; r += c * 14; g += c * 12; b += c * 8; }
        else if (cover === "scrub" || cover === "dirt") { if (hash(Math.floor(x * 0.7), Math.floor(z * 0.7)) > 0.93) { r -= 40; g -= 30; b -= 40; } }
        else if (cover === "cliff" || cover === "rock" || cover === "sandstone" || cover === "basalt") { const st = vnoise(x * 0.35, z * 0.35) - 0.5; r += st * 16; g += st * 15; b += st * 14; }
        else if (water && cover !== "ice") {
          const depth = Math.max(0, WATER_LEVEL - h);
          const k = smooth(0, 26, depth); r -= k * 34; g -= k * 22; b -= k * 10;
        }
        // hill shading (light from the north-west), stronger on bare and snowy ground, none on water or city ground
        if (!water && cover !== "urban" && cover !== "town" && cover !== "paved") {
          const nx = -dx, nz = -dz, ny = 1, nl = Math.hypot(nx, ny, nz);
          const lx = -0.55, ly = 0.7, lz = -0.45, dot = (nx * lx + ny * ly + nz * lz) / nl;
          const flat = ly; // a flat surface's lighting
          const strength = cover === "snow" ? 0.6 : cover === "rock" || cover === "cliff" || cover === "ash" || cover === "sandstone" || cover === "basalt" ? 0.75 : cover === "lava" || cover === "magma" ? 0.25 : 0.55;
          let s = 1 + (dot / flat - 1) * strength;
          s = s < 0.55 ? 0.55 : s > 1.18 ? 1.18 : s;
          if (cover === "snow") { const k = 1 - s; r *= 1 - k * 0.95; g *= 1 - k * 0.85; b *= 1 - k * 0.62; } // snow shadows: cool blue-grey, not lilac // snow shadows go blue-grey
          else { r *= s; g *= s; b *= s; }
          // contours every 10 m (index line every 50 m)
          const c0 = Math.floor(h / 10), cR = Math.floor(hs[gi + 1]! / 10), cD = Math.floor(hs[gi + G]! / 10);
          if ((c0 !== cR || c0 !== cD) && slope < 0.9) { const idx = Math.max(c0, cR, cD) % 5 === 0; const a = idx ? 0.16 : 0.07; r = r * (1 - a) + 120 * a; g = g * (1 - a) + 100 * a; b = b * (1 - a) + 80 * a; }
        }
        const p = (j * size + i) * 4;
        pixels[p] = r; pixels[p + 1] = g; pixels[p + 2] = b; pixels[p + 3] = 255;
        {
          // the satellite view's inputs: a stronger hill shade on all ground, the water's depth
          const nl = Math.hypot(dx, 1, dz), dot = (-dx * -0.55 + 0.7 + -dz * -0.45) / nl;
          const ss = Math.min(1.3, Math.max(0.4, 1 + (dot / 0.7 - 1) * 0.9));
          data[p] = coverIdx[j * size + i]!; data[p + 1] = Math.round(((ss - 0.4) / 0.9) * 63) * 4; data[p + 2] = water ? Math.min(255, Math.max(0, WATER_LEVEL - h) * 6) : 0; data[p + 3] = 255;
        }
      }
      if (++crow >= size) { phase = 2; break; }
      if (now() - t0 > budgetMs) return false;
    }
    if (phase === 2) {
      // shorelines: a thin darker blue edge on water pixels that touch land (the crisp coast of a street map)
      const isWater = (k: number) => { const c = covers[coverIdx[k]!]!; return c === "deep" || c === "sea" || c === "shallow" || c === "lake" || c === "river"; };
      for (let j = 1; j < size - 1; j++) for (let i = 1; i < size - 1; i++) {
        const k = j * size + i;
        if (!isWater(k)) continue;
        if (!isWater(k - 1) || !isWater(k + 1) || !isWater(k - size) || !isWater(k + size)) { const p = k * 4; pixels[p] = 120; pixels[p + 1] = 170; pixels[p + 2] = 218; }
      }
      phase = 3;
    }
    return true;
  };
  return { step, progress: () => (phase === 0 ? (row / G) * 0.75 : phase === 1 ? 0.75 + (crow / size) * 0.25 : 1), pixels, data, size, bounds };
}

/** paint to completion with the satellite data too (the bake) */
export function paintCartoAll(size: number, bounds: CartoBounds, src?: CartoSource): { pixels: Uint8ClampedArray; data: Uint8ClampedArray } {
  const job = createCartoJob(size, bounds, src);
  while (!job.step(Infinity)) { /* to completion */ }
  return { pixels: job.pixels, data: job.data };
}

/* ---------------- the satellite view ---------------- */

/** natural colours seen from orbit: deep blue water, dark canopy, tan desert, grey city, bright snow (Map / Satellite toggle) */
export const SAT_COLOR: Record<Cover, readonly [number, number, number]> = {
  deep: [12, 34, 62], sea: [18, 48, 82], shallow: [40, 94, 110], lake: [24, 58, 78], river: [38, 74, 88],
  beach: [198, 184, 148], meadow: [98, 118, 64], grass: [86, 110, 54], forest: [44, 70, 36], denseForest: [28, 52, 27],
  scrub: [130, 122, 84], dirt: [148, 122, 88], desert: [204, 178, 130], dunes: [212, 180, 124], rock: [124, 116, 104], sandstone: [176, 118, 76], basalt: [50, 46, 46], cliff: [106, 98, 90],
  snow: [236, 240, 246], ice: [194, 220, 234], ash: [84, 76, 72], lava: [255, 92, 22], magma: [255, 172, 42], marsh: [72, 90, 58],
  urban: [96, 100, 106], paved: [122, 124, 128], town: [120, 114, 104], wash: [170, 150, 118],
  crystal: [150, 112, 214], rift: [34, 16, 52], reef: [52, 168, 168], crop: [190, 162, 70],
};
/** recolour a map's data (createCartoJob `data`) into a satellite image; noise is keyed to world metres so it never swims */
export function satelliteFromData(data: Uint8ClampedArray, size: number, bounds: CartoBounds): Uint8ClampedArray {
  const covers = Object.keys(COVER_COLOR) as Cover[];
  const out = new Uint8ClampedArray(size * size * 4), mpp = bounds.span / size;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const p = (j * size + i) * 4, cover = covers[data[p]!] ?? "sea", shade = 0.4 + (data[p + 1]! / 252) * 0.9, depth = data[p + 2]! / 6;
    const x = bounds.x0 + (i + 0.5) * mpp, z = bounds.z0 + (j + 0.5) * mpp;
    let [r, g, b] = SAT_COLOR[cover];
    const grain = hash(Math.floor(x * 1.7), Math.floor(z * 1.7)) - 0.5;
    const water = cover === "deep" || cover === "sea" || cover === "shallow" || cover === "lake" || cover === "river";
    if (cover === "reef") {
      const c = vnoise(x * 0.3, z * 0.3); r += (c - 0.5) * 40 + grain * 10; g += (c - 0.5) * 40; b += (c - 0.5) * 30; if (c > 0.64) { r = 170; g = 196; b = 170; }
    } else if (water) {
      const k = smooth(0, 30, depth); r -= k * 10; g -= k * 18; b -= k * 14;
      const wave = vnoise(x * 0.08, z * 0.08) - 0.5; r += wave * 6; g += wave * 8; b += wave * 10;
    } else {
      if (cover === "forest" || cover === "denseForest" || cover === "marsh") {
        const crown = vnoise(x * 0.8, z * 0.8), k = (crown - 0.5) * 46 + grain * 14; r += k * 0.7; g += k; b += k * 0.5;
        if (crown < 0.28) { r *= 0.7; g *= 0.72; b *= 0.7; } // gaps between crowns
      } else if (cover === "meadow" || cover === "grass" || cover === "scrub") {
        const patch = vnoise(x * 0.06, z * 0.06) - 0.5; r += patch * 24 + grain * 10; g += patch * 26 + grain * 10; b += patch * 10 + grain * 6;
      } else if (cover === "desert" || cover === "dunes" || cover === "sandstone" || cover === "wash") {
        const rip = Math.sin((x * 0.5 + z * 0.3) + vnoise(x * 0.03, z * 0.03) * 8); r += rip * 8 + grain * 12; g += rip * 6 + grain * 10; b += rip * 4 + grain * 8;
      } else if (cover === "crystal") {
        const c = vnoise(x * 0.9, z * 0.9); r += (c - 0.5) * 50; g += (c - 0.5) * 40; b += (c - 0.5) * 60; if (c > 0.78) { r = 232; g = 214; b = 255; }
      } else if (cover === "rift") {
        const c = 1 - Math.abs(vnoise(x * 0.25, z * 0.25) * 2 - 1); r += c * 90; g += c * 30; b += c * 140; // a violet glow along the cracks
      } else if (cover === "lava") {
        const v = 1 - Math.abs(vnoise(x * 0.18, z * 0.18) * 2 - 1), hot = smooth(0.8, 0.97, v); r = 40 + (255 - 40) * hot; g = 26 + (190 - 26) * hot; b = 22 + (60 - 22) * hot;
      } else { r += grain * 16; g += grain * 15; b += grain * 14; }
      if (cover !== "lava" && cover !== "magma") { r *= shade; g *= shade; b *= shade; }
    }
    out[p] = r; out[p + 1] = g; out[p + 2] = b; out[p + 3] = 255;
  }
  return out;
}

/** paint to completion (tests and the bake) */
export function paintCarto(size: number, bounds: CartoBounds): Uint8ClampedArray {
  const job = createCartoJob(size, bounds);
  while (!job.step(Infinity)) { /* to completion */ }
  return job.pixels;
}

/** bump when the look changes so stale baked images are not used */
export const CARTO_VERSION = 2;
export function cartoFingerprint(): string {
  const px = paintCarto(10, { x0: NEXUS.x - 300, z0: NEXUS.z - 300, span: 600 });
  let h = 2166136261;
  for (let i = 0; i < px.length; i++) { h ^= px[i]!; h = Math.imul(h, 16777619) >>> 0; }
  return `v${CARTO_VERSION}-${h.toString(16)}`;
}
