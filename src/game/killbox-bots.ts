/** Killbox bots (owner, Nov 2 2026: "play killbox modes with AI bots to play with and play against"). On a built arena every slot of
 * both teams is on the field: your teammates are ally bots run here, and the other team is rival operators — sim machines (so your
 * shots, abilities and the hit feedback work on them as on any enemy) whose movement and fire this module drives instead of the
 * world AI. Bots fight each other as well as you: allies shoot rivals, rivals shoot you or whichever ally is nearer and in sight.
 *
 * Each bot plays the mode: in Clash it hunts the nearest enemy and otherwise pushes up a lane; in Dominion the team splits over the
 * three zones and leans on the ones it does not hold; in Lockdown attackers go for the objective and defenders hold round it; in
 * Ascendancy they hunt, and take the centre once the zone opens; in Extraction they go for a loose core, the carrier runs it home
 * (shooting back but never stopping to fight) while the rest escort, and the other team hunts the carrier. In sight of an enemy a bot stops at fighting range, strafes and fires
 * in bursts; line of sight is blocked by the arena's cover and standing shifters. Ally bots die and respawn at your side's spawns
 * (not in a round: they wait for the next one). Pure rules: Scene feeds the world in and applies what comes back. */
import { confine, solidShifters, spawnPoint, surfaceAt, type KillboxArena } from "./killbox-arenas";
import { PVP_MODES, type PvpModeId, type PvpState, type Unit } from "./pvp";
import type { RivalClass } from "./crucible";

export const ALLY_NAMES = ["VEX", "HOLT", "KAI", "ROOK", "SABLE"] as const;
export const BOT = {
  /** run speed and the speed while trading fire, m/s */ run: 6.4, strafe: 2.4,
  /** how far a bot sees and engages, and the range it likes to fight at */ sight: 44, prefer: 18,
  /** fire cadence: shots in a burst, the gap between them, the rest after */ burst: 4, interval: 0.24, rest: 0.85,
  /** ally bot health; a rival hit on an ally takes this much */ allyHp: 100, rivalDamageOnAlly: 7,
  /** a rival hit on the player (sim.hurtPlayer, before the player's own armour) */ rivalDamageOnPlayer: 3,
  /** an ally hit on a rival machine (crucible.ts RIVAL_HP = 9: four or five hits) */ allyDamageOnRival: 2,
  /** an ally down comes back after this many seconds (not within a round) */ respawn: 4.5,
} as const;

export type BotTeam = "us" | "them";
export type Bot = {
  id: string; name: string; cls: RivalClass; team: BotTeam;
  x: number; z: number; yaw: number; speed: number;
  hp: number; alive: boolean; respawnIn: number;
  cool: number; shot: number; firing: number;
  /** the zone (index) or lane this bot was given */ lane: number;
  /** strafe direction, flips now and then */ side: 1 | -1; flipIn: number;
  /** a detour to the foot (then the head) of a stair, ramp or bridge, after a climb was refused or the way was not straight */ via?: { x: number; z: number; then?: { x: number; z: number } } | undefined;
  /** seconds to the next route check */ routeIn?: number;
};
export type BotShot = { from: { x: number; z: number }; to: { x: number; z: number }; team: BotTeam; hit: boolean; at: number };
export type BotsState = { allies: Bot[]; rivals: Map<string, Bot>; shots: BotShot[]; clock: number; seed: number };

/** a rival machine as the bots see it: its slot tag (crucible.ts `crucible:N`), position (arena space) and whether it stands */
export type RivalView = { tag: string; cls: RivalClass; x: number; z: number; alive: boolean };
export type BotWorld = {
  arena: KillboxArena; st: PvpState; dt: number;
  /** the player in arena space */ player: { x: number; z: number; alive: boolean };
  rivals: readonly RivalView[];
};
export type BotOutcome = {
  /** where each rival machine stands and faces now (arena space), by tag */ rivalMoves: Map<string, { x: number; z: number; yaw: number; speed: number }>;
  /** damage ally bots dealt to rival machines, by tag */ rivalHits: Map<string, number>;
  /** damage the rivals dealt the player this step */ playerDamage: number;
  /** allies who went down this step (a point for the other team) */ allyDeaths: number;
};

