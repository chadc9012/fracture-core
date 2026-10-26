/** Killbox match modes (owner's PvP brief, Oct 25): Clash, Dominion, Freefall and Lockdown in the Killbox, the 3v3 Killbox:
 * Ascendancy rounds, and Fracture Royale. Pure rules, kept apart from Scene so they are testable.
 *
 * There is no online multiplayer yet (crucible.ts), so every other player is an AI operator. Around you the fight is real:
 * rival operators take the field (`onField` at a time) and your two squadmates (squad.ts) fight beside you. The rest of each
 * team is "the far side of the arena": the off-field members trade eliminations at a steady, seeded rate (`stepFront`), so a
 * 6v6 score moves like a 6v6 even though you only see your corner of it. The same scoring takes real players when they can
 * connect. No building mechanic (owner): movement, abilities, vehicles and cover. */

export type PvpModeId = "clash" | "dominion" | "freefall" | "lockdown" | "ascendancy" | "royale";
export type PvpKind = "team" | "zones" | "ffa" | "rounds" | "royale";
export type PvpMode = {
  id: PvpModeId; name: string; kind: PvpKind; tagline: string; brief: string;
  /** players per side (team modes), everyone (ffa), or the whole lobby (royale) */
  teamSize: number; players: number;
  /** rival operators fielded around you at once */
  onField: number;
  /** points (or round wins) to win; seconds on the clock (0 = none) */
  target: number; timeLimit: number;
  roundTime?: number;
  /** the activity id that launches it (activities.ts) */
  activity: string;
  /** Ascendancy is the elite playlist */
  elite?: boolean;
};

export const PVP_MODES: Readonly<Record<PvpModeId, PvpMode>> = {
  clash: { id: "clash", name: "Clash", kind: "team", tagline: "6v6 team deathmatch", brief: "Two teams of six. Every elimination scores for your team; first to 75 wins.", teamSize: 6, players: 12, onField: 3, target: 75, timeLimit: 600, activity: "killbox-clash" },
  dominion: { id: "dominion", name: "Dominion", kind: "zones", tagline: "6v6 objective control", brief: "Hold zones A, B and C. Held zones tick points, eliminations add more; first to 150.", teamSize: 6, players: 12, onField: 3, target: 150, timeLimit: 600, activity: "killbox-dominion" },
  freefall: { id: "freefall", name: "Freefall", kind: "ffa", tagline: "12-player free-for-all", brief: "Everyone for themselves. First to 20 eliminations, or the highest score when time runs out.", teamSize: 1, players: 12, onField: 4, target: 20, timeLimit: 480, activity: "killbox-freefall" },
  lockdown: { id: "lockdown", name: "Lockdown", kind: "rounds", tagline: "4v4 attack and defend", brief: "Rounds alternate: attack the objective and hold it, then defend it. No respawns in a round; first to 4 rounds.", teamSize: 4, players: 8, onField: 4, target: 4, timeLimit: 0, roundTime: 90, activity: "killbox-lockdown" },
  ascendancy: { id: "ascendancy", name: "Killbox: Ascendancy", kind: "rounds", tagline: "Elite 3v3 elimination", brief: "Wipe the other three to take the round. At the buzzer a capture zone decides it. Downed stays down; first to 5.", teamSize: 3, players: 6, onField: 3, target: 5, timeLimit: 0, roundTime: 90, activity: "killbox-ascendancy", elite: true },
  royale: { id: "royale", name: "Fracture Royale", kind: "royale", tagline: "60-player survival", brief: "Twenty squads of three. Scavenge, fight and outrun the closing fracture; the last squad standing wins.", teamSize: 3, players: 60, onField: 3, target: 1, timeLimit: 0, activity: "killbox-royale" },
};
export const pvpModeForActivity = (id: string) => Object.values(PVP_MODES).find((m) => m.activity === id);

/** seconds per off-field elimination per member: a 6v6 Clash with three off-field on each side scores ~0.2 a second a side */
export const FRONT_RATE = 1 / 15;
/** your fireteam on the field: you plus the two squadmates */
export const FIRETEAM = 3;

