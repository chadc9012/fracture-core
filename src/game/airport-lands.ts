/** Lands for the four airports of the owner's "THE 12 AIRPORTS" board (Nov 15) that had no ground of their own and walked
 * out into a neighbour's map (Nov 22, "Next"): Eldergrove, Skyhaven, Aurora Gate and Horizon Gate. Each is a land of its
 * own laid out far beyond the playable world, exactly like new-lands.ts / board-lands.ts (its own height and cover, painted
 * by carto-maps.ts; its own towns, roads, landmarks and names), so the street map, the satellite view and the Godot 3D view
 * all come from the same data. Each has an `airport` place, where a flight sets you down. Pure and deterministic.
 *
 *  - Eldergrove (Verdant Forest): an ancient forest valley. The Elder River comes off the upper terrace in Eldergrove
 *    Falls and runs down to Mirrorwater; the timber village on its east bank, the Heartwood grove of giant trees, the
 *    Moonwell Shrine, the Elder Stones and the airfield on the clearing to the north-east.
 *  - Skyhaven (Storm Islands): sea-stack pinnacles standing a hundred metres out of the sea, their flat tops grassed and
 *    linked by sky bridges — Skyhaven town on the great isle, the wind farm, the lighthouse pinnacle, the monastery,
 *    and the airport on the long mesa isle.
 *  - Aurora Gate (Frost Spire): a snowbound tundra basin under the aurora — frozen Lake Lumen with its ice-fishing huts,
 *    taiga stands, the Aurora Observatory on Skywatch Hill, the herders' camp, the steaming Ember Springs and the town.
 *  - Horizon Gate (the Wastelands): sunset badlands — terraced mesas and buttes, the Sundown River's canyon, the Twin
 *    Arches, the oasis, the solar array and the frontier town at the crossroads where the rail line meets the highway. */
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
/** Chaikin corner-cutting: a hand-placed polyline as a smooth curve (rivers, canyons) */
function chaikin(pts: readonly Pt[], rounds = 3): Pt[] {
  let p: Pt[] = pts.map((q) => [q[0], q[1]]);
  for (let k = 0; k < rounds; k++) {
    const o: Pt[] = [p[0]!];
    for (let i = 0; i < p.length - 1; i++) { const [ax, az] = p[i]!, [bx, bz] = p[i + 1]!; o.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); }
    o.push(p[p.length - 1]!);
    p = o;
  }
  return p;
}
const rng = (seed: number) => () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
type Rings = CartoFeatures["rings"];
const empty = () => ({ buildings: [] as CartoBuilding[], roads: [] as CartoRoad[], pavements: [] as CartoPavement[], rings: [] as Rings, pois: [] as CartoPoi[], areas: [] as CartoArea[] });
type Pt = [number, number];
/** a village: houses either side of a street on a heading, the street paved */
function street(f: ReturnType<typeof empty>, rnd: () => number, cx: number, cz: number, yaw: number, len: number, n: number, use: () => CartoBuilding["use"], hm: [number, number]) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  f.pavements.push({ x: cx, z: cz, hx: len / 2, hz: 3.5, yaw, kind: "street" });
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, along = -len / 2 + 6 + (i >> 1) * ((len - 12) / Math.max(1, (n >> 1) - 1 || 1)) + (rnd() - 0.5) * 2;
    const lz = side * (10 + rnd() * 2.5);
    f.buildings.push({ x: cx + along * c - lz * s, z: cz + along * s + lz * c, hx: 3.4 + rnd() * 2, hz: 3 + rnd() * 1.5, yaw, use: use(), h: 0.18, m: hm[0] + rnd() * (hm[1] - hm[0]) });
  }
}
const P = (f: ReturnType<typeof empty>, pre: string) => (id: string, name: string, cat: CartoPoi["cat"], [x, z]: Pt, rank: number, blurb: string) => f.pois.push({ id: `${pre}-${id}`, name, cat, x, z, rank, blurb });

/* =================================================================== */
/* Eldergrove                                                           */
/* =================================================================== */

const EG = { x: 40000, z: 24000, reach: 440 } as const;
const eg = (u: number, v: number): Pt => [EG.x + u, EG.z + v];
const EG_RIVER: readonly Pt[] = chaikin(([[60, -440], [40, -300], [70, -180], [50, -70], [20, 0], [30, 60], [0, 160], [-30, 250], [-60, 330]] as Pt[]).map(([u, v]) => eg(u, v)));
const EG_LAKE = { u: -70, v: 360, r: 95 };
const EG_VILLAGE = { u: 100, v: 60 };
const EG_HEART = { u: -210, v: 110, r: 95 };
const EG_SHRINE = { u: 270, v: 250 };
const EG_STONES = { u: -320, v: -60 };
const EG_FIELD = { u: 240, v: -230 };
const EG_RANGER = { u: -240, v: -280 };
/** the upper valley north of the falls stands ~24 m above the lower one: a ragged cliff band across the valley, the
 * river cutting down through it in a gorge (the falls) */
const egTerrace = (u: number, v: number) => 24 * (1 - smooth(-90, -50, v + (fbm(u * 0.006, 0, 81) - 0.5) * 70));

