/** Adaptive re-teaching — the "hidden reinforcement" layer games like this lean on: instead of a
 * mechanic being explained once and never again, repeated struggle at the same mechanic resurfaces
 * a fresh reminder, then backs off (cooldown) so it never nags. Pure state + functions; callers own
 * how a hint is actually shown (HUD alert banner, inline overlay text, etc). */
export type AdaptiveSkill = "DODGE" | "ABILITY_USE" | "HACK_ROUTE";

export type AdaptiveTutorialState = {
  struggle: Record<AdaptiveSkill, number>;
  cooldownUntil: Record<AdaptiveSkill, number>;
  timesTaught: Record<AdaptiveSkill, number>;
};

export const ADAPTIVE_TUTORIAL_INIT: AdaptiveTutorialState = {
  struggle: { DODGE: 0, ABILITY_USE: 0, HACK_ROUTE: 0 },
  cooldownUntil: { DODGE: 0, ABILITY_USE: 0, HACK_ROUTE: 0 },
  timesTaught: { DODGE: 0, ABILITY_USE: 0, HACK_ROUTE: 0 },
};

const RETEACH_THRESHOLD = 3;
const COOLDOWN_SECONDS = 30;

export const ADAPTIVE_HINTS: Record<AdaptiveSkill, string> = {
  DODGE: "Taking repeated heavy hits — dash, block, or disrupt out of the red zones before they stack up.",
  ABILITY_USE: "Your class ability is ready — abilities turn losing fights around. Press Q.",
  HACK_ROUTE: "Watch the node glow order before connecting — it flashes the correct sequence first.",
};

export function recordStruggle(state: AdaptiveTutorialState, skill: AdaptiveSkill): AdaptiveTutorialState {
  return { ...state, struggle: { ...state.struggle, [skill]: state.struggle[skill] + 1 } };
}

/** A clean success partially forgives past struggle instead of wiping it outright — one lucky pick
 * shouldn't erase a real pattern, but steady competence should stop the hints eventually. */
export function recordSuccess(state: AdaptiveTutorialState, skill: AdaptiveSkill): AdaptiveTutorialState {
  return { ...state, struggle: { ...state.struggle, [skill]: Math.max(0, state.struggle[skill] - 1) } };
}

/** Call after recording an outcome. Returns the hint text (and an advanced state with the counter
 * reset and a cooldown set) exactly when struggle has crossed the threshold and the cooldown has
 * elapsed; otherwise returns the state unchanged and a null hint. */
export function maybeReteach(state: AdaptiveTutorialState, skill: AdaptiveSkill, now: number): { state: AdaptiveTutorialState; hint: string | null } {
  if (state.struggle[skill] < RETEACH_THRESHOLD || now < state.cooldownUntil[skill]) return { state, hint: null };
  return {
    state: {
      ...state,
      struggle: { ...state.struggle, [skill]: 0 },
      cooldownUntil: { ...state.cooldownUntil, [skill]: now + COOLDOWN_SECONDS },
      timesTaught: { ...state.timesTaught, [skill]: state.timesTaught[skill] + 1 },
    },
    hint: ADAPTIVE_HINTS[skill],
  };
}
