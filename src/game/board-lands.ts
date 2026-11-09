/** The regions of the owner's "Planetary World Overview" board (Nov 8: "work on the rest of the regions and maps") that the game
 * had no ground for: the Farmland region, the Island / Beach region and the Ice Cap region. Each is a land of its own laid out
 * far beyond the playable world, exactly like new-lands.ts (its own height and cover, painted by carto-maps.ts; its own towns,
 * roads, landmarks and names), so the street map, the satellite view and the Godot 3D view all come from the same data.
 * Pure and deterministic.
 *
 *  - Goldenreach Farmlands (Verdant Forest's breadbasket): rolling patchwork fields of wheat, green crops, pasture and
 *    ploughed earth on a grid of farm lanes, hedgerows, farmsteads with barns and silos, the Windmill Ridge, Goldenreach
 *    Ranch's paddocks, orchards, a river with a mill, and Harvest Hollow, the market village.
 *  - Azure Isles (the board's "Azure Isles" biome; on the Shattered Reefs' sea): a chain of tropical islands — a green
 *    volcanic main isle with jungle, white beaches and a reef-ringed lagoon, the resort strip of Coral Bay, the marina and
 *    the Azure Shipyard, a lighthouse cay and sandbar islets.
 *  - Frostveil Ice Cap (Frost Spire's polar plateau): a high, wind-scoured ice sheet breaking into the sea at an ice shelf,
 *    crevasse fields, wind-carved ridges, nunataks of black rock, icebergs offshore, the Frostveil Research Station, the
 *    Glacier Cave and a buried relay mast. */
import type { CartoMap, Cover } from "./carto-maps";
import type { CartoArea, CartoBuilding, CartoFeatures, CartoPavement, CartoPoi, CartoRoad } from "./carto-features";
import { WATER_LEVEL } from "./terrain";
import type { NewLand } from "./new-lands";

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
const rng = (seed: number) => () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
type Rings = CartoFeatures["rings"];
const empty = () => ({ buildings: [] as CartoBuilding[], roads: [] as CartoRoad[], pavements: [] as CartoPavement[], rings: [] as Rings, pois: [] as CartoPoi[], areas: [] as CartoArea[] });

/* =================================================================== */
/* Goldenreach Farmlands                                                */
/* =================================================================== */

const GF = { x: 40000, z: 8000, reach: 440 } as const;
const gf = (u: number, v: number): [number, number] => [GF.x + u, GF.z + v];
/** the farm grid: fields ~46 x 34 m between lanes, the grid turned a little off north */
const GF_YAW = 0.18, GF_W = 46, GF_D = 34;
const gfGrid = (u: number, v: number) => { const c = Math.cos(GF_YAW), s = Math.sin(GF_YAW); return { a: u * c + v * s, b: -u * s + v * c }; };
const GF_RIVER: readonly [number, number][] = [[-440, 260], [-300, 200], [-200, 230], [-80, 150], [20, 170], [140, 90], [260, 120], [440, 40]].map(([u, v]) => gf(u!, v!));
const GF_VILLAGE = { u: 30, v: 40 };
const GF_RIDGE = { u: -230, v: -250, r: 120 };
const GF_RANCH = { u: 250, v: -170 };
const GF_ORCHARDS = [{ u: -140, v: 40, r: 55 }, { u: 160, v: 260, r: 50 }, { u: -330, v: 60, r: 40 }];
const GF_FARMS = [{ u: -250, v: -60 }, { u: -60, v: -170 }, { u: 120, v: -40 }, { u: 300, v: 40 }, { u: -320, v: 320 }, { u: 60, v: 310 }, { u: 330, v: 300 }];
/** the lake on the east edge */
const GF_LAKE = { u: 330, v: -340, r: 70 };