function egHeight(x: number, z: number): number {
  const u = x - EG.x, v = z - EG.z;
  let h = 16 + (fbm(u * 0.005, v * 0.005, 82) - 0.5) * 26 + (fbm(u * 0.02, v * 0.02, 83) - 0.5) * 4;
  // ridges rise along the west and east edges: a valley
  h += 34 * smooth(220, 430, Math.abs(u - 20)) + 10 * smooth(300, 440, -v);
  h += egTerrace(u, v);
  // the airfield's clearing is levelled
  const df = Math.hypot(u - EG_FIELD.u, v - EG_FIELD.v);
  h = h + (34 - h) * (1 - smooth(70, 110, df));
  // the river: a valley floor, then the channel; above the falls it runs in a narrow gorge through the terrace
  const r = polyDist(EG_RIVER, x, z), rw = 8 + r.t * 6, up = egTerrace(u, v) / 24;
  const floor = 3 + r.d * 0.05;
  h = h + (Math.min(h, floor) - h) * (1 - smooth(rw * (1 - up * 0.3), rw * (5 - up * 3.4), r.d));
  h -= (1 - smooth(rw * 0.5, rw, r.d)) * 4.5;
  // Mirrorwater
  const dl = Math.hypot(u - EG_LAKE.u, v - EG_LAKE.v);
  h -= 14 * (1 - smooth(EG_LAKE.r * 0.55, EG_LAKE.r * 1.15, dl));
  return h;
}
function egCover(x: number, z: number, h: number, slope: number): Cover {
  const u = x - EG.x, v = z - EG.z;
  if (h < WATER) return polyDist(EG_RIVER, x, z).d < 18 ? "river" : "lake";
  const dl = Math.hypot(u - EG_LAKE.u, v - EG_LAKE.v);
  if (h < WATER + 0.8 && dl < EG_LAKE.r * 1.3) return "beach";
  if (Math.hypot(u - EG_VILLAGE.u, v - EG_VILLAGE.v) < 56) return "town";
  if (Math.hypot(u - EG_FIELD.u, v - EG_FIELD.v) < 82) return Math.abs((u - EG_FIELD.u) * 0.94 + (v - EG_FIELD.v) * 0.34) < 18 ? "paved" : "grass";
  if (slope > 1.15) return "cliff";
  if (slope > 0.75) return "rock";
  if (Math.hypot(u - EG_HEART.u, v - EG_HEART.v) < EG_HEART.r) return "denseForest";
  const r = polyDist(EG_RIVER, x, z);
  if (r.d < 24) return fbm(u * 0.05, v * 0.05, 84) > 0.55 ? "forest" : "meadow";
  const n = fbm(u * 0.012, v * 0.012, 85);
  if (n > 0.66) return "meadow";                     // clearings
  if (n > 0.6) return "grass";
  return fbm(u * 0.03, v * 0.03, 86) > 0.42 ? "denseForest" : "forest";
}
function egFeatures(): CartoFeatures {
  const f = empty(), rnd = rng(91), p = P(f, "eg");
  const [vx, vz] = eg(EG_VILLAGE.u, EG_VILLAGE.v);
  // Eldergrove village: a timber high street along the river, the lodge, the sawmill on the bank, the market green
  street(f, rnd, vx, vz, 1.45, 96, 14, () => (rnd() > 0.6 ? "store" : "house"), [5, 8]);
  f.pavements.push({ x: vx + 18, z: vz + 4, hx: 9, hz: 8, yaw: 0, kind: "plaza" });
  f.buildings.push({ x: vx + 34, z: vz - 16, hx: 9, hz: 6, yaw: 1.45, use: "civic", h: 0.3, m: 10, name: "Warden's Lodge" });
  f.buildings.push({ x: vx - 40, z: vz + 14, hx: 8, hz: 5, yaw: 1.3, use: "industrial", h: 0.25, m: 8, name: "Sawmill" });
  f.buildings.push({ x: vx + 22, z: vz + 30, hx: 5, hz: 4, yaw: 1.45, use: "store", h: 0.2, m: 7, name: "The Mossy Antler" });
  // the Heartwood: giant trees round a clearing, the oldest of them at the centre
  const [hx, hz] = eg(EG_HEART.u, EG_HEART.v);
  f.rings.push({ x: hx, z: hz, r: 16, kind: "ring", name: "The Heartwood" });
  // the falls, the shrine, the stones, the ranger station, the airfield
  const [fx, fz] = eg(52, -68);
  const [sx, sz] = eg(EG_SHRINE.u, EG_SHRINE.v);
  f.buildings.push({ x: sx, z: sz, hx: 5, hz: 5, yaw: 0.785, use: "civic", h: 0.35, m: 9, name: "Moonwell Shrine" });
  f.rings.push({ x: sx + 14, z: sz + 4, r: 4, kind: "ring", name: "Moonwell" });
  const [tx, tz] = eg(EG_STONES.u, EG_STONES.v);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; f.buildings.push({ x: tx + Math.cos(a) * 14, z: tz + Math.sin(a) * 14, hx: 0.9, hz: 0.6, yaw: a, use: "civic", h: 0.2, m: 4.5, ...(i === 0 ? { name: "Elder Stones" } : {}) }); }
  const [rx, rz] = eg(EG_RANGER.u, EG_RANGER.v);
  f.buildings.push({ x: rx, z: rz, hx: 5, hz: 4, yaw: 0.3, use: "civic", h: 0.2, m: 6, name: "Ranger Station" });
  f.buildings.push({ x: rx + 10, z: rz - 8, hx: 1.6, hz: 1.6, yaw: 0.3, use: "transport", h: 0.6, m: 16, name: "Fire lookout" });
  const [ax, az] = eg(EG_FIELD.u, EG_FIELD.v);
  f.pavements.push({ x: ax, z: az, hx: 70, hz: 9, yaw: 0.35, kind: "apron" });
  f.buildings.push({ x: ax - 26, z: az + 30, hx: 12, hz: 7, yaw: 0.35, use: "transport", h: 0.25, m: 9, name: "Eldergrove Airfield" });
  f.rings.push({ x: ax + 30, z: az + 34, r: 9, kind: "pad", name: "Helipad" });
  // roads: the forest road from the airfield down through the village and over the river to the Heartwood; tracks to
  // the shrine, the stones, the ranger station and the falls overlook; a boardwalk on Mirrorwater
  f.roads.push({ cls: "main", pts: [[ax - 26, az + 44], eg(200, -120), eg(150, -20), [vx + 10, vz - 4], eg(52, 62)], width: 6.5, name: "Elder Road" });
  f.roads.push({ cls: "bridge", pts: [eg(52, 62), eg(8, 58)], width: 6, name: "Old Stone Bridge" });
  f.roads.push({ cls: "main", pts: [eg(8, 58), eg(-60, 70), eg(-140, 100), [hx + 18, hz]], width: 5.5, name: "Heartwood Way" });
  f.roads.push({ cls: "track", pts: [[vx + 10, vz + 10], eg(170, 150), eg(230, 220), [sx - 6, sz]], width: 3.5, name: "Shrine Path" });
  f.roads.push({ cls: "track", pts: [eg(-60, 70), eg(-160, 0), eg(-260, -40), [tx + 16, tz]], width: 3.2, name: "Stones Track" });
  f.roads.push({ cls: "track", pts: [eg(-160, 0), eg(-200, -160), [rx + 6, rz + 6]], width: 3.2, name: "Ranger Track" });
  f.roads.push({ cls: "trail", pts: [eg(150, -20), eg(100, -60), [fx + 18, fz - 6]], width: 2.4, name: "Falls Overlook" });
  f.roads.push({ cls: "boardwalk", pts: [eg(-20, 300), eg(-40, 330), eg(-56, 344)], width: 3, name: "Mirrorwater Jetty" });
  p("airport", "Eldergrove Airfield", "airport", [ax, az - 12], 0, "A grass-edged strip in the clearing: flights to the network, and the forest right to the fence.");
  p("village", "Eldergrove", "village", [vx, vz - 12], 0, "The timber village on the Elder River: the lodge, the sawmill and lamplit porches under the canopy.");
  p("falls", "Eldergrove Falls", "falls", [fx, fz], 1, "The Elder River leaps the terrace in a white curtain; the spray keeps the moss green all year.");
  p("heart", "The Heartwood", "landmark", [hx, hz - 20], 1, "Trees older than the cities, wide as houses. The rangers say they listen.");
  p("shrine", "Moonwell Shrine", "temple", [sx, sz - 10], 1, "A shrine round a spring that holds the moon even at noon.");
  p("stones", "Elder Stones", "ruins", [tx, tz], 2, "A ring of standing stones, older than anyone remembers.");
  p("ranger", "Ranger Station", "outpost", [rx, rz - 10], 2, "The wardens' post and their fire lookout over the canopy.");
  p("lake", "Mirrorwater", "lake", eg(EG_LAKE.u, EG_LAKE.v), 1, "Still water that doubles the forest; a jetty and canoes.");
  f.areas.push({ name: "Eldergrove", x: EG.x, z: EG.z - EG.reach * 0.86, kind: "forest", rank: 0 });
  f.areas.push({ name: "Elder River", x: eg(10, 200)[0], z: eg(10, 200)[1], kind: "river", rank: 1 });
  f.areas.push({ name: "Greywood Ridge", x: eg(-380, -200)[0], z: eg(-380, -200)[1], kind: "mountain", rank: 1 });
  f.areas.push({ name: "Thornback Ridge", x: eg(400, 60)[0], z: eg(400, 60)[1], kind: "mountain", rank: 2 });
  return f;
}

