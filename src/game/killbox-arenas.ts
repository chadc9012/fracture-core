/** Killbox arena maps (owner's Killbox maps & modes doc, Nov 1 2026). An arena is a hand-built map in its own space: in the lore the
 * simulation runs the Killbox as a stress test on "echo copies" of real places, so each one hangs at ARENA_ALTITUDE over an empty
 * stretch of the world (like the pocket rooms at INTERIOR_ALTITUDE) and the open world is hidden while you play it.
 *
 * Everything walkable is a district deck (district-decks.ts), so terrain.walkHeight, the player, rivals and squadmates all agree.
 * Ledges and parapets are walls (walls.ts) — the player auto-steps onto any higher deck, so a ledge you must not walk up has a wall
 * on its low side. Rival machines do not collide with walls, so the match keeps them on the rooftops with `confine`. Falling off
 * the roofs is a death (`belowKillPlane`). Pure data and geometry, no three.js.
 *
 * Maps follow the owner's PvP maps board (Nov 2 2026: Kaiju Complex, Fracture Floor, Killbox Prime, then the new arenas).
 *
 * Kaiju Complex (Neon City, E-Rooftops; first built as "Rooftop Run"): two blocks of rooftops either side of a neon street, joined by three
 * crossings — a sloped west catwalk, the wide billboard bridge in the middle and an east catwalk — so the fight runs in three lanes.
 * Its fracture event is the Billboard Blackout: every sign goes dark and sight ranges collapse for 30 s.
 *
 * Fracture Floor (Nexus City, Sector 02; first built as "Data Fields"): a wet rooftop plaza in the towers. A processing floor between
 * two raised uplink terraces, cargo containers and crates for cover, and glass data walls — cover that rises and sinks. Its fracture event is the Grid
 * Rewrite: the standing pillars sink and the sunken ones rise, so every sightline on the floor changes for 25 s.
 *
 * Glass Spire (Nexus City, Spire Crown): an open plaza on a glass tower top round a raised crown, with a sky garden down each flank.
 * Its fracture event is the Spire Shatter: the glass panels shatter and blast shutters rise across the lanes.
 *
 * Riverfront (Neon City, River District): two promenades across a river, joined by two road bridges and a low footbridge between the
 * quays. Its fracture event is the Flood Alert: barriers rise across the bridges and the quay, and the rain comes down in sheets.
 *
 * Solara Outpost (Solara, Relay Mesa; the first day map): a desert relay outpost on a mesa, a raised relay deck in the middle and a hab
 * roof on each flank. Its fracture event is the Solar Flare: blinding glare, the panel arrays fold flat and heat shields rise.
 *
 * Frostveil Ring (Frostveil, Beacon Shaft): a frozen ring of deck round a bottomless shaft, a beacon platform in the middle on four
 * bridges and two corner watchtowers. Its fracture event is the Whiteout: blinding snow, ice walls across the bridges, the heated screens die.
 *
 * Thalassia Dome (Thalassia, seabed): an undersea research dome, labs round an open moon pool with a bridge across it and a raised gallery
 * on each flank. Its fracture event is the Pressure Breach: mist, bulkheads rise across the lanes and the glass partitions retract.
 *
 * Playlists rotate through the maps that list them (`arenaForRun`). */
import type { Deck } from "./district-decks";
import type { SolidBox } from "./environment-collision";
import type { PvpModeId } from "./pvp";
import type { Wall } from "./walls";

export type ArenaId = "kaiju-complex" | "fracture-floor" | "killbox-prime" | "skydock" | "neon-yard" | "glass-spire" | "riverfront" | "solara-outpost" | "frostveil-ring" | "thalassia-dome";
/** an axis-aligned roof: x0..x1 by z0..z1 in arena space (m), its surface `top` m above the arena base */
export type ArenaRoof = { id: string; name: string; x0: number; x1: number; z0: number; z1: number; top: number };
/** a straight walkway along z (bridges cross the street) or x (stairs between roofs): from `top` at the low-coordinate end to `topB` */
export type ArenaWalk = { id: string; x: number; z: number; along: "x" | "z"; length: number; width: number; top: number; topB: number; rails: boolean };
/** a solid prop standing on a roof (HVAC unit, water tank, sign base): blocks movement and line of sight; you can mantle onto it */
export type ArenaCover = { id: string; kind: "hvac" | "tank" | "vent" | "crate" | "sign" | "container" | "console" | "barrier" | "dropship" | "planter" | "pillar"; x: number; z: number; w: number; d: number; h: number };
/** a cover wall that rises and sinks with the fracture event: "up" stands until the event sinks it, "down" lies flush until the
 * event raises it. Solid (movement and sight) while more than half raised. */
export type ArenaShifter = { id: string; x: number; z: number; w: number; d: number; h: number; phase: "up" | "down" };
/** a wall in arena space: a ledge or parapet from (ax,az) to (bx,bz), solid from `base` to `top` (m above the arena base) */
export type ArenaWall = { ax: number; az: number; bx: number; bz: number; base: number; top: number };
export type FractureEvent = { name: string; brief: string; /** first fires at this match time, then every `every` s, for `length` s */ first: number; every: number; length: number; warn: number; /** sight multiplier while it runs */ visibility: number };

export type KillboxArena = {
  id: ArenaId; name: string; region: string; size: "small" | "medium" | "large"; blurb: string;
  /** where it hangs in the world (x, z) and the height of its street level */
  site: { x: number; z: number }; base: number;
  /** how KillboxArena.tsx dresses it */
  look: "neon-rooftops" | "nexus-grid" | "prime-roof" | "skydock" | "neon-yard" | "glass-spire" | "riverfront" | "solara-outpost" | "frostveil-ring" | "thalassia-dome";
  roofs: readonly ArenaRoof[]; walks: readonly ArenaWalk[]; cover: readonly ArenaCover[]; ledges: readonly ArenaWall[];
  shifters: readonly ArenaShifter[];
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

/* ---------------- Kaiju Complex ---------------- */

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
  // small AC units in the roof corners (owner's board: rooftop plant everywhere), mirrored through the centre
  { id: "nw-ac", kind: "hvac", x: -43.5, z: 31.5, w: 1.4, d: 1.4, h: 1.1 }, { id: "se-ac", kind: "hvac", x: 43.5, z: -31.5, w: 1.4, d: 1.4, h: 1.1 },
  { id: "ne-ac", kind: "hvac", x: 43.5, z: 31.5, w: 1.4, d: 1.4, h: 1.1 }, { id: "sw-ac", kind: "hvac", x: -43.5, z: -31.5, w: 1.4, d: 1.4, h: 1.1 },
  { id: "nm-ac", kind: "hvac", x: 12, z: 32, w: 1.4, d: 1.4, h: 1.1 }, { id: "sm-ac", kind: "hvac", x: -12, z: -32, w: 1.4, d: 1.4, h: 1.1 },
  // the billboard bridge: two low barriers to fight over the centre from
  { id: "bridge-west", kind: "crate", x: -2.2, z: 0, w: 1.2, d: 3, h: 1.2 }, { id: "bridge-east", kind: "crate", x: 2.2, z: 0, w: 1.2, d: 3, h: 1.2 },
];
// the ledges where a tall roof meets the mid roof (3 m): a wall on the low side, open where the stairs come up
const RR_LEDGES: ArenaWall[] = [
  { ax: -16, az: 8, bx: -16, bz: 26, base: 19.5, top: 23 }, { ax: -16, az: 31, bx: -16, bz: 34, base: 19.5, top: 23 },
  { ax: 16, az: -8, bx: 16, bz: -26, base: 19.5, top: 23 }, { ax: 16, az: -31, bx: 16, bz: -34, base: 19.5, top: 23 },
];

export const KAIJU_COMPLEX: KillboxArena = {
  id: "kaiju-complex", name: "Kaiju Complex", region: "Neon City · E-Rooftops", size: "small",
  blurb: "Two blocks of neon-trimmed rooftops under the Kaiju sign, over a street you do not want to fall into. Three crossings: the west catwalk, the billboard bridge and the east catwalk.",
  site: { x: -1000, z: 700 }, base: ARENA_ALTITUDE, look: "neon-rooftops",
  roofs: RR_ROOFS, walks: RR_WALKS, cover: RR_COVER, ledges: RR_LEDGES, shifters: [],
  spawns: {
    us: [[-30, 30], [0, 31], [30, 30], [-42, 14], [42, 14], [-8, 12]],
    them: [[30, -30], [0, -31], [-30, -30], [42, -14], [-42, -14], [8, -12]],
  },
  zones: [{ id: "A", dx: -34, dz: 0 }, { id: "B", dx: 0, dz: 0 }, { id: "C", dx: 34, dz: 0 }], objective: [0, 0],
  killPlane: 12,
  fracture: { name: "Billboard Blackout", brief: "Every sign on the block goes dark. Sight ranges collapse; fight by muzzle flash.", first: 90, every: 150, length: 30, warn: 10, visibility: 0.4 },
  modes: ["clash", "dominion", "freefall", "lockdown", "ascendancy"],
};

