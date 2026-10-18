/**
 * Neon City grind rails for Mag-Grind Boots (pure). Rails are polylines in local metres around the district centre
 * (north = −z). With the boots on, walking or falling within magnet range of a rail latches you onto it; you slide
 * along it, gaining speed, until the end (open rails) or until you jump off with the speed you built. Rails with a
 * fixed `y` ride the Grid's elevated transit deck; the others float a short way above the street.
 */
import { DECK } from "./neon-tiers";

export type Rail = { id: string; name: string; closed: boolean; /** [x, z, y|null] in local metres; y null = follow the ground */ pts: readonly (readonly [number, number, number | null])[] };
const RAIL_H = 1.1; // rail height above the surface it follows
const D = DECK.y + RAIL_H;

export const RAILS: readonly Rail[] = [
  { id: "grid-line", name: "Grid Line", closed: true, pts: [[-DECK.halfX, -DECK.halfZ, D], [DECK.halfX, -DECK.halfZ, D], [DECK.halfX, DECK.halfZ, D], [-DECK.halfX, DECK.halfZ, D]] },
  { id: "avenue-run", name: "Avenue Run", closed: false, pts: [[-34, 6, null], [-12, 6, null], [12, 6, null], [34, 6, null]] },
  { id: "undercity-slide", name: "Undercity Slide", closed: false, pts: [[-30, 20, null], [-10, 24, null], [10, 24, null], [30, 20, null]] },
  { id: "spire-approach", name: "Spire Approach", closed: false, pts: [[-6, -8, null], [-6, -20, null], [-6, -32, null]] },
];

export const MAG_RANGE = 2.2;          // horizontal reach of the magnets
export const MAG_VERTICAL = 1.8;       // how far above/below the rail your feet can be
export const GRIND_MIN_SPEED = 16;
export const GRIND_MAX_SPEED = 36;
export const GRIND_ACCEL = 4;
export const GRIND_COOLDOWN = 0.45;    // after leaving a rail, before you can latch again
export const JUMP_OFF_BOOST = 1.1;
export const JUMP_OFF_VY = 9;

export type WorldRail = { id: string; name: string; closed: boolean; pts: { x: number; z: number; y: number }[]; len: number[]; total: number };
/** Place the rails in the world. `groundAt` gives the walkable surface for rails that follow the ground. */
export function worldRails(center: { x: number; z: number }, groundAt: (x: number, z: number) => number, rails: readonly Rail[] = RAILS): WorldRail[] {
  return rails.map((r) => {
    const pts = r.pts.map(([x, z, y]) => ({ x: center.x + x, z: center.z + z, y: y ?? groundAt(center.x + x, center.z + z) + RAIL_H }));
    const len: number[] = [0];
    const n = r.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; len.push(len[i]! + Math.hypot(b.x - a.x, b.z - a.z)); }
    return { id: r.id, name: r.name, closed: r.closed, pts, len, total: len[len.length - 1]! };
  });
}

/** position and unit direction at distance s along a rail (wraps on closed rails, clamps on open ones) */
export function railAt(r: WorldRail, s: number): { x: number; y: number; z: number; tx: number; tz: number; atEnd: boolean } {
  const t = r.closed ? ((s % r.total) + r.total) % r.total : Math.max(0, Math.min(r.total, s));
  let i = 0;
  while (i < r.len.length - 2 && t > r.len[i + 1]!) i++;
  const a = r.pts[i]!, b = r.pts[(i + 1) % r.pts.length]!;
  const seg = r.len[i + 1]! - r.len[i]!, k = seg > 0 ? (t - r.len[i]!) / seg : 0;
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1;
  return { x: a.x + dx * k, z: a.z + dz * k, y: a.y + (b.y - a.y) * k, tx: dx / d, tz: dz / d, atEnd: !r.closed && (s <= 0 || s >= r.total) };
}