function gfHeight(x: number, z: number): number {
  const u = x - GF.x, v = z - GF.z;
  // gently rolling, rising to the Windmill Ridge in the south-west
  let h = 14 + (fbm(u * 0.004, v * 0.004, 31) - 0.5) * 14 + (fbm(u * 0.012, v * 0.012, 32) - 0.5) * 3;
  const dr = Math.hypot(u - GF_RIDGE.u, v - GF_RIDGE.v);
  h += 24 * (1 - smooth(GF_RIDGE.r * 0.2, GF_RIDGE.r * 1.4, dr));
  // the river valley
  const r = polyDist(GF_RIVER, x, z), rw = 7 + r.t * 5;
  // a broad flat-bottomed valley, then the channel cut into its floor
  const floor = 2.5 + r.d * 0.06;
  h = h + (Math.min(h, floor) - h) * (1 - smooth(rw, rw * 6, r.d));
  h -= (1 - smooth(rw * 0.5, rw, r.d)) * 4.5;
  // the lake
  const dl = Math.hypot(u - GF_LAKE.u, v - GF_LAKE.v);
  h -= 16 * (1 - smooth(GF_LAKE.r * 0.6, GF_LAKE.r * 1.2, dl));
  // the land runs into a coast at the north-east corner
  const coast = (u - v) / Math.SQRT2 - 360 + (fbm(u * 0.005, v * 0.005, 33) - 0.5) * 120;
  h -= 22 * smooth(0, 90, coast);
  return h;
}
function gfCover(x: number, z: number, h: number, slope: number): Cover {
  const u = x - GF.x, v = z - GF.z;
  if (h < WATER) {
    const r = polyDist(GF_RIVER, x, z);
    if (r.d < 16) return "river";
    if (Math.hypot(u - GF_LAKE.u, v - GF_LAKE.v) < GF_LAKE.r * 1.3) return "lake";
    const d = WATER - h; return d < 2 ? "shallow" : d < 9 ? "sea" : "deep";
  }
  if (h < WATER + 1.0) return "beach";
  if (Math.hypot(u - GF_VILLAGE.u, v - GF_VILLAGE.v) < 58) return "town";
  for (const o of GF_ORCHARDS) if (Math.hypot(u - o.u, v - o.v) < o.r * (0.8 + 0.3 * fbm(u * 0.05, v * 0.05, 34))) return "forest";
  if (slope > 0.9) return "rock";
  const r = polyDist(GF_RIVER, x, z);
  if (r.d < 26) return fbm(u * 0.05, v * 0.05, 35) > 0.5 ? "forest" : "meadow";
  if (Math.hypot(u - GF_RANCH.u, v - GF_RANCH.v) < 95) return "meadow";
  // the patchwork: each field is wheat, a green crop, pasture or ploughed earth; hedgerows along the lanes
  const g = gfGrid(u, v), fa = Math.floor(g.a / GF_W), fb = Math.floor(g.b / GF_D);
  const ea = Math.abs(g.a - Math.round(g.a / GF_W) * GF_W), eb = Math.abs(g.b - Math.round(g.b / GF_D) * GF_D);
  if (ea < 1.6 || eb < 1.6) return hash(fa, fb, 36) > 0.55 ? "scrub" : "grass";
  const k = hash(fa, fb, 37);
  if (Math.hypot(u - GF_RIDGE.u, v - GF_RIDGE.v) < GF_RIDGE.r * 0.7) return k > 0.5 ? "meadow" : "grass";
  return k < 0.42 ? "crop" : k < 0.62 ? "meadow" : k < 0.82 ? "grass" : "dirt";
}
function gfFeatures(): CartoFeatures {
  const f = empty(), rnd = rng(41);
  const [vx, vz] = gf(GF_VILLAGE.u, GF_VILLAGE.v);
  // Harvest Hollow: a high street and a green, the market hall, the inn, the chapel, the grain co-op
  f.pavements.push({ x: vx, z: vz, hx: 46, hz: 3.5, yaw: GF_YAW, kind: "street" }, { x: vx, z: vz, hx: 3.5, hz: 40, yaw: GF_YAW, kind: "street" }, { x: vx + 14, z: vz + 12, hx: 9, hz: 7, yaw: GF_YAW, kind: "plaza" });
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1, along = -38 + (i >> 1) * 11 + (rnd() - 0.5) * 3;
    const lx = along, lz = side * (10 + rnd() * 3), c = Math.cos(GF_YAW), s = Math.sin(GF_YAW);
    f.buildings.push({ x: vx + lx * c - lz * s, z: vz + lx * s + lz * c, hx: 3.5 + rnd() * 2, hz: 3 + rnd() * 1.5, yaw: GF_YAW, use: rnd() > 0.55 ? "store" : "house", h: 0.18, m: 5 + rnd() * 3 });
  }
  f.buildings.push({ x: vx + 14, z: vz - 22, hx: 9, hz: 6, yaw: GF_YAW, use: "civic", h: 0.25, m: 8, name: "Market Hall" });
  f.buildings.push({ x: vx - 24, z: vz + 24, hx: 4, hz: 7, yaw: GF_YAW, use: "civic", h: 0.4, m: 14, name: "Harvest Chapel" });
  f.buildings.push({ x: vx + 40, z: vz + 22, hx: 10, hz: 7, yaw: GF_YAW, use: "industrial", h: 0.3, m: 9, name: "Grain Co-op" });
  for (const k of [0, 1, 2]) f.rings.push({ x: vx + 54 + k * 7, z: vz + 34, r: 3, kind: "dome", ...(k === 1 ? { name: "Co-op silos" } : {}) });
  // farmsteads: a farmhouse, a big barn, a silo or two, a yard
  GF_FARMS.forEach((p, i) => {
    const [fx, fz] = gf(p.u, p.v), y = GF_YAW + (rnd() - 0.5) * 0.3;
    f.buildings.push({ x: fx, z: fz, hx: 5, hz: 4, yaw: y, use: "house", h: 0.2, m: 7, ...(i === 0 ? { name: "Ashby Farm" } : {}) });
    f.buildings.push({ x: fx + 16, z: fz + 6, hx: 9, hz: 6, yaw: y, use: "industrial", h: 0.3, m: 10, ...(i === 0 ? { name: "Red Barn" } : {}) });
    f.rings.push({ x: fx + 28, z: fz + 2, r: 2.6, kind: "dome" });
    if (i % 2 === 0) f.rings.push({ x: fx + 28, z: fz + 10, r: 2.2, kind: "dome" });
    f.pavements.push({ x: fx + 8, z: fz + 3, hx: 14, hz: 9, yaw: y, kind: "apron" });
  });
  // Windmill Ridge: a line of windmills along the crest
  for (let i = 0; i < 6; i++) { const [wx, wz] = gf(GF_RIDGE.u - 90 + i * 34, GF_RIDGE.v + 30 - i * 10); f.buildings.push({ x: wx, z: wz, hx: 2.2, hz: 2.2, yaw: 0.785, use: "transport", h: 0.6, m: 22, ...(i === 2 ? { name: "Windmill Ridge" } : {}) }); }
  // Goldenreach Ranch: the house, stables and paddock fences
  const [rx, rz] = gf(GF_RANCH.u, GF_RANCH.v);
  f.buildings.push({ x: rx, z: rz, hx: 9, hz: 6, yaw: 0, use: "house", h: 0.25, m: 8, name: "Goldenreach Ranch" });
  f.buildings.push({ x: rx + 22, z: rz - 4, hx: 12, hz: 5, yaw: 0, use: "industrial", h: 0.2, m: 6, name: "Stables" });
  f.rings.push({ x: rx - 40, z: rz + 30, r: 32, kind: "fence", name: "Paddock" }, { x: rx + 36, z: rz + 48, r: 26, kind: "fence" });
  f.rings.push({ x: rx - 10, z: rz + 70, r: 16, kind: "arena", name: "Rodeo ring" });
  // the mill on the river
  const [mx, mz] = gf(-80, 160);
  f.buildings.push({ x: mx, z: mz, hx: 5, hz: 5, yaw: 0.4, use: "industrial", h: 0.35, m: 11, name: "Old Water Mill" });
  // roads: the county road through the village, farm lanes on the grid, a bridge over the river, a rail halt
  f.roads.push({ cls: "main", pts: [gf(-440, -60), gf(-250, -60), gf(-60, 10), [vx, vz], gf(200, 20), gf(300, -100), [rx, rz]], width: 7, name: "Goldenreach Road" });
  f.roads.push({ cls: "main", pts: [[vx, vz], gf(20, 120), gf(30, 168), gf(40, 260), gf(60, 440)], width: 6, name: "Mill Lane" });
  f.roads.push({ cls: "bridge", pts: [gf(27, 150), gf(33, 186)], width: 6, name: "Hollow Bridge" });
  const c = Math.cos(GF_YAW), s = Math.sin(GF_YAW);
  const lane = (a0: number, b0: number, a1: number, b1: number, name?: string) => f.roads.push({ cls: "track", pts: [gf(a0 * c - b0 * s, a0 * s + b0 * c), gf(a1 * c - b1 * s, a1 * s + b1 * c)], width: 3.2, ...(name ? { name } : {}) });
  for (const a of [-276, -138, 138, 276]) lane(a, -400, a, 400, a === -138 ? "Hedge Lane" : undefined);
  for (const b of [-238, -102, 102, 238]) lane(-400, b, 400, b, b === 102 ? "Barley Lane" : undefined);
  f.roads.push({ cls: "rail", pts: [gf(-440, 380), gf(-100, 330), gf(200, 360), gf(440, 300)], width: 2.4, name: "Grain line" });
  f.buildings.push({ x: gf(-100, 336)[0], z: gf(-100, 336)[1], hx: 8, hz: 3, yaw: 0, use: "transport", h: 0.15, m: 5, name: "Goldenreach Halt" });
  const P = (id: string, name: string, cat: CartoPoi["cat"], [x, z]: [number, number], rank: number, blurb: string) => f.pois.push({ id: `gf-${id}`, name, cat, x, z, rank, blurb });
  P("village", "Harvest Hollow", "village", [vx, vz - 14], 0, "The market village: harvest fairs, the co-op's silos and the best pie on the continent.");
  P("ridge", "Windmill Ridge", "landmark", gf(GF_RIDGE.u - 20, GF_RIDGE.v + 10), 1, "A crest of old windmills over the whole patchwork.");
  P("ranch", "Goldenreach Ranch", "landmark", [rx, rz - 12], 1, "Horses, cattle and a rodeo ring every harvest.");
  P("mill", "Old Water Mill", "landmark", [mx, mz], 2, "Still grinding, the wheel turned by the Goldenreach river.");
  P("farm", "Ashby Farm", "village", gf(GF_FARMS[0]!.u, GF_FARMS[0]!.v - 12), 2, "The oldest farmstead; the red barn is a landmark for miles.");
  P("halt", "Goldenreach Halt", "station", gf(-100, 336), 2, "The grain line's stop: harvest trains to the capital.");
  P("lake", "Mirror Lake", "lake", gf(GF_LAKE.u, GF_LAKE.v), 2, "Fishing jetties and reeds on the east edge.");
  P("orchards", "Sunfall Orchards", "park", gf(GF_ORCHARDS[0]!.u, GF_ORCHARDS[0]!.v), 2, "Apple and pear rows; ripe in autumn.");
  f.areas.push({ name: "Goldenreach Farmlands", x: GF.x, z: GF.z - GF.reach * 0.84, kind: "valley", rank: 0 });
  f.areas.push({ name: "Goldenreach River", x: gf(-200, 250)[0], z: gf(-200, 250)[1], kind: "river", rank: 1 });
  f.areas.push({ name: "Windmill Ridge", x: gf(GF_RIDGE.u, GF_RIDGE.v - 40)[0], z: gf(GF_RIDGE.u, GF_RIDGE.v - 40)[1], kind: "mountain", rank: 1 });
  f.areas.push({ name: "Amber Bay", x: gf(360, 380)[0], z: gf(360, 380)[1], kind: "sea", rank: 1 });
  return f;
}