/* ---------------- Fracture Floor ---------------- */

/** a prop list and its copy turned half way round the centre (both teams get the same cover) */
function pointPair<T extends { id: string; x: number; z: number }>(half: readonly T[]): T[] {
  return [...half, ...half.map((k) => ({ ...k, id: `${k.id}-b`, x: -k.x, z: -k.z }))];
}
// a 60 x 48 m processing floor between two uplink terraces 2.5 m up (z 24..34 north, your side; -34..-24 south), two ramps each
const DF_ROOFS: ArenaRoof[] = [
  { id: "floor", name: "Processing Floor", x0: -30, x1: 30, z0: -24, z1: 24, top: 20 },
  { id: "north-uplink", name: "North Uplink", x0: -30, x1: 30, z0: 24, z1: 34, top: 22.5 },
  { id: "south-uplink", name: "South Uplink", x0: -30, x1: 30, z0: -34, z1: -24, top: 22.5 },
];
const DF_WALKS: ArenaWalk[] = [
  { id: "north-ramp-w", x: -20, z: 20, along: "z", length: 8, width: 4, top: 20, topB: 22.5, rails: false },
  { id: "north-ramp-e", x: 20, z: 20, along: "z", length: 8, width: 4, top: 20, topB: 22.5, rails: false },
  { id: "south-ramp-w", x: -20, z: -20, along: "z", length: 8, width: 4, top: 22.5, topB: 20, rails: false },
  { id: "south-ramp-e", x: 20, z: -20, along: "z", length: 8, width: 4, top: 22.5, topB: 20, rails: false },
];
// the terrace faces: 2.5 m, so you can mantle up them with a jump but never walk up; open where the ramps arrive
const DF_LEDGES: ArenaWall[] = [24, -24].flatMap((z) => [[-30, -22], [-18, 18], [22, 30]].map(([a, b]) => ({ ax: a!, az: z, bx: b!, bz: z, base: 19.5, top: 22.5 })));
const DF_COVER: ArenaCover[] = pointPair<ArenaCover>([
  // cargo containers on the floor: tall cover in an offset grid, so no lane runs the length of the floor; crates for low cover
  { id: "container-w", kind: "container", x: -22, z: 8, w: 2.4, d: 6, h: 2.6 },
  { id: "container-nw", kind: "container", x: -8, z: 14, w: 6, d: 2.4, h: 2.6 },
  { id: "container-ne", kind: "container", x: 25, z: 12, w: 5, d: 2.4, h: 2.6 },
  { id: "crates-mid", kind: "crate", x: 8, z: 6, w: 2.2, d: 3.2, h: 1.3 },
  { id: "container-edge", kind: "container", x: 27, z: 6.5, w: 2.4, d: 3, h: 2.6 },
  // the centre: two low barriers either side of the objective
  { id: "core-barrier", kind: "barrier", x: -5, z: 0, w: 1.2, d: 3, h: 1.2 },
  // the uplink terraces: a low wall at the lip to fight down from, and a console
  { id: "uplink-wall", kind: "barrier", x: 0, z: 26, w: 6, d: 1.2, h: 1.2 },
  { id: "uplink-console", kind: "console", x: -12, z: 30, w: 1.6, d: 1.6, h: 1.6 },
]);
const DF_SHIFTERS: ArenaShifter[] = pointPair<ArenaShifter>([
  // standing pillars that the Grid Rewrite sinks…
  { id: "pillar-w", x: -16, z: 3, w: 4, d: 1, h: 3, phase: "up" },
  { id: "pillar-n", x: 0, z: 9, w: 6, d: 1, h: 3, phase: "up" },
  // …and slots in the floor it raises, across the lanes the standing pillars left open
  { id: "slot-c", x: -10, z: 0, w: 1, d: 5, h: 3, phase: "down" },
  { id: "slot-w", x: -26, z: -2, w: 1, d: 6, h: 3, phase: "down" },
  { id: "slot-n", x: 12, z: 18, w: 5, d: 1, h: 3, phase: "down" },
]);

export const FRACTURE_FLOOR: KillboxArena = {
  id: "fracture-floor", name: "Fracture Floor", region: "Nexus City · Sector 02", size: "small",
  blurb: "A rain-wet plaza high in the Nexus towers, between two uplink terraces. Cargo containers for cover, and glass data walls that rise and sink when the grid rewrites itself.",
  site: { x: -1000, z: 380 }, base: ARENA_ALTITUDE, look: "nexus-grid",
  roofs: DF_ROOFS, walks: DF_WALKS, cover: DF_COVER, ledges: DF_LEDGES, shifters: DF_SHIFTERS,
  spawns: {
    us: [[-20, 31], [0, 32], [20, 31], [-26, 27], [26, 27], [-6, 30]],
    them: [[20, -31], [0, -32], [-20, -31], [26, -27], [-26, -27], [6, -30]],
  },
  zones: [{ id: "A", dx: -20, dz: 0 }, { id: "B", dx: 0, dz: 0 }, { id: "C", dx: 20, dz: 0 }], objective: [0, 0],
  killPlane: 12,
  fracture: { name: "Grid Rewrite", brief: "The grid rewrites itself: standing data pillars sink and new ones rise, changing every sightline on the floor.", first: 75, every: 120, length: 25, warn: 10, visibility: 1 },
  modes: ["lockdown", "ascendancy", "dominion", "clash", "freefall"],
};

/* ---------------- Killbox Prime ---------------- */

// one big 64 m roof, and a balcony 4 m down along half of each side (west to the south, east to the north), each reached by two
// flights of stairs: a flank route that drops you out of the main fight and brings you back up behind it
const KP_ROOFS: ArenaRoof[] = [
  { id: "roof", name: "Prime Deck", x0: -32, x1: 32, z0: -32, z1: 32, top: 20 },
  { id: "west-balcony", name: "West Balcony", x0: -44, x1: -32, z0: -32, z1: 8, top: 16 },
  { id: "east-balcony", name: "East Balcony", x0: 32, x1: 44, z0: -8, z1: 32, top: 16 },
];
const KP_WALKS: ArenaWalk[] = [
  { id: "west-stairs-s", x: -36, z: -26, along: "x", length: 8, width: 4, top: 16, topB: 20, rails: false },
  { id: "west-stairs-n", x: -36, z: 4, along: "x", length: 8, width: 4, top: 16, topB: 20, rails: false },
  { id: "east-stairs-n", x: 36, z: 26, along: "x", length: 8, width: 4, top: 20, topB: 16, rails: false },
  { id: "east-stairs-s", x: 36, z: -4, along: "x", length: 8, width: 4, top: 20, topB: 16, rails: false },
];
// the 4 m face between the deck and each balcony: walled from the balcony, open where the stairs come up
const KP_LEDGES: ArenaWall[] = [
  ...[[-32, -28], [-24, 2], [6, 8]].map(([a, b]) => ({ ax: -32, az: a!, bx: -32, bz: b!, base: 15.5, top: 20 })),
  ...[[-8, -6], [-2, 24], [28, 32]].map(([a, b]) => ({ ax: 32, az: a!, bx: 32, bz: b!, base: 15.5, top: 20 })),
];
const KP_COVER: ArenaCover[] = pointPair<ArenaCover>([
  { id: "container-a", kind: "container", x: -14, z: 18, w: 6, d: 2.4, h: 2.6 },
  { id: "container-b", kind: "container", x: 20, z: 14, w: 2.4, d: 6, h: 2.6 },
  { id: "container-c", kind: "container", x: -26, z: 8, w: 2.4, d: 5, h: 2.6 },
  { id: "crates-a", kind: "crate", x: 6, z: 20, w: 2.2, d: 2.2, h: 1.3 },
  { id: "crates-b", kind: "crate", x: -6, z: 12, w: 2, d: 3, h: 1.3 },
  { id: "barrier-a", kind: "barrier", x: 13, z: 4, w: 3, d: 1.2, h: 1.2 },
  { id: "spawn-wall", kind: "barrier", x: 0, z: 25, w: 6, d: 1.2, h: 1.2 },
  { id: "console", kind: "console", x: 26, z: 30, w: 1.6, d: 1.6, h: 1.6 },
  { id: "balcony-crates", kind: "crate", x: -38, z: -10, w: 2, d: 2, h: 1.3 },
]);
const KP_SHIFTERS: ArenaShifter[] = pointPair<ArenaShifter>([
  // glass walls standing out on the deck…
  { id: "glass-w", x: -14, z: 7, w: 5, d: 1, h: 3, phase: "up" },
  { id: "glass-n", x: 8, z: 12, w: 1, d: 4, h: 3, phase: "up" },
  // …and the containment ring round the capture zone, open at the corners, that the lock raises
  { id: "ring-n", x: 0, z: 8.5, w: 9, d: 1, h: 3, phase: "down" },
  { id: "ring-w", x: -8.5, z: 0, w: 1, d: 9, h: 3, phase: "down" },
]);