export type Zone = { id: "A" | "B" | "C"; /** offset from the arena centre, m */ dx: number; dz: number; owner: "us" | "them" | null; /** capture progress toward the player's side, -1..1 */ cap: number };
export const ZONE_RADIUS = 7, ZONE_CAPTURE_S = 5, ZONE_TICK_S = 2;
export const ROUND_ZONE_S = 6;
export const ROYALE = { startRadius: 230, finalRadius: 18, phases: 5, phaseHold: 50, phaseShrink: 35, damagePerSec: [2, 3, 5, 8, 12] as readonly number[], waveEvery: 40 } as const;

export type PvpState = {
  mode: PvpModeId; clock: number; us: number; them: number;
  /** ffa: everyone's eliminations, index 0 is you */
  board: number[];
  zones: Zone[];
  /** rounds */
  round: number; roundClock: number; usRounds: number; themRounds: number; attacking: boolean; plant: number; zoneHold: number; roundRivalsLeft: number; roundOver: number;
  /** royale */
  alive: number; phase: number; radius: number; nextWave: number;
  /** the match result once decided */
  result: "win" | "loss" | null; reason: string;
  /** rng seed for the off-field fight */
  seed: number;
};

const ZONES = (): Zone[] => [{ id: "A", dx: -22, dz: 0, owner: null, cap: 0 }, { id: "B", dx: 0, dz: 0, owner: null, cap: 0 }, { id: "C", dx: 22, dz: 0, owner: null, cap: 0 }];
export function newPvp(mode: PvpModeId, seed = 1): PvpState {
  const m = PVP_MODES[mode];
  return { mode, clock: 0, us: 0, them: 0, board: Array.from({ length: m.kind === "ffa" ? m.players : 0 }, () => 0), zones: m.kind === "zones" ? ZONES() : [], round: 1, roundClock: 0, usRounds: 0, themRounds: 0, attacking: true, plant: 0, zoneHold: 0, roundRivalsLeft: m.kind === "rounds" ? m.onField : 0, roundOver: 0, alive: m.players, phase: 0, radius: m.kind === "royale" ? ROYALE.startRadius : 0, nextWave: 0, result: null, reason: "", seed };
}

/** deterministic 0..1 from the state's seed (advances it) */
function rnd(st: PvpState): number { st.seed = (Math.imul(st.seed ^ 0x5bd1e995, 1103515245) + 12345) >>> 0; return (st.seed % 100000) / 100000; }

/** what the player and the field did this frame */
export type PvpEvents = { dt: number; kills: number; died: boolean; /** player distance to the arena centre and position offset (for zones) */ px: number; pz: number; /** rivals of this round still standing (rounds) */ rivalsAlive: number };

/** advance a match one frame; returns true once it is decided */
export function stepPvp(st: PvpState, e: PvpEvents): boolean {
  if (st.result) return true;
  const m = PVP_MODES[st.mode];
  st.clock += e.dt;
  switch (m.kind) {
    case "team": {
      st.us += e.kills; if (e.died) st.them += 1;
      stepFront(st, m, e.dt);
      break;
    }
    case "zones": {
      st.us += e.kills; if (e.died) st.them += 1;
      stepFront(st, m, e.dt);
      stepZones(st, e);
      break;
    }
    case "ffa": {
      st.board[0]! += e.kills;
      if (e.died) { const k = 1 + Math.floor(rnd(st) * (m.players - 1)); st.board[k]! += 1; }
      // everyone else trades eliminations off-field
      for (let i = 1; i < st.board.length; i++) if (rnd(st) < e.dt * FRONT_RATE * 0.6) st.board[i]! += 1;
      st.us = st.board[0]!; st.them = Math.max(...st.board.slice(1));
      break;
    }
    case "rounds": stepRounds(st, m, e); break;
    case "royale": stepRoyale(st, m, e); break;
  }
  decide(st, m);
  return st.result !== null;
}

/** the far side of the arena: off-field members of each team trade eliminations */
function stepFront(st: PvpState, m: PvpMode, dt: number) {
  const ours = Math.max(0, m.teamSize - FIRETEAM), theirs = Math.max(0, m.teamSize - m.onField);
  if (rnd(st) < dt * FRONT_RATE * ours) st.us += 1;
  if (rnd(st) < dt * FRONT_RATE * theirs) st.them += 1;
}

