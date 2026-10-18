/** Vyrak trust and dragon riding (design doc: Stage 3 Proven Covenant -> Stage 4 Ancient Bond -> Stage 5 Eternal Covenant).
 * Trust is DERIVED from keys already in earnedRewards, per Operator, so there is no new save field and nothing to farm:
 * every source pays once (a challenge, an encounter, a ruin, a puzzle, a protected run). Repeating an easy encounter adds nothing.
 * Riding unlocks only at full trust, for that Operator alone; regions and activities can still forbid it. */
import { CHALLENGES, challengeKey, type ChallengeId } from "./dragonite";
import { isBonded } from "./dragon-covenant";
import type { ClassId, PlayerProgression } from "./progression";

type Store = Pick<PlayerProgression, "earnedRewards">;
export const FULL_TRUST = 100, ETERNAL_CHALLENGES = 3;
export const TRUST_WEIGHT = { challenge: 25, encounter: 8, ruin: 6, puzzle: 10, protect: 15 } as const;
/** caps per kind so no single route can fill the bar on its own */
const CAP = { challenge: 75, encounter: 32, ruin: 18, puzzle: 20, protect: 15 } as const;
export type TrustKind = keyof typeof TRUST_WEIGHT;

export const ruinKey = (c: ClassId, id: string) => `vyrak-ruin:${c}:${id}`;
export const puzzleKey = (c: ClassId, id: string) => `vyrak-puzzle:${c}:${id}`;
export const protectKey = (c: ClassId, id: string) => `vyrak-protect:${c}:${id}`;
export const ridingKey = (c: ClassId) => `vyrak-riding:${c}`;
export const eternalKey = (c: ClassId) => `vyrak-eternal:${c}`;

const count = (p: Store, prefix: string, exclude?: string) => p.earnedRewards.filter((r) => r.startsWith(prefix) && (!exclude || !r.endsWith(exclude))).length;

export type TrustBreakdown = Record<TrustKind, number> & { total: number };
export function trustOf(p: Store, c: ClassId | null): TrustBreakdown {
  const zero = { challenge: 0, encounter: 0, ruin: 0, puzzle: 0, protect: 0, total: 0 };
  if (!c || !isBonded(p, c)) return zero;
  const raw = {
    challenge: (Object.keys(CHALLENGES) as ChallengeId[]).filter((id) => p.earnedRewards.includes(challengeKey(c, id))).length * TRUST_WEIGHT.challenge,
    // difficult encounters won (the Vyrak fight itself is the bond, not trust)
    encounter: count(p, `enc-done:${c}:`, ":vyrak") * TRUST_WEIGHT.encounter,
    ruin: count(p, `vyrak-ruin:${c}:`) * TRUST_WEIGHT.ruin,
    puzzle: count(p, `vyrak-puzzle:${c}:`) * TRUST_WEIGHT.puzzle,
    protect: count(p, `vyrak-protect:${c}:`) * TRUST_WEIGHT.protect,
  };
  const capped = { challenge: Math.min(raw.challenge, CAP.challenge), encounter: Math.min(raw.encounter, CAP.encounter), ruin: Math.min(raw.ruin, CAP.ruin), puzzle: Math.min(raw.puzzle, CAP.puzzle), protect: Math.min(raw.protect, CAP.protect) };
  return { ...capped, total: Math.min(FULL_TRUST, capped.challenge + capped.encounter + capped.ruin + capped.puzzle + capped.protect) };
}

export type TrustStage = 0 | 1 | 2 | 3 | 4 | 5;
export const STAGE_NAMES: Record<TrustStage, string> = { 0: "No bond", 1: "The Covenant", 2: "The Companion", 3: "The Proven Covenant", 4: "The Ancient Bond", 5: "The Eternal Covenant" };
/** stage 4 needs full trust AND the bond ceremony (claimAncientBond); stage 5 is the optional endgame path */
export function trustStage(p: Store, c: ClassId | null): TrustStage {
  if (!c || !isBonded(p, c)) return 0;
  if (p.earnedRewards.includes(eternalKey(c)) && p.earnedRewards.includes(ridingKey(c))) return 5;
  if (p.earnedRewards.includes(ridingKey(c))) return 4;
  return trustOf(p, c).total > 0 ? 3 : 2;
}