export const KILLBOX_PRIME: KillboxArena = {
  id: "killbox-prime", name: "Killbox Prime", region: "Neon City · Prime Tower", size: "medium",
  blurb: "One big roof at the top of a Neon tower: containers and glass walls round a holographic capture zone, and two lower balconies to flank by. When the containment locks, glass walls box in the centre.",
  site: { x: -700, z: 1000 }, base: ARENA_ALTITUDE, look: "prime-roof",
  roofs: KP_ROOFS, walks: KP_WALKS, cover: KP_COVER, ledges: KP_LEDGES, shifters: KP_SHIFTERS,
  spawns: {
    us: [[-18, 29], [0, 30], [18, 29], [-26, 24], [26, 24], [-8, 28]],
    them: [[18, -29], [0, -30], [-18, -29], [26, -24], [-26, -24], [8, -28]],
  },
  zones: [{ id: "A", dx: -20, dz: 0 }, { id: "B", dx: 0, dz: 0 }, { id: "C", dx: 20, dz: 0 }], objective: [0, 0],
  killPlane: 10,
  fracture: { name: "Containment Lock", brief: "The capture zone locks down: a ring of glass walls rises round the centre and the walls out on the deck sink. Get in through the corners, or hold the gaps.", first: 90, every: 140, length: 25, warn: 10, visibility: 1 },
  modes: ["clash", "dominion", "freefall", "lockdown", "ascendancy"],
};

/* ---------------- Skydock ---------------- */

// an aerial docking platform above the clouds at dusk: a central hangar deck with the landing pad (the capture zone), a raised
// docking platform for each team across an open drop, joined to the deck by two ramps each, and a high gantry down each side —
// the flank, 4 m over the deck, reached from both docks and by a steep stair from the deck's middle
const SD_ROOFS: ArenaRoof[] = [
  { id: "deck", name: "Hangar Deck", x0: -26, x1: 26, z0: -14, z1: 14, top: 20 },
  { id: "north-dock", name: "North Dock", x0: -20, x1: 20, z0: 22, z1: 34, top: 22 },
  { id: "south-dock", name: "South Dock", x0: -20, x1: 20, z0: -34, z1: -22, top: 22 },
  { id: "east-gantry", name: "East Gantry", x0: 30.5, x1: 33.5, z0: -32, z1: 32, top: 24 },
  { id: "west-gantry", name: "West Gantry", x0: -33.5, x1: -30.5, z0: -32, z1: 32, top: 24 },
];
const SD_WALKS: ArenaWalk[] = [
  // deck to docks over the drop
  { id: "ramp-ne", x: 12, z: 18, along: "z", length: 8, width: 4, top: 20, topB: 22, rails: true },
  { id: "ramp-nw", x: -12, z: 18, along: "z", length: 8, width: 4, top: 20, topB: 22, rails: true },
  { id: "ramp-sw", x: -12, z: -18, along: "z", length: 8, width: 4, top: 22, topB: 20, rails: true },
  { id: "ramp-se", x: 12, z: -18, along: "z", length: 8, width: 4, top: 22, topB: 20, rails: true },
  // docks up to the gantries
  { id: "gantry-ne", x: 25.5, z: 30, along: "x", length: 12, width: 3, top: 22, topB: 24, rails: true },
  { id: "gantry-nw", x: -25.5, z: 30, along: "x", length: 12, width: 3, top: 24, topB: 22, rails: true },
  { id: "gantry-se", x: 25.5, z: -30, along: "x", length: 12, width: 3, top: 22, topB: 24, rails: true },
  { id: "gantry-sw", x: -25.5, z: -30, along: "x", length: 12, width: 3, top: 24, topB: 22, rails: true },
  // the steep stairs from the deck's middle up to each gantry
  { id: "stair-e", x: 28, z: 0, along: "x", length: 6, width: 3, top: 20, topB: 24, rails: true },
  { id: "stair-w", x: -28, z: 0, along: "x", length: 6, width: 3, top: 24, topB: 20, rails: true },
];
const SD_COVER: ArenaCover[] = pointPair<ArenaCover>([
  // a parked dropship on each side of the pad: the big cover in the middle of the fight
  { id: "dropship", kind: "dropship", x: -15, z: 6, w: 10, d: 3.4, h: 3.2 },
  { id: "container", kind: "container", x: 8, z: 9, w: 2.4, d: 5, h: 2.6 },
  { id: "deck-crates", kind: "crate", x: -22, z: -6, w: 2, d: 2.2, h: 1.3 },
  { id: "pad-barrier", kind: "barrier", x: 0, z: 7.5, w: 5, d: 1.2, h: 1.2 },
  // on the docks: a low wall at the lip and a crate stack
  { id: "dock-wall", kind: "barrier", x: 0, z: 25, w: 6, d: 1.2, h: 1.2 },
  { id: "dock-crates", kind: "crate", x: -14, z: 30, w: 2.2, d: 2.2, h: 1.3 },
  // half-cover out on the gantries
  { id: "gantry-crate", kind: "crate", x: 32, z: 12, w: 1.4, d: 2, h: 1.2 },
]);

export const SKYDOCK: KillboxArena = {
  id: "skydock", name: "Skydock", region: "Aerial Docking Arena · over the cloud sea", size: "medium",
  blurb: "A docking platform above the clouds at dusk. Fight round the landing pad between two parked dropships, cross the drop on the ramps, or take the high gantries down each side.",
  site: { x: -400, z: 1100 }, base: ARENA_ALTITUDE, look: "skydock",
  roofs: SD_ROOFS, walks: SD_WALKS, cover: SD_COVER, ledges: [], shifters: [],
  spawns: {
    us: [[-10, 31], [0, 31], [10, 31], [-16, 26], [16, 26], [0, 28]],
    them: [[10, -31], [0, -31], [-10, -31], [16, -26], [-16, -26], [0, -28]],
  },
  zones: [{ id: "A", dx: -32, dz: 0 }, { id: "B", dx: 0, dz: 0 }, { id: "C", dx: 32, dz: 0 }], objective: [0, 0],
  killPlane: 12,
  fracture: { name: "Cloud Bank", brief: "A bank of cloud rolls up over the dock. Sight drops to a few metres: listen for footsteps and fight close.", first: 80, every: 140, length: 25, warn: 10, visibility: 0.35 },
  modes: ["clash", "dominion", "freefall", "lockdown", "ascendancy"],
};

/* ---------------- Neon Yard ---------------- */