/** closest point on a rail to (x, z): distance along the rail and horizontal distance */
export function closestOnRail(r: WorldRail, x: number, z: number): { s: number; dist: number; y: number } {
  let best = { s: 0, dist: Infinity, y: 0 };
  const n = r.closed ? r.pts.length : r.pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = r.pts[i]!, b = r.pts[(i + 1) % r.pts.length]!;
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    const px = a.x + dx * k, pz = a.z + dz * k, dist = Math.hypot(x - px, z - pz);
    if (dist < best.dist) best = { s: r.len[i]! + Math.sqrt(l2) * k, dist, y: a.y + (b.y - a.y) * k };
  }
  return best;
}

export type GrindState = { railId: string | null; s: number; dir: 1 | -1; speed: number; cooldown: number };
export const createGrind = (): GrindState => ({ railId: null, s: 0, dir: 1, speed: 0, cooldown: 0 });
export const isGrinding = (g: GrindState) => g.railId !== null;

/** Try to latch onto the nearest rail in magnet range. Needs Mag-Grind Boots, the feet near rail height, and no cooldown. */
export function tryLatch(g: GrindState, rails: readonly WorldRail[], hasBoots: boolean, px: number, py: number, pz: number, vx: number, vz: number): boolean {
  if (!hasBoots || g.railId || g.cooldown > 0) return false;
  let best: { r: WorldRail; c: ReturnType<typeof closestOnRail> } | null = null;
  for (const r of rails) {
    const c = closestOnRail(r, px, pz);
    if (c.dist > MAG_RANGE || Math.abs(py - (c.y - RAIL_H)) > MAG_VERTICAL) continue;
    if (!best || c.dist < best.c.dist) best = { r, c };
  }
  if (!best) return false;
  const here = railAt(best.r, best.c.s);
  const sp = Math.hypot(vx, vz);
  g.railId = best.r.id; g.s = best.c.s;
  g.dir = sp > 1 && vx * here.tx + vz * here.tz < 0 ? -1 : 1; // keep going the way you were already heading
  g.speed = Math.max(GRIND_MIN_SPEED, Math.min(GRIND_MAX_SPEED, sp * 1.1));
  return true;
}

export type GrindStep = { x: number; y: number; z: number; vx: number; vz: number; ended: boolean };
/** Slide along the rail. `ended` when an open rail runs out. */
export function stepGrind(g: GrindState, rails: readonly WorldRail[], dt: number): GrindStep | null {
  g.cooldown = Math.max(0, g.cooldown - dt);
  if (!g.railId) return null;
  const r = rails.find((x) => x.id === g.railId);
  if (!r) { g.railId = null; return null; }
  g.speed = Math.min(GRIND_MAX_SPEED, g.speed + GRIND_ACCEL * dt);
  g.s += g.dir * g.speed * dt;
  const at = railAt(r, g.s);
  const vx = at.tx * g.dir * g.speed, vz = at.tz * g.dir * g.speed;
  if (at.atEnd) { g.railId = null; g.cooldown = GRIND_COOLDOWN; return { x: at.x, y: at.y, z: at.z, vx, vz, ended: true }; }
  return { x: at.x, y: at.y, z: at.z, vx, vz, ended: false };
}

/** Jump off: keep the rail's speed in the travelling direction and pop upward. */
export function leaveGrind(g: GrindState, rails: readonly WorldRail[]): { vx: number; vz: number; vy: number } | null {
  if (!g.railId) return null;
  const r = rails.find((x) => x.id === g.railId);
  const at = r ? railAt(r, g.s) : null;
  const speed = g.speed * JUMP_OFF_BOOST;
  g.railId = null; g.cooldown = GRIND_COOLDOWN;
  return at ? { vx: at.tx * g.dir * speed, vz: at.tz * g.dir * speed, vy: JUMP_OFF_VY } : { vx: 0, vz: 0, vy: JUMP_OFF_VY };
}
