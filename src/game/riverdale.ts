/** Riverdale (owner's global map board, Oct 26 2026): Aetheria's river town on the Verdant landmass, east of the forest on
 * the Verdant river's northern bend (world.ts RIVERDALE). Its streets of walk-in family homes are residences.ts
 * (city "riverdale"); this module is the town itself: the square with its clock tower, benches and lamps, the paved
 * streets between the rows, the welcome sign on the road in, and the riverside boardwalk out to a jetty on the river.
 *
 * Pure layout and geometry data, no three.js: RiverdaleTown.tsx merges `townBoxes` (residences.ts Box, in the town's
 * frame: origin at the square's centre on the graded ground, +z south) into a few meshes, `townWalls` go to the wall
 * collider and the boardwalk is a deck you walk on. Tested in riverdale.test.ts. */
import { RIVERDALE } from "./world";
import { riverdaleGroundLevel, waterNetwork } from "./terrain";
import type { Box } from "./residences";
import type { Wall } from "./walls";
import type { Deck } from "./district-decks";

export { RIVERDALE };
/** the graded ground the town stands on */
export const townLevel = () => riverdaleGroundLevel();

/** the nearest point of the river's water's edge to the square, and the unit bearing to it */
let riverCache: { x: number; z: number; dirX: number; dirZ: number; dist: number; surface: number } | null = null;
export function riverside() {
  if (riverCache) return riverCache;
  let best = { x: RIVERDALE.x, z: RIVERDALE.z + 200, dist: Infinity, surface: 0 };
  for (const r of waterNetwork().rivers) for (const p of r.points) {
    const d = Math.hypot(p.x - RIVERDALE.x, p.z - RIVERDALE.z) - p.w;
    if (d < best.dist) best = { x: p.x, z: p.z, dist: d, surface: p.s };
  }
  const L = Math.hypot(best.x - RIVERDALE.x, best.z - RIVERDALE.z) || 1;
  riverCache = { x: best.x, z: best.z, dirX: (best.x - RIVERDALE.x) / L, dirZ: (best.z - RIVERDALE.z) / L, dist: best.dist, surface: best.surface };
  return riverCache;
}

/** the boardwalk: from the town's edge (the graded ground's rim) straight toward the river, ending on a jetty over the
 * water's edge; level with the town the whole way, standing on piles where the bank falls away */
export const BOARDWALK_W = 3.2;
export function boardwalk(): { start: number; end: number; dirX: number; dirZ: number; y: number } {
  const r = riverside();
  return { start: RIVERDALE.r - 6, end: r.dist + 6, dirX: r.dirX, dirZ: r.dirZ, y: townLevel() + 0.35 };
}
export function boardwalkDeck(): Deck {
  const b = boardwalk(), mid = (b.start + b.end) / 2, length = b.end - b.start;
  return { id: "riverdale-boardwalk", x: RIVERDALE.x + b.dirX * mid, z: RIVERDALE.z + b.dirZ * mid, dirX: b.dirX, dirZ: b.dirZ, length, width: BOARDWALK_W, top: b.y, base: b.y - 0.4, ramp: 0 };
}

const STONE = "#b9b09f", PAVE = "#8f8a80", ROAD = "#4b4c4e", WOOD = "#7a5a3c", DARK = "#2f3437", BRASS = "#c9a55a", ROOF = "#5b3a2e";
/** the clock tower on the square: footprint half-size and height */
export const TOWER = { half: 2.2, height: 11 };
/** the street lamps round the square, local (x, z) */
export const LAMPS: readonly [number, number][] = [[-11, -11], [11, -11], [-11, 11], [11, 11], [-13, -40], [13, 40], [-40, 13], [40, -13]];
/** the welcome sign: on the west road into town, facing the way you come in */
export const SIGN = { x: -RIVERDALE.r - 4, z: 4 } as const;

