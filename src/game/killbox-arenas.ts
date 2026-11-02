/** Killbox arena maps (owner's Killbox maps & modes doc, Nov 1 2026). An arena is a hand-built map in its own space: in the lore the
 * simulation runs the Killbox as a stress test on "echo copies" of real places, so each one hangs at ARENA_ALTITUDE over an empty
 * stretch of the world (like the pocket rooms at INTERIOR_ALTITUDE) and the open world is hidden while you play it.
 *
 * Everything walkable is a district deck (district-decks.ts), so terrain.walkHeight, the player, rivals and squadmates all agree.
 * Ledges and parapets are walls (walls.ts) — the player auto-steps onto any higher deck, so a ledge you must not walk up has a wall
 * on its low side. Rival machines do not collide with walls, so the match keeps them on the rooftops with `confine`. Falling off
 * the roofs is a death (`belowKillPlane`). Pure data and geometry, no three.js.
 *
 * The first map is Rooftop Run (Neon City, E-Rooftops): two blocks of rooftops either side of a neon street, joined by three
 * crossings — a sloped west catwalk, the wide billboard bridge in the middle and an east catwalk — so the fight runs in three lanes.
 * Its fracture event is the Billboard Blackout: every sign goes dark and sight ranges collapse for 30 s. */
import type { Deck } from "./district-decks";
import type { SolidBox } from "./environment-collision";
import type { PvpModeId } from "./pvp";
import type { Wall } from "./walls";

export type ArenaId = "rooftop-run";
/** an axis-aligned roof: x0..x1 by z0..z1 in arena space (m), its surface `top` m above the arena base */
export type ArenaRoof = { id: string; name: string; x0: number; x1: number; z0: number; z1: number; top: number };
/** a straight walkway along z (bridges cross the street) or x (stairs between roofs): from `top` at the low-coordinate end to `topB` */
export type ArenaWalk = { id: string; x: number; z: number; along: "x" | "z"; length: number; width: number; top: number; topB: number; rails: boolean };
/** a solid prop standing on a roof (HVAC unit, water tank, sign base): blocks movement and line of sight; you can mantle onto it */
export type ArenaCover = { id: string; kind: "hvac" | "tank" | "vent" | "crate" | "sign"; x: number; z: number; w: number; d: number; h: number };
/** a wall in arena space: a ledge or parapet from (ax,az) to (bx,bz), solid from `base` to `top` (m above the arena base) */
export type ArenaWall = { ax: number; az: number; bx: number; bz: number; base: number; top: number };
export type FractureEvent = { name: string; brief: string; /** first fires at this match time, then every `every` s, for `length` s */ first: number; every: number; length: number; warn: number; /** sight multiplier while it runs */ visibility: number };

export type KillboxArena = {
  id: ArenaId; name: string; region: string; size: "small" | "medium" | "large"; blurb: string;
  /** where it hangs in the world (x, z) and the height of its street level */
  site: { x: number; z: number }; base: number;
  roofs: readonly ArenaRoof[]; walks: readonly ArenaWalk[]; cover: readonly ArenaCover[]; ledges: readonly ArenaWall[];
  /** team spawns (arena space): "us" is the player's side; free-for-all uses both */
  spawns: { us: readonly [number, number][]; them: readonly [number, number][] };
  /** Dominion zones A, B, C and the round modes' objective (arena space) */
  zones: readonly { id: "A" | "B" | "C"; dx: number; dz: number }[]; objective: readonly [number, number];
  /** falling below this (m above base) is a death */
  killPlane: number;
  fracture: FractureEvent;
  modes: readonly PvpModeId[];
};

/** arenas hang here: above the pocket rooms' 600 m would be fine too, but this keeps them clear of every far-view layer */
export const ARENA_ALTITUDE = 320;
const PARAPET = 1.1;

/* ---------------- Rooftop Run ---------------- */

