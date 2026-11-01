/** Dungeon trials: puzzle floors and parkour floors inside the walkable descents (pure; fracture-gates.ts builds them into the layout,
 * descent-runtime.ts runs them). Every dungeon has its own puzzle type and its own climb/drop style, and a difficulty set by the dungeon's
 * own hardness and the gate's true rank, so a rank-C Rootbound run and a rank-S Abyssal run are different tests, not the same floor longer.
 *
 * PARKOUR floor: no floor at all. A chain of platforms over the pit from the landing pad to the pad around the drop shaft. ASCENT climbs up
 * to a summit and back down; GAP_RUN is a sprint across islands at wandering heights. Touch the summit pad to clear it (the drop opens);
 * fall into the pit and you are put back on the landing pad (a stumble, never a death). Gaps and rises are kept inside what every class
 * can do on foot (tests/descent-trials.test.ts check the physics numbers below).
 * PUZZLE floor: a SEQUENCE (step on the glyph plates in the order of their pips), BEACONS (stand in each beacon until it charges, they leak
 * charge when you leave) or a RELAY (touch the lit plates in a chain before the clock runs out). */
export type PuzzleKind = "SEQUENCE" | "BEACONS" | "RELAY";
export type ParkourKind = "ASCENT" | "GAP_RUN";
export type Platform = { x: number; z: number; w: number; d: number; /** absolute top surface height */ top: number };
export type ParkourCourse = { kind: ParkourKind; platforms: Platform[]; /** the platform whose touch clears the floor */ summit: number; /** falling below this puts you back on the landing pad */ fallBelow: number };
export type PuzzlePlate = { x: number; z: number; /** 0-based position in the required order (SEQUENCE, RELAY) */ order: number };
export type PuzzleSpec = { kind: PuzzleKind; plates: PuzzlePlate[]; /** plate / beacon trigger radius */ radius: number; /** BEACONS: seconds to fill one */ charge: number; /** RELAY: seconds for the whole chain (0 otherwise) */ timeLimit: number };
export type TierTrial = { parkour?: ParkourCourse; puzzle?: PuzzleSpec };

export const PUZZLE_NAME: Record<PuzzleKind, string> = { SEQUENCE: "Glyph sequence", BEACONS: "Beacon charge", RELAY: "Chain relay" };
export const PARKOUR_NAME: Record<ParkourKind, string> = { ASCENT: "Climb and drop", GAP_RUN: "Island run" };

/* ---------------- what each dungeon asks ---------------- */
export type DungeonTrial = { puzzle: PuzzleKind; parkour: ParkourKind; /** 0 (gentle) to 1 (brutal): the dungeon's own hardness */ hardness: number };
export const DUNGEON_TRIALS: Readonly<Record<string, DungeonTrial>> = {
  "rootbound-labyrinth": { puzzle: "BEACONS", parkour: "ASCENT", hardness: 0.3 },
  "drowned-cathedral": { puzzle: "SEQUENCE", parkour: "GAP_RUN", hardness: 0.45 },
  "tomb-hollow-sun": { puzzle: "RELAY", parkour: "ASCENT", hardness: 0.5 },
  "iron-grave": { puzzle: "BEACONS", parkour: "GAP_RUN", hardness: 0.55 },
  "eternal-whiteout": { puzzle: "SEQUENCE", parkour: "ASCENT", hardness: 0.6 },
  "crucible-fallen": { puzzle: "RELAY", parkour: "GAP_RUN", hardness: 0.7 },
  "sublevel-protocol": { puzzle: "SEQUENCE", parkour: "GAP_RUN", hardness: 0.65 },
  "forgotten-foundation": { puzzle: "RELAY", parkour: "ASCENT", hardness: 0.8 },
  "abyssal-vault": { puzzle: "BEACONS", parkour: "GAP_RUN", hardness: 1 },
  // the playable strikes (strike-sites.ts): one trial each, kept gentler than the big dungeons so a strike stays a ten-minute mission
  "strike-slagworks": { puzzle: "SEQUENCE", parkour: "GAP_RUN", hardness: 0.35 },
  "strike-bloom": { puzzle: "BEACONS", parkour: "ASCENT", hardness: 0.3 },
  "strike-drowned-relay": { puzzle: "SEQUENCE", parkour: "ASCENT", hardness: 0.4 },
  "strike-skyline-override": { puzzle: "RELAY", parkour: "GAP_RUN", hardness: 0.45 },
};
export const trialOf = (dungeonId: string): DungeonTrial => DUNGEON_TRIALS[dungeonId] ?? { puzzle: "SEQUENCE", parkour: "GAP_RUN", hardness: 0.5 };
const RANKS = ["F", "E", "D", "C", "B", "A", "S"] as const;
/** the trials' difficulty, 0 to 1: the dungeon's own hardness (55%) and the gate's true rank (45%) */
export const trialDifficulty = (dungeonId: string, rank: string) => Math.max(0, Math.min(1, 0.55 * trialOf(dungeonId).hardness + 0.45 * (Math.max(0, RANKS.indexOf(rank as (typeof RANKS)[number])) / 6)));
/** how many puzzle and parkour floors a rank's descent gets (limited by the chamber floors it has) */
export const TRIAL_COUNTS: Record<string, { puzzles: number; parkour: number }> = { F: { puzzles: 0, parkour: 0 }, E: { puzzles: 1, parkour: 0 }, D: { puzzles: 1, parkour: 1 }, C: { puzzles: 2, parkour: 1 }, B: { puzzles: 2, parkour: 2 }, A: { puzzles: 3, parkour: 2 }, S: { puzzles: 3, parkour: 3 } };