/* =================================================================== */
/* Skyhaven                                                             */
/* =================================================================== */

const SK = { x: 40000, z: 28000, reach: 450 } as const;
const sk = (u: number, v: number): Pt => [SK.x + u, SK.z + v];
/** the pinnacles: centre, top radius, top height; the great isle carries the town */
const SK_ISLES: readonly { id: string; u: number; v: number; r: number; h: number }[] = [
  { id: "great", u: -40, v: 30, r: 120, h: 96 },
  { id: "mesa", u: 230, v: -180, r: 95, h: 92 },     // the airport's long isle
  { id: "wind", u: -250, v: -170, r: 70, h: 104 },
  { id: "light", u: 300, v: 210, r: 34, h: 82 },
  { id: "abbey", u: -280, v: 220, r: 58, h: 118 },
  { id: "garden", u: 90, v: 260, r: 56, h: 88 },
  { id: "spur", u: 120, v: -20, r: 34, h: 94 },
  { id: "w2", u: -380, v: 20, r: 30, h: 74 },
  { id: "n2", u: -60, v: -330, r: 40, h: 86 },
];
const skIsle = (id: string) => SK_ISLES.find((i) => i.id === id)!;
function skHeight(x: number, z: number): number {
  const u = x - SK.x, v = z - SK.z;
  let h = -26 + (fbm(u * 0.006, v * 0.006, 101) - 0.5) * 12;   // the sea far below
  for (const s of SK_ISLES) {
    const wob = (fbm(u * 0.02 + s.u, v * 0.02 + s.v, 102) - 0.5) * s.r * 0.35;
    const d = Math.hypot(u - s.u, v - s.v) + wob;
    // a near-flat grassed top, then sheer sides down to a skirt of fallen rock at the waterline
    const top = s.h + (fbm(u * 0.015, v * 0.015, 103) - 0.5) * 8 - smooth(0, s.r, d) * 6;
    const side = 1 - smooth(s.r * 0.92, s.r * 1.12, d);
    h = Math.max(h, -26 + (top + 26) * side);
    // a skirt of fallen rock at the cliff foot, just out of the water
    if (d < s.r * 1.4) h = Math.max(h, -26 + 30 * (1 - smooth(s.r * 1.05, s.r * 1.4, d)));
  }
  return h;
}
function skCover(x: number, z: number, h: number, slope: number): Cover {
  const u = x - SK.x, v = z - SK.z;
  if (h < WATER) { const d = WATER - h; return d < 3 ? "shallow" : d < 14 ? "sea" : "deep"; }
  if (h < 6) return slope > 0.8 ? "rock" : "beach";
  if (slope > 1.1) return "cliff";
  if (slope > 0.6) return "rock";
  const g = skIsle("great"), m = skIsle("mesa");
  if (Math.hypot(u - g.u - 10, v - g.v + 10) < 62) return "town";
  if (Math.hypot(u - m.u, v - m.v) < m.r * 0.85 && Math.abs((u - m.u) * 0.8 - (v - m.v) * 0.6) < 16) return "paved";
  const ab = skIsle("abbey");
  if (Math.hypot(u - ab.u, v - ab.v) < 20) return "paved";
  const n = fbm(u * 0.03, v * 0.03, 104);
  const gd = skIsle("garden");
  if (Math.hypot(u - gd.u, v - gd.v) < gd.r * 0.8) return n > 0.45 ? "forest" : "meadow";
  return n > 0.7 ? "forest" : n > 0.5 ? "meadow" : "grass";
}
function skFeatures(): CartoFeatures {
  const f = empty(), rnd = rng(111), p = P(f, "sk");
  const g = skIsle("great"), [gx, gz] = sk(g.u + 10, g.v - 10);
  // Skyhaven town: white houses round a high street and the harbourmaster's sky-dock, the Aerie inn, the bazaar
  street(f, rnd, gx, gz, 0.4, 100, 16, () => (rnd() > 0.55 ? "store" : "house"), [6, 11]);
  street(f, rnd, gx - 6, gz + 14, 0.4 + Math.PI / 2, 60, 8, () => "house", [5, 9]);
  f.pavements.push({ x: gx + 4, z: gz - 2, hx: 11, hz: 9, yaw: 0.4, kind: "plaza" });
  f.buildings.push({ x: gx + 30, z: gz - 30, hx: 8, hz: 6, yaw: 0.4, use: "civic", h: 0.4, m: 14, name: "Wind Council Hall" });
  f.buildings.push({ x: gx - 34, z: gz + 2, hx: 6, hz: 5, yaw: 0.4, use: "store", h: 0.3, m: 10, name: "The Aerie" });
  const [dx, dz] = sk(g.u - 100, g.v + 50);
  f.rings.push({ x: dx, z: dz, r: 10, kind: "dock", name: "Sky-dock" });
  // the airport's mesa: a strip along it, the terminal, the control mast
  const m = skIsle("mesa"), [mx, mz] = sk(m.u, m.v);
  f.pavements.push({ x: mx, z: mz, hx: 76, hz: 10, yaw: -0.64, kind: "apron" });
  f.buildings.push({ x: mx + 18, z: mz + 34, hx: 14, hz: 7, yaw: -0.64, use: "transport", h: 0.3, m: 11, name: "Skyhaven Airport" });
  f.buildings.push({ x: mx - 30, z: mz + 30, hx: 1.6, hz: 1.6, yaw: 0, use: "transport", h: 0.8, m: 22, name: "Control mast" });
  // the wind farm, the lighthouse, the abbey, the hanging gardens
  const w = skIsle("wind");
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, [tx, tz] = sk(w.u + Math.cos(a) * 42, w.v + Math.sin(a) * 42); f.buildings.push({ x: tx, z: tz, hx: 1.4, hz: 1.4, yaw: a, use: "transport", h: 0.9, m: 34, ...(i === 0 ? { name: "Gale Turbines" } : {}) }); }
  const l = skIsle("light"), [lx, lz] = sk(l.u, l.v);
  f.buildings.push({ x: lx, z: lz, hx: 3, hz: 3, yaw: 0, use: "civic", h: 0.9, m: 26, name: "Skyhaven Light" });
  const ab = skIsle("abbey"), [bx, bz] = sk(ab.u, ab.v);
  f.buildings.push({ x: bx, z: bz, hx: 12, hz: 9, yaw: 0.2, use: "civic", h: 0.5, m: 16, name: "Cloudreach Abbey" });
  f.buildings.push({ x: bx + 16, z: bz - 10, hx: 2.5, hz: 2.5, yaw: 0.2, use: "civic", h: 0.8, m: 28, name: "Bell tower" });
  const gd = skIsle("garden"), [hx, hz] = sk(gd.u, gd.v);
  f.rings.push({ x: hx, z: hz, r: 18, kind: "ring", name: "Hanging Gardens" });
  // the sky bridges between the tops (deck from edge to edge), the roads on the isles
  const edge = (a: { u: number; v: number; r: number }, b: { u: number; v: number; r: number }, k: number): Pt => { const dx2 = b.u - a.u, dz2 = b.v - a.v, L = Math.hypot(dx2, dz2); return sk(a.u + (dx2 / L) * a.r * k, a.v + (dz2 / L) * a.r * k); };
  const bridge = (a: string, b: string, name?: string) => { const A = skIsle(a), B = skIsle(b); f.roads.push({ cls: "bridge", pts: [edge(A, B, 0.78), edge(B, A, 0.78)], width: 5, ...(name ? { name } : {}) }); };
  bridge("great", "spur", "Spur Span");
  bridge("spur", "mesa", "Airport Span");
  bridge("great", "wind", "Gale Bridge");
  bridge("great", "garden", "Garden Span");
  bridge("great", "abbey", "Pilgrim's Bridge");
  bridge("garden", "light", "Lamplighter's Span");
  bridge("great", "n2");
  bridge("great", "w2");
  f.roads.push({ cls: "main", pts: [edge(g, skIsle("spur"), 0.78), [gx + 20, gz - 4], [gx, gz], edge(g, skIsle("abbey"), 0.78)], width: 6, name: "Skyway" });
  f.roads.push({ cls: "street", pts: [[gx, gz], edge(g, skIsle("garden"), 0.78)], width: 5, name: "Garden Row" });
  f.roads.push({ cls: "street", pts: [[gx, gz], edge(g, skIsle("wind"), 0.78)], width: 5, name: "Gale Row" });
  f.roads.push({ cls: "main", pts: [edge(m, skIsle("spur"), 0.78), [mx + 10, mz + 30]], width: 6, name: "Terminal Road" });
  p("airport", "Skyhaven Airport", "airport", [mx, mz - 14], 0, "A runway on a mesa a hundred metres over the sea: the network's highest landing.");
  p("town", "Skyhaven", "village", [gx, gz - 14], 0, "White houses on the great isle, bridges in every direction, the wind always in the flags.");
  p("dock", "Sky-dock", "dock", [dx, dz], 1, "Where the airships tie up off the cliff.");
  p("wind", "Gale Turbines", "landmark", sk(w.u, w.v), 1, "The turbines that keep Skyhaven lit, turning on the windiest rock.");
  p("light", "Skyhaven Light", "landmark", [lx, lz - 6], 1, "A lighthouse for aircraft as much as ships.");
  p("abbey", "Cloudreach Abbey", "temple", [bx, bz - 14], 1, "Monks on the highest pinnacle, who ring the bell for every storm.");
  p("gardens", "Hanging Gardens", "park", [hx, hz], 2, "Terraced gardens spilling over the cliff edge.");
  p("view", "Edge of the World", "viewpoint", sk(g.u + 110, g.v + 40), 2, "A railing, then a hundred metres of air.");
  f.areas.push({ name: "Skyhaven", x: SK.x, z: SK.z - SK.reach * 0.86, kind: "mountain", rank: 0 });
  f.areas.push({ name: "Sea of Gales", x: sk(150, 60)[0], z: sk(150, 60)[1], kind: "sea", rank: 1 });
  return f;
}