// two blocks of roofs, north (your side) and south, with a 16 m street between them (z -8..8); heights are point-symmetric so
// both sides get the same high ground: the west roof of the north block and the east roof of the south block are the tall ones
const RR_ROOFS: ArenaRoof[] = [
  { id: "nw", name: "Rooftop Bar", x0: -46, x1: -16, z0: 8, z1: 34, top: 23 },
  { id: "nm", name: "Billboard Roof", x0: -16, x1: 16, z0: 8, z1: 34, top: 20 },
  { id: "ne", name: "Water Tank Roof", x0: 16, x1: 46, z0: 8, z1: 34, top: 21.5 },
  { id: "sw", name: "Cooling Towers", x0: -46, x1: -16, z0: -34, z1: -8, top: 21.5 },
  { id: "sm", name: "Signal Roof", x0: -16, x1: 16, z0: -34, z1: -8, top: 20 },
  { id: "se", name: "Penthouse Deck", x0: 16, x1: 46, z0: -34, z1: -8, top: 23 },
];
const RR_WALKS: ArenaWalk[] = [
  // the three lanes over the street (each overlaps a metre into the roofs it joins)
  { id: "west-catwalk", x: -34, z: 0, along: "z", length: 18, width: 3, top: 21.5, topB: 23, rails: true },
  { id: "billboard-bridge", x: 0, z: 0, along: "z", length: 18, width: 8, top: 20, topB: 20, rails: true },
  { id: "east-catwalk", x: 34, z: 0, along: "z", length: 18, width: 3, top: 23, topB: 21.5, rails: true },
  // stairs from each mid roof up to its tall neighbour, at the back of the block
  { id: "north-stairs", x: -12, z: 28.5, along: "x", length: 8, width: 5, top: 23, topB: 20, rails: false },
  { id: "south-stairs", x: 12, z: -28.5, along: "x", length: 8, width: 5, top: 20, topB: 23, rails: false },
];
const RR_COVER: ArenaCover[] = [
  // north block
  { id: "nw-tank", kind: "tank", x: -38, z: 26, w: 4, d: 4, h: 3.2 }, { id: "nw-hvac", kind: "hvac", x: -26, z: 16, w: 4, d: 2.4, h: 1.6 },
  { id: "nm-sign", kind: "sign", x: -6, z: 22, w: 7, d: 1, h: 2.2 }, { id: "nm-vent", kind: "vent", x: 8, z: 14, w: 2.4, d: 2.4, h: 1.4 },
  { id: "nm-crate", kind: "crate", x: 4, z: 28, w: 2, d: 2, h: 1.3 },
  { id: "ne-tank", kind: "tank", x: 38, z: 26, w: 4, d: 4, h: 3.2 }, { id: "ne-hvac", kind: "hvac", x: 26, z: 14, w: 4, d: 2.4, h: 1.6 },
  // south block (the same props turned half way round the centre)
  { id: "se-tank", kind: "tank", x: 38, z: -26, w: 4, d: 4, h: 3.2 }, { id: "se-hvac", kind: "hvac", x: 26, z: -16, w: 4, d: 2.4, h: 1.6 },
  { id: "sm-sign", kind: "sign", x: 6, z: -22, w: 7, d: 1, h: 2.2 }, { id: "sm-vent", kind: "vent", x: -8, z: -14, w: 2.4, d: 2.4, h: 1.4 },
  { id: "sm-crate", kind: "crate", x: -4, z: -28, w: 2, d: 2, h: 1.3 },
  { id: "sw-tank", kind: "tank", x: -38, z: -26, w: 4, d: 4, h: 3.2 }, { id: "sw-hvac", kind: "hvac", x: -26, z: -14, w: 4, d: 2.4, h: 1.6 },
  // the billboard bridge: two low barriers to fight over the centre from
  { id: "bridge-west", kind: "crate", x: -2.2, z: 0, w: 1.2, d: 3, h: 1.2 }, { id: "bridge-east", kind: "crate", x: 2.2, z: 0, w: 1.2, d: 3, h: 1.2 },
];
// the ledges where a tall roof meets the mid roof (3 m): a wall on the low side, open where the stairs come up
const RR_LEDGES: ArenaWall[] = [
  { ax: -16, az: 8, bx: -16, bz: 26, base: 19.5, top: 23 }, { ax: -16, az: 31, bx: -16, bz: 34, base: 19.5, top: 23 },
  { ax: 16, az: -8, bx: 16, bz: -26, base: 19.5, top: 23 }, { ax: 16, az: -31, bx: 16, bz: -34, base: 19.5, top: 23 },
];

