/** The two continents of the canon board that the playable world had no ground for (owner, Nov 1: "build them"): Crystal Badlands
 * and The Shattered Reefs, designed from the board's lists (planet.ts places). Each is a land of its own, laid out in a frame
 * far beyond the playable world (so no world lookup ever lands in it) with its own ground (height and cover, painted by
 * carto-maps.ts through a CartoSource) and its own towns, roads, landmarks and names (a CartoFeatures, drawn like any street map).
 * The Godot game builds their 3D views from the same data (scripts/export-godot-data.ts). Pure and deterministic.
 *
 *  - Crystal Badlands: a high badland plateau broken by the winding Echo Canyons, the broad Refraction Valley of crystal fields,
 *    violet Void Rifts, the Crystal Spire on its mesa at the heart, The Prism, the Crystal Mines and their rail, and Scavenger's
 *    Rest, the trading town on the road to the coast.
 *  - The Shattered Reefs: a broken ring of islands round a lagoon, cut by The Fracture (a trench into the deep), reef flats,
 *    Echo Isles (the harbour town), Echo Ruins, the Ancient Vault, the Driftmarker light, the Sunken Spire rising out of the
 *    lagoon and The Deep off the outer edge; causeways link the near isles, ferries the far ones. */
import type { CartoMap, CartoSource, Cover } from "./carto-maps";
import type { CartoArea, CartoBuilding, CartoFeatures, CartoPavement, CartoPoi, CartoRoad } from "./carto-features";
import { WATER_LEVEL } from "./terrain";

/** the lands are designed with the sea at 0; the painter and the 3D views get world heights (sea at WATER_LEVEL) */
const WATER = 0;

/* ---------------- noise (deterministic) ---------------- */
function hash(ix: number, iz: number, seed: number): number { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x: number, z: number, seed = 0): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
const fbm = (x: number, z: number, seed = 0) => vnoise(x, z, seed) * 0.55 + vnoise(x * 2.07 + 13, z * 2.07 - 7, seed) * 0.27 + vnoise(x * 4.2 - 3, z * 4.2 + 9, seed) * 0.13 + vnoise(x * 8.5, z * 8.5, seed) * 0.05;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
/** distance from a point to a polyline */
function polyDist(pts: readonly (readonly [number, number])[], x: number, z: number): { d: number; t: number } {
  let best = Infinity, bt = 0, acc = 0, total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]!, [bx, bz] = pts[i]!, ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1, L = Math.sqrt(L2);
    const t = clamp01(((x - ax) * ex + (z - az) * ez) / L2), d = Math.hypot(ax + ex * t - x, az + ez * t - z);
    if (d < best) { best = d; bt = (acc + t * L) / (total || 1); }
    acc += L;
  }
  return { d: best, t: bt };
}

export type NewLand = { map: CartoMap; source: CartoSource; features: () => CartoFeatures };

/* =================================================================== */
/* Crystal Badlands                                                     */
/* =================================================================== */

const CB = { x: 40000, z: 0, reach: 430 } as const;
/** local points (metres from the land's centre) */
const cb = (u: number, v: number): [number, number] => [CB.x + u, CB.z + v];
const CB_CANYON: readonly [number, number][] = [[-430, -150], [-320, -120], [-220, -170], [-120, -110], [-40, -150], [60, -230], [170, -210], [260, -280], [430, -300]].map(([u, v]) => cb(u!, v!));
const CB_VALLEY = { u: 150, v: 150, rx: 210, rz: 120 };
const CB_SPIRE = { u: -20, v: 30, r: 46 };
const CB_PRISM = { u: 220, v: 120 };
const CB_MINES = [{ u: -250, v: 160 }, { u: -300, v: 230 }, { u: -200, v: 260 }];
const CB_TOWN = { u: -140, v: -300 };
const CB_RIFTS: readonly (readonly [number, number][])[] = [
  [[60, 40], [120, 70], [170, 60], [240, 100]].map(([u, v]) => cb(u!, v!)),
  [[90, 220], [150, 200], [210, 240], [300, 220]].map(([u, v]) => cb(u!, v!)),
];
/** the coast: the south-west corner falls into the sea */
const cbCoast = (u: number, v: number) => (u + v) / Math.SQRT2 + 360 + (fbm(u * 0.004, v * 0.004, 3) - 0.5) * 160;