/* =================================================================== */
/* Aurora Gate                                                          */
/* =================================================================== */

const AG = { x: 40000, z: 32000, reach: 440 } as const;
const ag = (u: number, v: number): Pt => [AG.x + u, AG.z + v];
const AG_LAKE = { u: -40, v: 140, rx: 190, rz: 120 };
const AG_TOWN = { u: 150, v: -40 };
const AG_HILL = { u: -230, v: -250, r: 110 };
const AG_SPRINGS = { u: 290, v: 230 };
const AG_CAMP = { u: -310, v: 60 };
const AG_PORT = { u: 250, v: -270 };
const agLake = (u: number, v: number) => Math.hypot((u - AG_LAKE.u) / AG_LAKE.rx, (v - AG_LAKE.v) / AG_LAKE.rz) + (fbm(u * 0.01, v * 0.01, 121) - 0.5) * 0.25;
function agHeight(x: number, z: number): number {
  const u = x - AG.x, v = z - AG.z;
  let h = 12 + (fbm(u * 0.005, v * 0.005, 122) - 0.5) * 18 + (fbm(u * 0.025, v * 0.025, 123) - 0.5) * 2.5;
  // Skywatch Hill and the fells round the basin
  h += 46 * Math.pow(1 - smooth(0, AG_HILL.r * 1.5, Math.hypot(u - AG_HILL.u, v - AG_HILL.v)), 1.6);
  h += 30 * smooth(250, 440, Math.hypot(u, v * 1.2));
  // the airport's plain is levelled
  h = h + (14 - h) * (1 - smooth(80, 120, Math.hypot(u - AG_PORT.u, v - AG_PORT.v)));
  // Lake Lumen: a shallow basin, frozen (its ice stands just above the water line)
  const l = agLake(u, v);
  h = h + (0.6 - h) * (1 - smooth(0.9, 1.25, l));
  // the springs' hollow
  h -= 5 * (1 - smooth(10, 30, Math.hypot(u - AG_SPRINGS.u, v - AG_SPRINGS.v)));
  return h;
}
function agCover(x: number, z: number, h: number, slope: number): Cover {
  const u = x - AG.x, v = z - AG.z;
  if (agLake(u, v) < 1.0) return "ice";
  if (Math.hypot(u - AG_SPRINGS.u, v - AG_SPRINGS.v) < 14) return "lake";
  if (h < WATER) return "lake";
  if (Math.hypot(u - AG_TOWN.u, v - AG_TOWN.v) < 58) return "town";
  if (Math.hypot(u - AG_PORT.u, v - AG_PORT.v) < 90) return Math.abs((u - AG_PORT.u) * 0.97 - (v - AG_PORT.v) * 0.24) < 18 ? "paved" : "snow";
  if (slope > 1.05) return "cliff";
  if (slope > 0.6) return fbm(u * 0.05, v * 0.05, 124) > 0.5 ? "rock" : "snow";
  // the taiga: dark spruce stands across the basin, thicker toward the fells; open snow between
  const n = fbm(u * 0.011, v * 0.011, 125) + smooth(150, 380, Math.hypot(u, v)) * 0.12;
  if (n > 0.63) return "forest";
  if (n > 0.57 && fbm(u * 0.06, v * 0.06, 126) > 0.5) return "forest";
  if (fbm(u * 0.03, v * 0.03, 127) > 0.7) return "rock";
  // tundra heath (dwarf willow, crowberry) where the wind strips the snow thin
  return fbm(u * 0.022, v * 0.022, 128) > 0.6 ? "scrub" : "snow";
}
function agFeatures(): CartoFeatures {
  const f = empty(), rnd = rng(131), p = P(f, "ag");
  const [tx, tz] = ag(AG_TOWN.u, AG_TOWN.v);
  // Aurora Gate: log houses either side of the main street, the trading post, the sauna house, the chapel
  street(f, rnd, tx, tz, -0.3, 90, 14, () => (rnd() > 0.6 ? "store" : "house"), [5, 8]);
  f.pavements.push({ x: tx + 8, z: tz + 6, hx: 9, hz: 8, yaw: -0.3, kind: "plaza" });
  f.buildings.push({ x: tx + 30, z: tz + 22, hx: 9, hz: 6, yaw: -0.3, use: "store", h: 0.25, m: 8, name: "Northlight Trading Post" });
  f.buildings.push({ x: tx - 30, z: tz - 18, hx: 5, hz: 4, yaw: -0.3, use: "civic", h: 0.2, m: 6, name: "Sauna house" });
  f.buildings.push({ x: tx - 10, z: tz + 30, hx: 4, hz: 7, yaw: -0.3, use: "civic", h: 0.4, m: 13, name: "Chapel of Lights" });
  // the Aurora Observatory on Skywatch Hill: domes and a dish
  const [ox, oz] = ag(AG_HILL.u + 10, AG_HILL.v + 10);
  f.rings.push({ x: ox, z: oz, r: 9, kind: "dome", name: "Aurora Observatory" }, { x: ox + 20, z: oz + 6, r: 5, kind: "dome" });
  f.buildings.push({ x: ox - 16, z: oz + 14, hx: 6, hz: 4, yaw: 0, use: "civic", h: 0.2, m: 6, name: "Observers' lodge" });
  f.buildings.push({ x: ox + 6, z: oz - 18, hx: 1.2, hz: 1.2, yaw: 0, use: "transport", h: 0.7, m: 18, name: "Radio dish" });
  // ice-fishing huts out on Lake Lumen
  for (let i = 0; i < 9; i++) { const [hx, hz] = ag(AG_LAKE.u - 90 + rnd() * 180, AG_LAKE.v - 50 + rnd() * 100); f.buildings.push({ x: hx, z: hz, hx: 1.4, hz: 1.8, yaw: rnd() * 3, use: "house", h: 0.1, m: 2.6, ...(i === 0 ? { name: "Ice-fishing huts" } : {}) }); }
  // the herders' camp: hide tents round a fire, the reindeer pen
  const [cx, cz] = ag(AG_CAMP.u, AG_CAMP.v);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; f.rings.push({ x: cx + Math.cos(a) * 11, z: cz + Math.sin(a) * 11, r: 2.6, kind: "dome" }); }
  f.rings.push({ x: cx + 34, z: cz - 6, r: 18, kind: "fence", name: "Reindeer pen" });
  // Ember Springs: a bathhouse by the steaming pool
  const [sx, sz] = ag(AG_SPRINGS.u, AG_SPRINGS.v);
  f.buildings.push({ x: sx - 22, z: sz - 6, hx: 6, hz: 4, yaw: 0.5, use: "civic", h: 0.2, m: 6, name: "Springs bathhouse" });
  f.roads.push({ cls: "boardwalk", pts: [[sx - 16, sz - 4], [sx - 8, sz]], width: 2.6 });
  // the airport on the plain
  const [px, pz] = ag(AG_PORT.u, AG_PORT.v);
  f.pavements.push({ x: px, z: pz, hx: 72, hz: 9, yaw: -0.25, kind: "apron" });
  f.buildings.push({ x: px - 10, z: pz + 34, hx: 13, hz: 7, yaw: -0.25, use: "transport", h: 0.3, m: 10, name: "Aurora Gate Airport" });
  // roads: the winter road from the airport through town round the lake; tracks to the observatory, camp and springs
  f.roads.push({ cls: "main", pts: [[px - 10, pz + 48], ag(220, -160), ag(190, -90), [tx, tz], ag(80, 20), ag(-80, 0), ag(-200, 40), [cx + 12, cz]], width: 6.5, name: "Winter Road" });
  f.roads.push({ cls: "track", pts: [ag(-80, 0), ag(-150, -120), ag(-200, -200), [ox, oz + 12]], width: 3.6, name: "Skywatch Road" });
  f.roads.push({ cls: "track", pts: [[tx, tz], ag(210, 60), ag(260, 160), [sx - 22, sz - 14]], width: 3.4, name: "Springs Track" });
  f.roads.push({ cls: "trail", pts: [ag(80, 20), ag(40, 80), ag(0, 120)], width: 2.6, name: "Ice road" });
  p("airport", "Aurora Gate Airport", "airport", [px, pz - 12], 0, "The northern gate: a strip on the snow plain, ski-equipped and lit for the long night.");
  p("town", "Aurora Gate", "village", [tx, tz - 12], 0, "Log houses, wood smoke and the sky on fire every clear night.");
  p("observatory", "Aurora Observatory", "research", [ox, oz - 14], 1, "Domes on Skywatch Hill reading the aurora — and what the Fracture does to it.");
  p("lake", "Lake Lumen", "lake", ag(AG_LAKE.u, AG_LAKE.v), 1, "Frozen eight months a year; the aurora shows in the ice.");
  p("camp", "Herders' Camp", "camp", [cx, cz - 12], 2, "Reindeer herders who follow the lights south every winter.");
  p("springs", "Ember Springs", "lake", [sx, sz], 1, "A hot pool steaming in the snow.");
  p("hill", "Skywatch Hill", "peak", ag(AG_HILL.u, AG_HILL.v), 1, "The best seat under the aurora.");
  f.areas.push({ name: "Aurora Gate", x: AG.x, z: AG.z - AG.reach * 0.86, kind: "snow", rank: 0 });
  f.areas.push({ name: "Lumen Basin", x: ag(-40, 270)[0], z: ag(-40, 270)[1], kind: "valley", rank: 1 });
  f.areas.push({ name: "The Fells", x: ag(360, -10)[0], z: ag(360, -10)[1], kind: "mountain", rank: 2 });
  return f;
}

