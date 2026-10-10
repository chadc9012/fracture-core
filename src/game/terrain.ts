import { CRASH_SITE, trailMask } from "./verdant";
import { forestRelief, IMPACT_PIT } from "./forest-relief";
import { REGIONS, WORLD_RADIUS } from "./world";
import { LANES, laneSamples } from "./lanes";
import { buildWaterNetwork, carveTarget, type RiverPoint, type WaterNetwork } from "./rivers";

/* ------------------------------------------------------------------
 * Heightmap: seeded value noise (fbm) + per-region biome profiles.
 * heightAt() is the single source of truth — the mesh, prop scatter,
 * the player, vehicles and AI all sample the same function.
 * ------------------------------------------------------------------ */

export const WATER_LEVEL = -2.5;

function hash2(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = smooth(x - xi);
  const ty = smooth(y - yi);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

export function fbm(x: number, y: number, octaves = 4) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += vnoise(x * f, y * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.05;
  }
  return sum / norm;
}

function ridged(x: number, y: number) {
  return 1 - Math.abs(fbm(x, y, 3) * 2 - 1);
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** biome weight 1 at the region centre, 0 at the rim */
function weight(d: number, radius: number) {
  return 1 - smoothstep(0.15, 1.05, d / radius);
}

function naturalHeightAt(x: number, z: number): number {
  // rolling base terrain
  let h = fbm(x * 0.011, z * 0.011, 4) * 16 - 2;
  h += (fbm(x * 0.05 + 40, z * 0.05 - 20, 2) - 0.5) * 3;

  for (const r of REGIONS) {
    const d = Math.hypot(x - r.x, z - r.z);
    if (d > r.radius * 1.1) continue;
    const w = weight(d, r.radius);
    if (w <= 0) continue;

    switch (r.id) {
      case "frostspire": {
        // tall ridged mountain range
        const m = ridged(x * 0.02, z * 0.02);
        h = h * (1 - w) + w * (18 + m * 58);
        break;
      }
      case "ember": {
        // volcano cone with a crater
        const cone = Math.max(0, 1 - d / (r.radius * 0.85));
        const crater = smoothstep(0, 7, d);
        h = h * (1 - w) + w * (4 + cone * cone * 46 * crater + (1 - crater) * 20);
        break;
      }
      case "solara": {
        // dunes
        const dune = Math.sin(x * 0.06 + z * 0.02) * 3 + Math.sin(z * 0.09) * 2;
        h = h * (1 - w) + w * (5 + dune);
        break;
      }
      case "swamps": {
        // wet lowland, at/below water in places
        const wet = fbm(x * 0.07 - 12, z * 0.07 + 8, 3);
        h = h * (1 - w) + w * (-1.6 + wet * 4);
        break;
      }
      case "veridan": {
        h = h * (1 - w) + w * (3 + fbm(x * 0.03, z * 0.03, 3) * 8);
        break;
      }
      case "wastelands": {
        h = h * (1 - w) + w * (2.5 + (fbm(x * 0.04 + 9, z * 0.04, 3) - 0.5) * 6);
        break;
      }
      case "nexus": {
        // flat city plateau
        const pad = 1 - smoothstep(r.radius * 0.55, r.radius, d);
        h = h * (1 - w) + w * (7 * pad + h * (1 - pad) * 0.4 + 2);
        break;
      }
    }
  }

  // coastline: sink the terrain into the ocean at the world rim
  const d = Math.hypot(x, z);
  const coast = 1 - smoothstep(WORLD_RADIUS * 0.78, WORLD_RADIUS * 1.02, d);
  h = h * coast - (1 - coast) * 16;

  // Verdant Forest relief + the Fracture impact pit (forest-relief.ts); zero outside the forest
  h += forestRelief(x, z);
  return h;
}

/* ---------------- river beds + lake basins (rivers.ts) ---------------- */

const CARVE_CELL = 6;
const CARVE_RANGE = Math.ceil(WORLD_RADIUS * 1.2 / CARVE_CELL);
type CarveSeg = { a: RiverPoint; b: RiverPoint };
let network: WaterNetwork | null = null;
let carveCells: Map<number, CarveSeg[]> | null = null;

/** the traced rivers, waterfalls and lakes (built once on the uncarved heightmap) */
export function waterNetwork(): WaterNetwork {
  if (network) return network;
  network = buildWaterNetwork(naturalHeightAt, WATER_LEVEL);
  const cells = new Map<number, CarveSeg[]>();
  const reach = 6 + 7;
  for (const r of network.rivers) for (let i = 0; i < r.points.length - 1; i++) {
    const seg = { a: r.points[i]!, b: r.points[i + 1]! };
    const minX = Math.min(seg.a.x, seg.b.x) - reach, maxX = Math.max(seg.a.x, seg.b.x) + reach;
    const minZ = Math.min(seg.a.z, seg.b.z) - reach, maxZ = Math.max(seg.a.z, seg.b.z) + reach;
    for (let cx = Math.floor(minX / CARVE_CELL); cx <= Math.floor(maxX / CARVE_CELL); cx++)
      for (let cz = Math.floor(minZ / CARVE_CELL); cz <= Math.floor(maxZ / CARVE_CELL); cz++) {
        const key = (cx + CARVE_RANGE) * 4096 + (cz + CARVE_RANGE);
        let list = cells.get(key); if (!list) cells.set(key, (list = []));
        list.push(seg);
      }
  }
  carveCells = cells;
  return network;
}

/** nearest river centre-line info at (x,z), or null if no river is within carving reach */
export function riverAt(x: number, z: number): { dist: number; s: number; w: number; d: number } | null {
  if (!carveCells) waterNetwork();
  const list = carveCells!.get((Math.floor(x / CARVE_CELL) + CARVE_RANGE) * 4096 + (Math.floor(z / CARVE_CELL) + CARVE_RANGE));
  if (!list) return null;
  let best: { dist: number; s: number; w: number; d: number } | null = null;
  for (const { a, b } of list) {
    const ex = b.x - a.x, ez = b.z - a.z;
    const len2 = ex * ex + ez * ez || 1;
    const t = Math.min(1, Math.max(0, ((x - a.x) * ex + (z - a.z) * ez) / len2));
    const dist = Math.hypot(a.x + ex * t - x, a.z + ez * t - z);
    if (!best || dist < best.dist) best = { dist, s: a.s + (b.s - a.s) * t, w: a.w + (b.w - a.w) * t, d: a.d };
  }
  return best;
}

function rawHeightAt(x: number, z: number): number {
  let h = naturalHeightAt(x, z);
  const net = network ?? waterNetwork();
  const rv = riverAt(x, z);
  if (rv) h = carveTarget(h, rv.s, rv.w, rv.d, rv.dist);
  for (const l of net.lakes) {
    const d = Math.hypot(x - l.x, z - l.z);
    if (d < l.r) h = Math.min(h, l.level - 0.4 - (1 - d / l.r) ** 2 * 1.2);
  }
  return h;
}

/* ---------------- road grading ---------------- */

type GradePoint = { x: number; z: number; h: number };
const GRADE_CELL = 8;
const GRADE_RANGE = Math.ceil(WORLD_RADIUS * 1.2 / GRADE_CELL);
const GRADE_CORE = 5;
const GRADE_FADE = 14;
let gradePoints: GradePoint[] | null = null;
let gradeSegments: { a: GradePoint; b: GradePoint }[] | null = null;
let gradeNear: Uint8Array | null = null;

/** Smooth each supply route's centre-line height (moving average along the lane) so convoys and
 * players travel a graded road instead of every hillock; heightAt blends the verge toward it. */
function buildGrade() {
  const pts: GradePoint[] = [];
  const segs: { a: GradePoint; b: GradePoint }[] = [];
  for (const lane of LANES) {
    const start = pts.length;
    const raw = laneSamples(lane, 40).map((p) => ({ ...p, h: rawHeightAt(p.x, p.z) }));
    raw.forEach((p, i) => {
      let sum = 0, n = 0;
      for (let k = -5; k <= 5; k++) { const q = raw[i + k]; if (q) { sum += q.h; n++; } }
      pts.push({ x: p.x, z: p.z, h: sum / n });
    });
    for (let i = start; i < pts.length - 1; i++) segs.push({ a: pts[i]!, b: pts[i + 1]! });
  }
  const size = GRADE_RANGE * 2;
  const near = new Uint8Array(size * size);
  const reach = GRADE_FADE + GRADE_CELL;
  for (let cx = 0; cx < size; cx++) for (let cz = 0; cz < size; cz++) {
    const x = (cx - GRADE_RANGE + 0.5) * GRADE_CELL, z = (cz - GRADE_RANGE + 0.5) * GRADE_CELL;
    if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < reach)) near[cx * size + cz] = 1;
  }
  gradePoints = pts; gradeSegments = segs; gradeNear = near;
}

