/** The Nexus Region (owner, Nov 9 2026: the "Nexus Region — Central Continent, Regional Map v1.0" board, natural coastline,
 * the full region): the land round the capital, laid out from the board as a region map of its own (`nexus-region`), opened
 * first on the Nexus continent. Like the other board lands it lives in a frame far beyond the playable world with its own
 * ground (height + cover, painted by carto-maps.ts) and its own towns, roads, landmarks and names; the Godot game builds its
 * 3D view from the same data (scripts/export-godot-data.ts). Pure and deterministic.
 *
 * North to south as on the board: the snow peaks of Aether Ridge (Summit Observatory, Frostwatch Station, the Aether Monolith,
 * Skyline Crater) over the Verdant Expanse forest (Eldergrove Ruins, Whispering Falls, Emerald Lake, Mossveil Village) in the
 * north-west and the NOVA Research Complex, the corrupted Fracture Spire and the volcanic Obsidian Cliffs in the north-east;
 * Nexus City in the middle (The Core and its spire, Aether Heights, Westgate, NOVA HQ, Riverside, the Tech Quarter, the Arena
 * and Entertainment districts); the red canyons of the Ironcrest Outlands in the west; Southreach's military base in the
 * south-west; Nexus Harbor, Nexus Beach and the Azure Keys isles on the southern bay; Eastpoint's industry and Lighthouse
 * Point in the east. Board scale (~900 km²) is compressed to a 1.8 km map the phone can draw. */
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
function polyDist(pts: readonly (readonly [number, number])[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]!, [bx, bz] = pts[i]!, ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1;
    const t = clamp01(((x - ax) * ex + (z - az) * ez) / L2);
    best = Math.min(best, Math.hypot(ax + ex * t - x, az + ez * t - z));
  }
  return best;
}
/** signed distance to a closed polygon (negative inside) */
function polySigned(poly: readonly (readonly [number, number])[], x: number, z: number): number {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!, [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  const d = polyDist([...poly, poly[0]!], x, z);
  return inside ? -d : d;
}
const rng = (seed: number) => () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;

/* ---------------- the layout (local metres: u east, v south) ---------------- */

export const NR = { x: 40000, z: 24000, reach: 900 } as const;
const nr = (u: number, v: number): [number, number] => [NR.x + u, NR.z + v];

/** the coastline, clockwise from the north-west: cliffs under the mountains, the long east coast, Lighthouse Point, the bay
 * with the harbour and the beach, the Southreach peninsula, the west coast under Ironcrest */
const COAST: readonly [number, number][] = [
  [-700, -600], [-420, -680], [-80, -700], [260, -690], [560, -640], [760, -500], [840, -300], [860, -60], [850, 160],
  [830, 330], [760, 420], [660, 380], [600, 300], [520, 250], [420, 238], [300, 248], [180, 262], [60, 270], [-60, 252],
  [-140, 290], [-210, 380], [-300, 480], [-420, 560], [-560, 540], [-680, 430], [-800, 260], [-860, 60], [-850, -200], [-800, -420],
];
/** the Azure Keys: resort isles in the bay */
const KEYS: readonly { u: number; v: number; r: number }[] = [
  { u: 180, v: 420, r: 70 }, { u: 320, v: 470, r: 58 }, { u: 450, v: 410, r: 46 }, { u: 260, v: 560, r: 40 }, { u: 80, v: 520, r: 34 },
];
/** the river: from the snow under Aether Ridge past Emerald Lake, round the city's west side to the harbour */
const RIVER_LINE: readonly [number, number][] = [[-140, -560], [-230, -430], [-300, -300], [-330, -150], [-290, -20], [-230, 100], [-150, 190], [-90, 262]];
/** the river's course: the line above, densified and swung into meanders (wider in the lowland, tight in the hills) */
const RIVER: readonly [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let i = 1; i < RIVER_LINE.length; i++) {
    const [ax, az] = RIVER_LINE[i - 1]!, [bx, bz] = RIVER_LINE[i]!, L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let k = 0; k < 8; k++) {
      const t = k / 8, g = (i - 1 + t) / (RIVER_LINE.length - 1), amp = 6 + 22 * g;
      const w = Math.sin((i - 1 + t) * Math.PI * 1.7) * amp;
      out.push([ax + (bx - ax) * t + nx * w, az + (bz - az) * t + nz * w]);
    }
  }
  out.push(RIVER_LINE[RIVER_LINE.length - 1]!);
  return out;
})();
/** the board's waterfalls: off Aether Ridge into the river and the lake, and over the sea cliffs (local u, v; `to` is the
 * direction the water falls, `drop` how high the cliff behind it stands). The ground is raised into a cliff at each. */
