/** Fracture Gates and the descent (Stage 59, pure). A gate tears open in a region each day; walking through it drops the
 * fireteam into a descent: a stack of tiers, one under the other, each a chamber with a one-way drop shaft into the next,
 * ending in the boss room at the very bottom. There is no dungeon map: the only readout is depth.
 *
 * The descent lives in the same scene as the open world (like interiors.ts pocket rooms and the Storm Islands): a column of
 * floors parked far outside the world disc at altitude, so entering is a teleport, not a scene swap, and the existing
 * player controller, sim enemies and combat all work unchanged. `descentGroundAt` is the floor under you (the Storm
 * Islands' stormGroundAt pattern), and `descentSolids` are its walls for sweepSolids. Design: the "World Fracture —
 * Dungeon Design: The Descent" doc (ranks, sizes, the nine signature dungeons). */
import { REGIONS } from "./world";
import { slopeAt, walkHeight, WATER_LEVEL } from "./terrain";
import type { SolidBox } from "./environment-collision";

export type RiftRank = "F" | "E" | "D" | "C" | "B" | "A" | "S";
export const RANK_ORDER: readonly RiftRank[] = ["F", "E", "D", "C", "B", "A", "S"];

export type RankSpec = {
  label: string;
  /** total depth from the threshold floor to the boss floor, metres */
  depth: number;
  /** floors in the stack, threshold and boss room included */
  tiers: number;
  /** mechanic encounter arenas before the boss */
  encounters: number;
  /** enemy count multiplier for the tier plans (descent-run.ts) */
  enemyScale: number;
  /** champion types that can appear: Bulwark, then Surge, then Juggernaut */
  champions: number;
  /** gate portal height in the world, metres */
  gateHeight: number;
  /** seconds the boss can stay up before the descent collapses */
  enrage: number;
};

export const RANKS: Readonly<Record<RiftRank, RankSpec>> = {
  F: { label: "Initiate", depth: 60, tiers: 3, encounters: 0, enemyScale: 0.6, champions: 0, gateHeight: 25, enrage: 300 },
  E: { label: "Low Threat", depth: 120, tiers: 4, encounters: 1, enemyScale: 0.75, champions: 0, gateHeight: 30, enrage: 300 },
  D: { label: "Standard", depth: 200, tiers: 5, encounters: 1, enemyScale: 0.9, champions: 0, gateHeight: 35, enrage: 330 },
  C: { label: "Dangerous", depth: 300, tiers: 6, encounters: 2, enemyScale: 1, champions: 1, gateHeight: 40, enrage: 360 },
  B: { label: "Elite", depth: 450, tiers: 7, encounters: 2, enemyScale: 1.15, champions: 2, gateHeight: 45, enrage: 390 },
  A: { label: "Catastrophic", depth: 650, tiers: 8, encounters: 3, enemyScale: 1.3, champions: 3, gateHeight: 52, enrage: 420 },
  S: { label: "Legendary", depth: 1000, tiers: 10, encounters: 3, enemyScale: 1.5, champions: 3, gateHeight: 60, enrage: 450 },
};

/** gate colour by the rank it SHOWS: cyan F–D, violet C–B, crimson-gold A–S; sealed gates burn red */
export function gateColor(rank: RiftRank, sealed: boolean): { core: string; rim: string } {
  if (sealed) return { core: "#ff2a2a", rim: "#ff8a5c" };
  const i = RANK_ORDER.indexOf(rank);
  if (i <= 2) return { core: "#5ee7ff", rim: "#b8f6ff" };
  if (i <= 4) return { core: "#a970ff", rim: "#dcc4ff" };
  return { core: "#ff3b3b", rim: "#ffc860" };
}

export type DescentTheme = { fog: string; stone: string; trim: string; glow: string; light: string };
export type SignatureDungeon = {
  id: string;
  name: string;
  /** REGIONS id the gate opens in, or null while it has no gate site yet */
  regionId: string | null;
  /** where the dungeon belongs, for the HUD/briefing */
  place: string;
  rank: RiftRank;
  /** entrance closes behind you: the only way out is the boss room */
  sealed: boolean;
  look: string;
  theme: DescentTheme;
  gatekeeper: string;
  boss: string;
  bossMechanic: string;
  /** enemy names shown in the briefing; the sim's regional troops are what actually spawn */
  roster: readonly string[];
};