// a container yard on a harbour pier at night: rows of stacked containers make the corridors, two stacks you can climb (5.2 m,
// two containers up, by a steel stair) give the high ground, and the gantry crane rearranges the lanes when the yard shuffles
const NY_ROOFS: ArenaRoof[] = [
  { id: "yard", name: "Container Yard", x0: -40, x1: 40, z0: -34, z1: 34, top: 20 },
  { id: "west-stack", name: "West Stack", x0: -26, x1: -21, z0: -6, z1: 6, top: 25.2 },
  { id: "east-stack", name: "East Stack", x0: 21, x1: 26, z0: -6, z1: 6, top: 25.2 },
];
const NY_WALKS: ArenaWalk[] = [
  { id: "west-stair", x: -23.5, z: 10, along: "z", length: 8, width: 3, top: 25.2, topB: 20, rails: true },
  { id: "east-stair", x: 23.5, z: -10, along: "z", length: 8, width: 3, top: 20, topB: 25.2, rails: true },
];
// the climbable stacks' 5.2 m faces: walled from the yard, open where the stairs arrive
const NY_LEDGES: ArenaWall[] = [
  { ax: -26, az: -6, bx: -26, bz: 6, base: 19.5, top: 25.2 }, { ax: -21, az: -6, bx: -21, bz: 6, base: 19.5, top: 25.2 },
  { ax: -26, az: -6, bx: -21, bz: -6, base: 19.5, top: 25.2 }, { ax: -26, az: 6, bx: -25, bz: 6, base: 19.5, top: 25.2 }, { ax: -22, az: 6, bx: -21, bz: 6, base: 19.5, top: 25.2 },
  { ax: 26, az: 6, bx: 26, bz: -6, base: 19.5, top: 25.2 }, { ax: 21, az: 6, bx: 21, bz: -6, base: 19.5, top: 25.2 },
  { ax: 26, az: 6, bx: 21, bz: 6, base: 19.5, top: 25.2 }, { ax: 26, az: -6, bx: 25, bz: -6, base: 19.5, top: 25.2 }, { ax: 22, az: -6, bx: 21, bz: -6, base: 19.5, top: 25.2 },
];
const NY_COVER: ArenaCover[] = pointPair<ArenaCover>([
  // two-high rows that make the corridors, and single boxes to fight round
  { id: "row-n", kind: "container", x: -12, z: 14, w: 12, d: 2.4, h: 5.2 },
  { id: "row-ne", kind: "container", x: 12, z: 20, w: 6, d: 2.4, h: 2.6 },
  { id: "stack-nw", kind: "container", x: -30, z: 22, w: 2.4, d: 6, h: 5.2 },
  { id: "stack-ne", kind: "container", x: 32, z: 14, w: 2.4, d: 6, h: 2.6 },
  { id: "box-mid", kind: "container", x: -8, z: 4, w: 2.4, d: 6, h: 2.6 },
  { id: "crates", kind: "crate", x: 4, z: 10, w: 2.2, d: 2.2, h: 1.3 },
  { id: "barrier", kind: "barrier", x: 16, z: 4, w: 3, d: 1.2, h: 1.2 },
  { id: "spawn-wall", kind: "barrier", x: 0, z: 27, w: 6, d: 1.2, h: 1.2 },
]);
const NY_SHIFTERS: ArenaShifter[] = pointPair<ArenaShifter>([
  // boxes the crane lifts out of the lanes when the yard shuffles…
  { id: "lift-n", x: 0, z: 16, w: 6, d: 2.4, h: 2.6, phase: "up" },
  { id: "lift-w", x: -34, z: 6, w: 2.4, d: 6, h: 2.6, phase: "up" },
  // …and boxes it drops into the open ones
  { id: "drop-c", x: 0, z: 7.5, w: 6, d: 2.4, h: 2.6, phase: "down" },
  { id: "drop-w", x: -16, z: 0, w: 2.4, d: 6, h: 2.6, phase: "down" },
]);

export const NEON_YARD: KillboxArena = {
  id: "neon-yard", name: "Neon Yard", region: "Neon City · Southern Docks", size: "medium",
  blurb: "A container yard on the harbour at night. Stacked containers make the corridors, two stacks you can climb hold the high ground, and the gantry crane shuffles the lanes.",
  site: { x: -100, z: 1180 }, base: ARENA_ALTITUDE, look: "neon-yard",
  roofs: NY_ROOFS, walks: NY_WALKS, cover: NY_COVER, ledges: NY_LEDGES, shifters: NY_SHIFTERS,
  spawns: {
    us: [[-20, 30], [0, 31], [20, 30], [-34, 29], [34, 29], [-8, 30]],
    them: [[20, -30], [0, -31], [-20, -30], [34, -29], [-34, -29], [8, -30]],
  },
  zones: [{ id: "A", dx: -30, dz: 0 }, { id: "B", dx: 0, dz: 0 }, { id: "C", dx: 30, dz: 0 }], objective: [0, 0],
  killPlane: 12,
  fracture: { name: "Crane Shuffle", brief: "The gantry crane reworks the yard: it lifts containers out of the lanes and drops others into the open ones.", first: 70, every: 130, length: 30, warn: 10, visibility: 1 },
  modes: ["clash", "dominion", "freefall", "lockdown", "ascendancy"],
};

/* ---------------- Glass Spire ---------------- */

// the crown of a glass corporate tower in Nexus City at night: an open plaza deck (each team spawns at one end), the Spire Crown in
// the middle 5 m up (the high ground and the centre zone) reached by one steel stair from each team's side, and a sky garden 4 m
// down off each flank (zones A and C) joined to the plaza by two stairs each. Glass panels for cover that shatter in the event
const GS_ROOFS: ArenaRoof[] = [
  { id: "plaza", name: "Spire Plaza", x0: -28, x1: 28, z0: -30, z1: 30, top: 20 },
  { id: "crown", name: "Spire Crown", x0: -6, x1: 6, z0: -6, z1: 6, top: 25 },
  { id: "west-garden", name: "West Sky Garden", x0: -42, x1: -28, z0: -16, z1: 16, top: 16 },
  { id: "east-garden", name: "East Sky Garden", x0: 28, x1: 42, z0: -16, z1: 16, top: 16 },
];
const GS_WALKS: ArenaWalk[] = [
  // up to the crown from each team's side of the plaza
  { id: "crown-stair-n", x: -2.5, z: 10, along: "z", length: 8, width: 3, top: 25, topB: 20, rails: true },
  { id: "crown-stair-s", x: 2.5, z: -10, along: "z", length: 8, width: 3, top: 20, topB: 25, rails: true },
  // down to the sky gardens
  { id: "garden-stair-wn", x: -32, z: 12, along: "x", length: 8, width: 4, top: 16, topB: 20, rails: false },
  { id: "garden-stair-ws", x: -32, z: -12, along: "x", length: 8, width: 4, top: 16, topB: 20, rails: false },
  { id: "garden-stair-en", x: 32, z: 12, along: "x", length: 8, width: 4, top: 20, topB: 16, rails: false },
  { id: "garden-stair-es", x: 32, z: -12, along: "x", length: 8, width: 4, top: 20, topB: 16, rails: false },
];
// the crown's 5 m faces, open where its stairs arrive; the plaza's 4 m faces over the gardens, open at the garden stairs
const GS_LEDGES: ArenaWall[] = [
  ...[[-6, -4], [-1, 6]].map(([a, b]) => ({ ax: a!, az: 6, bx: b!, bz: 6, base: 19.5, top: 25 })),
  ...[[-6, 1], [4, 6]].map(([a, b]) => ({ ax: a!, az: -6, bx: b!, bz: -6, base: 19.5, top: 25 })),
  { ax: -6, az: -6, bx: -6, bz: 6, base: 19.5, top: 25 }, { ax: 6, az: -6, bx: 6, bz: 6, base: 19.5, top: 25 },
  ...[-28, 28].flatMap((x) => [[-16, -14], [-10, 10], [14, 16]].map(([a, b]) => ({ ax: x, az: a!, bx: x, bz: b!, base: 15.5, top: 20 }))),
];
const GS_COVER: ArenaCover[] = pointPair<ArenaCover>([
  { id: "spawn-wall", kind: "barrier", x: 0, z: 26, w: 6, d: 1.2, h: 1.2 },
  { id: "planter-w", kind: "planter", x: -16, z: 20, w: 4, d: 2, h: 1.1 },
  { id: "planter-e", kind: "planter", x: 14, z: 14, w: 2, d: 4, h: 1.1 },
  { id: "kiosk", kind: "console", x: 22, z: 22, w: 1.6, d: 1.6, h: 1.6 },
  { id: "pillar", kind: "pillar", x: -14, z: 6, w: 2, d: 2, h: 4 },
  { id: "crates", kind: "crate", x: -20, z: -14, w: 2.2, d: 2.2, h: 1.3 },
  { id: "garden-planter", kind: "planter", x: -38, z: 8, w: 2, d: 3, h: 1.1 },
]);
const GS_SHIFTERS: ArenaShifter[] = pointPair<ArenaShifter>([
  // glass panels standing on the plaza, that shatter when the spire fractures…
  { id: "glass-a", x: -10, z: 14, w: 6, d: 1, h: 3, phase: "up" },
  { id: "glass-b", x: 22, z: 8, w: 1, d: 5, h: 3, phase: "up" },
  // …and the blast shutters that rise to seal the lanes they leave open
  { id: "shutter-n", x: 6, z: 12, w: 1, d: 5, h: 3, phase: "down" },
  { id: "shutter-w", x: -24, z: 0, w: 1, d: 6, h: 3, phase: "down" },
]);

