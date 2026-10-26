/** MAW COLLAPSE — the perk on Astravore's Fang (the Hollow Star raid's boss drop, a heavy weapon). Pure and deterministic
 * (sim.ts supplies time and hit events). Every hit feeds the Maw; at full hunger the NEXT hit collapses a short singularity on
 * the target: nearby enemies are dragged inward and take a share of that hit's damage. Then a cooldown.
 *
 * Hunger = +1 per hit, max THRESHOLD; fades to 0 after DECAY_SECONDS without a hit.
 * Collapse = fires on the next hit at full hunger, once per hit event, then COOLDOWN_SECONDS lockout (no hunger builds in it). */
export const MAW_PERK = "MAW_COLLAPSE" as const;
export const MAW_THRESHOLD = 6;
export const MAW_DECAY_SECONDS = 5;
export const MAW_COOLDOWN_SECONDS = 7;
export const MAW_RADIUS = 10;
export const MAW_PULL = 14;       // inward knockback impulse (same units as machine kx/kz)
export const MAW_SPLASH = 0.6;    // share of the triggering hit's damage dealt to the others caught

export type MawState = { hunger: number; lastHitAt: number; cooldownUntil: number; lastEventId: number };
export const INITIAL_MAW: MawState = { hunger: 0, lastHitAt: -1e9, cooldownUntil: 0, lastEventId: -1 };

export function registerMawHit(state: MawState, hit: { now: number; eventId: number }): { state: MawState; collapse: boolean } {
  if (hit.eventId === state.lastEventId) return { state, collapse: false };
  let s: MawState = { ...state, lastEventId: hit.eventId };
  if (s.hunger > 0 && hit.now - s.lastHitAt > MAW_DECAY_SECONDS) s = { ...s, hunger: 0 };
  if (s.hunger >= MAW_THRESHOLD && hit.now >= s.cooldownUntil) {
    return { state: { ...s, hunger: 0, cooldownUntil: hit.now + MAW_COOLDOWN_SECONDS }, collapse: true };
  }
  if (hit.now >= s.cooldownUntil) s = { ...s, hunger: Math.min(MAW_THRESHOLD, s.hunger + 1), lastHitAt: hit.now };
  return { state: s, collapse: false };
}

/** Switching weapons clears hunger but keeps the lockout, so swapping cannot dodge the cooldown. */
export const resetMaw = (s: MawState): MawState => ({ ...INITIAL_MAW, cooldownUntil: s.cooldownUntil, lastEventId: s.lastEventId });

/** What a collapse does to one enemy at (dx,dz) from the target: null outside the radius, else its pull direction (toward the target) and damage. */
export function mawEffect(dx: number, dz: number, hitDamage: number): { pullX: number; pullZ: number; damage: number } | null {
  const d = Math.hypot(dx, dz);
  if (d > MAW_RADIUS) return null;
  const n = d < 1e-6 ? 0 : 1 / d;
  return { pullX: -dx * n * MAW_PULL + 0, pullZ: -dz * n * MAW_PULL + 0, damage: hitDamage * MAW_SPLASH };
}