export const SIGNATURE_DUNGEONS: readonly SignatureDungeon[] = [
  { id: "rootbound-labyrinth", name: "The Rootbound Labyrinth", regionId: "veridan", place: "Verdant Forest", rank: "C", sealed: false,
    look: "A descent through the hollow roots of a colossal tree; fungus is the only light.",
    theme: { fog: "#0b1a14", stone: "#3a3328", trim: "#5b4a33", glow: "#7dffb0", light: "#3fe08a" },
    gatekeeper: "Rootbound Warden", boss: "The Heartwood Warden", bossMechanic: "Sever the glowing root veins feeding its shield.", roster: ["Silt-Stalkers", "Spore swarms", "Root-bound Hollow Knights"] },
  { id: "drowned-cathedral", name: "The Drowned Cathedral", regionId: "swamps", place: "Shrouded Swamps", rank: "B", sealed: false,
    look: "A gothic cathedral sinking into the swamp; stained glass glowing under black water.",
    theme: { fog: "#081413", stone: "#2c3330", trim: "#41504a", glow: "#6fe3d0", light: "#4ac7b4" },
    gatekeeper: "The Drowned Deacon", boss: "The Drowned Choir", bossMechanic: "Match its sung tones on the nave bells; a wrong tone floods the floor.", roster: ["Swamp-Mutated Stalkers", "Drowned choir husks", "Automated Tech-Drones"] },
  { id: "tomb-hollow-sun", name: "Tomb of the Hollow Sun", regionId: "solara", place: "Solara Desert", rank: "B", sealed: false,
    look: "A sand-buried solar temple dropping into a chamber lit by a dying artificial sun.",
    theme: { fog: "#1c120a", stone: "#6b4a2c", trim: "#a37440", glow: "#ffc86a", light: "#ffb347" },
    gatekeeper: "Sun-Scarab Matriarch", boss: "The Hollow Regent", bossMechanic: "Angle mirror pylons to reignite the sun and open each damage window.", roster: ["Sand-wrapped Hollow Knights", "Sun-scarab swarms"] },
  { id: "iron-grave", name: "The Iron Grave", regionId: "wastelands", place: "The Wastelands", rank: "B", sealed: false,
    look: "A mine shaft stacked with wrecked tanks, mechs and convoy rigs; rust, sparks and failing floodlights.",
    theme: { fog: "#140f0b", stone: "#3b3029", trim: "#6a4b33", glow: "#ff9a3c", light: "#ffb070" },
    gatekeeper: "Scrap Golem Foreman", boss: "The Scrap Colossus", bossMechanic: "Knock out the magnet pylons or it rebuilds lost limbs from the wrecks.", roster: ["Mutated Raider crews", "Scrap golems", "Turret nests"] },
  { id: "eternal-whiteout", name: "The Eternal Whiteout", regionId: "frostspire", place: "Frostspire Mountains", rank: "A", sealed: true,
    look: "A crevasse into a glacier: blizzard above, dead silence below, soldiers frozen in blue ice.",
    theme: { fog: "#0b1420", stone: "#4a5a6a", trim: "#7d93a8", glow: "#9fe3ff", light: "#8fd0ff" },
    gatekeeper: "Rime Sentinel", boss: "The Whiteout Sovereign", bossMechanic: "Seen only as a shadow in its blizzard; thermal flares reveal it long enough to hit.", roster: ["Frost stalkers", "Ice-blade drones"] },
  { id: "crucible-fallen", name: "Crucible of the Fallen", regionId: "ember", place: "Ember Peaks", rank: "A", sealed: true,
    look: "A failed stabilization foundry inside the volcano: molten channels, hammer pistons, obsidian.",
    theme: { fog: "#1a0806", stone: "#2a1d1a", trim: "#4a2a20", glow: "#ff5a1f", light: "#ff7a3a" },
    gatekeeper: "Foundry Overseer", boss: "The Fallen Forgemind", bossMechanic: "The foundry AI fights with the forge itself.", roster: ["Magma-Mutated Crawlers", "Ash Hunters", "Corrupted Drones"] },
  { id: "sublevel-protocol", name: "The Sublevel Protocol", regionId: null, place: "Neon City", rank: "C", sealed: false,
    look: "Abandoned metro, flooded server vaults and black sites under Neon City.",
    theme: { fog: "#0a0816", stone: "#25222e", trim: "#3a3448", glow: "#ff3fd0", light: "#5ee7ff" },
    gatekeeper: "Security Overseer", boss: "The Sublevel Admin", bossMechanic: "A security AI that copies itself; find the real one.", roster: ["Corrupted security androids", "Glitch phantoms"] },
  { id: "forgotten-foundation", name: "The Forgotten Foundation", regionId: null, place: "Nexus City", rank: "S", sealed: true,
    look: "The unfinished simulation under Nexus: grid floors, wireframe walls.",
    theme: { fog: "#05070c", stone: "#1c222c", trim: "#e8edf5", glow: "#cfe6ff", light: "#9fc6ff" },
    gatekeeper: "Compliance Warden", boss: "The Foundation Warden", bossMechanic: "Rewrites the arena's rules each phase.", roster: ["Compliance drones", "Wireframe constructs"] },
  { id: "abyssal-vault", name: "The Abyssal Vault", regionId: null, place: "Thalassia", rank: "S", sealed: true,
    look: "A pressure vault below Thalassia's deepest zone; containment doors hundreds of metres tall.",
    theme: { fog: "#02060c", stone: "#14202a", trim: "#24384a", glow: "#3fd0ff", light: "#2a9cff" },
    gatekeeper: "Depth Warden", boss: "The Pressure Leviathan", bossMechanic: "Changes water pressure each phase.", roster: ["Depth Security Drones", "Abyssal predators"] },
];