const CLASSES: readonly RivalClass[] = ["TITAN", "HUNTER", "WARLOCK"];
/** how many ally bots fight beside you on a built arena: the rest of your team (free-for-all and royale: none) */
export function allyCount(mode: PvpModeId): number { const m = PVP_MODES[mode]; return m.kind === "ffa" || m.kind === "royale" ? 0 : m.teamSize - 1; }
/** how many rivals are on the field at once on a built arena: the whole other team (free-for-all: six) */
export function rivalCount(mode: PvpModeId): number { const m = PVP_MODES[mode]; return m.kind === "ffa" ? 6 : m.kind === "royale" ? m.onField : m.teamSize; }

function rng(s: BotsState) { s.seed = (Math.imul(s.seed ^ 0x9e3779b9, 1103515245) + 12345) >>> 0; return (s.seed % 100000) / 100000; }

export function newBots(arena: KillboxArena, mode: PvpModeId, playerClass: RivalClass, seed = 7): BotsState {
  const n = allyCount(mode), allies: Bot[] = [];
  for (let i = 0; i < n; i++) {
    // the spawns after the one you drop in at (GameCanvas drops you at spawn 1)
    const p = spawnPoint(arena, "us", [], i + 2);
    allies.push(fresh(`ally:${i}`, ALLY_NAMES[i % ALLY_NAMES.length]!, CLASSES[(CLASSES.indexOf(playerClass) + 1 + i) % 3]!, "us", p.x, p.z, i));
  }
  return { allies, rivals: new Map(), shots: [], clock: 0, seed };
}
function fresh(id: string, name: string, cls: RivalClass, team: BotTeam, x: number, z: number, lane: number): Bot {
  return { id, name, cls, team, x, z, yaw: team === "us" ? Math.PI : 0, speed: 0, hp: BOT.allyHp, alive: true, respawnIn: 0, cool: 0.6 + lane * 0.15, shot: 0, firing: 0, lane, side: lane % 2 ? 1 : -1, flipIn: 1.5 + lane * 0.4 };
}

/** is the straight line between two arena points clear of cover and standing shifters? (the bots' sight; height is ignored) */
export function clearShot(a: KillboxArena, ax: number, az: number, bx: number, bz: number, t: number): boolean {
  const boxes = [...a.cover.filter((k) => k.h >= 1.3), ...solidShifters(a, t)];
  for (const k of boxes) {
    // slab test against the box, slightly shrunk so a shot can graze an edge
    const x0 = k.x - k.w / 2 + 0.1, x1 = k.x + k.w / 2 - 0.1, z0 = k.z - k.d / 2 + 0.1, z1 = k.z + k.d / 2 - 0.1;
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    const clip = (p: number, q: number) => { if (Math.abs(p) < 1e-9) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
    if (clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dz, az - z0) && clip(dz, z1 - az) && t0 < t1) return false;
  }
  return true;
}

/** the tallest rise a bot walks up in one go (a player auto-steps any rise, but the arenas wall the ones they must not) */
export const MAX_STEP = 1.6;
/** the nearest stair or ramp whose low end is at height `here`: its foot, then a point just past its head */
export function stairsFrom(a: KillboxArena, x: number, z: number, here: number): { x: number; z: number; then: { x: number; z: number } } | undefined {
  let best: { x: number; z: number; then: { x: number; z: number } } | undefined, bd = Infinity;
  for (const w of a.walks) {
    if (w.top === w.topB) continue;
    const half = w.length / 2 + 1, lowAtStart = w.top < w.topB;
    const start = w.along === "x" ? { x: w.x - half, z: w.z } : { x: w.x, z: w.z - half }, end = w.along === "x" ? { x: w.x + half, z: w.z } : { x: w.x, z: w.z + half };
    const foot = lowAtStart ? start : end, head = lowAtStart ? end : start;
    if (Math.abs(surfaceAt(a, foot.x, foot.z) - here) > 0.6) continue;
    const d = Math.hypot(foot.x - x, foot.z - z);
    if (d < bd) { bd = d; best = { ...foot, then: head }; }
  }
  return best;
}

