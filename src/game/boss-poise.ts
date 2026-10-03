/**
 * Boss poise + weak-point system (Shangri-La Frontier-inspired): sustained hits break a boss's
 * poise and stagger it into a short, high-damage punish window, and a weak-point core also
 * flashes open the instant a boss shifts phase (boss-phases.ts) — reusing that existing
 * phase-flare moment as the "exposed" telegraph rather than inventing a second clock. Pure/
 * deterministic, same shape as boss-phases.ts so sim.ts calls it the identical way.
 */

export const POISE_MAX = 100;
const POISE_DECAY_PER_SEC = 4;
const WEAK_POINT_DURATION = 5;
const STAGGER_DURATION = 4;
export const WEAK_POINT_DAMAGE_MULT = 1.6;
export const STAGGER_DAMAGE_MULT = 2.25;

export type PoiseState = {
  poise: number;
  staggerUntil: number;
  weakPointUntil: number;
};

export const INITIAL_POISE: PoiseState = { poise: 0, staggerUntil: 0, weakPointUntil: 0 };

/** Passive poise decay — called once per boss per frame regardless of whether it was hit this
 * frame, so chip damage spread out over a long fight can't cheese a stagger. Frozen during the
 * stagger window itself (the meter sits at 0 and the punish window is the reward). */
export function decayPoise(state: PoiseState, dt: number, now: number): PoiseState {
  if (now < state.staggerUntil || state.poise <= 0) return state;
  return { ...state, poise: Math.max(0, state.poise - POISE_DECAY_PER_SEC * dt) };
}

/** A hit landing on the boss: feeds poise damage and returns the damage multiplier that hit
 * should apply (stacking the weak-point and stagger bonuses). Breaking poise opens the weak
 * point and starts the stagger window in the same beat. */
export function hitPoise(state: PoiseState, poiseDamage: number, now: number): { state: PoiseState; damageMult: number } {
  const staggered = now < state.staggerUntil;
  const weakPointOpen = !staggered && now < state.weakPointUntil;
  const damageMult = staggered ? STAGGER_DAMAGE_MULT : weakPointOpen ? WEAK_POINT_DAMAGE_MULT : 1;
  if (staggered) return { state, damageMult };
  const poise = state.poise + poiseDamage;
  if (poise >= POISE_MAX) {
    return { state: { poise: 0, staggerUntil: now + STAGGER_DURATION, weakPointUntil: now + STAGGER_DURATION }, damageMult };
  }
  return { state: { ...state, poise }, damageMult };
}

/** Opens a short weak-point window — called by sim.ts right when a boss's phase flares, so the
 * phase-change telegraph and the punish window are the same moment the player already sees. */
export function openWeakPoint(state: PoiseState, now: number): PoiseState {
  return { ...state, weakPointUntil: Math.max(state.weakPointUntil, now + WEAK_POINT_DURATION) };
}

export function isStaggered(state: PoiseState, now: number): boolean {
  return now < state.staggerUntil;
}

export function isWeakPointOpen(state: PoiseState, now: number): boolean {
  return now < state.weakPointUntil;
}