export const dungeonById = (id: string): SignatureDungeon | null => SIGNATURE_DUNGEONS.find((d) => d.id === id) ?? null;

/* ---------------- daily gates ---------------- */

export const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
/** small deterministic hash (FNV-1a) so every client places the same gate on the same day */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export type FractureGate = {
  id: string;
  dungeonId: string;
  day: string;
  x: number; z: number; y: number;
  /** the rank the gate reads as */
  shownRank: RiftRank;
  /** the rank it really is: usually the same; about one gate-day in seven runs a rank deeper than it reads */
  trueRank: RiftRank;
  sealed: boolean;
};

/** where the gate stands: the first dry, gentle spot on a seeded ring around the region centre (between 30% and 60% of its
 * radius, away from the hub) */
function gateSite(regionId: string, day: string): { x: number; z: number; y: number } | null {
  const r = REGIONS.find((g) => g.id === regionId);
  if (!r) return null;
  const h = hash(`${regionId}:${day}`);
  for (let k = 0; k < 24; k++) {
    const a = ((h % 3600) / 3600) * Math.PI * 2 + k * 2.399;
    const d = r.radius * (0.3 + (((h >>> 8) + k * 37) % 30) / 100);
    const x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
    const ground = walkHeight(x, z);
    if (ground > WATER_LEVEL + 1.5 && slopeAt(x, z) < 0.35) return { x, z, y: ground };
  }
  return null;
}

export function gatesForDay(now: number): FractureGate[] {
  const day = dayOf(now);
  const out: FractureGate[] = [];
  for (const d of SIGNATURE_DUNGEONS) {
    if (!d.regionId) continue;
    const site = gateSite(d.regionId, day);
    if (!site) continue;
    const i = RANK_ORDER.indexOf(d.rank);
    const lies = hash(`${d.id}:${day}:rank`) % 7 === 0 && i < RANK_ORDER.length - 1;
    out.push({ id: `${d.id}:${day}`, dungeonId: d.id, day, ...site, shownRank: d.rank, trueRank: lies ? RANK_ORDER[i + 1]! : d.rank, sealed: d.sealed });
  }
  return out;
}

/** gate radius you walk into (the lower half of the ring) */
export const gateRadius = (rank: RiftRank) => RANKS[rank].gateHeight * 0.18;
export function gateAt(gates: readonly FractureGate[], x: number, z: number): FractureGate | null {
  for (const g of gates) if (Math.hypot(x - g.x, z - g.z) <= gateRadius(g.shownRank)) return g;
  return null;
}

/* ---------------- the descent layout ---------------- */

