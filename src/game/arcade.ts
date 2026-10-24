/** The Pixel Pit reflex cabinet (pure; adapted from the stage 100-102 neon-arcade upload). A run is ARCADE_ROUNDS rounds of
 * TARGETS_PER_ROUND timed signals: hit each signal while it is lit. Pressing before the signal is an early miss (it does not
 * advance the target), a signal left unanswered past its window is a late miss, and MAX_MISSES misses end the run. A round in
 * which the player never presses at all ends the run as a timeout (walked away). Each round the windows shrink and the
 * signals come faster. Presses between rounds are ignored. Tonight's timings are the same for everyone (seeded by venue and
 * day). All times are injected (ms), so the rules are deterministic and testable. Your best per venue is kept in the save as
 * `arcade-best:<id>:<score>` (earnedRewards, union-merged; the highest wins). Social only: no currency, XP or loot. */
export const ARCADE_VENUES: Readonly<Record<string, { cabinet: string }>> = { "crown-casino": { cabinet: "Pixel Pit" } };
export const ARCADE_ROUNDS = 5;
export const TARGETS_PER_ROUND = 3;
export const MAX_MISSES = 2;
export const BASE_TOLERANCE_MS = 270;
export const MIN_TOLERANCE_MS = 150;
export const TOLERANCE_STEP_MS = 30;
/** the breather before each round (including the first) during which presses are ignored */
export const ROUND_GAP_MS = 1200;
export const JACKPOT_BONUS = 500;

export type ArcadeEnd = "misses" | "timeout" | "cleared";
export type ArcadeEvent = { kind: "hit" | "early" | "late"; points: number; at: number };
export type ArcadeRun = {
  venueId: string; day: string;
  round: number; roundStartsAt: number; targets: number[]; next: number;
  hits: number; misses: number; score: number; pressedThisRound: boolean;
  done: boolean; won: boolean; endedBy: ArcadeEnd | null; last: ArcadeEvent | null;
};

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

export const toleranceFor = (round: number) => Math.max(MIN_TOLERANCE_MS, BASE_TOLERANCE_MS - round * TOLERANCE_STEP_MS);
/** signal times (ms after the round starts) for a round of tonight's run: the first after a short wait, then gaps that
 * shorten each round but always leave the windows apart */
export function roundTargets(venueId: string, day: string, round: number): number[] {
  const r = rng(hash(`${venueId}@${day}#${round}`)), tol = toleranceFor(round), pace = 1 - Math.min(0.4, round * 0.08);
  const out: number[] = [];
  let t = 700 + r() * 600;
  for (let i = 0; i < TARGETS_PER_ROUND; i++) { out.push(Math.round(t)); t += Math.max(2 * tol + 120, (650 + r() * 650) * pace); }
  return out;
}

export function startArcade(venueId: string, day: string, now: number): ArcadeRun {
  return { venueId, day, round: 0, roundStartsAt: now + ROUND_GAP_MS, targets: roundTargets(venueId, day, 0), next: 0, hits: 0, misses: 0, score: 0, pressedThisRound: false, done: false, won: false, endedBy: null, last: null };
}

/** after the last signal of a round: the next round (after a breather) or the jackpot */
function endRound(s: ArcadeRun, at: number): ArcadeRun {
  if (s.round + 1 >= ARCADE_ROUNDS) return { ...s, score: s.score + JACKPOT_BONUS, done: true, won: true, endedBy: "cleared" };
  const round = s.round + 1;
  return { ...s, round, roundStartsAt: at + ROUND_GAP_MS, targets: roundTargets(s.venueId, s.day, round), next: 0, pressedThisRound: false };
}

/** advance the clock: signals whose window has closed unanswered become late misses; resolves the run even if the player
 * never presses again */