/** terrain height: the natural heightmap with supply-road corridors graded smooth */
export function heightAt(x: number, z: number): number {
  const raw = rawHeightAt(x, z);
  if (raw <= WATER_LEVEL) return raw;
  if (!gradePoints) buildGrade();
  const size = GRADE_RANGE * 2;
  const cx = Math.floor(x / GRADE_CELL) + GRADE_RANGE, cz = Math.floor(z / GRADE_CELL) + GRADE_RANGE;
  if (cx < 0 || cz < 0 || cx >= size || cz >= size || !gradeNear![cx * size + cz]) return raw;
  // nearest point on the graded centre-line polyline, height interpolated along the segment
  let best = Infinity, bh = raw;
  for (const sgm of gradeSegments!) {
    const ex = sgm.b.x - sgm.a.x, ez = sgm.b.z - sgm.a.z;
    const len2 = ex * ex + ez * ez || 1;
    const t = Math.min(1, Math.max(0, ((x - sgm.a.x) * ex + (z - sgm.a.z) * ez) / len2));
    const d = Math.hypot(sgm.a.x + ex * t - x, sgm.a.z + ez * t - z);
    if (d < best) { best = d; bh = sgm.a.h + (sgm.b.h - sgm.a.h) * t; }
  }
  const w = 1 - smoothstep(GRADE_CORE, GRADE_FADE, best);
  if (w <= 0) return raw;
  // a road never fills a river channel: inside the channel the carved bed wins (a bridge spans it)
  const rv = riverAt(x, z);
  const keep = rv ? 1 - smoothstep(rv.w + 0.5, rv.w + 3, rv.dist) : 0;
  const graded = raw + (Math.max(bh, WATER_LEVEL + 0.4) - raw) * w;
  return graded + (Math.min(raw, graded) - graded) * keep;
}