/* ---------------- what the player can do (the numbers the generator stays inside) ---------------- */
/** foot speed with no sprint (BASE_FOOT_SPEED 14; sprint is 2.1×), ground-jump apex 6.5 m, gravity 26 (Scene.tsx's jump) */
export const WALK_SPEED = 14, JUMP_APEX = 6.5, GRAVITY = 26;
export const AIRTIME = (2 * Math.sqrt(2 * GRAVITY * JUMP_APEX)) / GRAVITY; // ≈ 1.41 s level
/** the farthest edge-to-edge gap and the highest rise the generator may ask: well under a walking jump (≈ 19.8 m) and the apex */
export const MAX_GAP = 13, MAX_RISE = 4.5;
export const STEP_UP = 1.2;

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed: string) => { let s = hash(seed) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

type Room = { origin: { x: number; z: number }; floorY: number; wallH: number; w: number; d: number; landing: { x: number; z: number }; drop: { x: number; z: number } | null };

/* ---------------- parkour ---------------- */
export function buildParkour(room: Room, kind: ParkourKind, difficulty: number, seed: string): ParkourCourse {
  const r = rng(`${seed}:parkour`);
  const dif = Math.max(0, Math.min(1, difficulty));
  const size = Math.max(5, 10 - 5 * dif), gapTarget = 3 + 9 * dif;
  const a = room.landing, b = room.drop ?? room.landing;
  const lateral = Math.min(room.w / 2 - 12, 8 + 22 * dif), waves = 1 + Math.floor(r() * 2);
  const phase = r() < 0.5 ? 1 : -1;
  const path = (t: number) => ({ x: a.x + (b.x - a.x) * t + phase * lateral * Math.sin(t * Math.PI * waves), z: a.z + (b.z - a.z) * t });
  // arc length of the path, then platforms at equal arc spacing
  const N = 240; const pts = Array.from({ length: N + 1 }, (_, i) => path(i / N));
  const cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z));
  const L = cum[N]!;
  const H = Math.max(2, Math.min(room.wallH - 5, kind === "ASCENT" ? 6 + 10 * dif : 3 + 9 * dif));
  let hops = Math.max(4, Math.ceil(L / (size + gapTarget)));
  if (kind === "ASCENT") hops = Math.max(hops, Math.ceil((H * Math.PI) / (MAX_RISE - 0.6))); // the steepest step of the up-and-down curve (and the half-metre rounding) stays inside MAX_RISE
  const at = (u: number) => { const target = u * L; let i = 1; while (i < N && cum[i]! < target) i++; const k = (target - cum[i - 1]!) / Math.max(1e-6, cum[i]! - cum[i - 1]!); return { x: pts[i - 1]!.x + (pts[i]!.x - pts[i - 1]!.x) * k, z: pts[i - 1]!.z + (pts[i]!.z - pts[i - 1]!.z) * k }; };
  const rise = Math.min(MAX_RISE - 1, 1 + 2.5 * dif);
  const platforms: Platform[] = [];
  let y = 0;
  let summit = hops;
  for (let i = 0; i <= hops; i++) {
    const p = at(i / hops), end = i === 0 || i === hops;
    let h: number;
    if (end) h = 0;
    else if (kind === "ASCENT") h = H * Math.sin((i / hops) * Math.PI);
    else { y = Math.max(0, Math.min(H, y + (r() * 2 - 1) * rise)); h = Math.min(y, (MAX_RISE - 0.6) * Math.min(i, hops - i)); }
    // heights are quantised so a step is never a fraction of a metre
    h = Math.round(h * 2) / 2;
    const s = i === 0 ? 14 : i === hops ? 18 : size;
    platforms.push({ x: p.x, z: p.z, w: s, d: s, top: room.floorY + h });
  }
  if (kind === "ASCENT") { summit = platforms.reduce((best, p, i) => (p.top > platforms[best]!.top ? i : best), 1); platforms[summit] = { ...platforms[summit]!, w: 12, d: 12 }; }
  return { kind, platforms, summit, fallBelow: room.floorY - 8 };
}