export const GLASS_SPIRE: KillboxArena = {
  id: "glass-spire", name: "Glass Spire", region: "Nexus City · Spire Crown", size: "medium",
  blurb: "The top of a glass tower in Nexus City. Fight across the open plaza for the Spire Crown in the middle, or flank through the sky gardens below. When the spire fractures, the glass panels shatter and blast shutters seal the lanes.",
  site: { x: 200, z: 1180 }, base: ARENA_ALTITUDE, look: "glass-spire",
  roofs: GS_ROOFS, walks: GS_WALKS, cover: GS_COVER, ledges: GS_LEDGES, shifters: GS_SHIFTERS,
  spawns: {
    us: [[-18, 27], [0, 29], [18, 27], [-24, 23], [26, 26], [-8, 28]],
    them: [[18, -27], [0, -29], [-18, -27], [24, -23], [-26, -26], [8, -28]],
  },
  zones: [{ id: "A", dx: -35, dz: 0 }, { id: "B", dx: 0, dz: 0 }, { id: "C", dx: 35, dz: 0 }], objective: [0, 0],
  killPlane: 10,
  fracture: { name: "Spire Shatter", brief: "The spire fractures: every glass panel on the plaza shatters, glass dust hangs in the air, and blast shutters rise across the open lanes.", first: 85, every: 140, length: 25, warn: 10, visibility: 0.7 },
  modes: ["clash", "dominion", "freefall", "lockdown", "ascendancy"],
};

/* ---------------- Riverfront ---------------- */

// a river through Neon City at night: a promenade on each bank (each team spawns on one), and three lanes across the water: a
// steel road bridge on each flank at promenade height, and in the middle a low footbridge between two stone quays 3.5 m down,
// reached from each bank by a flight of stairs at either end of its quay. Falling in the river is a death
const RF_ROOFS: ArenaRoof[] = [
  { id: "north-bank", name: "North Promenade", x0: -40, x1: 40, z0: 12, z1: 32, top: 20 },
  { id: "south-bank", name: "South Promenade", x0: -40, x1: 40, z0: -32, z1: -12, top: 20 },
  { id: "north-quay", name: "North Quay", x0: -6, x1: 6, z0: 8, z1: 12, top: 16.5 },
  { id: "south-quay", name: "South Quay", x0: -6, x1: 6, z0: -12, z1: -8, top: 16.5 },
  // the landings at the head of each quay stair
  { id: "north-landing-w", name: "North Quay Steps", x0: -18, x1: -14, z0: 8, z1: 12, top: 20 },
  { id: "north-landing-e", name: "North Quay Steps", x0: 14, x1: 18, z0: 8, z1: 12, top: 20 },
  { id: "south-landing-w", name: "South Quay Steps", x0: -18, x1: -14, z0: -12, z1: -8, top: 20 },
  { id: "south-landing-e", name: "South Quay Steps", x0: 14, x1: 18, z0: -12, z1: -8, top: 20 },
];
const RF_WALKS: ArenaWalk[] = [
  // the road bridges (flat, at promenade height; each overlaps a metre into the banks)
  { id: "west-bridge", x: -30, z: 0, along: "z", length: 26, width: 6, top: 20, topB: 20, rails: true },
  { id: "east-bridge", x: 30, z: 0, along: "z", length: 26, width: 6, top: 20, topB: 20, rails: true },
  // the footbridge between the quays
  { id: "footbridge", x: 0, z: 0, along: "z", length: 18, width: 4, top: 16.5, topB: 16.5, rails: true },
  // quay stairs: down from each landing to the quay
  { id: "north-stair-w", x: -10, z: 10, along: "x", length: 8, width: 4, top: 20, topB: 16.5, rails: true },
  { id: "north-stair-e", x: 10, z: 10, along: "x", length: 8, width: 4, top: 16.5, topB: 20, rails: true },
  { id: "south-stair-w", x: -10, z: -10, along: "x", length: 8, width: 4, top: 20, topB: 16.5, rails: true },
  { id: "south-stair-e", x: 10, z: -10, along: "x", length: 8, width: 4, top: 16.5, topB: 20, rails: true },
];
// the bank's face over the stairs and the quay: walled from below (you cannot step up it), open to drop off from the promenade
const RF_LEDGES: ArenaWall[] = [12, -12].map((z) => ({ ax: -14, az: z, bx: 14, bz: z, base: 16, top: 20 }));
const RF_COVER: ArenaCover[] = pointPair<ArenaCover>([
  { id: "spawn-wall", kind: "barrier", x: 0, z: 26, w: 6, d: 1.2, h: 1.2 },
  { id: "stall", kind: "container", x: -22, z: 20, w: 6, d: 2.4, h: 2.6 },
  { id: "planter", kind: "planter", x: 12, z: 18, w: 4, d: 2, h: 1.1 },
  { id: "kiosk", kind: "console", x: -8, z: 16, w: 1.6, d: 1.6, h: 1.6 },
  { id: "crates", kind: "crate", x: 34, z: 18, w: 2.2, d: 2.2, h: 1.3 },
  { id: "bridge-barrier", kind: "barrier", x: -31.5, z: 3, w: 2, d: 1.2, h: 1.2 },
  { id: "quay-crates", kind: "crate", x: -3, z: 10.6, w: 1.4, d: 1.4, h: 1.2 },
]);
const RF_SHIFTERS: ArenaShifter[] = pointPair<ArenaShifter>([
  // glass windbreaks on the promenade that fold away when the alert sounds…
  { id: "screen-a", x: -14, z: 20, w: 4, d: 1, h: 2.4, phase: "up" },
  { id: "screen-b", x: 26, z: 16, w: 1, d: 4, h: 2.4, phase: "up" },
  // …and the flood barriers that rise across half of each bridge end and along the quay
  { id: "flood-bridge-n", x: -31.5, z: 6, w: 3, d: 1, h: 1.6, phase: "down" },
  { id: "flood-bridge-s", x: -28.5, z: -6, w: 3, d: 1, h: 1.6, phase: "down" },
  { id: "flood-quay", x: 3.5, z: 9, w: 3, d: 1, h: 1.6, phase: "down" },
]);

export const RIVERFRONT: KillboxArena = {
  id: "riverfront", name: "Riverfront", region: "Neon City · River District", size: "medium",
  blurb: "A river through Neon City at night. Hold your promenade, cross on the steel road bridges, or drop to the quays and fight over the low footbridge. When the flood alert sounds, barriers rise across the bridges and the rain comes down hard.",
  site: { x: 500, z: 1180 }, base: ARENA_ALTITUDE, look: "riverfront",
  roofs: RF_ROOFS, walks: RF_WALKS, cover: RF_COVER, ledges: RF_LEDGES, shifters: RF_SHIFTERS,
  spawns: {
    us: [[-18, 28], [0, 29], [18, 28], [-34, 26], [34, 26], [-8, 28]],
    them: [[18, -28], [0, -29], [-18, -28], [34, -26], [-34, -26], [8, -28]],
  },
  zones: [{ id: "A", dx: -30, dz: 0 }, { id: "B", dx: 0, dz: 0 }, { id: "C", dx: 30, dz: 0 }], objective: [0, 0],
  killPlane: 11,
  fracture: { name: "Flood Alert", brief: "Sirens on the river: the rain comes down in sheets, flood barriers rise across the bridges and the quay, and the windbreaks fold away.", first: 80, every: 135, length: 25, warn: 10, visibility: 0.6 },
  modes: ["clash", "dominion", "freefall", "lockdown", "ascendancy"],
};

/* ---------------- Solara Outpost ---------------- */

