/** The jungle-reclaimed city (owner's trailer, Video A 8–11 s: "Jungle-reclaimed city", listed as planned in
 * docs/trailer-references.md). It stands on Veridan's "Ancient Ruins" site ("Moss-eaten stones from before the trees"): the
 * shells of a pre-Fracture city block, concrete frames broken off at different heights, one leaning on its neighbour, vines
 * curtaining the facades, trees on the roofs and in the streets, rusted cars sunk in the old roadway, and one huge tree
 * cracking the central plaza.
 *
 * Pure layout: every tower and every stone piece is plain numbers (local to its tower), so it is tested without three.js.
 * Towers never stand on a road, river, mission pad, house, the forest trail or another named site, and the footprint keeps
 * clear of water and of other towers. */
import { heightAt, WATER_LEVEL } from "./terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";
import { placeable } from "./ground-cover";
import { isReserved } from "./verdant";
import { regionAt } from "./world";
import { mulberry32 } from "./rng";
import { siteById, SITES } from "./region-atlas";

export const CITY = {
  siteId: "vf-ruins",
  /** storey height (m) */
  storey: 3.4,
  /** street grid pitch (m between lot centres) */
  pitch: 17,
  /** open plaza radius around the site centre (the elder tree stands here) */
  plaza: 8,
  /** a tower may sink this much (m) on its downhill side before the slope rules it out */
  maxStep: 6,
  /** clearance kept around the forest trail, spawn clearing and crash pad (m) */
  trailMargin: 4,
} as const;

export type Tower = {
  x: number; z: number; yaw: number;
  /** footprint (m) along local x and z */
  w: number; d: number;
  /** intact storeys below the broken top */
  floors: number;
  /** the tower's foot (lowest ground under its footprint, a little below) */
  base: number;
  /** lean (rad) about its local x axis; one tower leans on its neighbour */
  lean: number;
  seed: number;
};
/** one stone piece in its tower's local frame: geometry key, centre, euler rotation, scale */
export type PieceKey = "slab" | "column" | "spandrel" | "panel" | "shard" | "rubble";
export type Piece = { g: PieceKey; x: number; y: number; z: number; rx: number; ry: number; rz: number; sx: number; sy: number; sz: number };
/** a vine curtain hanging from (x,y,z) in tower-local space, facing out along `yaw` */
export type Vine = { x: number; y: number; z: number; yaw: number; w: number; len: number };
/** a tree in world space; `y` is the ground (or roof) it grows from */
export type CityTree = { x: number; y: number; z: number; s: number; r: number; roof: boolean };
export type Wreck = { x: number; z: number; yaw: number };
export type City = { cx: number; cz: number; gridYaw: number; towers: Tower[]; trees: CityTree[]; wrecks: Wreck[] };

/** the geometry each piece key is cut from (the component builds these sizes once and scales instances) */
export const PIECE_SIZE: Record<PieceKey, readonly [number, number, number]> = {
  slab: [10, 0.4, 10],
  column: [0.9, CITY.storey, 0.9],
  spandrel: [4, 1.3, 0.32],
  /** a full-height infill wall between two floors (blank bays and end walls, so a shell reads as a building, not scaffolding) */
  panel: [4, CITY.storey - 0.4, 0.3],
  shard: [1, 1, 1],
  rubble: [1, 1, 1],
};

const rot = (x: number, z: number, a: number) => ({ x: x * Math.cos(a) + z * Math.sin(a), z: -x * Math.sin(a) + z * Math.cos(a) });

/** footprint corners and edge midpoints in world space (what the placement rules test) */
export function footprint(t: Pick<Tower, "x" | "z" | "yaw" | "w" | "d">, pad = 0): { x: number; z: number }[] {
  const hw = t.w / 2 + pad, hd = t.d / 2 + pad, out: { x: number; z: number }[] = [];
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0], [0, 0]] as const) {
    const p = rot(u * hw, v * hd, t.yaw);
    out.push({ x: t.x + p.x, z: t.z + p.z });
  }
  return out;
}