/** the highest platform top under (x, z) the feet can step onto (feet at most STEP_UP below it); null when there is none */
export function platformGround(course: ParkourCourse, x: number, z: number, feetY: number): number | null {
  let best: number | null = null;
  for (const p of course.platforms) {
    if (Math.abs(x - p.x) > p.w / 2 || Math.abs(z - p.z) > p.d / 2) continue;
    if (p.top > feetY + STEP_UP) continue;
    if (best === null || p.top > best) best = p.top;
  }
  return best;
}
/** standing on the summit pad (the touch that clears a parkour floor) */
export function onSummit(course: ParkourCourse, x: number, z: number, feetY: number): boolean {
  const p = course.platforms[course.summit]!;
  return Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2 && Math.abs(feetY - p.top) <= 1.5;
}
/** the worst edge-to-edge gap and rise between consecutive platforms (tests check these against MAX_GAP and MAX_RISE) */
export function courseExtremes(course: ParkourCourse): { gap: number; rise: number } {
  let gap = 0, rise = 0;
  for (let i = 1; i < course.platforms.length; i++) {
    const a = course.platforms[i - 1]!, b = course.platforms[i]!;
    const gx = Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2), gz = Math.max(0, Math.abs(a.z - b.z) - (a.d + b.d) / 2);
    gap = Math.max(gap, Math.hypot(gx, gz));
    rise = Math.max(rise, b.top - a.top);
  }
  return { gap, rise };
}

/* ---------------- puzzles ---------------- */
export function buildPuzzle(room: Room, kind: PuzzleKind, difficulty: number, seed: string): PuzzleSpec {
  const r = rng(`${seed}:puzzle`);
  const dif = Math.max(0, Math.min(1, difficulty));
  const cx = room.origin.x, cz = room.origin.z;
  const clear = (x: number, z: number) => Math.hypot(x - room.landing.x, z - room.landing.z) > 14 && (!room.drop || Math.hypot(x - room.drop.x, z - room.drop.z) > 14);
  const place = (n: number, minR: number, maxR: number, minGap: number) => {
    const out: { x: number; z: number }[] = [];
    for (let tries = 0; out.length < n && tries < 600; tries++) {
      const ang = r() * Math.PI * 2, rad = minR + r() * (maxR - minR);
      const x = cx + Math.cos(ang) * rad, z = cz + Math.sin(ang) * rad * 1.1;
      if (Math.abs(x - cx) > room.w / 2 - 6 || Math.abs(z - cz) > room.d / 2 - 6 || !clear(x, z)) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.z - z) < minGap)) continue;
      out.push({ x, z });
    }
    // a packed room: fall back to a ring so the count is always met
    for (let k = out.length; k < n; k++) { const ang = (k / n) * Math.PI * 2 + 0.3; out.push({ x: cx + Math.cos(ang) * (maxR * 0.9), z: cz + Math.sin(ang) * (maxR * 0.9) }); }
    return out;
  };
  const shuffled = (n: number) => { const o = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j]!, o[i]!]; } return o; };
  if (kind === "SEQUENCE") {
    const n = 3 + Math.round(4 * dif), pos = place(n, 12, 34, 12), ord = shuffled(n);
    return { kind, plates: pos.map((p, i) => ({ ...p, order: ord[i]! })), radius: 3.2, charge: 0, timeLimit: 0 };
  }
  if (kind === "BEACONS") {
    const n = 2 + Math.round(3 * dif), pos = place(n, 18, 38, 22);
    return { kind, plates: pos.map((p, i) => ({ ...p, order: i })), radius: 6, charge: 4 + 4 * dif, timeLimit: 0 };
  }
  const n = 4 + Math.round(5 * dif), pos = place(n, 10, 38, 14);
  // chain order: nearest next, from the plate closest to the landing
  const left = [...pos]; const chain: { x: number; z: number }[] = [];
  let cur = { x: room.landing.x, z: room.landing.z };
  while (left.length) { let bi = 0; for (let i = 1; i < left.length; i++) if (Math.hypot(left[i]!.x - cur.x, left[i]!.z - cur.z) < Math.hypot(left[bi]!.x - cur.x, left[bi]!.z - cur.z)) bi = i; cur = left.splice(bi, 1)[0]!; chain.push(cur); }
  let len = 0; for (let i = 1; i < chain.length; i++) len += Math.hypot(chain[i]!.x - chain[i - 1]!.x, chain[i]!.z - chain[i - 1]!.z);
  const timeLimit = Math.round((len / WALK_SPEED) * (1.7 - 0.7 * dif) + 4);
  return { kind: "RELAY", plates: chain.map((p, i) => ({ ...p, order: i })), radius: 3.4, charge: 0, timeLimit };
}