/** can a bot walk straight from one point to the other: on a surface all the way, with no rise taller than MAX_STEP? */
export function walkable(a: KillboxArena, ax: number, az: number, bx: number, bz: number): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.75));
  let prev = surfaceAt(a, ax, az);
  for (let i = 1; i <= n; i++) {
    const h = surfaceAt(a, ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n);
    if (!Number.isFinite(h) || h - prev > MAX_STEP) return false;
    prev = h;
  }
  return true;
}
/** when the straight line to a goal leaves the roofs (a street between blocks, a balcony below): the walkway to take — its near end,
 * then its far end — that makes the shortest trip; undefined when the straight line is fine or nothing helps */
export function routeVia(a: KillboxArena, fx: number, fz: number, tx: number, tz: number): { x: number; z: number; then: { x: number; z: number } } | undefined {
  if (walkable(a, fx, fz, tx, tz)) return undefined;
  let best: { x: number; z: number; then: { x: number; z: number } } | undefined, cost = Infinity;
  for (const w of a.walks) {
    const half = w.length / 2 + 1.2;
    const e1 = w.along === "x" ? { x: w.x - half, z: w.z } : { x: w.x, z: w.z - half }, e2 = w.along === "x" ? { x: w.x + half, z: w.z } : { x: w.x, z: w.z + half };
    for (const [p, q] of [[e1, e2], [e2, e1]] as const) {
      if (!Number.isFinite(surfaceAt(a, p.x, p.z)) || !Number.isFinite(surfaceAt(a, q.x, q.z))) continue;
      // the way up a stair runs from its foot; never route down to the foot of a climb you cannot make the other way
      if (surfaceAt(a, q.x, q.z) - surfaceAt(a, p.x, p.z) > MAX_STEP + 4.5) continue;
      const c = Math.hypot(p.x - fx, p.z - fz) * (walkable(a, fx, fz, p.x, p.z) ? 1 : 3) + w.length + Math.hypot(tx - q.x, tz - q.z) * (walkable(a, q.x, q.z, tx, tz) ? 1 : 3);
      if (c < cost) { cost = c; best = { ...p, then: q }; }
    }
  }
  return best;
}

/** where a bot heads when nobody is in sight */
function goalFor(b: Bot, w: BotWorld): { x: number; z: number } {
  const { arena: a, st } = w, m = PVP_MODES[st.mode], ours = b.team === "us";
  if (m.kind === "zones" && st.zones.length) {
    // spread over the zones, leaning toward those your team does not hold
    const want = st.zones.map((z, i) => ({ z, i, score: (z.owner === (ours ? "us" : "them") ? 0 : 2) + (i === b.lane % st.zones.length ? 1.5 : 0) }));
    const best = want.reduce((p, q) => (q.score > p.score ? q : p));
    return { x: best.z.dx + Math.sin(b.lane * 2.1) * 2.5, z: best.z.dz + Math.cos(b.lane * 2.1) * 2.5 };
  }
  if (m.kind === "extract" && st.core) {
    const c = st.core, mine = ours ? "us" : "them";
    if (c.carrier === b.id) return c.pads[mine];
    // a loose core: everyone goes for it; theirs: run the carrier down; ours: escort the carrier, a little ahead toward the pad
    if (c.holder === null || c.holder !== mine) return { x: c.x + Math.sin(b.lane * 2.3) * 1.2, z: c.z + Math.cos(b.lane * 2.3) * 1.2 };
    const pad = c.pads[mine], dx = pad.x - c.x, dz = pad.z - c.z, d = Math.max(1, Math.hypot(dx, dz)), ahead = Math.min(6, d);
    return { x: c.x + (dx / d) * ahead + Math.sin(b.lane * 2.1) * 3, z: c.z + (dz / d) * ahead + Math.cos(b.lane * 2.1) * 3 };
  }
  if (m.kind === "rounds") {
    const [ox, oz] = a.objective;
    const attacking = m.id === "lockdown" ? st.attacking === ours : st.roundClock >= (m.roundTime ?? 90);
    if (attacking) return { x: ox + Math.sin(b.lane * 2.4) * 2, z: oz + Math.cos(b.lane * 2.4) * 2 };
    if (m.id === "lockdown") { const r = 9 + (b.lane % 2) * 3, ang = b.lane * 1.9; return { x: ox + Math.sin(ang) * r, z: oz + (ours ? 1 : -1) * Math.abs(Math.cos(ang)) * r }; }
  }
  // push up a lane toward the other side: the zones make good lane points, then the far spawns
  const lanes = a.zones.length ? a.zones : [{ dx: 0, dz: 0 }];
  const lane = lanes[b.lane % lanes.length]!, far = ours ? -1 : 1;
  const pastLane = ours ? b.z < lane.dz + 2 : b.z > lane.dz - 2;
  return pastLane ? { x: lane.dx * 0.6, z: far * 24 } : { x: lane.dx, z: lane.dz };
}