export const NR_FALLS: readonly { id: string; name: string; u: number; v: number; to: number; drop: number }[] = [
  { id: "whisper", name: "Whispering Falls", u: -300, v: -350, to: Math.PI * 0.5, drop: 30 },
  { id: "ridge", name: "Ridge Falls", u: -150, v: -470, to: Math.PI * 0.65, drop: 34 },
  { id: "emerald", name: "Emerald Falls", u: -470, v: -235, to: Math.PI * 0.5, drop: 18 },
  { id: "west", name: "Westcliff Falls", u: -820, v: -260, to: Math.PI, drop: 24 },
  { id: "south", name: "Southreach Falls", u: -470, v: 530, to: Math.PI * 0.5, drop: 26 },
  { id: "east", name: "Eastcliff Falls", u: 838, v: 120, to: 0, drop: 24 },
  { id: "light", name: "Lighthouse Falls", u: 760, v: 410, to: Math.PI * 0.4, drop: 20 },
  { id: "north", name: "Northcliff Falls", u: 640, v: -620, to: -Math.PI * 0.5, drop: 26 },
];
const LAKE = { u: -470, v: -150, r: 60 };   // Emerald Lake
const CITY = { u: 0, v: -20, r: 230 };       // Nexus City
const PEAKS: readonly { u: number; v: number; h: number; r: number }[] = [
  { u: -260, v: -560, h: 135, r: 230 }, { u: -40, v: -620, h: 175, r: 250 }, { u: 200, v: -600, h: 150, r: 230 }, { u: -500, v: -520, h: 100, r: 210 },
  { u: 380, v: -620, h: 110, r: 180 }, { u: -120, v: -470, h: 70, r: 160 }, { u: 90, v: -480, h: 60, r: 150 }, { u: -680, v: -420, h: 60, r: 160 },
];
const CRATER = { u: 230, v: -560, r: 40 };   // Skyline Crater
const SPIRE = { u: 520, v: -470, r: 150 };   // The Fracture Spire zone
const OBSIDIAN = { u: 640, v: -250, r: 150 };
const OUTLANDS = { u: -640, v: 120, r: 230 }; // Ironcrest
const CANYONS: readonly (readonly [number, number][])[] = [
  [[-820, 20], [-700, 60], [-620, 30], [-520, 90], [-440, 70]],
  [[-760, 260], [-660, 210], [-600, 250], [-520, 200]],
];
const SOUTHREACH = { u: -380, v: 380, r: 120 };
const EASTPOINT = { u: 640, v: -20, r: 120 };
const NOVA = { u: 260, v: -360, r: 70 };
const BEACH = { u: 470, v: 225 };
const HARBOR = { u: 60, v: 250 };
const LIGHT = { u: 800, v: 390 };

/** signed distance to the coast (negative on land), roughened into coves and headlands */
const coastD = (u: number, v: number) => polySigned(COAST, u, v) + (fbm(u * 0.006, v * 0.006, 70) - 0.5) * 90 + (fbm(u * 0.03, v * 0.03, 69) - 0.5) * 18;
/** a zone's edge: its radius wobbled by noise so no district or biome reads as a circle */
const inZone = (u: number, v: number, c: { u: number; v: number; r: number }, k = 1, seed = 83) => Math.hypot(u - c.u, v - c.v) < c.r * k * (0.78 + 0.44 * fbm(u * 0.012 + c.u * 0.01, v * 0.012 + c.v * 0.01, seed));