const otherSite = (x: number, z: number) => SITES.some((s) => s.id !== CITY.siteId && Math.hypot(s.x - x, s.z - z) < s.radius + 12);
function lotOk(t: Pick<Tower, "x" | "z" | "yaw" | "w" | "d">): boolean {
  const pts = footprint(t, 1.5);
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) {
    const h = heightAt(p.x, p.z);
    if (h < WATER_LEVEL + 1.5) return false;
    if (!placeable(p.x, p.z, "rock", regionAt(p.x, p.z))) return false;
    if (isReserved(p.x, p.z, CITY.trailMargin)) return false;
    if (distanceToRoad(p.x, p.z) < LANE_HALF_WIDTH + 4) return false;
    if (otherSite(p.x, p.z)) return false;
    lo = Math.min(lo, h); hi = Math.max(hi, h);
  }
  return hi - lo <= CITY.maxStep;
}

let cached: City | null | undefined;
/** the city block around the Ancient Ruins site (null if the site is missing) */
export function reclaimedCity(): City | null {
  if (cached !== undefined) return cached;
  const site = siteById(CITY.siteId);
  if (!site) return (cached = null);
  const rnd = mulberry32(7331), gridYaw = 0.35;
  const towers: Tower[] = [];
  // lots on a street grid, ringing the plaza; nearest lots first so the block stays tight around the site
  const lots: { u: number; v: number }[] = [];
  for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) if (u || v) lots.push({ u, v });
  lots.sort((a, b) => Math.hypot(a.u, a.v) - Math.hypot(b.u, b.v));
  for (const { u, v } of lots) {
    if (towers.length >= 9) break;
    const w = 8 + rnd() * 4, d = 8 + rnd() * 4, jx = (rnd() - 0.5) * 2, jz = (rnd() - 0.5) * 2;
    const p = rot(u * CITY.pitch + jx, v * CITY.pitch + jz, gridYaw);
    const t = { x: site.x + p.x, z: site.z + p.z, yaw: gridYaw + (rnd() - 0.5) * 0.08, w, d };
    if (Math.hypot(p.x, p.z) - Math.max(w, d) * 0.7 < CITY.plaza) continue;
    if (!lotOk(t)) continue;
    const base = Math.min(...footprint(t).map((q) => heightAt(q.x, q.z))) - 0.4;
    // inner towers stand taller: the skyline peaks around the plaza, as in the trailer shot
    const ring = Math.max(Math.abs(u), Math.abs(v));
    const floors = Math.max(2, Math.round((ring === 1 ? 5 : 3) + rnd() * 3));
    towers.push({ ...t, floors, base, lean: 0, seed: 101 + towers.length * 37 });
  }
  // the tallest tower leans a few degrees (the trailer's tilted shell)
  if (towers.length) {
    const tall = towers.reduce((a, b) => (b.floors > a.floors ? b : a));
    tall.lean = 0.09;
  }
  const trees: CityTree[] = [];
  const cy = heightAt(site.x, site.z);
  trees.push({ x: site.x, y: cy, z: site.z, s: 2.1, r: 0.7, roof: false }); // the elder tree cracking the plaza
  // street trees between the lots (on open ground, never inside a footprint)
  for (let k = 0, guard = 0; k < 10 && guard < 200; guard++) {
    const a = rnd() * Math.PI * 2, dd = CITY.plaza + 3 + rnd() * CITY.pitch * 2.2, x = site.x + Math.cos(a) * dd, z = site.z + Math.sin(a) * dd;
    if (towers.some((t) => insideTower(t, x, z, 2))) continue;
    if (!placeable(x, z, "bush", regionAt(x, z)) || isReserved(x, z, 2) || heightAt(x, z) < WATER_LEVEL + 1.5) continue;
    if (trees.some((q) => Math.hypot(q.x - x, q.z - z) < 6)) continue;
    trees.push({ x, y: heightAt(x, z), z, s: 0.9 + rnd() * 0.7, r: rnd() * 6.28, roof: false }); k++;
  }
  // trees rooted on the broken roofs (on every tower that is not leaning)
  for (const t of towers) {
    if (t.lean) continue;
    const top = t.base + t.floors * CITY.storey, p = rot((rnd() - 0.5) * t.w * 0.4, (rnd() - 0.5) * t.d * 0.4, t.yaw);
    trees.push({ x: t.x + p.x, y: top + 0.2, z: t.z + p.z, s: 0.45 + rnd() * 0.3, r: rnd() * 6.28, roof: true });
  }
  // rusted cars sunk along the old streets (the gaps between lot rows)
  const wrecks: Wreck[] = [];
  for (let k = 0, guard = 0; k < 4 && guard < 80; guard++) {
    const along = (rnd() - 0.5) * CITY.pitch * 3.5, across = (rnd() < 0.5 ? -0.5 : 0.5) * CITY.pitch, flip = rnd() < 0.5;
    const p = rot(flip ? across : along, flip ? along : across, gridYaw), x = site.x + p.x, z = site.z + p.z;
    if (towers.some((t) => insideTower(t, x, z, 3)) || Math.hypot(x - site.x, z - site.z) < CITY.plaza + 2) continue;
    if (!placeable(x, z, "rock", regionAt(x, z)) || isReserved(x, z, 3) || heightAt(x, z) < WATER_LEVEL + 1) continue;
    if (wrecks.some((q) => Math.hypot(q.x - x, q.z - z) < 7)) continue;
    wrecks.push({ x, z, yaw: gridYaw + (flip ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.7 }); k++;
  }
  return (cached = { cx: site.x, cz: site.z, gridYaw, towers, trees, wrecks });
}