export const ROOFTOP_RUN: KillboxArena = {
  id: "rooftop-run", name: "Rooftop Run", region: "Neon City · E-Rooftops", size: "small",
  blurb: "Two blocks of neon rooftops over a street you do not want to fall into. Three crossings: the west catwalk, the billboard bridge and the east catwalk.",
  site: { x: -1000, z: 700 }, base: ARENA_ALTITUDE,
  roofs: RR_ROOFS, walks: RR_WALKS, cover: RR_COVER, ledges: RR_LEDGES,
  spawns: {
    us: [[-30, 30], [0, 31], [30, 30], [-42, 14], [42, 14], [-8, 12]],
    them: [[30, -30], [0, -31], [-30, -30], [42, -14], [-42, -14], [8, -12]],
  },
  zones: [{ id: "A", dx: -34, dz: 0 }, { id: "B", dx: 0, dz: 0 }, { id: "C", dx: 34, dz: 0 }], objective: [0, 0],
  killPlane: 12,
  fracture: { name: "Billboard Blackout", brief: "Every sign on the block goes dark. Sight ranges collapse; fight by muzzle flash.", first: 90, every: 150, length: 30, warn: 10, visibility: 0.4 },
  modes: ["clash", "dominion", "freefall", "lockdown", "ascendancy"],
};

export const ARENAS: Readonly<Record<ArenaId, KillboxArena>> = { "rooftop-run": ROOFTOP_RUN };
export const arenaById = (id: string | undefined): KillboxArena | undefined => (id && id in ARENAS ? ARENAS[id as ArenaId] : undefined);
/** the arena a mode plays on (the first that lists it), or undefined to play in the open world (Fracture Royale, the old duels) */
export const arenaForMode = (mode: PvpModeId): KillboxArena | undefined => Object.values(ARENAS).find((a) => a.modes.includes(mode));

/* ---------------- geometry ---------------- */

export const toWorld = (a: KillboxArena, dx: number, dz: number) => ({ x: a.site.x + dx, z: a.site.z + dz });
export const worldTop = (a: KillboxArena, top: number) => a.base + top;

function walkRect(w: ArenaWalk) {
  const hx = w.along === "x" ? w.length / 2 : w.width / 2, hz = w.along === "z" ? w.length / 2 : w.width / 2;
  return { x0: w.x - hx, x1: w.x + hx, z0: w.z - hz, z1: w.z + hz };
}