function stepZones(st: PvpState, e: PvpEvents) {
  for (const z of st.zones) {
    const here = Math.hypot(e.px - z.dx, e.pz - z.dz) < ZONE_RADIUS;
    if (here) z.cap = Math.min(1, z.cap + e.dt / ZONE_CAPTURE_S);
    // the zones you aren't standing in change hands in the off-field fight now and then
    else if (rnd(st) < e.dt / 30) z.cap = rnd(st) < 0.5 ? 1 : -1;
    z.owner = z.cap >= 1 ? "us" : z.cap <= -1 ? "them" : z.owner;
  }
  // zone points every ZONE_TICK_S
  const before = Math.floor((st.clock - e.dt) / ZONE_TICK_S), now = Math.floor(st.clock / ZONE_TICK_S);
  if (now > before) for (const z of st.zones) { if (z.owner === "us") st.us += 1; else if (z.owner === "them") st.them += 1; }
}

function endRound(st: PvpState, m: PvpMode, won: boolean, why: string) {
  if (won) st.usRounds++; else st.themRounds++;
  st.reason = why; st.roundOver = 3; // a short pause before the next round
  st.round++; st.roundClock = 0; st.plant = 0; st.zoneHold = 0; st.roundRivalsLeft = m.onField;
  if (m.id === "lockdown") st.attacking = !st.attacking;
  st.us = st.usRounds; st.them = st.themRounds;
}

function stepRounds(st: PvpState, m: PvpMode, e: PvpEvents) {
  if (st.roundOver > 0) { st.roundOver = Math.max(0, st.roundOver - e.dt); return; }
  st.roundClock += e.dt;
  st.roundRivalsLeft = e.rivalsAlive;
  const onObjective = Math.hypot(e.px, e.pz) < ZONE_RADIUS;
  if (e.died) { endRound(st, m, false, "You went down"); return; }
  if (st.roundClock > 1 && e.rivalsAlive === 0) { endRound(st, m, true, "Rivals wiped"); return; }
  const rt = m.roundTime ?? 90;
  if (m.id === "lockdown") {
    if (st.attacking) {
      if (onObjective) st.zoneHold += e.dt; else st.zoneHold = Math.max(0, st.zoneHold - e.dt);
      if (st.zoneHold >= ROUND_ZONE_S + 2) { endRound(st, m, true, "Objective secured"); return; }
      if (st.roundClock >= rt) { endRound(st, m, false, "Out of time"); return; }
    } else {
      // the attackers plant while nobody contests the objective
      if (!onObjective) st.plant += e.dt / 12; else st.plant = Math.max(0, st.plant - e.dt / 6);
      if (st.plant >= 1) { endRound(st, m, false, "The objective fell"); return; }
      if (st.roundClock >= rt) { endRound(st, m, true, "Held the line"); return; }
    }
    return;
  }
  // Ascendancy: at the buzzer a capture zone opens in the middle; take it, or lose it to them after a while
  if (st.roundClock >= rt) {
    if (onObjective) st.zoneHold += e.dt; else st.plant += e.dt / 15;
    if (st.zoneHold >= ROUND_ZONE_S) { endRound(st, m, true, "Zone captured"); return; }
    if (st.plant >= 1) { endRound(st, m, false, "They took the zone"); return; }
  }
}

/** the royale circle's radius at a match time */
export function royaleRadius(t: number): { radius: number; phase: number; closing: boolean } {
  const step = ROYALE.phaseHold + ROYALE.phaseShrink;
  const phase = Math.min(ROYALE.phases, Math.floor(t / step));
  const r = (p: number) => ROYALE.startRadius + (ROYALE.finalRadius - ROYALE.startRadius) * (p / ROYALE.phases);
  if (phase >= ROYALE.phases) return { radius: ROYALE.finalRadius, phase, closing: false };
  const into = t - phase * step;
  if (into < ROYALE.phaseHold) return { radius: r(phase), phase, closing: false };
  const k = (into - ROYALE.phaseHold) / ROYALE.phaseShrink;
  return { radius: r(phase) + (r(phase + 1) - r(phase)) * k, phase, closing: true };
}