// a solar relay outpost on a mesa top in the Solara desert, in the heat of the day: an open sandy yard, the relay deck in the middle
// 3.5 m up (zone B) reached by a ramp from each side, and a prefab hab module on each flank whose roof (4 m up, by a steel stair)
// holds a zone of its own; solar panel arrays and machinery for cover
const SO_ROOFS: ArenaRoof[] = [
  { id: "yard", name: "Outpost Yard", x0: -36, x1: 36, z0: -30, z1: 30, top: 20 },
  { id: "relay-deck", name: "Relay Deck", x0: -8, x1: 8, z0: -8, z1: 8, top: 23.5 },
  { id: "hab-west", name: "West Hab Roof", x0: -30, x1: -20, z0: 8, z1: 20, top: 24 },
  { id: "hab-east", name: "East Hab Roof", x0: 20, x1: 30, z0: -20, z1: -8, top: 24 },
];
const SO_WALKS: ArenaWalk[] = [
  { id: "deck-ramp-w", x: -12, z: 0, along: "x", length: 8, width: 4, top: 20, topB: 23.5, rails: true },
  { id: "deck-ramp-e", x: 12, z: 0, along: "x", length: 8, width: 4, top: 23.5, topB: 20, rails: true },
  { id: "hab-stair-w", x: -25, z: 4, along: "z", length: 8, width: 3, top: 20, topB: 24, rails: true },
  { id: "hab-stair-e", x: 25, z: -4, along: "z", length: 8, width: 3, top: 24, topB: 20, rails: true },
];
// the deck's and the habs' faces: walled from the yard, open where the ramps and stairs arrive
const SO_LEDGES: ArenaWall[] = [
  ...[-8, 8].flatMap((x) => [[-8, -2], [2, 8]].map(([a, b]) => ({ ax: x, az: a!, bx: x, bz: b!, base: 19.5, top: 23.5 }))),
  ...[-8, 8].map((z) => ({ ax: -8, az: z, bx: 8, bz: z, base: 19.5, top: 23.5 })),
  { ax: -30, az: 8, bx: -30, bz: 20, base: 19.5, top: 24 }, { ax: -20, az: 8, bx: -20, bz: 20, base: 19.5, top: 24 }, { ax: -30, az: 20, bx: -20, bz: 20, base: 19.5, top: 24 },
  { ax: -30, az: 8, bx: -26.5, bz: 8, base: 19.5, top: 24 }, { ax: -23.5, az: 8, bx: -20, bz: 8, base: 19.5, top: 24 },
  { ax: 30, az: -8, bx: 30, bz: -20, base: 19.5, top: 24 }, { ax: 20, az: -8, bx: 20, bz: -20, base: 19.5, top: 24 }, { ax: 30, az: -20, bx: 20, bz: -20, base: 19.5, top: 24 },
  { ax: 30, az: -8, bx: 26.5, bz: -8, base: 19.5, top: 24 }, { ax: 23.5, az: -8, bx: 20, bz: -8, base: 19.5, top: 24 },
];
const SO_COVER: ArenaCover[] = pointPair<ArenaCover>([
  { id: "spawn-wall", kind: "barrier", x: 0, z: 25, w: 6, d: 1.2, h: 1.2 },
  { id: "water-tank", kind: "tank", x: 10, z: 18, w: 3, d: 3, h: 3 },
  { id: "container", kind: "container", x: -10, z: 14, w: 6, d: 2.4, h: 2.6 },
  { id: "generator", kind: "hvac", x: 18, z: 6, w: 3, d: 2, h: 1.8 },
  { id: "crates", kind: "crate", x: -14, z: -4, w: 2.2, d: 2.2, h: 1.3 },
  { id: "deck-barrier", kind: "barrier", x: -4, z: 12, w: 4, d: 1.2, h: 1.2 },
  { id: "hab-crates", kind: "crate", x: -27, z: 17, w: 1.6, d: 1.6, h: 1.2 },
]);
const SO_SHIFTERS: ArenaShifter[] = pointPair<ArenaShifter>([
  // solar panel arrays standing in the yard, that fold flat when the flare hits…
  { id: "panels-a", x: -14, z: 21, w: 6, d: 1, h: 2.4, phase: "up" },
  { id: "panels-b", x: 24, z: 14, w: 1, d: 6, h: 2.4, phase: "up" },
  // …and the heat shields that rise out of the yard to cover the open ground
  { id: "shield-n", x: 3, z: 12, w: 4, d: 1, h: 2.2, phase: "down" },
  { id: "shield-w", x: -20, z: 0, w: 1, d: 5, h: 2.2, phase: "down" },
]);

export const SOLARA_OUTPOST: KillboxArena = {
  id: "solara-outpost", name: "Solara Outpost", region: "Solara · Relay Mesa", size: "medium",
  blurb: "A solar relay outpost on a desert mesa in the heat of the day. Take the relay deck in the middle, or the hab roofs on the flanks. When a solar flare hits, the glare is blinding, the panel arrays fold flat and heat shields rise.",
  site: { x: 800, z: 1180 }, base: ARENA_ALTITUDE, look: "solara-outpost",
  roofs: SO_ROOFS, walks: SO_WALKS, cover: SO_COVER, ledges: SO_LEDGES, shifters: SO_SHIFTERS,
  spawns: {
    us: [[-18, 27], [0, 28], [18, 27], [-33, 25], [33, 25], [-8, 27]],
    them: [[18, -27], [0, -28], [-18, -27], [33, -25], [-33, -25], [8, -28]],
  },
  zones: [{ id: "A", dx: -25, dz: 14 }, { id: "B", dx: 0, dz: 0 }, { id: "C", dx: 25, dz: -14 }], objective: [0, 0],
  killPlane: 12,
  fracture: { name: "Solar Flare", brief: "A solar flare hits the mesa: the glare is blinding, the panel arrays fold flat and heat shields rise across the open yard.", first: 80, every: 140, length: 25, warn: 10, visibility: 0.5 },
  modes: ["clash", "dominion", "freefall", "lockdown", "ascendancy"],
};

/* ---------------- Frostveil Ring ---------------- */

// a frozen ring of deck round a bottomless shaft in the Frostveil, in icy twilight under the aurora: the ring itself (each team
// spawns on its north or south arm), a beacon platform in the middle of the shaft (zone B, the frozen beacon hanging over it) joined
// to the ring by four bridges, and a watchtower on two corners (4.5 m up, by a steel stair) for the high ground
const FR_ROOFS: ArenaRoof[] = [
  { id: "north-arm", name: "North Ring", x0: -32, x1: 32, z0: 18, z1: 30, top: 20 },
  { id: "south-arm", name: "South Ring", x0: -32, x1: 32, z0: -30, z1: -18, top: 20 },
  { id: "west-arm", name: "West Ring", x0: -32, x1: -20, z0: -18, z1: 18, top: 20 },
  { id: "east-arm", name: "East Ring", x0: 20, x1: 32, z0: -18, z1: 18, top: 20 },
  { id: "beacon", name: "Beacon Platform", x0: -7, x1: 7, z0: -6, z1: 6, top: 20 },
  { id: "tower-nw", name: "Northwest Watchtower", x0: -32, x1: -24, z0: 22, z1: 30, top: 24.5 },
  { id: "tower-se", name: "Southeast Watchtower", x0: 24, x1: 32, z0: -30, z1: -22, top: 24.5 },
];
const FR_WALKS: ArenaWalk[] = [
  { id: "bridge-n", x: -3, z: 12, along: "z", length: 14, width: 4, top: 20, topB: 20, rails: true },
  { id: "bridge-s", x: 3, z: -12, along: "z", length: 14, width: 4, top: 20, topB: 20, rails: true },
  { id: "bridge-w", x: -13.5, z: 3, along: "x", length: 15, width: 4, top: 20, topB: 20, rails: true },
  { id: "bridge-e", x: 13.5, z: -3, along: "x", length: 15, width: 4, top: 20, topB: 20, rails: true },
  { id: "tower-stair-nw", x: -20, z: 26, along: "x", length: 8, width: 3, top: 24.5, topB: 20, rails: true },
  { id: "tower-stair-se", x: 20, z: -26, along: "x", length: 8, width: 3, top: 20, topB: 24.5, rails: true },
];
// the watchtowers' faces: walled from the ring, open where their stairs arrive
const FR_LEDGES: ArenaWall[] = [
  { ax: -24, az: 22, bx: -24, bz: 24.5, base: 19.5, top: 24.5 }, { ax: -24, az: 27.5, bx: -24, bz: 30, base: 19.5, top: 24.5 }, { ax: -32, az: 22, bx: -24, bz: 22, base: 19.5, top: 24.5 },
  { ax: 24, az: -22, bx: 24, bz: -24.5, base: 19.5, top: 24.5 }, { ax: 24, az: -27.5, bx: 24, bz: -30, base: 19.5, top: 24.5 }, { ax: 32, az: -22, bx: 24, bz: -22, base: 19.5, top: 24.5 },
];
const FR_COVER: ArenaCover[] = pointPair<ArenaCover>([
  { id: "spawn-wall", kind: "barrier", x: 0, z: 24, w: 6, d: 1.2, h: 1.2 },
  { id: "crates", kind: "crate", x: 10, z: 22, w: 2.2, d: 2.2, h: 1.3 },
  { id: "generator", kind: "hvac", x: -26, z: 10, w: 2, d: 3, h: 1.8 },
  { id: "fuel-tank", kind: "tank", x: 26, z: 14, w: 2.6, d: 2.6, h: 2.6 },
  { id: "container", kind: "container", x: 28, z: 6, w: 2.4, d: 6, h: 2.6 },
  { id: "beacon-barrier", kind: "barrier", x: 4, z: 4, w: 2, d: 1, h: 1.1 },
  { id: "ring-barrier", kind: "barrier", x: -24, z: -8, w: 1.2, d: 3, h: 1.2 },
]);
const FR_SHIFTERS: ArenaShifter[] = pointPair<ArenaShifter>([
  // heated screens on the ring, that die in the whiteout…
  { id: "screen-a", x: -12, z: 22, w: 4, d: 1, h: 2, phase: "up" },
  { id: "screen-b", x: 26, z: -6, w: 1, d: 4, h: 2, phase: "up" },
  // …and the ice walls that freeze across half of the bridges
  { id: "ice-n", x: -4.2, z: 13, w: 1.6, d: 1, h: 2.4, phase: "down" },
  { id: "ice-w", x: -14, z: 4.2, w: 1, d: 1.6, h: 2.4, phase: "down" },
]);