/** One step of every bot. Mutates the bot state; returns what Scene must apply to the machines and the player. */
export function stepBots(s: BotsState, w: BotWorld): BotOutcome {
  const { arena: a, st, dt } = w, m = PVP_MODES[st.mode], t = st.clock;
  s.clock += dt;
  const out: BotOutcome = { rivalMoves: new Map(), rivalHits: new Map(), playerDamage: 0, allyDeaths: 0 };
  const inRound = m.kind === "rounds", between = inRound && st.roundOver > 0;

  // rivals: one brain per field slot, picked up where the machine stands (a fresh spawn takes the machine's position)
  const live = new Set<string>();
  w.rivals.forEach((r, i) => {
    live.add(r.tag);
    let b = s.rivals.get(r.tag);
    if (!b || (!b.alive && r.alive)) { b = fresh(r.tag, r.cls, r.cls, "them", r.x, r.z, i); s.rivals.set(r.tag, b); }
    b.alive = r.alive; b.cls = r.cls;
    if (!r.alive) return;
    // the machine may have been knocked back or pushed by a hit: follow it rather than snap it back
    if (Math.hypot(r.x - b.x, r.z - b.z) > 3) { b.x = r.x; b.z = r.z; }
  });
  for (const k of [...s.rivals.keys()]) if (!live.has(k)) s.rivals.delete(k);

  // allies: respawn timers (rounds bring everyone back when the next round starts)
  for (const b of s.allies) {
    if (b.alive) continue;
    if (inRound) { if (between) b.respawnIn = 0; continue; }
    b.respawnIn -= dt;
    if (b.respawnIn <= 0) {
      const threats = [...s.rivals.values()].filter((r) => r.alive);
      const p = spawnPoint(a, "us", threats, b.lane + 1);
      Object.assign(b, { x: p.x, z: p.z, hp: BOT.allyHp, alive: true, respawnIn: 0 });
    }
  }
  if (between) for (const b of s.allies) if (!b.alive) { const p = spawnPoint(a, "us", [], b.lane + 1); Object.assign(b, { x: p.x, z: p.z, hp: BOT.allyHp, alive: true, respawnIn: 0 }); }

  type Foe = { kind: "player" } | { kind: "bot"; bot: Bot };
  const posOf = (f: Foe) => (f.kind === "player" ? w.player : f.bot);
  // free-for-all: every rival is everyone's enemy, the other rivals included
  const ffa = m.kind === "ffa";
  const foesOf = (b: Bot): Foe[] => b.team === "us"
    ? [...s.rivals.values()].filter((r) => r.alive).map((bot) => ({ kind: "bot", bot }))
    : [...(w.player.alive ? [{ kind: "player" } as Foe] : []), ...s.allies.filter((q) => q.alive).map((bot) => ({ kind: "bot", bot }) as Foe),
       ...(ffa ? [...s.rivals.values()].filter((r) => r.alive && r !== b).map((bot) => ({ kind: "bot", bot }) as Foe) : [])];

  const act = (b: Bot) => {
    if (!b.alive || between) { b.speed = 0; return; }
    // the nearest foe in sight
    let foe: Foe | null = null, fd = Infinity;
    for (const f of foesOf(b)) {
      const p = posOf(f), d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d < BOT.sight && d < fd && clearShot(a, b.x, b.z, p.x, p.z, t)) { foe = f; fd = d; }
    }
    let vx = 0, vz = 0, speed: number = BOT.run;
    // on a detour to the stairs: walk it out first (unless a foe is right there)
    if (b.via && !(foe && fd < BOT.prefer)) {
      const dx = b.via.x - b.x, dz = b.via.z - b.z, d = Math.hypot(dx, dz);
      if (d < 1) { b.via = b.via.then; } else { foe = null; }
      if (b.via) { const ex = b.via.x - b.x, ez = b.via.z - b.z, e = Math.max(0.01, Math.hypot(ex, ez)); vx = ex / e; vz = ez / e; b.yaw = Math.atan2(ex, ez); }
    }
    b.flipIn -= dt; if (b.flipIn <= 0) { b.side = b.side > 0 ? -1 : 1; b.flipIn = 1.2 + rng(s) * 1.6; }
    // Extraction's carrier never stops to fight: it shoots back on the run home
    const carrying = st.core?.carrier === b.id;
    if (foe && carrying) { const p = posOf(foe); fire(s, b, foe, p, Math.hypot(p.x - b.x, p.z - b.z), out); foe = null; }
    if (foe) {
      const p = posOf(foe), dx = p.x - b.x, dz = p.z - b.z, d = Math.max(0.01, Math.hypot(dx, dz));
      b.yaw = Math.atan2(dx, dz);
      // close to fighting range, then strafe across the line of fire
      const close = d > BOT.prefer ? 1 : d < BOT.prefer * 0.5 ? -0.6 : 0;
      vx = (dx / d) * close - (dz / d) * b.side * 0.9; vz = (dz / d) * close + (dx / d) * b.side * 0.9;
      speed = BOT.strafe + (close > 0 ? 2 : 0);
      fire(s, b, foe, p, d, out);
    } else if (!b.via) {
      const g = goalFor(b, w);
      // the way there: straight if it can be walked, else over the walkway that makes the shortest trip (checked about once a second)
      b.routeIn = (b.routeIn ?? 0) - dt;
      if (b.routeIn <= 0) { b.routeIn = 0.9 + rng(s) * 0.3; b.via = routeVia(a, b.x, b.z, g.x, g.z); }
      const aim = b.via ?? g, dx = aim.x - b.x, dz = aim.z - b.z, d = Math.hypot(dx, dz);
      if (d > 1.2) { vx = dx / d; vz = dz / d; if (!carrying) b.yaw = Math.atan2(dx, dz); } else speed = 0;
      if (!carrying) b.firing = Math.max(0, b.firing - dt);
    }
    const l = Math.hypot(vx, vz);
    const nx = l > 0 ? b.x + (vx / l) * speed * dt : b.x, nz = l > 0 ? b.z + (vz / l) * speed * dt : b.z;
    // stay on the roofs, out of the props; a step that would need a climb (a 2 m+ rise) is refused, so bots use the ramps and stairs
    const c = confine(a, nx, nz, 0.7, t), here = surfaceAt(a, b.x, b.z), rise = surfaceAt(a, c.x, c.z) - here;
    if (rise < MAX_STEP) { b.speed = Math.hypot(c.x - b.x, c.z - b.z) / Math.max(dt, 1e-4); b.x = c.x; b.z = c.z; }
    else { b.speed = 0; if (!b.via) b.via = stairsFrom(a, b.x, b.z, here); }
  };
  for (const b of s.allies) act(b);
  for (const b of s.rivals.values()) act(b);
  for (const [tag, b] of s.rivals) if (b.alive) out.rivalMoves.set(tag, { x: b.x, z: b.z, yaw: b.yaw, speed: b.speed });
  if (s.shots.length > 48) s.shots.splice(0, s.shots.length - 48);
  return out;

  function fire(s: BotsState, b: Bot, foe: Foe, p: { x: number; z: number }, d: number, o: BotOutcome) {
    b.cool -= dt;
    b.firing = Math.max(0, b.firing - dt);
    if (b.cool > 0) return;
    b.shot = (b.shot + 1) % (BOT.burst + 1);
    if (b.shot === BOT.burst) { b.cool = BOT.rest + rng(s) * 0.3; return; }
    b.cool = BOT.interval;
    b.firing = 0.1;
    const chance = Math.max(0.15, Math.min(0.62, 0.66 - d / 110));
    const hit = rng(s) < chance, miss = hit ? 0 : 1.2 + rng(s) * 2, ang = rng(s) * Math.PI * 2;
    s.shots.push({ from: { x: b.x, z: b.z }, to: { x: p.x + Math.cos(ang) * miss, z: p.z + Math.sin(ang) * miss }, team: b.team, hit, at: s.clock });
    if (!hit) return;
    if (foe.kind === "player") { o.playerDamage += BOT.rivalDamageOnPlayer; return; }
    const target = foe.bot;
    if (target.team === "them") { o.rivalHits.set(target.id, (o.rivalHits.get(target.id) ?? 0) + BOT.allyDamageOnRival); return; }
    target.hp -= BOT.rivalDamageOnAlly;
    if (target.hp <= 0 && target.alive) { target.alive = false; target.respawnIn = BOT.respawn; o.allyDeaths++; }
  }
}