/** is (x,z) inside a tower's footprint (grown by `margin`)? */
export function insideTower(t: Pick<Tower, "x" | "z" | "yaw" | "w" | "d">, x: number, z: number, margin = 0): boolean {
  const l = rot(x - t.x, z - t.z, -t.yaw);
  return Math.abs(l.x) <= t.w / 2 + margin && Math.abs(l.z) <= t.d / 2 + margin;
}
/** vegetation and scatter keep out of the shells (and the plaza's elder tree) */
export function inReclaimedCity(x: number, z: number, margin = 1): boolean {
  const c = reclaimedCity();
  if (!c || Math.hypot(x - c.cx, z - c.cz) > CITY.pitch * 3.5) return false;
  if (Math.hypot(x - c.cx, z - c.cz) < 3 + margin) return true;
  return c.towers.some((t) => insideTower(t, x, z, margin));
}

/** collision circles filling each footprint (the player, vehicles and the camera stop at the shells) */
export function citySolids(c: City | null = reclaimedCity()): { x: number; z: number; r: number }[] {
  if (!c) return [];
  const out: { x: number; z: number; r: number }[] = [];
  for (const t of c.towers) {
    const nx = Math.max(2, Math.round(t.w / 2.2)), nz = Math.max(2, Math.round(t.d / 2.2));
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const p = rot(-t.w / 2 + 1.1 + (i * (t.w - 2.2)) / (nx - 1), -t.d / 2 + 1.1 + (k * (t.d - 2.2)) / (nz - 1), t.yaw);
      out.push({ x: t.x + p.x, z: t.z + p.z, r: 1.5 });
    }
  }
  out.push({ x: c.cx, z: c.cz, r: 1.6 }); // the elder tree's trunk
  return out;
}

/** every stone piece of one tower, local to its foot: floor slabs, a column grid per storey, spandrel bands between the
 * window rows (some fallen out), a broken top of jagged column stumps and a half-collapsed last slab, rubble at the base */