/** every box of the town in its local frame (y = 0 on the graded ground) */
export function townBoxes(): Box[] {
  const out: Box[] = [];
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, mat: Box["mat"] = "solid", prism = false) =>
    out.push(prism ? { x, y, z, sx, sy, sz, color, mat, prism } : { x, y, z, sx, sy, sz, color, mat });
  const S = RIVERDALE.square, len = RIVERDALE.r * 2 - 4;
  // the streets between the rows (the homes stand on a 26 m grid round the square, so the streets run at ±13)
  for (const k of [-13, 13]) { box(k, 0.03, 0, 6, 0.06, len, ROAD); box(0, 0.035, k, len, 0.06, 6, ROAD); }
  // the square: paving, a kerb all round, flower beds in the corners
  box(0, 0.06, 0, S * 2, 0.12, S * 2, PAVE);
  for (const s of [-1, 1]) { box(s * S, 0.12, 0, 0.4, 0.24, S * 2, STONE); box(0, 0.12, s * S, S * 2, 0.24, 0.4, STONE); }
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) { box(cx * (S - 3), 0.25, cz * (S - 3), 3.4, 0.5, 3.4, STONE); box(cx * (S - 3), 0.55, cz * (S - 3), 3, 0.12, 3, "#4f7a3a"); }
  // the clock tower: plinth, shaft, belfry with a clock face each way, roof
  const T = TOWER;
  box(0, 0.4, 0, T.half * 2 + 1.2, 0.8, T.half * 2 + 1.2, STONE);
  box(0, 0.8 + (T.height - 3) / 2, 0, T.half * 2, T.height - 3, T.half * 2, "#a99c86");
  box(0, T.height - 1.2, 0, T.half * 2 + 0.4, 2.4, T.half * 2 + 0.4, "#8a7b66");
  for (const [fx, fz, sx, sz] of [[0, T.half + 0.22, 1.8, 0.06], [0, -T.half - 0.22, 1.8, 0.06], [T.half + 0.22, 0, 0.06, 1.8], [-T.half - 0.22, 0, 0.06, 1.8]] as const) {
    box(fx, T.height - 1.2, fz, sx, 1.8, sz, "#f4ecd6", "lamp");
  }
  box(0, T.height + 1.2, 0, T.half * 2 + 0.8, 2.4, T.half * 2 + 0.8, ROOF, "solid", true);
  box(0, T.height + 2.6, 0, 0.12, 1.2, 0.12, BRASS);
  // benches facing the tower
  for (const [bx, bz, along] of [[0, -8, true], [0, 8, true], [-8, 0, false], [8, 0, false]] as const) {
    const [sx, sz] = along ? [3.2, 0.6] : [0.6, 3.2];
    box(bx, 0.48, bz, sx, 0.08, sz, WOOD);
    box(bx + (along ? 0 : Math.sign(bx) * 0.3), 0.85, bz + (along ? Math.sign(bz) * 0.3 : 0), along ? sx : 0.08, 0.6, along ? 0.08 : sz, WOOD);
    for (const s of [-1, 1]) box(bx + (along ? s * 1.4 : 0), 0.24, bz + (along ? 0 : s * 1.4), 0.12, 0.48, 0.12, DARK);
  }
  // street lamps: post, arm, lantern
  for (const [lx, lz] of LAMPS) { box(lx, 2.2, lz, 0.18, 4.4, 0.18, DARK); box(lx, 4.5, lz, 0.6, 0.5, 0.6, "#ffe2a8", "lamp"); box(lx, 4.85, lz, 0.75, 0.16, 0.75, DARK); }
  // the welcome sign: two posts and a board (the lettering is drawn by the component)
  for (const s of [-1, 1]) box(SIGN.x, 1.4, SIGN.z + s * 2.2, 0.22, 2.8, 0.22, WOOD);
  box(SIGN.x, 2.3, SIGN.z, 0.16, 1.3, 5.2, "#2e4a3a");
  return out;
}

/** the boardwalk's boxes in its own frame (residences.ts Box): origin where it leaves the town at deck level, local +z
 * toward the river, so RiverdaleTown.tsx places them with the boardwalk's bearing (`boardwalkFrame`) */
export function boardwalkFrame() {
  const b = boardwalk();
  return { x: RIVERDALE.x + b.dirX * b.start, z: RIVERDALE.z + b.dirZ * b.start, floor: b.y, rot: Math.atan2(b.dirX, b.dirZ), length: b.end - b.start };
}
export function boardwalkBoxes(): Box[] {
  const f = boardwalkFrame(), out: Box[] = [], W = BOARDWALK_W;
  out.push({ x: 0, y: -0.08, z: f.length / 2, sx: W, sy: 0.16, sz: f.length, color: WOOD, mat: "solid" });
  for (let s = 0; s <= f.length; s += 2.4) for (const side of [-1, 1]) {
    out.push({ x: side * (W / 2 - 0.1), y: 0.5, z: s, sx: 0.12, sy: 1.0, sz: 0.12, color: DARK, mat: "solid" });
    if (s > 4) out.push({ x: side * (W / 2 - 0.25), y: -3.1, z: s, sx: 0.3, sy: 6, sz: 0.3, color: "#5a4a3a", mat: "solid" });
  }
  for (const side of [-1, 1]) out.push({ x: side * (W / 2 - 0.1), y: 0.98, z: f.length / 2 + 1.5, sx: 0.1, sy: 0.08, sz: f.length - 3, color: WOOD, mat: "solid" });
  out.push({ x: 0, y: 0.98, z: f.length, sx: W, sy: 0.08, sz: 0.1, color: WOOD, mat: "solid" });
  // a lantern at the jetty's end
  out.push({ x: W / 2 - 0.1, y: 1.6, z: f.length - 0.2, sx: 0.4, sy: 0.4, sz: 0.4, color: "#ffe2a8", mat: "lamp" });
  return out;
}

/** the town's solid parts for the wall collider: the clock tower, the sign posts, the boardwalk's rails */
export function townWalls(): Wall[] {
  const L = townLevel(), T = TOWER, h = T.half + 0.6, cx = RIVERDALE.x, cz = RIVERDALE.z, out: Wall[] = [];
  const seg = (ax: number, az: number, bx: number, bz: number, half: number, top: number) => out.push({ ax: cx + ax, az: cz + az, bx: cx + bx, bz: cz + bz, half, base: L - 1, top });
  seg(-h, -h, h, -h, 0.3, L + T.height + 2); seg(h, -h, h, h, 0.3, L + T.height + 2); seg(h, h, -h, h, 0.3, L + T.height + 2); seg(-h, h, -h, -h, 0.3, L + T.height + 2);
  seg(SIGN.x, SIGN.z - 2.6, SIGN.x, SIGN.z + 2.6, 0.2, L + 3);
  const b = boardwalk(), yaw = Math.atan2(b.dirX, b.dirZ), ox = Math.cos(yaw) * (BOARDWALK_W / 2), oz = -Math.sin(yaw) * (BOARDWALK_W / 2);
  for (const s of [-1, 1]) seg(b.dirX * (b.start + 3) + s * ox, b.dirZ * (b.start + 3) + s * oz, b.dirX * b.end + s * ox, b.dirZ * b.end + s * oz, 0.1, b.y + 1);
  // the jetty's end rail
  seg(b.dirX * b.end - ox, b.dirZ * b.end - oz, b.dirX * b.end + ox, b.dirZ * b.end + oz, 0.1, b.y + 1);
  return out;
}