function cbHeight(x: number, z: number): number {
  const u = x - CB.x, v = z - CB.z;
  let h = 22 + (fbm(u * 0.006, v * 0.006, 1) - 0.5) * 22;
  // mesas: terraced high ground
  const m = fbm(u * 0.004 + 40, v * 0.004 - 20, 2);
  if (m > 0.56) { const step = Math.floor((m - 0.56) * 40) / 40; h += 14 + step * 90; }
  // the Spire's mesa
  const ds = Math.hypot(u - CB_SPIRE.u, v - CB_SPIRE.v);
  h += 26 * (1 - smooth(CB_SPIRE.r, CB_SPIRE.r + 30, ds));
  // Refraction Valley: a broad, flat-floored basin
  const dv = Math.hypot((u - CB_VALLEY.u) / CB_VALLEY.rx, (v - CB_VALLEY.v) / CB_VALLEY.rz);
  h = h - (h - 8) * (1 - smooth(0.7, 1.15, dv));
  // the Echo Canyons: a deep winding cut
  // (a dry canyon: its floor stays a few metres above the sea until it reaches the coast)
  const c = polyDist(CB_CANYON, x, z), cw = 16 + vnoise(c.t * 20, 0, 4) * 10, carve = 1 - smooth(cw * 0.5, cw * 1.4, c.d);
  h = h + (Math.min(h, 3 + c.t * 4) - h) * carve;
  // the rifts: narrow cracks
  for (const r of CB_RIFTS) { const d = polyDist(r, x, z).d; h -= 6 * (1 - smooth(2, 7, d)); }
  // the coast
  const coast = cbCoast(u, v);
  if (coast < 60) h = h * smooth(-10, 60, coast) - 14 * (1 - smooth(-60, 10, coast));
  return h;
}
function cbCover(x: number, z: number, h: number, slope: number): Cover {
  const u = x - CB.x, v = z - CB.z;
  if (h < WATER) { const d = WATER - h; return d < 2 ? "shallow" : d < 9 ? "sea" : "deep"; }
  if (h < WATER + 1.4) return "beach";
  for (const r of CB_RIFTS) if (polyDist(r, x, z).d < 4.5) return "rift";
  // the town's ground and the Spire's plaza
  if (Math.hypot(u - CB_TOWN.u, v - CB_TOWN.v) < 62) return "town";
  if (Math.hypot(u - CB_SPIRE.u, v - CB_SPIRE.v) < 14) return "paved";
  if (slope > 1.25) return "sandstone";
  const n = fbm(u * 0.03, v * 0.03, 5);
  const dv = Math.hypot((u - CB_VALLEY.u) / CB_VALLEY.rx, (v - CB_VALLEY.v) / CB_VALLEY.rz);
  if (dv < 1) return n > 0.38 ? "crystal" : "dunes";
  // crystal outcrops thin out away from the valley and the spire
  const nearSpire = Math.hypot(u - CB_SPIRE.u, v - CB_SPIRE.v) < 120;
  if (n > (nearSpire ? 0.6 : 0.74)) return "crystal";
  if (slope > 0.75) return "rock";
  return n > 0.52 ? "sandstone" : vnoise(u * 0.02, v * 0.02, 6) > 0.5 ? "desert" : "dirt";
}
function cbFeatures(m: CartoMap): CartoFeatures {
  const buildings: CartoBuilding[] = [], roads: CartoRoad[] = [], pavements: CartoPavement[] = [], rings: CartoFeatures["rings"] = [], pois: CartoPoi[] = [], areas: CartoArea[] = [];
  const [tx, tz] = cb(CB_TOWN.u, CB_TOWN.v);
  // Scavenger's Rest: a dusty grid of salvaged buildings round a market square, a fuel depot and a landing pad
  for (const k of [-1, 1]) { pavements.push({ x: tx + k * 16, z: tz, hx: 3, hz: 52, yaw: 0, kind: "street" }, { x: tx, z: tz + k * 16, hx: 52, hz: 3, yaw: 0, kind: "street" }); }
  pavements.push({ x: tx, z: tz, hx: 10, hz: 10, yaw: 0, kind: "plaza" });
  let seed = 11;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  for (const [cu, cv] of [[-34, -34], [0, -34], [34, -34], [-34, 0], [34, 0], [-34, 34], [0, 34], [34, 34]] as const)
    for (let i = 0; i < 2; i++) {
      const w = 5 + rnd() * 5, d = 5 + rnd() * 4, ox = (i ? 6 : -6) + (rnd() - 0.5) * 3, oz = (rnd() - 0.5) * 6;
      buildings.push({ x: tx + cu + ox, z: tz + cv + oz, hx: w / 2, hz: d / 2, yaw: (rnd() - 0.5) * 0.3, use: rnd() > 0.6 ? "store" : "house", h: 0.15 + rnd() * 0.15, m: 4 + rnd() * 5 });
    }
  buildings.push({ x: tx + 46, z: tz - 40, hx: 9, hz: 6, yaw: 0, use: "industrial", h: 0.2, m: 7, name: "Fuel Depot" });
  buildings.push({ x: tx, z: tz, hx: 4, hz: 4, yaw: 0.785, use: "civic", h: 0.3, m: 11, name: "Trade Hall" });
  rings.push({ x: tx - 48, z: tz + 46, r: 9, kind: "pad", name: "Landing pad" });
  // the Crystal Spire on its mesa, The Prism, the mines and the rail
  const [sx, sz] = cb(CB_SPIRE.u, CB_SPIRE.v), [px, pz] = cb(CB_PRISM.u, CB_PRISM.v);
  rings.push({ x: sx, z: sz, r: 12, kind: "dome", name: "The Crystal Spire" });
  buildings.push({ x: px, z: pz, hx: 10, hz: 10, yaw: 0.785, use: "civic", h: 0.7, m: 34, name: "The Prism" });
  const mines = CB_MINES.map((p) => cb(p.u, p.v));
  mines.forEach(([x, z], i) => { buildings.push({ x, z, hx: 6, hz: 4, yaw: i * 0.6, use: "industrial", h: 0.25, m: 7, ...(i === 0 ? { name: "Crystal Mines · Shaft A" } : {}) }); rings.push({ x: x + 8, z: z + 6, r: 4, kind: "hazard", name: "Mine shaft" }); });
  roads.push({ cls: "rail", pts: [...mines, cb(-160, 60), cb(-60, 40)], width: 2.2, name: "Mine rail" });
  // roads: the coast road through town up to the Spire, on past the valley to the Prism; tracks to the mines and the canyon rim
  roads.push({ cls: "main", pts: [cb(-330, -380), cb(-200, -330), [tx, tz], cb(-110, -200), cb(-80, -60), cb(-40, 0), [sx, sz]], width: 7, name: "Spire Road" });
  roads.push({ cls: "main", pts: [[sx, sz], cb(60, 60), cb(130, 110), [px, pz]], width: 6, name: "Prism Road" });
  roads.push({ cls: "track", pts: [cb(-40, 0), cb(-120, 80), cb(-200, 140), mines[0]!], width: 4, name: "Mine track" });
  roads.push({ cls: "bridge", pts: [cb(-130, -128), cb(-104, -96)], width: 6, name: "Canyon Bridge" });
  roads.push({ cls: "track", pts: [cb(-80, -60), cb(-20, -200), cb(60, -260), cb(170, -250)], width: 3.5, name: "Canyon rim trail" });
  roads.push({ cls: "boardwalk", pts: [cb(-330, -380), cb(-360, -410)], width: 4, name: "Scavenger Jetty" });
  // places (the board's list) and names
  const P = (id: string, name: string, cat: CartoPoi["cat"], [x, z]: [number, number], rank: number, blurb: string) => pois.push({ id: `cb-${id}`, name, cat, x, z, rank, blurb });
  P("spire", "The Crystal Spire", "spire", [sx, sz + 16], 0, "The capital: a spire of living crystal on its mesa, humming with the Fracture.");
  P("rest", "Scavenger's Rest", "village", [tx, tz - 14], 0, "The trading town: salvage, fuel and rumours on the road to the coast.");
  P("prism", "The Prism", "landmark", [px, pz + 14], 1, "A colossal crystal that splits the light into impossible colours.");
  P("mines", "Crystal Mines", "outpost", mines[0]!, 1, "Shafts sunk after the richest seams; the rail runs the ore out.");
  P("fields", "Shattered Fields", "ruins", cb(-260, 40), 1, "Crystal shards strewn across the plateau as if something burst here.");
  P("canyons", "Echo Canyons", "landmark", cb(60, -232), 1, "Every sound comes back three times. Some come back changed.");
  P("valley", "Refraction Valley", "landmark", cb(150, 150), 1, "A basin floored with crystal fields that bend the light.");
  P("rifts", "Void Rifts", "hazard", cb(150, 66), 1, "Cracks into nothing. Keep your distance.");
  P("port", "Scavenger Jetty", "port", cb(-345, -395), 2, "A rickety jetty on the badland coast.");
  areas.push({ name: "Crystal Badlands", x: CB.x, z: CB.z - CB.reach * 0.82, kind: "desert", rank: 0 });
  areas.push({ name: "Echo Canyons", x: cb(-120, -126)[0], z: cb(-120, -126)[1], kind: "valley", rank: 1 });
  areas.push({ name: "Refraction Valley", x: cb(150, 190)[0], z: cb(150, 190)[1], kind: "valley", rank: 1 });
  areas.push({ name: "Shattered Fields", x: cb(-260, 70)[0], z: cb(-260, 70)[1], kind: "desert", rank: 2 });
  areas.push({ name: "Obsidian Ocean", x: cb(-360, -250)[0], z: cb(-360, -250)[1], kind: "sea", rank: 1 });
  return { buildings, roads, pavements, rings, pois, areas };
}