/** the column sits far outside the world disc (interiors park at x = 2000; the Storm Islands near x = 980) */
export const DESCENT_ORIGIN = { x: -2600, z: -2600 } as const;
/** threshold floor altitude; the deepest S-rank boss floor is still 900 m above the sea */
export const DESCENT_TOP = 1900;
/** every tier's drop shaft sits this far from the centre line, alternating ends, so each tier is a walk across the room */
export const DROP_OFFSET = 26;
export const DROP_RADIUS = 6;

export type TierKind = "THRESHOLD" | "CHAMBER" | "ENCOUNTER" | "GATEKEEPER" | "BOSS" | "NESTED";
export type Tier = {
  index: number;
  kind: TierKind;
  /** floor surface height */
  floorY: number;
  /** room footprint around the column centre */
  w: number; d: number;
  /** where you land arriving from above */
  landing: { x: number; z: number };
  /** the one-way drop to the next tier; null on the boss floor (its way down is the nested crack, if it opens) */
  drop: { x: number; z: number } | null;
  /** you must clear this tier before its drop opens */
  gated: boolean;
  /** headroom: the walls stop under the next floor up */
  wallH: number;
};
export type DescentLayout = { dungeonId: string; rank: RiftRank; origin: { x: number; z: number }; tiers: Tier[]; nested: Tier };

const SIZE: Record<TierKind, { w: number; d: number }> = {
  THRESHOLD: { w: 48, d: 72 }, CHAMBER: { w: 56, d: 76 }, ENCOUNTER: { w: 92, d: 104 }, GATEKEEPER: { w: 72, d: 84 }, BOSS: { w: 140, d: 140 }, NESTED: { w: 80, d: 80 },
};

/** which floors are mechanic arenas: spread the rank's encounters evenly through the middle tiers */
export function tierKinds(rank: RiftRank): TierKind[] {
  const spec = RANKS[rank];
  const kinds: TierKind[] = Array.from({ length: spec.tiers }, () => "CHAMBER");
  kinds[0] = "THRESHOLD";
  kinds[spec.tiers - 1] = "BOSS";
  const gk = RANK_ORDER.indexOf(rank) >= RANK_ORDER.indexOf("B");
  if (gk) kinds[spec.tiers - 2] = "GATEKEEPER";
  const middle = Array.from({ length: spec.tiers - 2 - (gk ? 1 : 0) }, (_, i) => i + 1);
  for (let e = 0; e < spec.encounters && middle.length; e++) {
    const at = middle[Math.min(middle.length - 1, Math.floor(((e + 1) * middle.length) / (spec.encounters + 1)))]!;
    kinds[at] = "ENCOUNTER";
  }
  return kinds;
}

export function buildDescent(dungeonId: string, rank: RiftRank, origin: { x: number; z: number } = DESCENT_ORIGIN): DescentLayout {
  const spec = RANKS[rank];
  const kinds = tierKinds(rank);
  const step = spec.depth / (spec.tiers - 1);
  const tiers: Tier[] = kinds.map((kind, index) => {
    const side = index % 2 === 0 ? 1 : -1;
    const size = SIZE[kind];
    return {
      index, kind,
      floorY: DESCENT_TOP - index * step,
      w: size.w, d: size.d,
      // you arrive at the opposite end from this tier's own drop (where the drop above lets you out)
      landing: { x: origin.x, z: origin.z - side * DROP_OFFSET },
      drop: kind === "BOSS" ? null : { x: origin.x, z: origin.z + side * DROP_OFFSET },
      gated: kind !== "THRESHOLD" && kind !== "CHAMBER",
      wallH: Math.min(28, step - 2),
    };
  });
  const boss = tiers[tiers.length - 1]!;
  const nested: Tier = { index: tiers.length, kind: "NESTED", floorY: boss.floorY - 80, ...SIZE.NESTED, landing: { x: origin.x, z: origin.z }, drop: null, gated: true, wallH: 40 };
  return { dungeonId, rank, origin, tiers, nested };
}

/** which drops are open: a gated tier's drop opens once it is cleared; the nested crack is the boss room's centre */
export type OpenWays = { drops: ReadonlySet<number>; nested: boolean };

const inRoom = (t: Tier, o: { x: number; z: number }, x: number, z: number) => Math.abs(x - o.x) <= t.w / 2 && Math.abs(z - o.z) <= t.d / 2;
const inHole = (t: Tier, open: OpenWays, x: number, z: number) =>
  !!t.drop && open.drops.has(t.index) && Math.hypot(x - t.drop.x, z - t.drop.z) < DROP_RADIUS;

