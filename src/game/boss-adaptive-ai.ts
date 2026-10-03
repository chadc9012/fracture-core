/**
 * Adaptive boss AI (Shangri-La Frontier-inspired): a boss reads the player's recent combat
 * pattern during an active fight and counters it — the "it's reading me" moment. Pure/stateless
 * aside from the rolling log the caller (Scene.tsx) keeps; sim.ts's per-machine boss loop folds
 * the returned CounterTuning into its existing phase tuning the same way boss-phases.ts's
 * tuningFor() already is, so the two systems stack rather than compete.
 */

export type PlayerAction = "MELEE" | "RANGED" | "DASH" | "ABILITY";

export type ActionLogEntry = { action: PlayerAction; at: number };

const WINDOW_SECONDS = 14;
const MIN_SAMPLES = 5;
const DOMINANCE_SHARE = 0.55;
const LOG_CAP = 24;

/** Appends one action and prunes anything older than the read window, newest first. */
export function logAction(log: readonly ActionLogEntry[], action: PlayerAction, now: number): ActionLogEntry[] {
  const next = [{ action, at: now }, ...log.filter((e) => now - e.at < WINDOW_SECONDS)];
  return next.length > LOG_CAP ? next.slice(0, LOG_CAP) : next;
}

/** The player's dominant recent action, once it's a clear majority within the window — null
 * while the sample is too small or too mixed to call a real "pattern" yet. */
export function dominantPattern(log: readonly ActionLogEntry[], now: number): PlayerAction | null {
  const recent = log.filter((e) => now - e.at < WINDOW_SECONDS);
  if (recent.length < MIN_SAMPLES) return null;
  const counts: Record<PlayerAction, number> = { MELEE: 0, RANGED: 0, DASH: 0, ABILITY: 0 };
  for (const e of recent) counts[e.action]++;
  const [top, count] = (Object.entries(counts) as [PlayerAction, number][]).sort((a, b) => b[1] - a[1])[0]!;
  return count / recent.length >= DOMINANCE_SHARE ? top : null;
}

export type CounterTuning = {
  /** multiplies the boss's own melee/ranged damage output */
  damageMult: number;
  /** multiplies the boss's movement speed (closing distance on a kiting/ranged player) */
  speedMult: number;
  /** multiplies attack cooldown — below 1 means it attacks more often */
  cooldownMult: number;
  /** flavor line shown once, the moment the counter first engages */
  tell: string;
};

const NEUTRAL: CounterTuning = { damageMult: 1, speedMult: 1, cooldownMult: 1, tell: "" };

const COUNTERS: Record<PlayerAction, CounterTuning> = {
  // leaning on melee trades: boss starts hitting harder up close to punish standing in the pocket
  MELEE: { damageMult: 1.25, speedMult: 1, cooldownMult: 1, tell: "reading your melee rhythm — bracing for harder trades" },
  // kiting with gunfire: boss closes distance faster so standing-and-shooting stops being free
  RANGED: { damageMult: 1, speedMult: 1.3, cooldownMult: 1, tell: "closing the gap — it's done eating your shots" },
  // leaning on Phase Dash to avoid damage: boss shortens its own cooldown to punish the dash's recovery window
  DASH: { damageMult: 1, speedMult: 1, cooldownMult: 0.7, tell: "timing around your dash — the window's closing" },
  // leaning on an ability: boss drifts its cooldown up to bait it out and punishes right after
  ABILITY: { damageMult: 1.15, speedMult: 1, cooldownMult: 1.15, tell: "baiting your cooldowns" },
};

export function counterTuningFor(pattern: PlayerAction | null): CounterTuning {
  return pattern ? COUNTERS[pattern] : NEUTRAL;
}