/* ---------------- the puzzle state machine ---------------- */
export type PuzzleState = {
  /** SEQUENCE / RELAY: how many correct plates so far */
  progress: number;
  /** BEACONS: charge 0..1 per beacon */
  charge: number[];
  /** the plate the player stood on last frame (-1 none), so a plate triggers once per step on */
  on: number;
  /** RELAY: when the chain began (seconds), null before the first plate */
  startedAt: number | null;
  /** seconds of the last mistake, for the wrong-glow */
  wrongAt: number;
  done: boolean;
};
export type PuzzleEvent = "STEP" | "WRONG" | "RESET" | "BEACON_FULL" | "DONE";
export const freshPuzzle = (spec: PuzzleSpec): PuzzleState => ({ progress: 0, charge: spec.plates.map(() => 0), on: -1, startedAt: null, wrongAt: -1e9, done: false });
export const BEACON_LEAK = 0.35;

export function stepPuzzle(spec: PuzzleSpec, state: PuzzleState, inp: { x: number; z: number; now: number; dt: number }): { state: PuzzleState; events: PuzzleEvent[] } {
  if (state.done) return { state, events: [] };
  const events: PuzzleEvent[] = [];
  let s: PuzzleState = { ...state, charge: [...state.charge] };
  const under = spec.plates.findIndex((p) => Math.hypot(inp.x - p.x, inp.z - p.z) <= spec.radius);
  const fresh = under >= 0 && under !== s.on;
  if (spec.kind === "BEACONS") {
    spec.plates.forEach((_, i) => {
      const before = s.charge[i]!;
      if (before >= 1) return;
      const rate = i === under ? inp.dt / spec.charge : -inp.dt * BEACON_LEAK / spec.charge;
      s.charge[i] = Math.max(0, Math.min(1, before + rate));
      if (before < 1 && s.charge[i]! >= 1) events.push("BEACON_FULL");
    });
    if (s.charge.every((c) => c >= 1)) { s.done = true; events.push("DONE"); }
  } else if (spec.kind === "SEQUENCE") {
    if (fresh) {
      const plate = spec.plates[under]!;
      if (plate.order === s.progress) { s.progress++; events.push("STEP"); if (s.progress >= spec.plates.length) { s.done = true; events.push("DONE"); } }
      else if (plate.order !== s.progress - 1) { s.progress = 0; s.wrongAt = inp.now; events.push("WRONG"); } // the plate you just pressed is never a mistake
    }
  } else {
    if (s.startedAt !== null && inp.now - s.startedAt > spec.timeLimit) { s = { ...s, progress: 0, startedAt: null }; events.push("RESET"); }
    if (fresh) {
      const plate = spec.plates[under]!;
      if (plate.order === s.progress) {
        if (s.progress === 0) s.startedAt = inp.now;
        s.progress++; events.push("STEP");
        if (s.progress >= spec.plates.length) { s.done = true; events.push("DONE"); }
      }
    }
  }
  s.on = under;
  return { state: s, events };
}

/* ---------------- the live trial (read by the renderer, like fracture-gates.ts's active descent) ---------------- */
export type LiveTrial = { tier: number; spec: PuzzleSpec; state: PuzzleState } | null;
let liveTrial: LiveTrial = null;
export const setLiveTrial = (t: LiveTrial) => { liveTrial = t; };
export const getLiveTrial = () => liveTrial;

/** the trials a floor gets: its kind decides which */
export function buildTrial(room: Room, kind: "PARKOUR" | "PUZZLE", dungeonId: string, rank: string, seed: string): TierTrial {
  const t = trialOf(dungeonId), dif = trialDifficulty(dungeonId, rank);
  return kind === "PARKOUR" ? { parkour: buildParkour(room, t.parkour, dif, seed) } : { puzzle: buildPuzzle(room, t.puzzle, dif, seed) };
}