/** nested crack: a 9 m hole in the centre of the boss room */
export const CRACK_RADIUS = 9;
const inCrack = (layout: DescentLayout, t: Tier, open: OpenWays, x: number, z: number) =>
  t.kind === "BOSS" && open.nested && Math.hypot(x - layout.origin.x, z - layout.origin.z) < CRACK_RADIUS;

/** the floor under (x, z) for feet at `feetY`: the highest floor at or below the feet (within a 3 m step) whose room
 * covers the point and that has no open hole there; -Infinity outside the descent */
export function descentGroundAt(layout: DescentLayout, open: OpenWays, x: number, z: number, feetY: number): number {
  const all = open.nested ? [...layout.tiers, layout.nested] : layout.tiers;
  for (const t of all) {
    if (feetY < t.floorY - 3) continue;
    if (!inRoom(t, layout.origin, x, z)) continue;
    if (inHole(t, open, x, z) || inCrack(layout, t, open, x, z)) continue;
    return t.floorY;
  }
  return -Infinity;
}

/** the tier whose floor you are standing on or falling toward */
export function tierAt(layout: DescentLayout, feetY: number, nestedOpen = false): Tier {
  const all = nestedOpen ? [...layout.tiers, layout.nested] : layout.tiers;
  for (const t of all) if (feetY >= t.floorY - 3) return t;
  return all[all.length - 1]!;
}

/** inside an open drop shaft between two floors: the fall is slowed to a controlled descent (a gravity lift, no splat) */
export function inShaft(layout: DescentLayout, open: OpenWays, x: number, z: number, feetY: number): boolean {
  for (const t of layout.tiers) {
    if (feetY > t.floorY + 1) continue;
    const below = layout.tiers[t.index + 1];
    const floorBelow = below ? below.floorY : t.kind === "BOSS" ? layout.nested.floorY : -Infinity;
    if (feetY < floorBelow) continue;
    if (t.drop && open.drops.has(t.index) && Math.hypot(x - t.drop.x, z - t.drop.z) < DROP_RADIUS + 2) return true;
    if (inCrack(layout, t, open, x, z)) return true;
  }
  return false;
}

/** inside the descent column at all (for world-bounds, atmosphere and HUD) */
export function inDescentSpace(layout: DescentLayout, x: number, z: number, y: number): boolean {
  return Math.abs(x - layout.origin.x) < 120 && Math.abs(z - layout.origin.z) < 120 && y > layout.nested.floorY - 40 && y < DESCENT_TOP + 60;
}

/** walls of every floor, for sweepSolids: a closed box per tier (there is no way out sideways) */
export function descentSolids(layout: DescentLayout, nestedOpen: boolean): SolidBox[] {
  const all = nestedOpen ? [...layout.tiers, layout.nested] : layout.tiers;
  const boxes: SolidBox[] = [];
  const t = 2;
  for (const tier of all) {
    const { x, z } = layout.origin, y = tier.floorY + tier.wallH / 2;
    boxes.push(
      { x, y, z: z - tier.d / 2 - t / 2, w: tier.w + 2 * t, h: tier.wallH, d: t },
      { x, y, z: z + tier.d / 2 + t / 2, w: tier.w + 2 * t, h: tier.wallH, d: t },
      { x: x - tier.w / 2 - t / 2, y, z, w: t, h: tier.wallH, d: tier.d },
      { x: x + tier.w / 2 + t / 2, y, z, w: t, h: tier.wallH, d: tier.d },
    );
  }
  return boxes;
}

/** depth readout: metres below the threshold floor */
export const depthBelow = (feetY: number) => Math.max(0, Math.round(DESCENT_TOP - feetY));

/* ---------------- the live descent (one at a time, read by sim.ts like stormGroundAt) ---------------- */

let live: { layout: DescentLayout; open: OpenWays } | null = null;
export function setActiveDescent(next: { layout: DescentLayout; open: OpenWays } | null) { live = next; }
export function activeDescent() { return live; }
/** the live descent's floor under (x, z), for sim enemies and the player; -Infinity when no descent is running */
export function liveDescentGroundAt(x: number, z: number, feetY: number): number {
  return live ? descentGroundAt(live.layout, live.open, x, z, feetY) : -Infinity;
}
