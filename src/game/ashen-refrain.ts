/** ASHEN REFRAIN — the perk on Cantor's Dirge (the Ashen Choir raid's boss drop, a heavy weapon). Pure and deterministic (sim.ts supplies
 * time and kill events). Every kill with the Dirge adds a verse: each verse raises weapon damage, and verses fade if you stop killing.
 * At a full refrain the NEXT kill sings the Last Verse: an ash burst at the body that hurts everything near it, then a cooldown.
 *
 * Verses  = +1 per kill, max VERSES; fade to 0 after DECAY_SECONDS without a kill.
 * Damage  = +DAMAGE_PER_VERSE per verse on every hit.
 * Burst   = fires on the next kill at full verses, once per kill event, then COOLDOWN_SECONDS lockout (no verses build in it). */
export const REFRAIN_PERK = "ASHEN_REFRAIN" as const;
export const REFRAIN_VERSES = 5;
export const REFRAIN_DECAY_SECONDS = 9;
export const REFRAIN_DAMAGE_PER_VERSE = 0.06;
export const REFRAIN_COOLDOWN_SECONDS = 8;
export const REFRAIN_RADIUS = 8;
export const REFRAIN_SPLASH = 0.5; // share of the killing hit's damage dealt to everything the burst catches

export type RefrainState = { verses: number; lastKillAt: number; cooldownUntil: number; lastEventId: number };
export const INITIAL_REFRAIN: RefrainState = { verses: 0, lastKillAt: -1e9, cooldownUntil: 0, lastEventId: -1 };

/** damage multiplier at `now` (verses that have faded count for nothing) */
export const refrainDamageMult = (s: RefrainState, now: number) => (s.verses > 0 && now - s.lastKillAt <= REFRAIN_DECAY_SECONDS ? 1 + REFRAIN_DAMAGE_PER_VERSE * s.verses : 1);

export function registerRefrainKill(state: RefrainState, kill: { now: number; eventId: number }): { state: RefrainState; burst: boolean } {
  if (kill.eventId === state.lastEventId) return { state, burst: false };
  let s: RefrainState = { ...state, lastEventId: kill.eventId };
  if (s.verses > 0 && kill.now - s.lastKillAt > REFRAIN_DECAY_SECONDS) s = { ...s, verses: 0 };
  if (s.verses >= REFRAIN_VERSES && kill.now >= s.cooldownUntil) {
    return { state: { ...s, verses: 0, cooldownUntil: kill.now + REFRAIN_COOLDOWN_SECONDS }, burst: true };
  }
  if (kill.now >= s.cooldownUntil) s = { ...s, verses: Math.min(REFRAIN_VERSES, s.verses + 1), lastKillAt: kill.now };
  return { state: s, burst: false };
}

/** Switching weapons clears the verses but keeps the lockout, so swapping cannot dodge the cooldown. */
export const resetRefrain = (s: RefrainState): RefrainState => ({ ...INITIAL_REFRAIN, cooldownUntil: s.cooldownUntil, lastEventId: s.lastEventId });

/** damage the burst deals to one enemy at (dx,dz) from the body: null outside the radius */
export const refrainBurstDamage = (dx: number, dz: number, hitDamage: number): number | null => (Math.hypot(dx, dz) > REFRAIN_RADIUS ? null : hitDamage * REFRAIN_SPLASH);