/* =================================================================== */
/* Horizon Gate                                                         */
/* =================================================================== */

const HG = { x: 40000, z: 36000, reach: 440 } as const;
const hg = (u: number, v: number): Pt => [HG.x + u, HG.z + v];
const HG_RIVER: readonly Pt[] = chaikin(([[-440, -120], [-300, -60], [-220, -110], [-120, -40], [-30, -70], [60, 10], [130, -20], [220, 60], [330, 40], [440, 110]] as Pt[]).map(([u, v]) => hg(u, v)));
const HG_TOWN = { u: -60, v: 110 };
const HG_OASIS = { u: 250, v: 270, r: 34 };
const HG_ARCHES = { u: 120, v: 200 };
const HG_SOLAR = { u: -270, v: 250 };
const HG_PORT = { u: 210, v: -250 };
const HG_BUTTES = [{ u: -200, v: -280, r: 40, h: 50 }, { u: 40, v: -290, r: 30, h: 44 }, { u: 330, v: -60, r: 36, h: 52 }, { u: -340, v: 120, r: 26, h: 40 }, { u: 60, v: 330, r: 24, h: 38 }];
function hgHeight(x: number, z: number): number {
  const u = x - HG.x, v = z - HG.z;
  let h = 16 + (fbm(u * 0.005, v * 0.005, 141) - 0.5) * 16;
  // terraced mesas
  const m = fbm(u * 0.0045 - 30, v * 0.0045 + 50, 142);
  if (m > 0.6) h += 10 + Math.floor((m - 0.6) * 30) / 30 * 70;
  for (const b of HG_BUTTES) { const d = Math.hypot(u - b.u, v - b.v) + (fbm(u * 0.05, v * 0.05, 143) - 0.5) * 10; h += b.h * (1 - smooth(b.r * 0.85, b.r * 1.05, d)); }
  // the town, the airport and the solar array are on the flat
  for (const [p, r, lvl] of [[HG_TOWN, 75, 18], [HG_PORT, 110, 17], [HG_SOLAR, 90, 19]] as const) { const d = Math.hypot(u - p.u, v - p.v); h = h + (lvl - h) * (1 - smooth(r * 0.75, r * 1.2, d)); }
  // the Sundown River: a canyon cut into the plain
  const r = polyDist(HG_RIVER, x, z), cw = 14 + vnoise(r.t * 16, 0, 144) * 8;
  h = h + (Math.min(h, -1.5) - h) * (1 - smooth(cw * 0.5, cw * 1.5, r.d));
  // the oasis
  h -= 10 * (1 - smooth(HG_OASIS.r * 0.6, HG_OASIS.r * 1.2, Math.hypot(u - HG_OASIS.u, v - HG_OASIS.v)));
  return h;
}
function hgCover(x: number, z: number, h: number, slope: number): Cover {
  const u = x - HG.x, v = z - HG.z;
  if (h < WATER) return Math.hypot(u - HG_OASIS.u, v - HG_OASIS.v) < HG_OASIS.r * 1.3 ? "lake" : "river";
  const r = polyDist(HG_RIVER, x, z);
  if (h < WATER + 1.2 && r.d < 30) return "wash";
  if (Math.hypot(u - HG_TOWN.u, v - HG_TOWN.v) < 58) return "town";
  if (Math.hypot(u - HG_PORT.u, v - HG_PORT.v) < 92) return Math.abs((u - HG_PORT.u) * 0.9 + (v - HG_PORT.v) * 0.44) < 18 ? "paved" : "dirt";
  if (Math.abs(u - HG_SOLAR.u) < 70 && Math.abs(v - HG_SOLAR.v) < 50) return "paved";
  const doa = Math.hypot(u - HG_OASIS.u, v - HG_OASIS.v);
  if (doa < HG_OASIS.r * 2) return doa < HG_OASIS.r * 1.5 ? "grass" : "scrub";
  if (slope > 1.1) return "cliff";
  if (slope > 0.55) return "sandstone";
  if (r.d < 40) return "scrub";
  const n = fbm(u * 0.02, v * 0.02, 145);
  return n > 0.62 ? "dunes" : n > 0.46 ? "desert" : fbm(u * 0.04, v * 0.04, 146) > 0.55 ? "scrub" : "dirt";
}
function hgFeatures(): CartoFeatures {
  const f = empty(), rnd = rng(151), p = P(f, "hg");
  const [tx, tz] = hg(HG_TOWN.u, HG_TOWN.v);
  // Horizon Gate: a frontier main street at the crossroads, the depot, the saloon, the water tower
  street(f, rnd, tx, tz, 0.05, 100, 16, () => (rnd() > 0.5 ? "store" : "house"), [5, 9]);
  street(f, rnd, tx + 4, tz, Math.PI / 2 + 0.05, 70, 8, () => (rnd() > 0.5 ? "store" : "house"), [5, 8]);
  f.buildings.push({ x: tx + 40, z: tz - 26, hx: 10, hz: 5, yaw: 0.05, use: "transport", h: 0.2, m: 7, name: "Horizon Depot" });
  f.buildings.push({ x: tx - 24, z: tz - 20, hx: 6, hz: 5, yaw: 0.05, use: "store", h: 0.25, m: 8, name: "Last Light Saloon" });
  f.buildings.push({ x: tx + 22, z: tz + 26, hx: 1.8, hz: 1.8, yaw: 0, use: "transport", h: 0.7, m: 16, name: "Water tower" });
  // the oasis, the arches, the solar array, the airport
  const [ox, oz] = hg(HG_OASIS.u, HG_OASIS.v);
  f.buildings.push({ x: ox - 40, z: oz - 10, hx: 5, hz: 4, yaw: 0.3, use: "store", h: 0.2, m: 6, name: "Oasis caravanserai" });
  const [ax, az] = hg(HG_ARCHES.u, HG_ARCHES.v);
  f.buildings.push({ x: ax, z: az, hx: 2, hz: 7, yaw: 0.4, use: "civic", h: 0.6, m: 18, name: "Twin Arches" }, { x: ax + 26, z: az + 10, hx: 2, hz: 6, yaw: 0.9, use: "civic", h: 0.5, m: 15 });
  const [sx, sz] = hg(HG_SOLAR.u, HG_SOLAR.v);
  for (let i = 0; i < 6; i++) f.pavements.push({ x: sx - 50 + i * 20, z: sz, hx: 7, hz: 42, yaw: 0, kind: "apron" });
  f.buildings.push({ x: sx + 76, z: sz - 40, hx: 8, hz: 5, yaw: 0, use: "industrial", h: 0.25, m: 7, name: "Sunfield Array" });
  const [px, pz] = hg(HG_PORT.u, HG_PORT.v);
  f.pavements.push({ x: px, z: pz, hx: 74, hz: 9, yaw: 0.46, kind: "apron" });
  f.buildings.push({ x: px - 28, z: pz + 34, hx: 13, hz: 7, yaw: 0.46, use: "transport", h: 0.3, m: 10, name: "Horizon Gate Airport" });
  // the highway, the rail line, a bridge over the canyon, tracks
  f.roads.push({ cls: "highway", pts: [hg(-440, 160), hg(-220, 130), [tx, tz], hg(80, 40), hg(96, 0)], width: 8, name: "Sundown Highway" });
  f.roads.push({ cls: "bridge", pts: [hg(96, 0), hg(112, -48)], width: 8, name: "Canyon Bridge" });
  f.roads.push({ cls: "highway", pts: [hg(112, -48), hg(150, -130), [px - 28, pz + 48]], width: 8, name: "Airport Road" });
  f.roads.push({ cls: "rail", pts: [hg(-440, 210), hg(-200, 180), [tx + 40, tz - 34], hg(200, 120), hg(440, 170)], width: 2.4, name: "Horizon Line" });
  f.roads.push({ cls: "track", pts: [[tx, tz], hg(60, 160), [ax - 6, az], hg(200, 250), [ox - 36, oz - 10]], width: 3.6, name: "Oasis Trail" });
  f.roads.push({ cls: "track", pts: [hg(-220, 130), [sx + 76, sz - 46]], width: 3.6, name: "Array Road" });
  p("airport", "Horizon Gate Airport", "airport", [px, pz - 12], 0, "A runway on the badland flats where the sun sets all evening.");
  p("town", "Horizon Gate", "village", [tx, tz - 14], 0, "The frontier town at the crossroads: the depot, the saloon and the last fuel for a hundred kilometres.");
  p("arches", "Twin Arches", "landmark", [ax + 12, az - 10], 1, "Two stone arches the wind took ten thousand years to carve.");
  p("oasis", "Sundown Oasis", "lake", [ox, oz], 1, "Palms and still water in the red rock; caravans stop here.");
  p("canyon", "Sundown Canyon", "viewpoint", hg(-120, -40), 1, "The river's cut through the plain, deep enough to lose the sun in.");
  p("solar", "Sunfield Array", "outpost", [sx, sz - 50], 2, "Mirrors to the horizon, powering Horizon Gate and the line.");
  f.areas.push({ name: "Horizon Gate", x: HG.x, z: HG.z - HG.reach * 0.86, kind: "desert", rank: 0 });
  f.areas.push({ name: "Sundown River", x: hg(300, 30)[0], z: hg(300, 30)[1], kind: "river", rank: 1 });
  f.areas.push({ name: "The Mesas", x: hg(-300, -200)[0], z: hg(-300, -200)[1], kind: "mountain", rank: 1 });
  return f;
}