function stepRoyale(st: PvpState, m: PvpMode, e: PvpEvents) {
  const z = royaleRadius(st.clock);
  st.radius = z.radius; st.phase = z.phase;
  if (e.died) { st.result = "loss"; st.reason = `Eliminated · placed ${Math.ceil(st.alive / m.teamSize)} of ${m.players / m.teamSize}`; return; }
  // squads fall elsewhere at a rate that empties the lobby by the final circle; your eliminations take players out too
  const others = st.alive - m.teamSize;
  const fall = others > 0 ? others * e.dt / Math.max(20, (ROYALE.phaseHold + ROYALE.phaseShrink) * ROYALE.phases - st.clock) : 0;
  st.alive = Math.max(m.teamSize, st.alive - e.kills - (rnd(st) < fall ? 1 : 0));
  st.us = e.kills + st.us; st.them = st.alive;
}

/** the damage the closing fracture deals per second at a distance from the circle centre (0 inside) */
export function stormDamage(st: PvpState, dist: number): number {
  return dist > st.radius ? ROYALE.damagePerSec[Math.min(ROYALE.damagePerSec.length - 1, st.phase)]! : 0;
}

function decide(st: PvpState, m: PvpMode) {
  if (st.result) return;
  if (m.kind === "royale") { if (st.alive <= m.teamSize) { st.result = "win"; st.reason = "Last squad standing"; } return; }
  if (m.kind === "rounds") {
    if (st.usRounds >= m.target) { st.result = "win"; st.reason = `${st.usRounds}–${st.themRounds}`; }
    else if (st.themRounds >= m.target) { st.result = "loss"; st.reason = `${st.usRounds}–${st.themRounds}`; }
    return;
  }
  if (st.us >= m.target) { st.result = "win"; st.reason = `${st.us}–${st.them}`; return; }
  if (st.them >= m.target) { st.result = "loss"; st.reason = m.kind === "ffa" ? "Another operator reached the target" : `${st.us}–${st.them}`; return; }
  if (m.timeLimit > 0 && st.clock >= m.timeLimit) {
    st.result = st.us > st.them ? "win" : "loss";
    st.reason = `Time · ${st.us}–${st.them}`;
  }
}

/** rival operators that should be on the field right now */
export function fieldSize(st: PvpState): number {
  const m = PVP_MODES[st.mode];
  if (m.kind === "rounds") return st.roundOver > 0 ? 0 : m.onField;
  if (m.kind === "royale") return Math.min(m.onField, Math.max(0, st.alive - m.teamSize));
  return m.onField;
}
/** do downed rivals come back this round/match? (no respawns in rounds; royale sends fresh squads in waves instead) */
export const respawns = (st: PvpState) => PVP_MODES[st.mode].kind !== "rounds";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** one line of match state for the activity HUD */
export function pvpLine(st: PvpState): string {
  const m = PVP_MODES[st.mode];
  const left = m.timeLimit > 0 ? ` · ${clock(Math.max(0, m.timeLimit - st.clock))}` : "";
  switch (m.kind) {
    case "team": return `Us ${st.us} – ${st.them} Them${left}`;
    case "zones": return `Us ${st.us} – ${st.them} Them · ${st.zones.map((z) => `${z.id}${z.owner === "us" ? "●" : z.owner === "them" ? "○" : "·"}`).join(" ")}${left}`;
    case "ffa": { const rank = 1 + st.board.slice(1).filter((v) => v > st.board[0]!).length; return `You ${st.board[0]} · leader ${st.them} · ${rank}${rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th"} of ${m.players}${left}`; }
    case "rounds": {
      const rt = m.roundTime ?? 90, z = st.roundClock >= rt;
      const role = m.id === "lockdown" ? (st.attacking ? "ATTACK" : `DEFEND · plant ${Math.round(st.plant * 100)}%`) : z ? "ZONE OPEN — take the centre" : `${st.roundRivalsLeft} rival${st.roundRivalsLeft === 1 ? "" : "s"} left`;
      return `Round ${st.round} · ${st.usRounds}–${st.themRounds} · ${st.roundOver > 0 ? st.reason : `${role} · ${clock(Math.max(0, rt - st.roundClock))}`}`;
    }
    case "royale": { const z = royaleRadius(st.clock); return `${st.alive} alive · ${Math.ceil(st.alive / m.teamSize)} squads · circle ${Math.round(z.radius)} m${z.closing ? " CLOSING" : ""}`; }
  }
}