/* ---------------- road-over-river crossings ---------------- */

export type Crossing = { x: number; z: number; deck: number; road: number; dirX: number; dirZ: number; length: number; width: number; dry: boolean; resolved: boolean };
let crossings: Crossing[] | null = null;

/** every place a supply road meets a river or dry wash; resolved crossings get a bridge deck */
export function riverCrossings(): Crossing[] {
  if (crossings) return crossings;
  if (!gradePoints) buildGrade();
  const out: Crossing[] = [];
  for (const r of waterNetwork().rivers) {
    let hit: { p: RiverPoint; g: GradePoint; d: number; gi: number } | null = null;
    const flush = () => {
      if (!hit) return;
      const a = gradePoints![Math.max(0, hit.gi - 1)]!, b = gradePoints![Math.min(gradePoints!.length - 1, hit.gi + 1)]!;
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
      const deck = Math.max(hit.g.h, hit.p.s + 1.1);
      out.push({ x: hit.p.x, z: hit.p.z, deck, road: hit.g.h, dirX: dx / len, dirZ: dz / len, length: (hit.p.w + 4) * 2, width: 8, dry: r.dry, resolved: deck - hit.g.h < 2.5 });
      hit = null;
    };
    for (const p of r.points) {
      let best: { g: GradePoint; d: number; gi: number } | null = null;
      gradePoints!.forEach((g, gi) => { const d = Math.hypot(g.x - p.x, g.z - p.z); if (!best || d < best.d) best = { g, d, gi }; });
      const b = best as { g: GradePoint; d: number; gi: number } | null;
      if (b && b.d < GRADE_CORE + p.w) { if (!hit || b.d < hit.d) hit = { p, ...b }; }
      else flush();
    }
    flush();
  }
  crossings = out;
  return out;
}

/** bridge deck height at (x,z), or -Infinity off every deck */
export function deckAt(x: number, z: number): number {
  for (const c of riverCrossings()) {
    if (!c.resolved) continue;
    const dx = x - c.x, dz = z - c.z;
    const along = dx * c.dirX + dz * c.dirZ, across = -dx * c.dirZ + dz * c.dirX;
    if (Math.abs(along) < c.length / 2 && Math.abs(across) < c.width / 2) return c.deck;
  }
  return -Infinity;
}

/** ground height a walker stands on (water surface if submerged, bridge deck if on one) */
export function walkHeight(x: number, z: number) {
  return Math.max(WATER_LEVEL - 0.6, heightAt(x, z), deckAt(x, z));
}

/** terrain steepness 0..1 — used for traction and traversal cost */
export function slopeAt(x: number, z: number) {
  const e = 2.5;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.min(1, Math.hypot(dx, dz) / (e * 2.2));
}

/* ---------------- vertex colouring ---------------- */

const PALETTE = {
  deep: [0.03, 0.16, 0.28],
  shallow: [0.09, 0.35, 0.45],
  sand: [0.76, 0.66, 0.42],
  grass: [0.2, 0.44, 0.22],
  dirt: [0.36, 0.28, 0.17],
  rock: [0.36, 0.35, 0.34],
  snow: [0.93, 0.95, 1.0],
  ash: [0.14, 0.1, 0.09],
  lava: [0.85, 0.24, 0.05],
  swamp: [0.12, 0.22, 0.15],
} as const;