/** how many of each team stand in each zone (arena space), the player counted for "us" — Dominion capture is by presence */
export function zonePresence(s: BotsState, st: PvpState, player: { x: number; z: number; alive: boolean }, radius: number): Record<string, { us: number; them: number }> {
  const out: Record<string, { us: number; them: number }> = {};
  for (const z of st.zones) {
    const near = (p: { x: number; z: number }) => Math.hypot(p.x - z.dx, p.z - z.dz) < radius;
    out[z.id] = {
      us: s.allies.filter((b) => b.alive && near(b)).length + (player.alive && near(player) ? 1 : 0),
      them: [...s.rivals.values()].filter((b) => b.alive && near(b)).length,
    };
  }
  return out;
}

/** rounds: your ally bots still up, and how many of them stand on the objective (pvp.ts PvpEvents alliesAlive / objectiveUs) */
export function roundPresence(s: BotsState, a: KillboxArena, radius: number): { alliesAlive: number; objectiveUs: number } {
  const up = s.allies.filter((b) => b.alive);
  return { alliesAlive: up.length, objectiveUs: up.filter((b) => Math.hypot(b.x - a.objective[0], b.z - a.objective[1]) < radius).length };
}

/** everyone on the field for Extraction's core (pvp.ts Unit): you as "player", the ally bots and the rivals by their ids */
export function fieldUnits(s: BotsState, player: { x: number; z: number; alive: boolean }): Unit[] {
  return [{ id: "player", team: "us", x: player.x, z: player.z, alive: player.alive },
    ...s.allies.map((b) => ({ id: b.id, team: "us" as const, x: b.x, z: b.z, alive: b.alive })),
    ...[...s.rivals.values()].map((b) => ({ id: b.id, team: "them" as const, x: b.x, z: b.z, alive: b.alive }))];
}

/** a new round: every ally back on your side's spawns at full health */
export function resetAllies(s: BotsState, a: KillboxArena): void {
  for (const b of s.allies) { const p = spawnPoint(a, "us", [], b.lane + 2); Object.assign(b, { x: p.x, z: p.z, hp: BOT.allyHp, alive: true, respawnIn: 0, via: undefined, speed: 0 }); }
  s.rivals.clear();
}