/* =================================================================== */
/* Azure Isles                                                          */
/* =================================================================== */

const AZ = { x: 40000, z: 12000, reach: 460 } as const;
const az = (u: number, v: number): [number, number] => [AZ.x + u, AZ.z + v];
const AZ_ISLES: readonly { id: string; u: number; v: number; r: number; h: number }[] = [
  { id: "main", u: -60, v: 20, r: 225, h: 78 },    // the green volcanic main isle
  { id: "coral", u: 210, v: -180, r: 100, h: 18 }, // Coral Bay's isle, the resort strip
  { id: "light", u: 300, v: 210, r: 34, h: 12 },   // lighthouse cay
  { id: "bar1", u: 150, v: 120, r: 26, h: 3 },     // sandbars
  { id: "bar2", u: 210, v: 60, r: 20, h: 3 },
  { id: "west", u: -330, v: -260, r: 80, h: 24 },
  { id: "palm", u: -300, v: 300, r: 56, h: 14 },   // Palm Key
  { id: "north", u: 120, v: 330, r: 64, h: 18 },
];
const AZ_LAGOON = { u: 130, v: 20, r: 120 };
const AZ_CRATER = { u: -90, v: 40, r: 26 };
function azHeight(x: number, z: number): number {
  const u = x - AZ.x, v = z - AZ.z;
  let h = -6 - smooth(320, 470, Math.hypot(u, v)) * 14 + (fbm(u * 0.01, v * 0.01, 51) - 0.5) * 4;
  // the lagoon floor: shallow sand
  const dl = Math.hypot(u - AZ_LAGOON.u, v - AZ_LAGOON.v);
  if (dl < AZ_LAGOON.r * 1.3) h = Math.max(h, -3.5 + smooth(0, AZ_LAGOON.r * 1.3, dl) * -6 + (fbm(u * 0.03, v * 0.03, 52) - 0.5) * 1.5);
  for (const i of AZ_ISLES) {
    const d = Math.hypot(u - i.u, v - i.v) / (i.r * (0.8 + 0.4 * fbm(u * 0.01 + i.u, v * 0.01 + i.v, 53)));
    if (d < 1.7) {
      const cone = i.h * Math.pow(1 - smooth(0, 1, d), i.id === "main" ? 1.6 : 1.2) + (fbm(u * 0.025, v * 0.025, 54) - 0.5) * 6 * (1 - smooth(0.5, 1, d));
      h = Math.max(h, -2.5 + cone + 2.6 * (1 - smooth(0.95, 1.35, d)));   // a white-sand apron and a reef shelf
    }
  }
  // the crater on the main isle's summit
  const dc = Math.hypot(u - AZ_CRATER.u, v - AZ_CRATER.v);
  h -= 22 * (1 - smooth(AZ_CRATER.r * 0.5, AZ_CRATER.r, dc));
  return h;
}
function azCover(x: number, z: number, h: number, slope: number): Cover {
  const u = x - AZ.x, v = z - AZ.z;
  if (h < WATER) {
    const d = WATER - h;
    if (d < 2.2 && fbm(u * 0.05, v * 0.05, 55) > 0.42) return "reef";
    return d < 3.5 ? "shallow" : d < 12 ? "sea" : "deep";
  }
  if (Math.hypot(u - AZ_CRATER.u, v - AZ_CRATER.v) < AZ_CRATER.r * 0.55) return "lake";
  if (h < WATER + 2.2) return "beach";
  const coral = AZ_ISLES[1]!;
  if (Math.hypot(u - coral.u, v - coral.v) < 52) return "town";
  const main = AZ_ISLES[0]!;
  if (Math.hypot(u - (main.u + 120), v - (main.v - 40)) < 34) return "town";   // the marina town
  if (slope > 1.2) return "cliff";
  if (h > 55) return slope > 0.7 ? "basalt" : "grass";
  const n = fbm(u * 0.035, v * 0.035, 56);
  return n > 0.42 ? "denseForest" : n > 0.3 ? "forest" : "grass";
}
function azFeatures(): CartoFeatures {
  const f = empty(), rnd = rng(61);
  const isle = (id: string) => AZ_ISLES.find((i) => i.id === id)!;
  const co = isle("coral"), [cx, cz] = az(co.u, co.v);
  // Coral Bay: the resort strip along the beach — towers, villas, the beach club, a pool deck
  f.pavements.push({ x: cx, z: cz, hx: 56, hz: 4, yaw: -0.5, kind: "street" }, { x: cx - 6, z: cz + 10, hx: 12, hz: 8, yaw: -0.5, kind: "plaza" });
  for (let i = 0; i < 7; i++) {
    const t = -48 + i * 16, lx = t * Math.cos(-0.5), lz = t * Math.sin(-0.5);
    f.buildings.push({ x: cx + lx + 12 * Math.sin(-0.5), z: cz + lz - 12 * Math.cos(-0.5), hx: 6, hz: 5, yaw: -0.5, use: i % 3 === 1 ? "entertainment" : "apartment", h: 0.6, m: 18 + rnd() * 22, ...(i === 3 ? { name: "Azure Grand Resort" } : {}) });
    f.buildings.push({ x: cx + lx - 12 * Math.sin(-0.5), z: cz + lz + 12 * Math.cos(-0.5), hx: 3.5, hz: 3, yaw: -0.5, use: "house", h: 0.15, m: 5 });
  }
  f.buildings.push({ x: cx + 30, z: cz + 34, hx: 8, hz: 5, yaw: -0.5, use: "entertainment", h: 0.25, m: 7, name: "Tidewater Beach Club" });
  f.rings.push({ x: cx - 18, z: cz + 30, r: 7, kind: "ring", name: "Pool deck" });
  // the marina town on the main isle, the shipyard, docks
  const ma = isle("main"), [mx, mz] = az(ma.u + 120, ma.v - 40);
  f.pavements.push({ x: mx, z: mz, hx: 28, hz: 3, yaw: 0.3, kind: "street" }, { x: mx, z: mz, hx: 3, hz: 24, yaw: 0.3, kind: "street" });
  for (let i = 0; i < 10; i++) f.buildings.push({ x: mx - 22 + (i % 5) * 11 + (rnd() - 0.5) * 2, z: mz - 12 + (i >> 1 & 1) * 22 + (rnd() - 0.5) * 2, hx: 3.5, hz: 3, yaw: 0.3, use: rnd() > 0.5 ? "store" : "house", h: 0.15, m: 5 + rnd() * 4 });
  f.buildings.push({ x: mx + 34, z: mz + 30, hx: 14, hz: 8, yaw: 0.3, use: "industrial", h: 0.35, m: 12, name: "Azure Shipyard" });
  f.buildings.push({ x: mx + 54, z: mz + 18, hx: 6, hz: 18, yaw: 0.3, use: "industrial", h: 0.15, m: 4, name: "Dry dock" });
  for (let k = 0; k < 4; k++) f.roads.push({ cls: "boardwalk", pts: [az(ma.u + 150, ma.v - 70 + k * 12), az(ma.u + 182, ma.v - 74 + k * 12)], width: 2.5, ...(k === 1 ? { name: "Azure Marina" } : {}) });
  f.rings.push({ x: az(ma.u + 175, ma.v - 52)[0], z: az(ma.u + 175, ma.v - 52)[1], r: 22, kind: "dock", name: "Marina" });
  // the volcano, the lighthouse, sandbars, the west isle's ruined fort
  const [vx, vz] = az(AZ_CRATER.u, AZ_CRATER.v);
  const li = isle("light"), [lx, lz] = az(li.u, li.v);
  f.buildings.push({ x: lx, z: lz, hx: 2.5, hz: 2.5, yaw: 0, use: "transport", h: 0.6, m: 24, name: "Azure Light" });
  const we = isle("west"), [wx, wz] = az(we.u, we.v);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; f.buildings.push({ x: wx + Math.cos(a) * 16, z: wz + Math.sin(a) * 16, hx: 4, hz: 2, yaw: a, use: "civic", h: 0.15, m: 4 }); }
  // roads: the ring road round the main isle, the climb to the crater rim, the causeway to Coral Bay; ferries
  const ring: [number, number][] = [];
  for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; ring.push(az(ma.u + Math.cos(a) * 150, ma.v + Math.sin(a) * 140)); }
  f.roads.push({ cls: "main", pts: ring, width: 6, name: "Isle Ring Road" });
  f.roads.push({ cls: "trail", pts: [az(ma.u + 90, ma.v - 20), az(ma.u + 40, ma.v + 10), az(-60, 30), [vx + 20, vz + 6]], width: 2.4, name: "Crater Trail" });
  f.roads.push({ cls: "bridge", pts: [az(80, -80), az(140, -130)], width: 6, name: "Coral Causeway" });
  f.roads.push({ cls: "ferry", pts: [az(ma.u + 182, ma.v - 52), az(240, 140), az(li.u - 20, li.v - 20)], width: 2, name: "Lighthouse ferry" });
  f.roads.push({ cls: "ferry", pts: [az(ma.u - 140, ma.v - 60), az(-260, -180), az(we.u + 40, we.v + 30)], width: 2, name: "West Isle ferry" });
  const P = (id: string, name: string, cat: CartoPoi["cat"], [x, z]: [number, number], rank: number, blurb: string) => f.pois.push({ id: `az-${id}`, name, cat, x, z, rank, blurb });
  P("bay", "Coral Bay", "village", [cx, cz - 16], 0, "The resort strip: towers on white sand, the beach club, the reef at the door.");
  P("marina", "Azure Marina", "port", az(ma.u + 175, ma.v - 52), 1, "Yachts, charters and the island ferries.");
  P("yard", "Azure Shipyard", "dock", [mx + 34, mz + 30], 2, "Hulls built and refitted for the whole archipelago.");
  P("crater", "Mount Azure", "peak", [vx, vz + 30], 1, "A sleeping volcano wrapped in jungle; a lake fills its crater.");
  P("lagoon", "Turquoise Lagoon", "lake", az(AZ_LAGOON.u, AZ_LAGOON.v), 1, "Waist-deep, glass-clear and ringed with reef.");
  P("light", "Azure Light", "viewpoint", [lx, lz], 2, "The lighthouse on its cay; the best sunset in the isles.");
  P("fort", "Old Fort", "ruins", [wx, wz], 2, "A ruined sea fort on the west isle.");
  P("reef", "The Reef Wall", "landmark", az(260, -40), 2, "A coral drop-off: divers' favourite.");
  f.areas.push({ name: "Azure Isles", x: AZ.x, z: AZ.z - AZ.reach * 0.86, kind: "sea", rank: 0 });
  f.areas.push({ name: "Mount Azure", x: vx, z: vz - 40, kind: "mountain", rank: 1 });
  f.areas.push({ name: "Azure Sea", x: az(-300, 330)[0], z: az(-300, 330)[1], kind: "sea", rank: 1 });
  return f;
}