/* ---------------- the registry ---------------- */

const EG_MAP: CartoMap = { id: "eldergrove", name: "Eldergrove", sub: "Ancient forest · falls · river valley", kind: "region", x: EG.x, z: EG.z, reach: EG.reach, regionId: "eldergrove" };
const SK_MAP: CartoMap = { id: "skyhaven", name: "Skyhaven", sub: "Sky pinnacles · bridges · the Sea of Gales", kind: "region", x: SK.x, z: SK.z, reach: SK.reach, regionId: "skyhaven" };
const AG_MAP: CartoMap = { id: "aurora-gate", name: "Aurora Gate", sub: "Tundra · frozen lake · the aurora", kind: "region", x: AG.x, z: AG.z, reach: AG.reach, regionId: "aurora-gate" };
const HG_MAP: CartoMap = { id: "horizon-gate", name: "Horizon Gate", sub: "Badlands · mesas · the canyon", kind: "region", x: HG.x, z: HG.z, reach: HG.reach, regionId: "horizon-gate" };
/** the land ids, with the continent of the canon board each one belongs to */
export const AIRPORT_LAND_CONTINENT = { eldergrove: "verdant-forest", skyhaven: "storm-islands", "aurora-gate": "frost-spire", "horizon-gate": "wastelands" } as const;
export const AIRPORT_LANDS: readonly NewLand[] = [
  { map: EG_MAP, source: { height: (x, z) => egHeight(x, z) + WATER_LEVEL, cover: (x, z, h, s) => egCover(x, z, h - WATER_LEVEL, s) }, features: egFeatures },
  { map: SK_MAP, source: { height: (x, z) => skHeight(x, z) + WATER_LEVEL, cover: (x, z, h, s) => skCover(x, z, h - WATER_LEVEL, s) }, features: skFeatures },
  { map: AG_MAP, source: { height: (x, z) => agHeight(x, z) + WATER_LEVEL, cover: (x, z, h, s) => agCover(x, z, h - WATER_LEVEL, s) }, features: agFeatures },
  { map: HG_MAP, source: { height: (x, z) => hgHeight(x, z) + WATER_LEVEL, cover: (x, z, h, s) => hgCover(x, z, h - WATER_LEVEL, s) }, features: hgFeatures },
];