export function nrHeight(x: number, z: number): number {
  const u = x - NR.x, v = z - NR.z;
  const coast = coastD(u, v);
  // the sea floor shelves down from the coast; the land rises behind a beach or a cliff
  let h = coast > 0 ? -2 - smooth(0, 160, coast) * 16 + (fbm(u * 0.01, v * 0.01, 71) - 0.5) * 2 : 3 + smooth(0, 60, -coast) * 4 + (fbm(u * 0.006, v * 0.006, 72) - 0.5) * 8;
  // the Azure Keys
  for (const k of KEYS) {
    const d = Math.hypot(u - k.u, v - k.v) / (k.r * (0.82 + 0.36 * fbm(u * 0.02 + k.u, v * 0.02, 73)));
    if (d < 1.5) h = Math.max(h, -2.4 + 9 * Math.pow(1 - smooth(0, 1, d), 1.3) + 2.6 * (1 - smooth(0.9, 1.3, d)));
  }
  if (coast > 0) return h;
  const inland = smooth(0, 80, -coast);
  h += Math.pow(fbm(u * 0.004, v * 0.004, 68), 2) * 34 * inland;
  // Aether Ridge: snow peaks along the north
  for (const p of PEAKS) {
    const d = Math.hypot(u - p.u, (v - p.v) * 1.3) / p.r;
    if (d < 1.2) h += p.h * Math.pow(1 - smooth(0, 1.2, d), 1.6) * (0.75 + 0.5 * fbm(u * 0.02, v * 0.02, 74)) * inland;
  }
  h -= 30 * (1 - smooth(CRATER.r * 0.4, CRATER.r, Math.hypot(u - CRATER.u, v - CRATER.v)));
  // the Fracture Spire's broken crags, the Obsidian Cliffs' black ridges
  const ds = Math.hypot(u - SPIRE.u, v - SPIRE.v) / SPIRE.r;
  if (ds < 1.3) h += (1 - smooth(0, 1.3, ds)) * (40 + 60 * Math.pow(fbm(u * 0.03, v * 0.03, 75), 2)) * inland;
  const dob = Math.hypot(u - OBSIDIAN.u, v - OBSIDIAN.v) / OBSIDIAN.r;
  if (dob < 1.2) h += (1 - smooth(0, 1.2, dob)) * (24 + 40 * Math.abs(fbm(u * 0.02, v * 0.02, 76) - 0.5) * 2) * inland;
  // the Ironcrest mesas, cut by canyons
  const dol = Math.hypot(u - OUTLANDS.u, v - OUTLANDS.v) / OUTLANDS.r;
  if (dol < 1.25) {
    const mesa = (1 - smooth(0.7, 1.25, dol)) * (18 + 14 * smooth(0.45, 0.55, fbm(u * 0.012, v * 0.012, 77)));
    let cut = 0;
    for (const c of CANYONS) cut = Math.max(cut, 1 - smooth(10, 34, polyDist(c.map(([a, b]) => [a, b] as [number, number]), u, v)));
    h += mesa * (1 - cut * 0.92);
  }
  // a cliff behind every waterfall: the ground lifted in a lobe uphill of the lip, dropping sharply at it
  for (const fl of NR_FALLS) {
    const du = u - fl.u, dv = v - fl.v, back = -(du * Math.cos(fl.to) + dv * Math.sin(fl.to)), side = Math.abs(-du * Math.sin(fl.to) + dv * Math.cos(fl.to));
    if (back > -6 && back < 200 && side < 110) {
      // a headland: sheer at the lip, rounding off into the hills behind and to the sides
      const lift = fl.drop * smooth(-6, 3, back) * (1 - smooth(20 + 25 * fbm(dv * 0.03, du * 0.03, 88), 105, side)) * (1 - smooth(50, 200, back)) * (0.85 + 0.3 * fbm(u * 0.02, v * 0.02, 89));
      h = Math.max(h, 3 + lift);
    }
  }
  // the city, the districts and the base stand on graded ground
  const flat = (cu: number, cv: number, r: number, to: number) => { const t = 1 - smooth(r * 0.75, r * 1.15, Math.hypot(u - cu, v - cv)); h = h + (to - h) * t; };
  flat(CITY.u, CITY.v, CITY.r, 7);
  flat(SOUTHREACH.u, SOUTHREACH.v, SOUTHREACH.r, 8);
  flat(EASTPOINT.u, EASTPOINT.v, EASTPOINT.r, 6);
  flat(NOVA.u, NOVA.v, NOVA.r, 22);
  // the river and Emerald Lake
  // cut below the sea whatever the hills did: a channel with sloping banks, and the lake bowl
  const dr = polyDist(RIVER, u, v);
  const bank = smooth(8, 30, dr);
  h = h * bank + -2.2 * (1 - bank);
  const dl = Math.hypot(u - LAKE.u, v - LAKE.v) / (0.85 + 0.3 * fbm(u * 0.02, v * 0.02, 87));
  const shore = smooth(LAKE.r * 0.7, LAKE.r * 1.15, dl);
  h = h * shore + -3.5 * (1 - shore);
  return h;
}

export function nrCover(x: number, z: number, h: number, slope: number): Cover {
  const u = x - NR.x, v = z - NR.z;
  if (h < WATER) {
    const d = WATER - h;
    if (Math.hypot(u - LAKE.u, v - LAKE.v) < LAKE.r) return "lake";
    if (coastD(u, v) < 0) return "river";
    if (d < 2.2 && fbm(u * 0.05, v * 0.05, 78) > 0.44) return "reef";
    return d < 4 ? "shallow" : d < 12 ? "sea" : "deep";
  }
  if (h < WATER + 1.8) return "beach";
  if (inZone(u, v, CITY, 0.95)) return "urban";
  if (inZone(u, v, SOUTHREACH, 0.9)) return "town";
  if (inZone(u, v, EASTPOINT, 0.9)) return "urban";
  if (inZone(u, v, NOVA, 0.85)) return "town";
  if (Math.hypot(u - BEACH.u, v - BEACH.v) < 70 && h < WATER + 5) return "beach";
  // the Fracture Spire's corruption and the volcanic Obsidian Cliffs
  if (inZone(u, v, SPIRE, 1.1, 84)) return fbm(u * 0.04, v * 0.04, 79) > 0.55 ? "crystal" : "rift";
  if (inZone(u, v, OBSIDIAN, 1.05, 85)) { const dob = Math.hypot(u - OBSIDIAN.u, v - OBSIDIAN.v); return fbm(u * 0.05, v * 0.05, 80) > 0.62 ? "lava" : dob < OBSIDIAN.r * 0.55 ? "basalt" : "ash"; }
  // the Ironcrest Outlands
  if (inZone(u, v, OUTLANDS, 1.1, 86)) return slope > 0.9 ? "cliff" : fbm(u * 0.03, v * 0.03, 81) > 0.32 ? "sandstone" : "dirt";
  if (h > 95) return "snow";
  if (h > 70) return slope > 0.8 ? "rock" : "snow";
  if (slope > 1.1) return "cliff";
  if (h > 48) return slope > 0.6 ? "rock" : "scrub";
  // the Verdant Expanse: deep forest in the north-west; parkland and meadow elsewhere
  const verdant = smooth(0, 1, (-u - 150) / 300) * smooth(0, 1, (-v - 50) / 250);
  const n = fbm(u * 0.03, v * 0.03, 82);
  if (verdant > 0.3) return n > 0.4 ? "denseForest" : "forest";
  return n > 0.56 ? "forest" : n > 0.38 ? "grass" : "meadow";
}