export function towerPieces(t: Tower): Piece[] {
  const r = mulberry32(t.seed), S = CITY.storey, out: Piece[] = [];
  const P = (g: PieceKey, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => out.push({ g, x, y, z, rx, ry, rz, sx, sy, sz });
  const nx = t.w > 10 ? 3 : 2, nz = t.d > 10 ? 3 : 2;
  const colX = Array.from({ length: nx + 1 }, (_, i) => -t.w / 2 + 0.4 + (i * (t.w - 0.8)) / nx);
  const colZ = Array.from({ length: nz + 1 }, (_, i) => -t.d / 2 + 0.4 + (i * (t.d - 0.8)) / nz);
  const [SW, , SD] = PIECE_SIZE.slab, [SPW] = PIECE_SIZE.spandrel;
  for (let f = 0; f < t.floors; f++) {
    // columns of this storey (an upper column has occasionally fallen)
    for (const cx of colX) for (const cz of colZ) {
      const edge = cx === colX[0] || cx === colX[nx] || cz === colZ[0] || cz === colZ[nz];
      if (!edge && f > 0 && r() < 0.5) continue; // the interior is mostly gutted
      if (f > 1 && r() < 0.06) continue;
      P("column", cx, f * S + S / 2, cz);
    }
    // the slab above this storey
    P("slab", 0, (f + 1) * S, 0, t.w / SW, 1, t.d / SD, (r() - 0.5) * 0.01, 0, (r() - 0.5) * 0.01);
    // each bay of each face: a blank infill wall (end walls mostly), a window band (spandrel under the slab), or gone
    for (const side of [0, 1, 2, 3]) {
      const along = side % 2 ? t.d : t.w, n = Math.max(1, Math.round(along / SPW)), seg = along / n;
      const blank = side % 2 ? 0.6 : 0.22;
      for (let i = 0; i < n; i++) {
        const roll = r();
        if (roll < 0.1 + f * 0.025) continue; // fallen out
        const a = -along / 2 + seg * (i + 0.5), out_ = (side % 2 ? t.w : t.d) / 2 + 0.05;
        const [x, z] = side === 0 ? [a, -out_] : side === 1 ? [out_, a] : side === 2 ? [a, out_] : [-out_, a];
        const ry = side % 2 ? Math.PI / 2 : 0, sx = (seg / SPW) * 0.98;
        if (roll > 1 - blank) {
          // a blank wall; now and then only its lower half still stands
          const half = r() < 0.2 ? 0.55 : 1, ph = PIECE_SIZE.panel[1];
          P("panel", x, f * S + 0.2 + (ph * half) / 2, z, sx, half, 1, 0, ry, 0);
        } else P("spandrel", x, (f + 1) * S - 0.75, z, sx, 1, 1, 0, ry, (r() - 0.5) * 0.03);
      }
    }
  }
  // the broken top: jagged stumps of the next storey's edge columns with chunks on them, and a slab slumped at one corner
  const top = t.floors * S;
  for (const cx of colX) for (const cz of colZ) {
    const edge = cx === colX[0] || cx === colX[nx] || cz === colZ[0] || cz === colZ[nz];
    if (!edge || r() < 0.65) continue; // most edge columns snapped off at the slab; a few stumps stand on
    const h = 0.3 + r() * 1.2;
    P("column", cx, top + (S * h) / 2, cz, 1, h, 1, (r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.08);
    P("shard", cx + (r() - 0.5) * 0.3, top + S * h + 0.2, cz + (r() - 0.5) * 0.3, 0.8 + r() * 0.5, 0.5 + r() * 0.6, 0.6 + r() * 0.4, r() * 0.8, r() * 3, r() * 0.8);
  }
  const fx = r() < 0.5 ? -1 : 1, fz = r() < 0.5 ? -1 : 1;
  P("slab", fx * t.w * 0.18, top + S * 0.55, fz * t.d * 0.18, (t.w * 0.55) / SW, 1, (t.d * 0.5) / SD, fz * 0.32, 0, -fx * 0.28);
  // rubble heaped at the foot
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, s = 0.6 + r() * 1.3;
    P("rubble", Math.cos(a) * (t.w / 2 + 0.6 + r() * 2.5), 0.4 + s * 0.2, Math.sin(a) * (t.d / 2 + 0.6 + r() * 2.5), s, s * 0.7, s, r(), r() * 6, r());
  }
  return out;
}

/** vine curtains hanging down each facade from a slab edge, in tower-local space */
export function towerVines(t: Tower): Vine[] {
  const r = mulberry32(t.seed + 9), out: Vine[] = [], S = CITY.storey;
  for (const side of [0, 1, 2, 3]) {
    const along = side % 2 ? t.d : t.w, off = (side % 2 ? t.w : t.d) / 2 + 0.35;
    const n = 3 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const a = (r() - 0.5) * (along - 2), from = 1 + Math.floor(r() * t.floors), y = from * S + 0.1;
      const len = Math.min(y - 0.2, 3 + r() * from * S * 0.9), w = 1.6 + r() * 2.4;
      const [x, z] = side === 0 ? [a, -off] : side === 1 ? [off, a] : side === 2 ? [a, off] : [-off, a];
      const yaw = side === 0 ? Math.PI : side === 1 ? Math.PI / 2 : side === 2 ? 0 : -Math.PI / 2;
      out.push({ x, y, z, yaw, w, len });
    }
  }
  return out;
}