/* =================================================================== */
/* Frostveil Ice Cap                                                    */
/* =================================================================== */

const FV = { x: 40000, z: 16000, reach: 450 } as const;
const fv = (u: number, v: number): [number, number] => [FV.x + u, FV.z + v];
const FV_CREVASSES: readonly (readonly [number, number][])[] = [
  [[-200, -60], [-120, -90], [-40, -70], [60, -110]].map(([u, v]) => fv(u!, v!)),
  [[-160, 40], [-80, 20], [0, 50], [90, 30], [170, 60]].map(([u, v]) => fv(u!, v!)),
  [[40, 160], [110, 140], [190, 170]].map(([u, v]) => fv(u!, v!)),
];
const FV_NUNATAKS = [{ u: -280, v: 190, r: 62, h: 52 }, { u: 120, v: -260, r: 34, h: 38 }, { u: 260, v: 260, r: 28, h: 30 }];
const FV_STATION = { u: -60, v: -220 };
const FV_CAVE = { u: 180, v: 90 };
const FV_SHELF = (u: number, v: number) => v - 300 + (fbm(u * 0.006, 0, 71) - 0.5) * 80;   // > 0: off the shelf into the sea
function fvHeight(x: number, z: number): number {
  const u = x - FV.x, v = z - FV.z;
  // the ice sheet: a high dome, wind-scoured into long ridges (sastrugi) running east-west
  let h = 38 - Math.hypot(u, v) * 0.03 + (fbm(u * 0.004, v * 0.004, 72) - 0.5) * 10 + Math.sin(v * 0.06 + fbm(u * 0.01, v * 0.01, 73) * 6) * 0.8;
  for (const n of FV_NUNATAKS) { const d = Math.hypot(u - n.u, v - n.v); h += n.h * Math.pow(1 - smooth(0, n.r * 1.6, d), 1.8); }
  for (const c of FV_CREVASSES) { const p = polyDist(c, x, z); h -= 10 * (1 - smooth(1.5, 5, p.d)); }
  // the ice shelf: a sheer front, then the sea with bergs
  const s = FV_SHELF(u, v);
  if (s > 0) {
    h = -6 - smooth(0, 160, s) * 14;
    const berg = fbm(u * 0.03, v * 0.03, 74);
    if (berg > 0.66 && s > 30) h = 3 + (berg - 0.66) * 60;
  }
  return h;
}
function fvCover(x: number, z: number, h: number, slope: number): Cover {
  const u = x - FV.x, v = z - FV.z;
  if (h < WATER) { const d = WATER - h; return d < 3 ? "shallow" : d < 14 ? "sea" : "deep"; }
  if (FV_SHELF(u, v) > 0) return "ice";   // the bergs
  for (const n of FV_NUNATAKS) {
    const d = Math.hypot(u - n.u, v - n.v);
    if (d < n.r * 0.9) return slope > 0.8 ? "basalt" : "rock";
    if (d < n.r * 1.5 && fbm(u * 0.06, v * 0.06, 76) > 0.45) return "dirt";   // the moraine round its foot
  }
  for (const c of FV_CREVASSES) if (polyDist(c, x, z).d < 4.5) return "ice";
  if (Math.hypot(u - FV_STATION.u, v - FV_STATION.v) < 36) return "paved";
  if (slope > 1.2) return "cliff";
  // blue ice where the wind strips the snow; snow everywhere else
  return fbm(u * 0.02, v * 0.02, 75) > 0.63 ? "ice" : "snow";
}
function fvFeatures(): CartoFeatures {
  const f = empty();
  const [sx, sz] = fv(FV_STATION.u, FV_STATION.v);
  // Frostveil Research Station: domes, labs on stilts, a hangar, a landing pad, the radar mast
  for (const [lx, lz, r] of [[0, 0, 8], [16, 6, 5], [-14, -6, 5], [6, -16, 4]] as const) f.rings.push({ x: sx + lx, z: sz + lz, r, kind: "dome", ...(r === 8 ? { name: "Frostveil Research Station" } : {}) });
  f.buildings.push({ x: sx + 26, z: sz - 14, hx: 12, hz: 8, yaw: 0, use: "industrial", h: 0.3, m: 10, name: "Station hangar" });
  f.buildings.push({ x: sx - 24, z: sz + 12, hx: 6, hz: 3, yaw: 0.2, use: "civic", h: 0.2, m: 6, name: "Labs" });
  f.buildings.push({ x: sx + 4, z: sz + 22, hx: 1.2, hz: 1.2, yaw: 0, use: "transport", h: 0.9, m: 30, name: "Radar mast" });
  f.rings.push({ x: sx - 30, z: sz - 26, r: 10, kind: "pad", name: "Ice pad" });
  f.rings.push({ x: sx, z: sz, r: 40, kind: "fence" });
  // the Glacier Cave's mouth, a buried relay, a whaling-era wreck locked in the shelf, a nomad camp
  const [cx, cz] = fv(FV_CAVE.u, FV_CAVE.v);
  f.rings.push({ x: cx, z: cz, r: 6, kind: "hazard", name: "Glacier Cave" });
  const [rx, rz] = fv(220, -120);
  f.buildings.push({ x: rx, z: rz, hx: 1, hz: 1, yaw: 0, use: "transport", h: 0.5, m: 14, name: "Buried relay" });
  const [kx, kz] = fv(-120, 120);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; f.rings.push({ x: kx + Math.cos(a) * 9, z: kz + Math.sin(a) * 9, r: 2.5, kind: "dome" }); }
  // routes: the flagged snow road from the station to the shelf landing, tracks to the cave, the relay and the camp
  f.roads.push({ cls: "track", pts: [[sx, sz], fv(-40, -100), fv(-20, 60), fv(-10, 200), fv(0, 290)], width: 5, name: "Flag Route" });
  f.roads.push({ cls: "trail", pts: [fv(-20, 60), fv(80, 80), [cx, cz]], width: 2.4, name: "Cave trail" });
  f.roads.push({ cls: "trail", pts: [[sx, sz], fv(80, -170), [rx, rz]], width: 2.4, name: "Relay trail" });
  f.roads.push({ cls: "trail", pts: [fv(-40, -100), fv(-110, 20), [kx, kz]], width: 2.4, name: "Nomad trail" });
  f.roads.push({ cls: "boardwalk", pts: [fv(0, 292), fv(4, 330)], width: 4, name: "Shelf landing" });
  const P = (id: string, name: string, cat: CartoPoi["cat"], [x, z]: [number, number], rank: number, blurb: string) => f.pois.push({ id: `fv-${id}`, name, cat, x, z, rank, blurb });
  P("station", "Frostveil Station", "research", [sx, sz - 14], 0, "The only heated walls on the ice cap: labs, a hangar and a radar that listens to the Fracture.");
  P("cave", "Glacier Cave", "cave", [cx, cz], 1, "Blue ice tunnels under the sheet. Something sleeps down there.");
  P("shelf", "The Ice Shelf", "viewpoint", fv(0, 286), 1, "A sheer ice front where the cap breaks into the sea.");
  P("relay", "Buried Relay", "outpost", [rx, rz], 2, "A pre-Fracture mast, half swallowed by the ice. It still transmits.");
  P("camp", "Nomad Camp", "camp", [kx, kz], 2, "Hide tents of the ice nomads, who trade furs and warnings.");
  P("crevasses", "Crevasse Fields", "hazard", fv(-80, 20), 1, "Snow bridges over drops with no bottom. Rope up.");
  P("spine", "Black Spine", "peak", fv(FV_NUNATAKS[0]!.u, FV_NUNATAKS[0]!.v), 1, "A nunatak of black rock breaking through the ice.");
  f.areas.push({ name: "Frostveil Ice Cap", x: FV.x, z: FV.z - FV.reach * 0.86, kind: "snow", rank: 0 });
  f.areas.push({ name: "Frozen Sea", x: fv(-260, 380)[0], z: fv(-260, 380)[1], kind: "sea", rank: 1 });
  return f;
}