/* ---------------- the features ---------------- */

type Rings = CartoFeatures["rings"];
const empty = () => ({ buildings: [] as CartoBuilding[], roads: [] as CartoRoad[], pavements: [] as CartoPavement[], rings: [] as Rings, pois: [] as CartoPoi[], areas: [] as CartoArea[] });

/** the districts of Nexus City (board names), each a cluster of towers of its own character */
const DISTRICTS: readonly { id: string; name: string; u: number; v: number; r: number; use: CartoBuilding["use"]; lo: number; hi: number; n: number; sub: string }[] = [
  { id: "core", name: "The Core", u: 30, v: -110, r: 70, use: "office", lo: 90, hi: 230, n: 14, sub: "Central Business District" },
  { id: "heights", name: "Aether Heights", u: -110, v: -150, r: 60, use: "apartment", lo: 70, hi: 170, n: 11, sub: "Luxury District" },
  { id: "westgate", name: "Westgate", u: -200, v: -50, r: 60, use: "apartment", lo: 18, hi: 60, n: 14, sub: "Residential District" },
  { id: "novahq", name: "NOVA HQ", u: -80, v: -30, r: 40, use: "civic", lo: 40, hi: 110, n: 6, sub: "Operator Command" },
  { id: "riverside", name: "Riverside", u: -150, v: 90, r: 60, use: "house", lo: 6, hi: 14, n: 18, sub: "Suburbs" },
  { id: "tech", name: "Tech Quarter", u: 170, v: -90, r: 55, use: "office", lo: 40, hi: 120, n: 10, sub: "R&D / Upgrades" },
  { id: "arena", name: "Arena District", u: 160, v: 40, r: 55, use: "entertainment", lo: 14, hi: 45, n: 7, sub: "Tournaments & Events" },
  { id: "ent", name: "Entertainment District", u: 40, v: 90, r: 55, use: "entertainment", lo: 20, hi: 80, n: 10, sub: "Nightlife · Clubs · Arena" },
];