export const FROSTVEIL_RING: KillboxArena = {
  id: "frostveil-ring", name: "Frostveil Ring", region: "Frostveil · Beacon Shaft", size: "medium",
  blurb: "A frozen ring of deck round a bottomless shaft, under the aurora. Fight round the ring, take a watchtower, or cross a bridge to the beacon platform in the middle. In a whiteout the snow blinds you, ice walls freeze across the bridges and the heated screens die.",
  site: { x: 1100, z: 1180 }, base: ARENA_ALTITUDE, look: "frostveil-ring",
  roofs: FR_ROOFS, walks: FR_WALKS, cover: FR_COVER, ledges: FR_LEDGES, shifters: FR_SHIFTERS,
  spawns: {
    us: [[-14, 27], [0, 28], [14, 27], [24, 26], [30, 21], [-8, 27]],
    them: [[14, -27], [0, -28], [-14, -27], [-24, -26], [-30, -21], [8, -27]],
  },
  zones: [{ id: "A", dx: -26, dz: 0 }, { id: "B", dx: 0, dz: 0 }, { id: "C", dx: 26, dz: 0 }], objective: [0, 0],
  killPlane: 12,
  fracture: { name: "Whiteout", brief: "A whiteout sweeps the ring: the snow blinds you, ice walls freeze across the bridges and the heated screens die.", first: 85, every: 140, length: 25, warn: 10, visibility: 0.35 },
  modes: ["clash", "dominion", "freefall", "lockdown", "ascendancy"],
};

/* ---------------- Thalassia Dome ---------------- */

// an undersea research dome on the Thalassia seabed: a lab floor round an open moon pool (each team spawns at one end), a narrow
// bridge across the pool (zone B), and a raised gallery along each flank (4.5 m up, a stair at each end) holding zones A and C.
// Falling into the moon pool is a death
const TD_ROOFS: ArenaRoof[] = [
  { id: "north-floor", name: "North Lab", x0: -34, x1: 34, z0: 6, z1: 30, top: 20 },
  { id: "south-floor", name: "South Lab", x0: -34, x1: 34, z0: -30, z1: -6, top: 20 },
  { id: "west-floor", name: "West Lab", x0: -34, x1: -6, z0: -6, z1: 6, top: 20 },
  { id: "east-floor", name: "East Lab", x0: 6, x1: 34, z0: -6, z1: 6, top: 20 },
  { id: "west-gallery", name: "West Gallery", x0: -34, x1: -24, z0: -20, z1: 20, top: 24.5 },
  { id: "east-gallery", name: "East Gallery", x0: 24, x1: 34, z0: -20, z1: 20, top: 24.5 },
];
const TD_WALKS: ArenaWalk[] = [
  { id: "pool-bridge", x: 0, z: 0, along: "x", length: 14, width: 3, top: 20, topB: 20, rails: true },
  { id: "gallery-stair-wn", x: -29, z: 24, along: "z", length: 8, width: 3, top: 24.5, topB: 20, rails: true },
  { id: "gallery-stair-ws", x: -29, z: -24, along: "z", length: 8, width: 3, top: 20, topB: 24.5, rails: true },
  { id: "gallery-stair-en", x: 29, z: 24, along: "z", length: 8, width: 3, top: 24.5, topB: 20, rails: true },
  { id: "gallery-stair-es", x: 29, z: -24, along: "z", length: 8, width: 3, top: 20, topB: 24.5, rails: true },
];
// the galleries' faces: walled from the floor, open where their stairs arrive
const TD_LEDGES: ArenaWall[] = [-1, 1].flatMap((s) => [
  { ax: s * 24, az: -20, bx: s * 24, bz: 20, base: 19.5, top: 24.5 },
  ...[-20, 20].flatMap((z) => [[-34, -30.5], [-27.5, -24]].map(([a, b]) => ({ ax: s * a!, az: z, bx: s * b!, bz: z, base: 19.5, top: 24.5 }))),
]);
const TD_COVER: ArenaCover[] = pointPair<ArenaCover>([
  { id: "spawn-wall", kind: "barrier", x: 0, z: 25, w: 6, d: 1.2, h: 1.2 },
  { id: "lab-bench", kind: "console", x: -12, z: 14, w: 3, d: 1.4, h: 1.1 },
  { id: "specimen-tank", kind: "tank", x: 12, z: 16, w: 3, d: 3, h: 3 },
  { id: "crates", kind: "crate", x: 20, z: 10, w: 2.2, d: 2.2, h: 1.3 },
  { id: "pillar", kind: "pillar", x: -16, z: 0, w: 2, d: 2, h: 4 },
  { id: "pool-barrier", kind: "barrier", x: -10, z: 9, w: 4, d: 1.2, h: 1.2 },
  { id: "gallery-crates", kind: "crate", x: -31, z: 8, w: 1.6, d: 1.6, h: 1.2 },
]);
const TD_SHIFTERS: ArenaShifter[] = pointPair<ArenaShifter>([
  // glass partitions in the labs, that retract when the breach alarm sounds…
  { id: "glass-a", x: -20, z: 16, w: 4, d: 1, h: 2.6, phase: "up" },
  { id: "glass-b", x: 8, z: 20, w: 1, d: 4, h: 2.6, phase: "up" },
  // …and the bulkheads that rise to seal the lanes
  { id: "bulkhead-n", x: -4, z: 12, w: 4, d: 1, h: 2.6, phase: "down" },
  { id: "bulkhead-w", x: -20, z: -2, w: 1, d: 4, h: 2.6, phase: "down" },
]);

export const THALASSIA_DOME: KillboxArena = {
  id: "thalassia-dome", name: "Thalassia Dome", region: "Thalassia · Seabed Research Dome", size: "medium",
  blurb: "An undersea research dome on the Thalassia seabed. Fight across the labs, take a gallery, or hold the narrow bridge over the moon pool. When the dome breaches, alarms sound, mist sprays, bulkheads seal the lanes and the glass partitions retract.",
  site: { x: 1400, z: 1180 }, base: ARENA_ALTITUDE, look: "thalassia-dome",
  roofs: TD_ROOFS, walks: TD_WALKS, cover: TD_COVER, ledges: TD_LEDGES, shifters: TD_SHIFTERS,
  spawns: {
    us: [[-14, 27], [0, 28], [14, 27], [20, 26], [-20, 26], [-8, 27]],
    them: [[14, -27], [0, -28], [-14, -27], [-20, -26], [20, -26], [8, -27]],
  },
  zones: [{ id: "A", dx: -29, dz: 0 }, { id: "B", dx: 0, dz: 0 }, { id: "C", dx: 29, dz: 0 }], objective: [0, 0],
  killPlane: 12,
  fracture: { name: "Pressure Breach", brief: "The dome breaches: alarms sound, mist sprays through the labs, bulkheads rise to seal the lanes and the glass partitions retract.", first: 75, every: 135, length: 25, warn: 10, visibility: 0.5 },
  modes: ["clash", "dominion", "freefall", "lockdown", "ascendancy"],
};