/* =================================================================== */
/* The Shattered Reefs                                                  */
/* =================================================================== */

const SR = { x: 40000, z: 4000, reach: 460 } as const;
const sr = (u: number, v: number): [number, number] => [SR.x + u, SR.z + v];
/** the islands: a broken ring round the lagoon plus outliers (local centre, radius, peak height) */
const SR_ISLES: readonly { id: string; u: number; v: number; r: number; h: number }[] = [
  { id: "echo", u: -210, v: 40, r: 120, h: 28 },     // Echo Isles: the largest, the harbour town
  { id: "ruins", u: -60, v: -230, r: 70, h: 18 },
  { id: "vault", u: 170, v: -170, r: 66, h: 24 },
  { id: "east", u: 250, v: 60, r: 60, h: 16 },
  { id: "north", u: 70, v: 240, r: 72, h: 20 },
  { id: "drift", u: 340, v: 300, r: 26, h: 10 },     // Driftmarker's rock
  { id: "w2", u: -310, v: -170, r: 40, h: 12 },
  { id: "s2", u: -150, v: 290, r: 38, h: 11 },
];
/** The Fracture: a trench from the lagoon out to the deep */
const SR_FRACTURE: readonly [number, number][] = [[-40, -40], [40, -80], [120, -60], [200, -110], [300, -150], [460, -200]].map(([u, v]) => sr(u!, v!));
const SR_DEEP = { u: 380, v: -330, r: 150 };
const SR_SPIRE = { u: 20, v: 20 };
function srHeight(x: number, z: number): number {
  const u = x - SR.x, v = z - SR.z;
  // the sea floor: a lagoon inside the ring (shallow), open water outside (deeper)
  const ringD = Math.hypot(u, v);
  let h = -14 - smooth(220, 460, ringD) * 18 + (fbm(u * 0.01, v * 0.01, 21) - 0.5) * 6;
  if (ringD < 200) h = -6 + (fbm(u * 0.02, v * 0.02, 22) - 0.5) * 4;
  for (const i of SR_ISLES) {
    const d = Math.hypot(u - i.u, v - i.v) / (i.r * (0.8 + 0.4 * fbm(u * 0.012 + i.u, v * 0.012 + i.v, 23)));
    if (d < 1.6) {
      const bump = i.h * Math.pow(1 - smooth(0, 1, d), 1.4) + (fbm(u * 0.03, v * 0.03, 24) - 0.5) * 4 * (1 - smooth(0.6, 1, d));
      h = Math.max(h, -3 + bump + (d < 1.3 ? 2.2 * (1 - smooth(1, 1.3, d)) : 0)); // a reef apron round each isle
    }
  }
  const f = polyDist(SR_FRACTURE, x, z);
  h = Math.min(h, h - 40 * (1 - smooth(10, 28, f.d)));
  const dd = Math.hypot(u - SR_DEEP.u, v - SR_DEEP.v);
  h -= 30 * (1 - smooth(SR_DEEP.r * 0.4, SR_DEEP.r, dd));
  return h;
}
function srCover(x: number, z: number, h: number, slope: number): Cover {
  const u = x - SR.x, v = z - SR.z;
  if (h < WATER) {
    const d = WATER - h;
    if (d < 1.6 && fbm(u * 0.05, v * 0.05, 25) > 0.38) return "reef";
    return d < 2.5 ? "shallow" : d < 12 ? "sea" : "deep";
  }
  if (h < WATER + 1.3) return "beach";
  const echo = SR_ISLES[0]!;
  if (Math.hypot(u - (echo.u + 40), v - (echo.v - 10)) < 48) return "town";
  if (slope > 1.1) return "cliff";
  const n = fbm(u * 0.04, v * 0.04, 26);
  if (h > 18) return slope > 0.7 ? "rock" : "grass";
  return n > 0.55 ? "forest" : n > 0.35 ? "grass" : "scrub";
}
function srFeatures(m: CartoMap): CartoFeatures {
  const buildings: CartoBuilding[] = [], roads: CartoRoad[] = [], pavements: CartoPavement[] = [], rings: CartoFeatures["rings"] = [], pois: CartoPoi[] = [], areas: CartoArea[] = [];
  const isle = (id: string) => SR_ISLES.find((i) => i.id === id)!;
  const echo = isle("echo"), [ex, ez] = sr(echo.u + 40, echo.v - 10);
  // Echo Isles: harbour town on the lagoon side, a quay and piers
  pavements.push({ x: ex, z: ez, hx: 40, hz: 3, yaw: 0, kind: "street" }, { x: ex, z: ez, hx: 3, hz: 40, yaw: 0, kind: "street" }, { x: ex + 12, z: ez + 12, hx: 8, hz: 8, yaw: 0, kind: "plaza" });
  let seed = 77;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  for (const [cu, cv] of [[-22, -22], [22, -22], [-22, 22], [22, 22], [-22, 0], [22, 0], [0, -22], [0, 22]] as const) {
    const w = 6 + rnd() * 6, d = 6 + rnd() * 5;
    buildings.push({ x: ex + cu + (rnd() - 0.5) * 4, z: ez + cv + (rnd() - 0.5) * 4, hx: w / 2, hz: d / 2, yaw: (rnd() - 0.5) * 0.4, use: rnd() > 0.5 ? "house" : "store", h: 0.15 + rnd() * 0.2, m: 5 + rnd() * 5 });
  }
  buildings.push({ x: ex - 30, z: ez + 30, hx: 8, hz: 5, yaw: 0.2, use: "civic", h: 0.3, m: 9, name: "Harbourmaster" });
  for (const k of [0, 1, 2]) roads.push({ cls: "boardwalk", pts: [sr(echo.u + 92, echo.v - 40 + k * 26), sr(echo.u + 124, echo.v - 40 + k * 26)], width: 3, name: k === 1 ? "Echo Piers" : "" });
  // the ruins, the vault, the light, the sunken spire
  const ru = isle("ruins"), [rx, rz] = sr(ru.u, ru.v);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; buildings.push({ x: rx + Math.cos(a) * 22, z: rz + Math.sin(a) * 22, hx: 2.5 + (i % 3), hz: 2, yaw: a, use: "civic", h: 0.1, m: 2 + (i % 3) * 2 }); }
  const va = isle("vault"), [vx, vz] = sr(va.u, va.v);
  buildings.push({ x: vx, z: vz, hx: 12, hz: 9, yaw: 0.3, use: "civic", h: 0.45, m: 13, name: "Ancient Vault" });
  const dr = isle("drift"), [dx, dz] = sr(dr.u, dr.v);
  buildings.push({ x: dx, z: dz, hx: 2.5, hz: 2.5, yaw: 0, use: "transport", h: 0.6, m: 22, name: "Driftmarker Light" });
  const [spx, spz] = sr(SR_SPIRE.u, SR_SPIRE.v);
  rings.push({ x: spx, z: spz, r: 10, kind: "dome", name: "The Sunken Spire" });
  rings.push({ x: sr(SR_DEEP.u, SR_DEEP.v)[0], z: sr(SR_DEEP.u, SR_DEEP.v)[1], r: SR_DEEP.r * 0.5, kind: "hazard", name: "The Deep" });
  // causeways between near isles; ferries to the far ones
  roads.push({ cls: "bridge", pts: [sr(-120, -20), sr(-85, -150)], width: 6, name: "Ruins Causeway" });
  roads.push({ cls: "bridge", pts: [sr(30, -225), sr(110, -190)], width: 6, name: "Vault Causeway" });
  roads.push({ cls: "main", pts: [sr(-260, 70), [ex, ez], sr(-110, 0), sr(-120, -20)], width: 6, name: "Harbour Road" });
  roads.push({ cls: "track", pts: [sr(-85, -150), [rx, rz]], width: 3.5, name: "Ruins track" });
  roads.push({ cls: "track", pts: [sr(110, -190), [vx, vz]], width: 3.5, name: "Vault track" });
  roads.push({ cls: "ferry", pts: [sr(echo.u + 124, echo.v - 14), sr(80, 120), sr(70, 190)], width: 2, name: "North ferry" });
  roads.push({ cls: "ferry", pts: [sr(echo.u + 124, echo.v - 14), sr(150, 60), sr(205, 60)], width: 2, name: "East ferry" });
  roads.push({ cls: "ferry", pts: [sr(205, 60), sr(300, 220), sr(325, 288)], width: 2, name: "Driftmarker run" });
  const P = (id: string, name: string, cat: CartoPoi["cat"], [x, z]: [number, number], rank: number, blurb: string) => pois.push({ id: `sr-${id}`, name, cat, x, z, rank, blurb });
  P("echo", "Echo Isles", "village", [ex, ez - 16], 0, "The capital: a harbour town of stilts and salvage on the lagoon.");
  P("fracture", "The Fracture", "hazard", sr(160, -96), 0, "A trench torn through the reef into the dark. The water hums.");
  P("ruins", "Echo Ruins", "ruins", [rx, rz], 1, "A ring of broken columns from before the Fracture.");
  P("vault", "Ancient Vault", "temple", [vx, vz + 14], 1, "Sealed doors no one alive has opened.");
  P("drift", "Driftmarker", "viewpoint", [dx, dz], 1, "The light that keeps ships off the outer reef.");
  P("spire", "Sunken Spire", "spire", [spx, spz], 1, "A spire rising out of the lagoon, its base lost below.");
  P("deep", "The Deep", "hazard", sr(SR_DEEP.u, SR_DEEP.v), 1, "Where the sea floor falls away.");
  P("port", "Echo Piers", "port", sr(echo.u + 124, echo.v - 14), 2, "Ferries to the outer isles.");
  areas.push({ name: "The Shattered Reefs", x: SR.x, z: SR.z - SR.reach * 0.84, kind: "sea", rank: 0 });
  areas.push({ name: "Lagoon", x: sr(20, 90)[0], z: sr(20, 90)[1], kind: "lake", rank: 1 });
  areas.push({ name: "Echo Ocean", x: sr(-330, 330)[0], z: sr(-330, 330)[1], kind: "sea", rank: 1 });
  return { buildings, roads, pavements, rings, pois, areas };
}

/* ---------------- the registry ---------------- */

const CB_MAP: CartoMap = { id: "crystal-badlands", name: "Crystal Badlands", sub: "Crystal plateau · canyons · rifts", kind: "region", x: CB.x, z: CB.z, reach: CB.reach, regionId: "crystal-badlands" };
const SR_MAP: CartoMap = { id: "shattered-reefs", name: "The Shattered Reefs", sub: "Broken isles · reefs · the deep", kind: "region", x: SR.x, z: SR.z, reach: SR.reach, regionId: "shattered-reefs" };
export const NEW_LANDS: readonly NewLand[] = [
  { map: CB_MAP, source: { height: (x, z) => cbHeight(x, z) + WATER_LEVEL, cover: (x, z, h, s) => cbCover(x, z, h - WATER_LEVEL, s) }, features: () => cbFeatures(CB_MAP) },
  { map: SR_MAP, source: { height: (x, z) => srHeight(x, z) + WATER_LEVEL, cover: (x, z, h, s) => srCover(x, z, h - WATER_LEVEL, s) }, features: () => srFeatures(SR_MAP) },
];
export const newLand = (id: string) => NEW_LANDS.find((l) => l.map.id === id) ?? null;