export function nrFeatures(map: CartoMap): CartoFeatures {
  const f = empty(), rnd = rng(91);
  const P = (id: string, name: string, cat: CartoPoi["cat"], [x, z]: [number, number], rank: number, blurb: string) => f.pois.push({ id: `nr-${id}`, name, cat, x, z, rank, blurb });
  const A = (name: string, [x, z]: [number, number], kind: CartoArea["kind"], rank: number) => f.areas.push({ name, x, z, kind, rank });
  const dry = (u: number, v: number, m = 1.5) => nrHeight(...nr(u, v)) > WATER + m;

  // Nexus City: the districts round The Core, the Core Spire at its heart
  const [sx, sz] = nr(CITY.u + 30, CITY.v - 80);
  f.buildings.push({ x: sx, z: sz, hx: 30, hz: 30, yaw: 0, use: "civic", h: 1, m: 420, name: "Nexus Core Spire" });
  f.rings.push({ x: sx, z: sz + 72, r: 22, kind: "ring", name: "Core Plaza" });
  for (const d of DISTRICTS) {
    const [dx, dz] = nr(d.u, d.v);
    let placed = 0;
    for (let tries = 0; placed < d.n && tries < d.n * 30; tries++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * d.r;
      let u = d.u + Math.cos(a) * rr, v = d.v + Math.sin(a) * rr;
      const hx = d.use === "house" ? 5 + rnd() * 3 : 8 + rnd() * 7, hz = d.use === "house" ? 4 + rnd() * 3 : 7 + rnd() * 6;
      // inside the ring, buildings stand in the street grid's blocks (55 m, streets 6.4 m wide), clear of the kerbs
      if (Math.hypot(u - CITY.u, v - CITY.v) < CITY.r * 0.92) {
        const snap = (w: number, c: number, half: number) => { const b = Math.floor((w - c) / 55) * 55 + c + 27.5, room = Math.max(0, 27.5 - 3.2 - half - 2); return b + Math.max(-room, Math.min(room, w - b)); };
        u = snap(u, CITY.u, hx); v = snap(v, CITY.v, hz);
      }
      const [x, z] = nr(u, v);
      if (!dry(u, v, 2.5)) continue;
      if (Math.hypot(x - sx, z - sz) < 62) continue;
      if (f.buildings.some((b) => Math.abs(b.x - x) < b.hx + hx + 6 && Math.abs(b.z - z) < b.hz + hz + 6)) continue;
      const t = rnd(), m = d.lo + (d.hi - d.lo) * t * t;
      f.buildings.push({ x, z, hx, hz, yaw: 0, use: d.use, h: Math.min(1, m / 120), m });
      placed++;
    }
    f.areas.push({ name: d.name, x: dx, z: dz - d.r * 0.2, kind: "district", rank: 1 });
  }
  // the Entertainment District's club hall (no casino in Nexus: owner, Nov 9 — Neon City has the only one) and the Arena
  // District's stadium and arena
  const [ex, ez] = nr(40, 120);
  f.buildings.push({ x: ex, z: ez, hx: 16, hz: 12, yaw: 0, use: "entertainment", h: 0.6, m: 64, name: "Nexus Live Hall" });
  const [ax, az] = nr(230, 60);
  f.rings.push({ x: ax, z: az, r: 20, kind: "arena", name: "Nexus Arena" });
  const [stx, stz] = nr(120, 150);
  f.rings.push({ x: stx, z: stz, r: 18, kind: "arena", name: "Nexus Stadium" });

  // the city's street grid: a block every 55 m inside the ring, the avenues' boulevards wider
  for (let g = -4; g <= 4; g++) {
    const off = g * 55, half = Math.sqrt(Math.max(0, (CITY.r * 0.92) ** 2 - off * off));
    if (half < 30) continue;
    const [px, pz] = nr(CITY.u + off, CITY.v), [qx, qz] = nr(CITY.u, CITY.v + off);
    f.pavements.push({ x: px, z: pz, hx: 3.2, hz: half, yaw: 0, kind: "street" }, { x: qx, z: qz, hx: half, hz: 3.2, yaw: 0, kind: "street" });
  }
  const [cpx, cpz] = nr(CITY.u + 30, CITY.v - 20);
  f.pavements.push({ x: cpx, z: cpz, hx: 24, hz: 24, yaw: 0, kind: "plaza" });
  // Nexus Beach's Ferris wheel
  const [wx, wz] = nr(BEACH.u + 70, BEACH.v - 40);
  f.buildings.push({ x: wx, z: wz, hx: 6, hz: 3, yaw: 0, use: "entertainment", h: 0.5, m: 40, name: "Nexus Beach Wheel" });
  // the ring road round the city and the avenues out to every district of the region
  const ring: [number, number][] = [];
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; ring.push(nr(CITY.u + Math.cos(a) * 250, CITY.v + Math.sin(a) * 215)); }
  f.roads.push({ cls: "highway", pts: ring, width: 10, name: "Nexus Ring" });
  const avenue = (name: string, cls: CartoRoad["cls"], w: number, pts: [number, number][]) => f.roads.push({ cls, pts: pts.map(([u, v]) => nr(u, v)), width: w, name });
  avenue("Central Avenue", "main", 9, [[30, -270], [30, -40], [50, 140], [60, 240]]);
  avenue("Crosstown", "main", 8, [[-250, -30], [-60, -30], [120, -20], [250, -10]]);
  avenue("West Highway", "highway", 9, [[-250, -30], [-420, 40], [-560, 110], [-760, 150]]);
  avenue("Southreach Road", "highway", 9, [[-120, 190], [-230, 280], [-330, 350]]);
  avenue("East Highway", "highway", 9, [[250, -10], [420, -20], [560, -20], [700, -10]]);
  avenue("Coast Road", "main", 7, [[60, 240], [200, 230], [340, 215], [470, 200], [600, 260], [720, 340], [790, 380]]);
  avenue("Ridge Road", "main", 6, [[-60, -230], [-130, -360], [-120, -480], [-60, -560]]);
  avenue("NOVA Road", "main", 7, [[60, -230], [180, -300], [260, -340]]);
  avenue("Obsidian Haul", "track", 6, [[560, -20], [600, -140], [640, -250], [660, -330]]);
  avenue("Verdant Trail", "trail", 3, [[-250, -60], [-380, -120], [-470, -200], [-520, -320], [-600, -400]]);
  avenue("Spire Track", "trail", 3, [[300, -380], [400, -430], [500, -470]]);
  avenue("River Bridge", "bridge", 9, [[-300, -30], [-340, -34]]);
  avenue("Keys Causeway", "bridge", 6, [[150, 255], [175, 350]]);
  avenue("Keys Bridge", "bridge", 5, [[230, 440], [290, 465]]);
  avenue("Keys Ferry", "ferry", 2, [[80, 275], [80, 490]]);
  f.roads.push({ cls: "rail", pts: [nr(-200, -60), nr(0, -60), nr(200, -60), nr(600, -40)], width: 3, name: "Nexus Maglev", color: "#8a5cff" });

  // Nexus Harbor: quays, cranes, warehouses; Nexus Marina's piers
  const [hx, hz] = nr(HARBOR.u, HARBOR.v - 20);
  f.pavements.push({ x: hx, z: hz, hx: 70, hz: 18, yaw: 0, kind: "apron" });
  for (let i = 0; i < 6; i++) f.buildings.push({ x: hx - 55 + i * 22, z: hz - 8, hx: 8, hz: 6, yaw: 0, use: "industrial", h: 0.2, m: 9 + rnd() * 5 });
  for (let k = 0; k < 4; k++) f.roads.push({ cls: "boardwalk", pts: [nr(-20 + k * 30, 262), nr(-20 + k * 30, 300)], width: 3, ...(k === 1 ? { name: "Nexus Harbor piers" } : {}) });
  f.rings.push({ x: hx, z: hz + 50, r: 34, kind: "dock", name: "Nexus Harbor" });
  for (let k = 0; k < 4; k++) f.roads.push({ cls: "boardwalk", pts: [nr(330 + k * 20, 236), nr(330 + k * 20, 266)], width: 2.5 });
  f.rings.push({ x: nr(360, 260)[0], z: nr(360, 260)[1], r: 24, kind: "dock", name: "Nexus Marina" });
  // Nexus Beach: the boardwalk, courts and the pier
  const [bx, bz] = nr(BEACH.u, BEACH.v - 30);
  f.pavements.push({ x: bx, z: bz, hx: 60, hz: 4, yaw: 0, kind: "street" });
  for (let i = 0; i < 6; i++) f.buildings.push({ x: bx - 50 + i * 20, z: bz - 14, hx: 6, hz: 5, yaw: 0, use: i % 2 ? "store" : "entertainment", h: 0.1, m: 6 + rnd() * 6 });
  for (let i = 0; i < 3; i++) f.pavements.push({ x: bx - 30 + i * 20, z: bz - 34, hx: 8, hz: 4.5, yaw: 0, kind: "plaza" });
  // the Azure Keys resorts: villas round each isle, a bridge between them
  for (const k of KEYS) {
    const n = Math.round(k.r / 12);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, [x, z] = nr(k.u + Math.cos(a) * k.r * 0.5, k.v + Math.sin(a) * k.r * 0.5);
      if (nrHeight(x, z) > WATER + 1) f.buildings.push({ x, z, hx: 4, hz: 3.5, yaw: a, use: "house", h: 0.1, m: 5 + rnd() * 3 });
    }
  }
  const k0 = KEYS[0]!, [kx, kz] = nr(k0.u, k0.v);
  f.buildings.push({ x: kx, z: kz, hx: 12, hz: 8, yaw: 0.2, use: "entertainment", h: 0.35, m: 22, name: "Azure Keys Resort" });

  // Southreach: Nexus Defense HQ, the Training Grounds, Forward Base S-7
  const [sr, srz] = nr(SOUTHREACH.u, SOUTHREACH.v);
  f.buildings.push({ x: sr, z: srz, hx: 22, hz: 14, yaw: 0, use: "civic", h: 0.4, m: 28, name: "Nexus Defense HQ" });
  for (let i = 0; i < 8; i++) f.buildings.push({ x: sr - 70 + (i % 4) * 40, z: srz + 40 + Math.floor(i / 4) * 24, hx: 12, hz: 6, yaw: 0, use: "industrial", h: 0.15, m: 6 });
  f.rings.push({ x: sr + 70, z: srz - 30, r: 16, kind: "pad", name: "Southreach helipads" });
  f.rings.push({ x: nr(-300, 330)[0], z: nr(-300, 330)[1], r: 30, kind: "fence", name: "Training Grounds" });
  f.pavements.push({ x: nr(-450, 300)[0], z: nr(-450, 300)[1], hx: 90, hz: 8, yaw: -0.4, kind: "apron" });
  f.roads.push({ cls: "runway", pts: [nr(-540, 340), nr(-360, 260)], width: 14, name: "Southreach Airfield" });

  // Eastpoint: steelworks, logistics, the refinery
  const [epx, epz] = nr(EASTPOINT.u, EASTPOINT.v);
  for (let i = 0; i < 14; i++) {
    const u = EASTPOINT.u - 90 + (i % 5) * 45 + (rnd() - 0.5) * 8, v = EASTPOINT.v - 60 + Math.floor(i / 5) * 50 + (rnd() - 0.5) * 8;
    if (dry(u, v, 2)) f.buildings.push({ x: nr(u, v)[0], z: nr(u, v)[1], hx: 12 + rnd() * 8, hz: 8 + rnd() * 6, yaw: 0, use: "industrial", h: 0.3, m: 10 + rnd() * 22, ...(i === 2 ? { name: "Nexus Steelworks" } : i === 9 ? { name: "Logistics Center" } : {}) });
  }
  // NOVA Research Complex: the main facility's domes and labs
  const [nx, nz] = nr(NOVA.u, NOVA.v);
  f.rings.push({ x: nx, z: nz, r: 16, kind: "dome", name: "NOVA Research Complex" }, { x: nx - 36, z: nz + 14, r: 10, kind: "dome" }, { x: nx + 34, z: nz + 16, r: 9, kind: "dome" });
  for (let i = 0; i < 5; i++) f.buildings.push({ x: nx - 40 + i * 20, z: nz - 34, hx: 7, hz: 5, yaw: 0, use: "civic", h: 0.25, m: 10 + rnd() * 10 });
  // Lighthouse Point, the Obsidian mine and refinery, the summit and frost stations, Mossveil Village, Eldergrove Ruins
  const [lx, lz] = nr(LIGHT.u, LIGHT.v);
  f.buildings.push({ x: lx, z: lz, hx: 3, hz: 3, yaw: 0, use: "transport", h: 0.6, m: 30, name: "Lighthouse Point" });
  f.buildings.push({ x: nr(600, -300)[0], z: nr(600, -300)[1], hx: 10, hz: 8, yaw: 0.3, use: "industrial", h: 0.3, m: 14, name: "Refinery Alpha" });
  f.buildings.push({ x: nr(-40, -600)[0], z: nr(-40, -600)[1], hx: 6, hz: 6, yaw: 0, use: "civic", h: 0.3, m: 12, name: "Summit Observatory" });
  f.buildings.push({ x: nr(150, -520)[0], z: nr(150, -520)[1], hx: 6, hz: 4, yaw: 0.2, use: "civic", h: 0.2, m: 8, name: "Frostwatch Station" });
  for (let i = 0; i < 9; i++) { const [x, z] = nr(-380 + (i % 3) * 16, -250 + Math.floor(i / 3) * 14); f.buildings.push({ x, z, hx: 4, hz: 3.5, yaw: 0.2, use: "house", h: 0.1, m: 5 }); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, [x, z] = nr(-560 + Math.cos(a) * 18, -330 + Math.sin(a) * 18); f.buildings.push({ x, z, hx: 4, hz: 2, yaw: a, use: "civic", h: 0.1, m: 4 }); }
  // Ironcrest: Dustwind Fort, the Abandoned Relay
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4, [x, z] = nr(-560 + Math.cos(a) * 14, 250 + Math.sin(a) * 14); f.buildings.push({ x, z, hx: 7, hz: 2, yaw: a, use: "civic", h: 0.12, m: 5 }); }
  f.buildings.push({ x: nr(-560, 120)[0], z: nr(-560, 120)[1], hx: 3, hz: 3, yaw: 0, use: "transport", h: 0.6, m: 26, name: "Abandoned Relay" });
  // the Fracture Spire: the corrupted needle at the zone's heart
  const [fx, fz] = nr(SPIRE.u, SPIRE.v);
  f.buildings.push({ x: fx, z: fz, hx: 7, hz: 7, yaw: 0.6, use: "dome", h: 1, m: 70, name: "The Fracture Spire" });
  f.rings.push({ x: fx, z: fz, r: 60, kind: "hazard", name: "Fracture Zone" });

  // the board's places
  P("city", "Nexus City", "landmark", nr(CITY.u, CITY.v), 0, "The capital and central hub: Lv 1–60+.");
  P("core", "The Core", "spire", [sx, sz + 72], 0, "The Central Business District under the Nexus Core Spire.");
  P("heights", "Aether Heights", "village", nr(-110, -150), 1, "The luxury district: penthouse towers over the river.");
  P("westgate", "Westgate", "village", nr(-200, -50), 1, "Residential district on the west bank.");
  P("novahq", "NOVA HQ", "civic", nr(-80, -30), 1, "Operator Command.");
  P("riverside", "Riverside", "village", nr(-150, 90), 1, "Suburbs and housing along the river.");
  P("tech", "Tech Quarter", "civic", nr(170, -90), 1, "R&D and upgrades.");
  P("arena", "Arena District", "arena", [ax, az], 1, "Tournaments and events at the Nexus Arena.");
  P("stadium", "Nexus Stadium", "arena", [stx, stz], 2, "Sports, tournaments, events.");
  P("ent", "Entertainment District", "entertainment", nr(40, 90), 1, "Nightlife, clubs and the arena.");
  P("livehall", "Nexus Live Hall", "nightclub", [ex, ez], 2, "Nightclub and rooftop concert venue.");
  P("harbor", "Nexus Harbor", "port", nr(HARBOR.u, HARBOR.v + 10), 0, "Trade and shipping: Lv 5–40.");
  P("marina", "Nexus Marina", "dock", nr(360, 255), 2, "Yachts and charters.");
  P("beach", "Nexus Beach", "park", nr(BEACH.u, BEACH.v), 0, "Recreation and sports: Lv 1–25.");
  P("keys", "Azure Keys", "village", nr(k0.u - 30, k0.v + 10), 0, "Isles and resorts: island housing, leisure, fishing. Lv 10–40.");
  P("light", "Lighthouse Point", "viewpoint", [lx, lz], 1, "Coastal Watch: Lv 10–30.");
  P("eastpoint", "Eastpoint", "village", [epx, epz], 0, "The industrial zone: Lv 20–45.");
  P("steel", "Nexus Steelworks", "outpost", nr(EASTPOINT.u - 0, EASTPOINT.v - 60), 2, "Furnaces and rolling mills.");
  P("logistics", "Logistics Center", "outpost", nr(EASTPOINT.u + 30, EASTPOINT.v + 40), 2, "The region's freight yards.");
  P("obsidian", "Obsidian Cliffs", "lava", nr(OBSIDIAN.u, OBSIDIAN.v), 0, "Mining and resources: Lv 25–50.");
  P("mine", "Obsidian Mine", "cave", nr(560, -220), 2, "Black glass from the cliffs.");
  P("refinery", "Refinery Alpha", "outpost", nr(600, -300), 2, "Ore refined for the city.");
  P("quarry", "Blackstone Quarry", "cave", nr(690, -160), 2, "Open-cut stone.");
  P("nova", "NOVA Research Complex", "research", [nx, nz], 0, "The main facility: story, upgrades, tech. Lv 20–50.");
  P("spire", "The Fracture Spire", "spire", [fx, fz], 0, "The endgame zone: Lv 50+.");
  P("gate", "Fracture Gate", "hazard", nr(560, -560), 2, "Where the corruption breaks through.");
  P("ridge", "Aether Ridge", "peak", nr(-90, -640), 0, "The mountain range: Lv 35–60.");
  P("observatory", "Summit Observatory", "viewpoint", nr(-40, -580), 2, "Telescopes over the whole region.");
  P("frostwatch", "Frostwatch Station", "outpost", nr(150, -520), 2, "A weather and watch post in the snow.");
  P("monolith", "Aether Monolith", "landmark", nr(-200, -520), 2, "A standing stone humming with power.");
  P("crater", "Skyline Crater", "cave", nr(CRATER.u, CRATER.v), 2, "A dungeon in the crater floor.");
  P("verdant", "Verdant Expanse", "park", nr(-470, -300), 0, "The forest zone: Lv 10–35.");
  P("eldergrove", "Eldergrove Ruins", "ruins", nr(-560, -330), 2, "Old stones in the deep wood.");
  P("wilds", "Verdant Wilds", "park", nr(-400, -380), 2, "Untamed forest.");
  for (const fl of NR_FALLS) P(`falls-${fl.id}`, fl.name, "falls", nr(fl.u, fl.v), fl.id === "whisper" ? 1 : 2, "Water off the cliffs.");
  P("lake", "Emerald Lake", "lake", nr(LAKE.u, LAKE.v), 1, "Clear green water under the forest.");
  P("mossveil", "Mossveil Village", "village", nr(-365, -236), 2, "A hamlet on the forest edge.");
  P("ironcrest", "Ironcrest Outlands", "camp", nr(OUTLANDS.u, OUTLANDS.v), 0, "Rugged wilderness: Lv 15–40.");
  P("redrock", "Redrock Canyon", "landmark", nr(-700, 50), 2, "Red walls and a dry river bed.");
  P("relay", "Abandoned Relay", "ruins", nr(-560, 120), 2, "A silent mast on the mesa.");
  P("ravine", "Ravine Ruins", "ruins", nr(-650, 220), 2, "A settlement swallowed by the canyon.");
  P("dustwind", "Dustwind Fort", "outpost", nr(-560, 250), 2, "A walled outpost on the canyon rim.");
  P("southreach", "Southreach", "outpost", [sr, srz - 20], 0, "Military and security: Lv 30–55.");
  P("defense", "Nexus Defense HQ", "civic", [sr, srz], 1, "Nexus Security's command.");
  P("training", "Training Grounds", "camp", nr(-300, 330), 2, "Ranges and courses.");
  P("forward", "Forward Base S-7", "outpost", nr(-330, 430), 2, "The coast's forward post.");

  A("Nexus Region", nr(0, -NR.reach * 0.86), "sea", 0);
  A("Aether Ridge", nr(-40, -560), "mountain", 0);
  A("Verdant Expanse", nr(-470, -260), "forest", 0);
  A("Ironcrest Outlands", nr(OUTLANDS.u, OUTLANDS.v - 40), "desert", 0);
  A("The Fracture Spire", nr(SPIRE.u, SPIRE.v - 60), "hazard", 0);
  A("Obsidian Cliffs", nr(OBSIDIAN.u, OBSIDIAN.v - 30), "lava", 1);
  A("Southreach", nr(SOUTHREACH.u, SOUTHREACH.v - 60), "district", 1);
  A("Eastpoint", nr(EASTPOINT.u, EASTPOINT.v - 60), "district", 1);
  A("Nexus City", nr(CITY.u, CITY.v + 40), "city", 0);
  A("Azure Keys", nr(260, 500), "sea", 1);
  A("Nexus Bay", nr(200, 330), "sea", 1);
  return f;
}

const NR_MAP: CartoMap = { id: "nexus-region", name: "Nexus Region", sub: "Central continent · capital and its lands", kind: "region", x: NR.x, z: NR.z, reach: NR.reach, regionId: "nexus" };
export const NEXUS_REGION: NewLand = {
  map: NR_MAP,
  source: { height: (x, z) => nrHeight(x, z) + WATER_LEVEL, cover: (x, z, h, s) => nrCover(x, z, h - WATER_LEVEL, s) },
  features: () => nrFeatures(NR_MAP),
};