export function arcadeTick(state: ArcadeRun, now: number): ArcadeRun {
  if (state.done || !Number.isFinite(now) || now < state.roundStartsAt) return state;
  let s = state;
  const tol = toleranceFor(s.round), elapsed = now - s.roundStartsAt;
  while (s.next < s.targets.length && elapsed > s.targets[s.next]! + tol) {
    const at = s.roundStartsAt + s.targets[s.next]! + tol;
    s = { ...s, next: s.next + 1, misses: s.misses + 1, last: { kind: "late", points: 0, at } };
    if (s.misses >= MAX_MISSES) return { ...s, done: true, won: false, endedBy: s.pressedThisRound ? "misses" : "timeout" };
    if (s.next === s.targets.length) return s.pressedThisRound ? arcadeTick(endRound(s, at), now) : { ...s, done: true, won: false, endedBy: "timeout" };
  }
  return s;
}

/** a press at `now`: early presses are misses (the target does not advance), presses inside the lit window score more the
 * closer they are; presses between rounds or after the run are ignored */
export function arcadeTap(state: ArcadeRun, now: number): ArcadeRun {
  const s = arcadeTick(state, now);
  if (s.done || !Number.isFinite(now) || now < s.roundStartsAt || s.next >= s.targets.length) return s;
  const tol = toleranceFor(s.round), target = s.roundStartsAt + s.targets[s.next]!;
  if (now < target - tol) {
    const misses = s.misses + 1, next = { ...s, misses, pressedThisRound: true, last: { kind: "early" as const, points: 0, at: now } };
    return misses >= MAX_MISSES ? { ...next, done: true, won: false, endedBy: "misses" } : next;
  }
  const points = Math.round((50 + 100 * (1 - Math.abs(now - target) / tol)) * (s.round + 1));
  const hit: ArcadeRun = { ...s, next: s.next + 1, hits: s.hits + 1, score: s.score + points, pressedThisRound: true, last: { kind: "hit", points, at: now } };
  return hit.next === hit.targets.length ? endRound(hit, now) : hit;
}

export type ArcadeSignal = "READY" | "WAIT" | "HIT" | "JACKPOT" | "GAME OVER";
/** what the cabinet shows at `now` */
export function arcadeSignal(state: ArcadeRun, now: number): ArcadeSignal {
  const s = arcadeTick(state, now);
  if (s.done) return s.won ? "JACKPOT" : "GAME OVER";
  if (now < s.roundStartsAt) return "READY";
  const t = s.targets[s.next];
  return t !== undefined && Math.abs(now - s.roundStartsAt - t) <= toleranceFor(s.round) ? "HIT" : "WAIT";
}

export const arcadeBestKey = (venueId: string, score: number) => `arcade-best:${venueId}:${Math.round(score)}`;
export function arcadeBest(p: { earnedRewards: readonly string[] }, venueId: string): number {
  const prefix = `arcade-best:${venueId}:`;
  let best = 0;
  for (const k of p.earnedRewards) if (k.startsWith(prefix)) best = Math.max(best, Number(k.slice(prefix.length)) || 0);
  return best;
}
/** keeps one key per venue (the best); returns the same object when the score is not a new best */
export function recordArcade<P extends { earnedRewards: string[] }>(p: P, venueId: string, score: number): P {
  if (score <= arcadeBest(p, venueId)) return p;
  const prefix = `arcade-best:${venueId}:`;
  return { ...p, earnedRewards: [...p.earnedRewards.filter((k) => !k.startsWith(prefix)), arcadeBestKey(venueId, score)] };
}
/** the cabinet's hit button: Space, never a held repeat, never while typing in a field */
export function isArcadePress(e: { code: string; repeat: boolean; target: unknown }): boolean {
  if (e.code !== "Space" || e.repeat) return false;
  const t = e.target as { tagName?: string; isContentEditable?: boolean } | null;
  return !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable));
}
/** standard-mapping gamepad: A hits, B leaves */
export const PAD_HIT = 0, PAD_LEAVE = 1;