const add = <T extends Store>(p: T, k: string): T => (p.earnedRewards.includes(k) ? p : { ...p, earnedRewards: [...p.earnedRewards, k] });
/** one-time trust sources recorded by the game (idempotent per id) */
export function recordTrust<T extends Store>(p: T, c: ClassId | null, kind: "ruin" | "puzzle" | "protect", id: string): T {
  if (!c || !isBonded(p, c) || !id) return p;
  return add(p, kind === "ruin" ? ruinKey(c, id) : kind === "puzzle" ? puzzleKey(c, id) : protectKey(c, id));
}
/** the Ancient Bond ceremony: only at full trust, only for this Operator; unlocks riding */
export function claimAncientBond<T extends Store>(p: T, c: ClassId | null): { progression: T; ok: boolean; reason?: string } {
  if (!c || !isBonded(p, c)) return { progression: p, ok: false, reason: "Not bonded on this Operator" };
  if (p.earnedRewards.includes(ridingKey(c))) return { progression: p, ok: false, reason: "Already complete" };
  if (trustOf(p, c).total < FULL_TRUST) return { progression: p, ok: false, reason: `Trust ${trustOf(p, c).total}/${FULL_TRUST}` };
  return { progression: add(p, ridingKey(c)), ok: true };
}
/** the optional endgame: three Vyrak challenges complete after the Ancient Bond */
export function claimEternalCovenant<T extends Store>(p: T, c: ClassId | null): { progression: T; ok: boolean } {
  if (!c || !p.earnedRewards.includes(ridingKey(c))) return { progression: p, ok: false };
  const done = (Object.keys(CHALLENGES) as ChallengeId[]).filter((id) => p.earnedRewards.includes(challengeKey(c, id))).length;
  return done >= ETERNAL_CHALLENGES ? { progression: add(p, eternalKey(c)), ok: true } : { progression: p, ok: false };
}

export type RideContext = { regionId: string | null; inDungeon: boolean; inStoryMission: boolean; indoors: boolean };
/** regions where Vyrak will not carry you: cities' no-fly lockdowns, interiors, dungeons and story missions */
const NO_FLY_REGIONS = new Set(["nexus", "neon"]);
export function canRide(p: Store, c: ClassId | null, ctx: RideContext): { ok: boolean; reason?: string } {
  if (!c || !p.earnedRewards.includes(ridingKey(c))) return { ok: false, reason: "Vyrak does not trust you enough to carry you" };
  if (ctx.indoors) return { ok: false, reason: "Too cramped to ride indoors" };
  if (ctx.inDungeon) return { ok: false, reason: "Vyrak will not enter this place" };
  if (ctx.inStoryMission) return { ok: false, reason: "The mission requires you on foot" };
  if (ctx.regionId && NO_FLY_REGIONS.has(ctx.regionId)) return { ok: false, reason: "The city's airspace is locked down" };
  return { ok: true };
}

/** flight model (pure): pitch/bank/throttle -> velocity, with stall below minimum speed and a hard ceiling */
export type Flight = { x: number; y: number; z: number; yaw: number; pitch: number; bank: number; speed: number };
export const FLIGHT = { min: 8, cruise: 24, max: 42, ceiling: 140, climbMax: 0.7, diveMax: 0.9, turnRate: 1.2 } as const;
export function createFlight(x: number, y: number, z: number, yaw: number): Flight { return { x, y, z, yaw, pitch: 0, bank: 0, speed: FLIGHT.cruise }; }
export function stepFlight(f: Flight, input: { pitch: number; turn: number; throttle: number }, dt: number, groundAt: (x: number, z: number) => number): Flight {
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const pitch = clamp(f.pitch + (clamp(input.pitch, -1, 1) * FLIGHT.climbMax - f.pitch) * Math.min(1, dt * 3), -FLIGHT.diveMax, FLIGHT.climbMax);
  const bank = f.bank + (clamp(input.turn, -1, 1) * 0.8 - f.bank) * Math.min(1, dt * 4);
  const yaw = f.yaw + clamp(input.turn, -1, 1) * FLIGHT.turnRate * dt;
  // diving gains speed, climbing loses it, the throttle trims toward its target
  const target = FLIGHT.cruise + clamp(input.throttle, -1, 1) * (FLIGHT.max - FLIGHT.cruise) * (input.throttle > 0 ? 1 : 0.6);
  const speed = clamp(f.speed + (target - f.speed) * Math.min(1, dt * 0.8) - Math.sin(pitch) * 14 * dt, FLIGHT.min, FLIGHT.max);
  const horiz = Math.cos(pitch) * speed;
  const x = f.x + Math.sin(yaw) * horiz * dt, z = f.z + Math.cos(yaw) * horiz * dt;
  let y = f.y + Math.sin(pitch) * speed * dt;
  y = Math.min(y, FLIGHT.ceiling);
  const floor = groundAt(x, z) + 2;
  if (y < floor) y = floor; // terrain collision: skim, never clip through
  return { x, y, z, yaw, pitch, bank, speed };
}
