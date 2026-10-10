/** NULL DISRUPTION — the perk on the Dark Knight's Null Sovereign. Pure and deterministic (sim.ts supplies time and hit
 * events). Properly timed hits build Null Charge; once the threshold is reached, the NEXT hit releases a cyan pulse that
 * stuns nearby enemies and breaks boss poise. There is no enemy-shield system in the game, so the pulse does NOT claim to
 * strip shields: it uses the existing stun (attack cooldown) and poise-stagger rules instead.
 *
 * Timed hit  = the target is winding up an attack (interrupt), or a boss's weak-point/stagger window is open.
 * Charge     = +1 per timed hit, max THRESHOLD; fades to 0 after DECAY_SECONDS without a timed hit.
 * Pulse      = fires on the next hit (timed or not) at full charge, once per hit event, then COOLDOWN_SECONDS lockout.
 *
 * Can a fully charged hit be lost? Verified in null-disruption.integration.test.ts (real stepSim bullet path):
 *  - Lockout: no. Charge cannot build during lockout and the pulse zeroes charge, so full charge never coexists with a lockout.
 *  - Weapon switch: yes, by design (Scene resets charge, but keeps the lockout so swapping cannot dodge the cooldown).
 *  - Decay: yes, by design. Full charge still expires DECAY_SECONDS after the last timed hit; the late hit then restarts at 1. */
export const NULL_PERK = "NULL_DISRUPTION" as const;
export const NULL_CHARGE_THRESHOLD = 5;
export const NULL_DECAY_SECONDS = 6;
export const NULL_COOLDOWN_SECONDS = 8;
export const NULL_PULSE_RADIUS = 14;
export const NULL_PULSE_POISE = 35;
export const NULL_PULSE_STUN_SECONDS = 1.4;

export type NullChargeState = { charge: number; lastTimedAt: number; cooldownUntil: number; lastEventId: number };
export const INITIAL_NULL_CHARGE: NullChargeState = { charge: 0, lastTimedAt: -1e9, cooldownUntil: 0, lastEventId: -1 };

export type NullHit = { now: number; timed: boolean; /** unique per hit event; a repeated id is ignored */ eventId: number };

export function registerNullHit(state: NullChargeState, hit: NullHit): { state: NullChargeState; pulse: boolean } {
  if (hit.eventId === state.lastEventId) return { state, pulse: false }; // one activation per attack event
  let s: NullChargeState = { ...state, lastEventId: hit.eventId };
  if (s.charge > 0 && hit.now - s.lastTimedAt > NULL_DECAY_SECONDS) s = { ...s, charge: 0 };
  if (s.charge >= NULL_CHARGE_THRESHOLD && hit.now >= s.cooldownUntil) {
    return { state: { ...s, charge: 0, cooldownUntil: hit.now + NULL_COOLDOWN_SECONDS }, pulse: true };
  }
  if (hit.timed && hit.now >= s.cooldownUntil) s = { ...s, charge: Math.min(NULL_CHARGE_THRESHOLD, s.charge + 1), lastTimedAt: hit.now };
  return { state: s, pulse: false };
}

/** Switching weapons or dying clears the charge. */
export const resetNullCharge = (): NullChargeState => ({ ...INITIAL_NULL_CHARGE });