/** every walkable surface as world decks: flat roofs, and walkways that climb from `top` to `topB` along +x / +z */
export function arenaDecks(a: KillboxArena): Deck[] {
  const out: Deck[] = [];
  for (const r of a.roofs) {
    const c = toWorld(a, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
    out.push({ id: `arena:${a.id}:${r.id}`, x: c.x, z: c.z, dirX: 0, dirZ: 1, length: r.z1 - r.z0, width: r.x1 - r.x0, top: worldTop(a, r.top), base: worldTop(a, r.top), ramp: 0 });
  }
  for (const w of a.walks) {
    const c = toWorld(a, w.x, w.z);
    out.push({ id: `arena:${a.id}:${w.id}`, x: c.x, z: c.z, dirX: w.along === "x" ? 1 : 0, dirZ: w.along === "z" ? 1 : 0, length: w.length, width: w.width, top: worldTop(a, w.top), base: worldTop(a, w.top), ramp: 0, topB: worldTop(a, w.topB) });
  }
  // cover tops are decks too, so a player who mantles onto a tank stands on it (walls keep you from walking into it)
  for (const k of a.cover) {
    const c = toWorld(a, k.x, k.z), top = worldTop(a, roofTopAt(a, k.x, k.z) + k.h);
    out.push({ id: `arena:${a.id}:cover:${k.id}`, x: c.x, z: c.z, dirX: 0, dirZ: 1, length: k.d, width: k.w, top, base: top, ramp: 0 });
  }
  return out;
}

/** the surface under (dx, dz) in arena space from roofs and walkways only (not cover), m above base; -Infinity off the map */
export function surfaceAt(a: KillboxArena, dx: number, dz: number): number {
  let best = -Infinity;
  for (const r of a.roofs) if (dx >= r.x0 && dx <= r.x1 && dz >= r.z0 && dz <= r.z1) best = Math.max(best, r.top);
  for (const w of a.walks) {
    const q = walkRect(w);
    if (dx < q.x0 || dx > q.x1 || dz < q.z0 || dz > q.z1) continue;
    const t = w.along === "x" ? (dx - q.x0) / (q.x1 - q.x0) : (dz - q.z0) / (q.z1 - q.z0);
    best = Math.max(best, w.top + (w.topB - w.top) * t);
  }
  return best;
}
function roofTopAt(a: KillboxArena, dx: number, dz: number): number { const s = surfaceAt(a, dx, dz); return Number.isFinite(s) ? s : 0; }

const inCover = (a: KillboxArena, dx: number, dz: number, pad: number) => a.cover.find((k) => Math.abs(dx - k.x) < k.w / 2 + pad && Math.abs(dz - k.z) < k.d / 2 + pad);

/** Keeps a body that does not collide with walls (a rival machine, a squadmate) on the rooftops: off the map or inside a prop, it is
 * moved to the nearest point that is on a roof or walkway, `margin` m in from the edge and clear of cover. Arena space in and out. */
export function confine(a: KillboxArena, dx: number, dz: number, margin = 0.8): { x: number; z: number; moved: boolean } {
  const onFloor = (x: number, z: number) => Number.isFinite(surfaceAt(a, x, z)) && Number.isFinite(surfaceAt(a, x + margin, z)) && Number.isFinite(surfaceAt(a, x - margin, z))
    && Number.isFinite(surfaceAt(a, x, z + margin)) && Number.isFinite(surfaceAt(a, x, z - margin)) && !inCover(a, x, z, margin * 0.6);
  if (onFloor(dx, dz)) return { x: dx, z: dz, moved: false };
  let best = { x: 0, z: 0, d: Infinity };
  const consider = (x: number, z: number) => { if (!onFloor(x, z)) return; const d = Math.hypot(x - dx, z - dz); if (d < best.d) best = { x, z, d }; };
  // nearest point of each walkable rectangle shrunk by the margin, then pushed off any prop it lands in
  const rects = [...a.roofs.map((r) => ({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 })), ...a.walks.map(walkRect)];
  for (const q of rects) {
    const clampX = (x: number) => Math.min(q.x1 - margin, Math.max(q.x0 + margin, x)), clampZ = (z: number) => Math.min(q.z1 - margin, Math.max(q.z0 + margin, z));
    const x = clampX(dx), z = clampZ(dz);
    consider(x, z);
    const k = inCover(a, x, z, margin * 0.6);
    if (k) {
      consider(clampX(k.x - k.w / 2 - margin), z); consider(clampX(k.x + k.w / 2 + margin), z);
      consider(x, clampZ(k.z - k.d / 2 - margin)); consider(x, clampZ(k.z + k.d / 2 + margin));
    }
  }
  return Number.isFinite(best.d) ? { x: best.x, z: best.z, moved: true } : { x: dx, z: dz, moved: false };
}

const wallMaker = (a: KillboxArena, out: Wall[]) => (ax: number, az: number, bx: number, bz: number, base: number, top: number, half = 0.15) => {
  const p = toWorld(a, ax, az), q = toWorld(a, bx, bz);
  out.push({ ax: p.x, az: p.z, bx: q.x, bz: q.z, half, base: a.base + base, top: a.base + top });
};

/** the roofs' parapets in world space: round the outside of each block and along the street, open at the three crossings */
export function arenaParapets(a: KillboxArena): Wall[] {
  const out: Wall[] = [], W = wallMaker(a, out);
  const crossings = a.walks.filter((w) => w.along === "z");
  const minX = Math.min(...a.roofs.map((r) => r.x0)), maxX = Math.max(...a.roofs.map((r) => r.x1));
  for (const r of a.roofs) {
    const lo = r.top - 0.5, hi = r.top + PARAPET;
    if (r.x0 <= minX) W(r.x0, r.z0, r.x0, r.z1, lo, hi);
    if (r.x1 >= maxX) W(r.x1, r.z0, r.x1, r.z1, lo, hi);
    const far = r.z0 > 0 ? r.z1 : r.z0, street = r.z0 > 0 ? r.z0 : r.z1;
    W(r.x0, far, r.x1, far, lo, hi);
    const gaps = crossings.map((w) => [w.x - w.width / 2, w.x + w.width / 2] as const).filter(([g0, g1]) => g1 > r.x0 && g0 < r.x1).sort((p, q) => p[0] - q[0]);
    let x = r.x0;
    for (const [g0, g1] of gaps) { if (g0 > x) W(x, street, g0, street, lo, hi); x = Math.max(x, g1); }
    if (x < r.x1) W(x, street, r.x1, street, lo, hi);
  }
  return out;
}

/** every solid wall in world space: the parapets, the crossings' rails, the ledges between roof heights, and a box round every prop */
export function arenaWalls(a: KillboxArena): Wall[] {
  const out: Wall[] = arenaParapets(a), W = wallMaker(a, out);
  for (const w of a.walks) if (w.rails && w.along === "z") {
    const q = walkRect(w), lo = Math.min(w.top, w.topB) - 0.5, hi = Math.max(w.top, w.topB) + PARAPET;
    W(q.x0, q.z0, q.x0, q.z1, lo, hi, 0.1); W(q.x1, q.z0, q.x1, q.z1, lo, hi, 0.1);
  }
  for (const l of a.ledges) W(l.ax, l.az, l.bx, l.bz, l.base, l.top, 0.2);
  for (const k of a.cover) {
    const t = roofTopAt(a, k.x, k.z), x0 = k.x - k.w / 2, x1 = k.x + k.w / 2, z0 = k.z - k.d / 2, z1 = k.z + k.d / 2;
    W(x0, z0, x1, z0, t - 0.2, t + k.h); W(x1, z0, x1, z1, t - 0.2, t + k.h); W(x1, z1, x0, z1, t - 0.2, t + k.h); W(x0, z1, x0, z0, t - 0.2, t + k.h);
  }
  return out;
}

/** line-of-sight blockers (environment-collision.ts SolidBox, centred): the props and the parapets, which you can duck behind */
export function arenaSolids(a: KillboxArena): { id: string; box: SolidBox }[] {
  const out: { id: string; box: SolidBox }[] = [];
  for (const k of a.cover) {
    const t = roofTopAt(a, k.x, k.z), c = toWorld(a, k.x, k.z);
    out.push({ id: `arena:${a.id}:${k.id}`, box: { x: c.x, y: a.base + t + k.h / 2, z: c.z, w: k.w, h: k.h, d: k.d } });
  }
  return out;
}

/* ---------------- match rules ---------------- */

/** a spawn point for side `side`: the one farthest from `threats` (arena space), so you never respawn in someone's sights */
export function spawnPoint(a: KillboxArena, side: "us" | "them" | "any", threats: readonly { x: number; z: number }[] = [], pick = 0): { x: number; z: number } {
  const list = side === "any" ? [...a.spawns.us, ...a.spawns.them] : a.spawns[side];
  if (!threats.length) { const p = list[((pick % list.length) + list.length) % list.length]!; return { x: p[0], z: p[1] }; }
  let best = list[0]!, far = -1;
  for (const p of list) { const d = Math.min(...threats.map((t) => Math.hypot(t.x - p[0], t.z - p[1]))); if (d > far) { far = d; best = p; } }
  return { x: best[0], z: best[1] };
}

/** has a body at world height `y` (feet) fallen off the roofs? */
export const belowKillPlane = (a: KillboxArena, y: number) => y < a.base + a.killPlane;

export type FractureState = { active: boolean; /** 0..1 how far into the event (fades in and out over the first and last 2 s) */ strength: number; /** seconds to the next start (0 while active) */ next: number; warning: boolean; count: number };
/** the arena's fracture event at match time `t` */
export function fractureAt(a: KillboxArena, t: number): FractureState {
  const f = a.fracture;
  if (t < f.first) return { active: false, strength: 0, next: f.first - t, warning: f.first - t <= f.warn, count: 0 };
  const into = (t - f.first) % f.every, count = Math.floor((t - f.first) / f.every) + 1;
  if (into < f.length) {
    const fade = Math.min(1, into / 2, (f.length - into) / 2);
    return { active: true, strength: Math.max(0, fade), next: 0, warning: false, count };
  }
  const next = f.every - into;
  return { active: false, strength: 0, next, warning: next <= f.warn, count };
}
/** the sight multiplier the event applies right now (1 = clear) */
export const fractureVisibility = (a: KillboxArena, t: number) => { const s = fractureAt(a, t); return 1 - (1 - a.fracture.visibility) * s.strength; };
/** a short HUD note for the event, or "" when there is nothing to say */
export function fractureLine(a: KillboxArena, t: number): string {
  const s = fractureAt(a, t);
  if (s.active) return `${a.fracture.name.toUpperCase()} · ${Math.ceil(a.fracture.first + (s.count - 1) * a.fracture.every + a.fracture.length - t)} s`;
  if (s.warning) return `${a.fracture.name} in ${Math.ceil(s.next)} s`;
  return "";
}

/** is (x, y, z) in an arena's airspace — over its footprint and above its street level? The sea under the arenas must not make
 * the game think you are swimming on a rooftop (Scene's `submerged` test reads the terrain below). */
export function inArenaSpace(x: number, y: number, z: number): boolean {
  for (const a of Object.values(ARENAS)) if (y > a.base - 2 && Math.abs(x - a.site.x) < 90 && Math.abs(z - a.site.z) < 90) return true;
  return false;
}