/* ---------------- the registry ---------------- */

const GF_MAP: CartoMap = { id: "goldenreach", name: "Goldenreach Farmlands", sub: "Farmland · ranches · river valley", kind: "region", x: GF.x, z: GF.z, reach: GF.reach, regionId: "goldenreach" };
const AZ_MAP: CartoMap = { id: "azure-isles", name: "Azure Isles", sub: "Tropical isles · beaches · resorts", kind: "region", x: AZ.x, z: AZ.z, reach: AZ.reach, regionId: "azure-isles" };
const FV_MAP: CartoMap = { id: "frostveil", name: "Frostveil Ice Cap", sub: "Ice sheet · crevasses · ice shelf", kind: "region", x: FV.x, z: FV.z, reach: FV.reach, regionId: "frostveil" };
/** the land ids, with the continent of the canon board each one belongs to */
export const BOARD_LAND_CONTINENT = { goldenreach: "verdant-forest", "azure-isles": "shattered-reefs", frostveil: "frost-spire" } as const;
export const BOARD_LANDS: readonly NewLand[] = [
  { map: GF_MAP, source: { height: (x, z) => gfHeight(x, z) + WATER_LEVEL, cover: (x, z, h, s) => gfCover(x, z, h - WATER_LEVEL, s) }, features: gfFeatures },
  { map: AZ_MAP, source: { height: (x, z) => azHeight(x, z) + WATER_LEVEL, cover: (x, z, h, s) => azCover(x, z, h - WATER_LEVEL, s) }, features: azFeatures },
  { map: FV_MAP, source: { height: (x, z) => fvHeight(x, z) + WATER_LEVEL, cover: (x, z, h, s) => fvCover(x, z, h - WATER_LEVEL, s) }, features: fvFeatures },
];