function mix(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  return [
    a[0]! + (b[0]! - a[0]!) * t,
    a[1]! + (b[1]! - a[1]!) * t,
    a[2]! + (b[2]! - a[2]!) * t,
  ];
}

/**
 * Slope masking (auto-material): flats keep their biome colour, mid slopes break into exposed
 * dirt, steep faces become cliff rock — no hand painting, and any deformed terrain re-masks itself.
 * `slope` is slopeAt()'s 0..1 steepness. Returns blend weights (each 0..1, rock wins over dirt).
 * Thresholds are tuned to this heightmap (slopeAt saturates near 42 degrees), not raw 30/45 degrees.
 */
export function slopeMask(slope: number): { dirt: number; rock: number } {
  return { dirt: smoothstep(0.22, 0.5, slope), rock: smoothstep(0.5, 0.85, slope) };
}

/** colour by elevation, then tinted by the dominant biome, then cliff-masked by slope */
export function colorAt(x: number, z: number, h: number): [number, number, number] {
  let c: [number, number, number];
  if (h < -6) c = [...PALETTE.deep];
  else if (h < WATER_LEVEL) c = mix(PALETTE.deep, PALETTE.shallow, (h + 6) / 6);
  else if (h < 1.6) c = mix(PALETTE.shallow, PALETTE.sand, Math.min(1, h / 1.6));
  else if (h < 12) c = mix(PALETTE.sand, PALETTE.grass, (h - 1.6) / 10.4);
  else if (h < 26) c = mix(PALETTE.grass, PALETTE.dirt, (h - 12) / 14);
  else if (h < 44) c = mix(PALETTE.dirt, PALETTE.rock, (h - 26) / 18);
  else c = mix(PALETTE.rock, PALETTE.snow, Math.min(1, (h - 44) / 18));

  for (const r of REGIONS) {
    const d = Math.hypot(x - r.x, z - r.z);
    if (d > r.radius * 1.1) continue;
    const w = weight(d, r.radius) * 0.85;
    if (w <= 0) continue;
    if (r.id === "solara") c = mix(c, PALETTE.sand, w);
    else if (r.id === "veridan") c = mix(c, PALETTE.grass, w * 0.9);
    else if (r.id === "swamps") c = mix(c, PALETTE.swamp, w);
    else if (r.id === "ember") {
      c = mix(c, PALETTE.ash, w);
      if (h > 34) c = mix(c, PALETTE.lava, smoothstep(34, 48, h) * 0.8);
    } else if (r.id === "frostspire") c = mix(c, PALETTE.snow, w * smoothstep(24, 48, h));
    else if (r.id === "wastelands") c = mix(c, [0.55, 0.44, 0.28], w * 0.8);
    else if (r.id === "nexus") c = mix(c, [0.2, 0.24, 0.3], w);
  }

  // slope mask: steep ground sheds its grass/snow for dirt then bare rock; underwater and the
  // shoreline keep their colour so beaches and sea floors do not turn to cliff
  if (h > 1.6) {
    const { dirt, rock } = slopeMask(slopeAt(x, z));
    const cliff = (fbm(x * 0.12, z * 0.12, 2) - 0.5) * 0.1; // strata variation
    c = mix(c, [PALETTE.dirt[0] + cliff, PALETTE.dirt[1] + cliff, PALETTE.dirt[2] + cliff], dirt * 0.75);
    c = mix(c, [PALETTE.rock[0] + cliff, PALETTE.rock[1] + cliff, PALETTE.rock[2] + cliff], rock * 0.9);
  }

  // Verdant trail: worn dirt along the path, scorched ground at the crash site
  const tm = trailMask(x, z);
  if (tm > 0) c = mix(c, [0.34, 0.27, 0.18], tm * 0.85);
  const crash = Math.hypot(x - CRASH_SITE.x, z - CRASH_SITE.z);
  if (crash < CRASH_SITE.radius) c = mix(c, [0.1, 0.1, 0.12], (1 - smoothstep(2, CRASH_SITE.radius, crash)) * 0.8);
  // freshly turned earth in and around the impact pit
  const pit = Math.hypot(x - IMPACT_PIT.x, z - IMPACT_PIT.z);
  if (pit < IMPACT_PIT.radius * 1.9) c = mix(c, [0.2, 0.15, 0.1], (1 - smoothstep(IMPACT_PIT.radius * 0.5, IMPACT_PIT.radius * 1.9, pit)) * 0.85);

  // a little noise so large surfaces never read as flat colour
  const n = (fbm(x * 0.35, z * 0.35, 2) - 0.5) * 0.08;
  return [
    Math.min(1, Math.max(0, c[0] + n)),
    Math.min(1, Math.max(0, c[1] + n)),
    Math.min(1, Math.max(0, c[2] + n)),
  ];
}