export const ARENAS: Readonly<Record<ArenaId, KillboxArena>> = { "kaiju-complex": KAIJU_COMPLEX, "fracture-floor": FRACTURE_FLOOR, "killbox-prime": KILLBOX_PRIME, skydock: SKYDOCK, "neon-yard": NEON_YARD, "glass-spire": GLASS_SPIRE, riverfront: RIVERFRONT, "solara-outpost": SOLARA_OUTPOST, "frostveil-ring": FROSTVEIL_RING, "thalassia-dome": THALASSIA_DOME };
export const arenaById = (id: string | undefined): KillboxArena | undefined => (id && id in ARENAS ? ARENAS[id as ArenaId] : undefined);
/** every arena a mode plays on, in rotation order; empty = it plays in the open world (Fracture Royale, the old duels) */
export const arenasForMode = (mode: PvpModeId): KillboxArena[] => Object.values(ARENAS).filter((a) => a.modes.includes(mode));
/** the first arena a mode plays on */
export const arenaForMode = (mode: PvpModeId): KillboxArena | undefined => arenasForMode(mode)[0];
/** the map for a mode's `played`-th match (0 = the first today): playlists rotate through their maps */
export function arenaForRun(mode: PvpModeId, played: number): KillboxArena | undefined {
  const list = arenasForMode(mode);
  return list.length ? list[((Math.floor(played) % list.length) + list.length) % list.length] : undefined;
}

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

/** seconds a data pillar takes to rise or sink */
export const SHIFT_SECONDS = 1.2;
/** how far raised (0..1) a shifter is at match time `t`: it eases over SHIFT_SECONDS from each start and end of the event */
export function shifterLift(a: KillboxArena, s: ArenaShifter, t: number): number {
  const f = a.fracture, ev = fractureAt(a, t);
  const raised = (s.phase === "up") !== ev.active;
  let since = Infinity;
  if (t >= f.first) { const into = (t - f.first) % f.every; since = ev.active ? into : into - f.length; }
  const k = Math.min(1, since / SHIFT_SECONDS);
  return raised ? k : 1 - k;
}
/** the shifters that block movement and sight right now (more than half raised) */
export const solidShifters = (a: KillboxArena, t: number) => a.shifters.filter((s) => shifterLift(a, s, t) > 0.5);

const inCover = (a: KillboxArena, dx: number, dz: number, pad: number, t = 0) => a.cover.find((k) => Math.abs(dx - k.x) < k.w / 2 + pad && Math.abs(dz - k.z) < k.d / 2 + pad)
  ?? solidShifters(a, t).find((k) => Math.abs(dx - k.x) < k.w / 2 + pad && Math.abs(dz - k.z) < k.d / 2 + pad);

/** Keeps a body that does not collide with walls (a rival machine, a squadmate) on the rooftops: off the map or inside a prop, it is
 * moved to the nearest point that is on a roof or walkway, `margin` m in from the edge and clear of cover. Arena space in and out. */
export function confine(a: KillboxArena, dx: number, dz: number, margin = 0.8, /** match time, for the shifters */ t = 0): { x: number; z: number; moved: boolean } {
  const onFloor = (x: number, z: number) => Number.isFinite(surfaceAt(a, x, z)) && Number.isFinite(surfaceAt(a, x + margin, z)) && Number.isFinite(surfaceAt(a, x - margin, z))
    && Number.isFinite(surfaceAt(a, x, z + margin)) && Number.isFinite(surfaceAt(a, x, z - margin)) && !inCover(a, x, z, margin * 0.6, t);
  if (onFloor(dx, dz)) return { x: dx, z: dz, moved: false };
  let best = { x: 0, z: 0, d: Infinity };
  const consider = (x: number, z: number) => { if (!onFloor(x, z)) return; const d = Math.hypot(x - dx, z - dz); if (d < best.d) best = { x, z, d }; };
  // nearest point of each walkable rectangle shrunk by the margin, then pushed off any prop it lands in
  const rects = [...a.roofs.map((r) => ({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 })), ...a.walks.map(walkRect)];
  for (const q of rects) {
    const clampX = (x: number) => Math.min(q.x1 - margin, Math.max(q.x0 + margin, x)), clampZ = (z: number) => Math.min(q.z1 - margin, Math.max(q.z0 + margin, z));
    const x = clampX(dx), z = clampZ(dz);
    consider(x, z);
    const k = inCover(a, x, z, margin * 0.6, t);
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

/** the roofs' parapets in world space: along every roof edge with nothing walkable beyond it (the outside of each block, the street
 * side between crossings), found by sampling the edge every 0.5 m. Edges that meet another roof or a walkway stay open. */
export function arenaParapets(a: KillboxArena): Wall[] {
  const out: Wall[] = [], W = wallMaker(a, out), STEP = 0.5, OUT = 0.4;
  for (const r of a.roofs) {
    const lo = r.top - 0.5, hi = r.top + PARAPET;
    // each edge: start, end and the outward normal
    const edges: [number, number, number, number, number, number][] = [
      [r.x0, r.z0, r.x1, r.z0, 0, -1], [r.x0, r.z1, r.x1, r.z1, 0, 1], [r.x0, r.z0, r.x0, r.z1, -1, 0], [r.x1, r.z0, r.x1, r.z1, 1, 0],
    ];
    for (const [ax, az, bx, bz, nx, nz] of edges) {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / STEP));
      let runStart = -1;
      for (let i = 0; i <= n; i++) {
        const t = (i + 0.5) / n, open = i === n || Number.isFinite(surfaceAt(a, ax + (bx - ax) * t + nx * OUT, az + (bz - az) * t + nz * OUT));
        if (!open && runStart < 0) runStart = i;
        if (open && runStart >= 0) { const t0 = runStart / n, t1 = i / n; W(ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1, lo, hi); runStart = -1; }
      }
    }
  }
  return out;
}

/** every solid wall in world space: the parapets, the crossings' rails, the ledges between roof heights, and a box round every prop */
export function arenaWalls(a: KillboxArena): Wall[] {
  const out: Wall[] = arenaParapets(a), W = wallMaker(a, out);
  for (const w of a.walks) if (w.rails) {
    // a rail down each long side, stopping short of the ends so nothing blocks you stepping on or off
    const q = walkRect(w), lo = Math.min(w.top, w.topB) - 0.5, hi = Math.max(w.top, w.topB) + PARAPET;
    if (w.along === "z") { W(q.x0, q.z0 + 0.6, q.x0, q.z1 - 0.6, lo, hi, 0.1); W(q.x1, q.z0 + 0.6, q.x1, q.z1 - 0.6, lo, hi, 0.1); }
    else { W(q.x0 + 0.6, q.z0, q.x1 - 0.6, q.z0, lo, hi, 0.1); W(q.x0 + 0.6, q.z1, q.x1 - 0.6, q.z1, lo, hi, 0.1); }
  }
  for (const l of a.ledges) W(l.ax, l.az, l.bx, l.bz, l.base, l.top, 0.2);
  for (const k of a.cover) {
    const t = roofTopAt(a, k.x, k.z), x0 = k.x - k.w / 2, x1 = k.x + k.w / 2, z0 = k.z - k.d / 2, z1 = k.z + k.d / 2;
    W(x0, z0, x1, z0, t - 0.2, t + k.h); W(x1, z0, x1, z1, t - 0.2, t + k.h); W(x1, z1, x0, z1, t - 0.2, t + k.h); W(x0, z1, x0, z0, t - 0.2, t + k.h);
  }
  return out;
}

/** the walls and sight blockers of the shifters standing at match time `t` (killbox-arena-install.ts swaps them in as they move) */
export function shifterBlockers(a: KillboxArena, t: number): { walls: Wall[]; solids: { id: string; box: SolidBox }[] } {
  const walls: Wall[] = [], W = wallMaker(a, walls), solids: { id: string; box: SolidBox }[] = [];
  for (const k of solidShifters(a, t)) {
    const b = roofTopAt(a, k.x, k.z), x0 = k.x - k.w / 2, x1 = k.x + k.w / 2, z0 = k.z - k.d / 2, z1 = k.z + k.d / 2, c = toWorld(a, k.x, k.z);
    W(x0, z0, x1, z0, b - 0.2, b + k.h); W(x1, z0, x1, z1, b - 0.2, b + k.h); W(x1, z1, x0, z1, b - 0.2, b + k.h); W(x0, z1, x0, z0, b - 0.2, b + k.h);
    solids.push({ id: `arena:${a.id}:shift:${k.id}`, box: { x: c.x, y: a.base + b + k.h / 2, z: c.z, w: k.w, h: k.h, d: k.d } });
  }
  return { walls, solids };
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
  return y > ARENA_ALTITUDE - 2 && overArena(x, z);
}
/** is (x, z) under an arena's footprint? Nothing outdoors lives there (open sea), so it is never a place to resume a save */
export const overArena = (x: number, z: number) => Object.values(ARENAS).some((a) => Math.abs(x - a.site.x) < 90 && Math.abs(z - a.site.z) < 90);
