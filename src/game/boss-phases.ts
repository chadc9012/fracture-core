/**
 * Multi-phase boss combat tuning. Named regional bosses (encounters.ts) previously fought as one
 * flat health bar with fixed damage/cooldown/speed constants for their whole fight. This gives
 * every boss three phases that escalate as it takes damage — matching the "boss fights become real
 * encounters, not bullet sponges" ask — without touching the underlying combat math sim.ts already
 * has (squadMove/hurtPlayer/enemyShots): phases just scale the same multipliers.
 *
 * Pure/deterministic so it can be unit-tested; sim.ts calls phaseForHpFraction() once per boss per
 * frame and applies the returned tuning, and pushes a phase-change flare when it changes.
 */

export type BossPhaseIndex = 0 | 1 | 2;

export type BossPhaseTuning = {
  label: string;
  telegraph: string;
  speedMult: number;
  damageMult: number;
  cooldownMult: number;
};

/** Phase 0: opening read. Phase 1 (below 66% hp): faster and hits harder, the fight opens up.
 *  Phase 2 (below 30% hp): desperate/overloaded — highest damage and fastest, but slower to react
 *  between attacks (higher cooldown), giving skilled players a real punish window. */
export const BOSS_PHASES: readonly BossPhaseTuning[] = [
  { label: "ENGAGED", telegraph: "Reading your approach.", speedMult: 1, damageMult: 1, cooldownMult: 1 },
  { label: "OVERDRIVEN", telegraph: "Systems overdriving — faster, harder hits.", speedMult: 1.2, damageMult: 1.3, cooldownMult: 0.85 },
  { label: "OVERLOADED", telegraph: "Critical overload — maximum output, slower recovery.", speedMult: 1.4, damageMult: 1.6, cooldownMult: 1.3 },
];

const PHASE_2_THRESHOLD = 0.66;
const PHASE_3_THRESHOLD = 0.3;

/** Which phase a boss should be in given its current hp as a fraction of max (0-1). */
export function phaseForHpFraction(fraction: number): BossPhaseIndex {
  if (fraction <= PHASE_3_THRESHOLD) return 2;
  if (fraction <= PHASE_2_THRESHOLD) return 1;
  return 0;
}

export function tuningFor(phase: BossPhaseIndex): BossPhaseTuning {
  return BOSS_PHASES[phase];
}
