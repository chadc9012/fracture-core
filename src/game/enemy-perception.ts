/**
 * Enemy awareness state machine: PATROL → SUSPICIOUS → ALERT (combat) → SEARCH → PATROL.
 * Pure functions so detection rules are testable; sim.ts owns movement and firing.
 *
 * Detection accumulates awareness (0..1) from sight (range shrinks with night and bad weather),
 * noise (player gunfire / combat heat) and damage taken. Awareness decays when the player is not
 * perceived. Enemies remember the last known player position and search it before giving up.
 */
export type AiState = "PATROL" | "SUSPICIOUS" | "ALERT" | "SEARCH";
export type EnemyAi = {
  state: AiState;
  awareness: number;
  lastX: number;
  lastZ: number;
  /** patrol anchor and current waypoint */
  homeX: number;
  homeZ: number;
  wpX: number;
  wpZ: number;
  timer: number;
  /** cover: retreat point and remaining time hunkered */
  coverX: number;
  coverZ: number;
  coverTime: number;
  lastHp: number;
};

export const SUSPICIOUS_AT = 0.3;
export const ALERT_AT = 1;
export const SEARCH_SECONDS = 8;
export const BASE_SIGHT = 85;

export function createAi(x: number, z: number, hp: number): EnemyAi {
  return { state: "PATROL", awareness: 0, lastX: x, lastZ: z, homeX: x, homeZ: z, wpX: x, wpZ: z, timer: 0, coverX: x, coverZ: z, coverTime: 0, lastHp: hp };
}

/** Effective sight range: night down to 55%, visibility (weather) down to its value, elites see 30% further. */
export function sightRange(night: number, visibility: number, elite: boolean) {
  return BASE_SIGHT * (1 - night * 0.45) * Math.max(0.25, visibility) * (elite ? 1.3 : 1);
}

export type Stimulus = {
  distance: number;
  sight: number;
  /** 0..1 noise level the player is producing (gunfire etc.) */
  noise: number;
  damaged: boolean;
  /** true when the enemy faces roughly toward the player (front cone) */
  facing: boolean;
};

/** Awareness gain per second for a stimulus (0 when the player is not perceived). */
export function awarenessGain(s: Stimulus): number {
  if (s.damaged) return 10;
  let g = 0;
  if (s.distance < s.sight) {
    const closeness = 1 - s.distance / s.sight;
    g += (s.facing ? 1.6 : 0.5) * (0.3 + closeness * 1.7);
  }
  const hearing = 60 * s.noise;
  if (s.distance < hearing) g += 1.2 * (1 - s.distance / hearing);
  return g;
}

export function stepAwareness(ai: EnemyAi, s: Stimulus, playerX: number, playerZ: number, dt: number): AiState {
  const gain = awarenessGain(s);
  if (gain > 0) {
    ai.awareness = Math.min(1.5, ai.awareness + gain * dt);
    if (ai.awareness >= SUSPICIOUS_AT) { ai.lastX = playerX; ai.lastZ = playerZ; }
  } else {
    ai.awareness = Math.max(0, ai.awareness - 0.18 * dt);
  }
  const prev = ai.state;
  if (ai.awareness >= ALERT_AT) ai.state = "ALERT";
  else if (prev === "ALERT") { ai.state = "SEARCH"; ai.timer = SEARCH_SECONDS; }
  else if (prev === "SEARCH") { ai.timer -= dt; if (ai.timer <= 0 && ai.awareness < SUSPICIOUS_AT) ai.state = "PATROL"; }
  else ai.state = ai.awareness >= SUSPICIOUS_AT ? "SUSPICIOUS" : "PATROL";
  // once in combat, keep the target locked while it remains perceived
  if (ai.state === "ALERT" && gain > 0) ai.awareness = Math.max(ai.awareness, ALERT_AT);
  return ai.state;
}

/** Wounded or reloading enemies break line and hunker: pick a point away from and to the side of the player. */
export function shouldTakeCover(hpFraction: number, coverTime: number, boss: boolean): boolean {
  return !boss && coverTime <= 0 && hpFraction < 0.5;
}

export function pickCover(mx: number, mz: number, px: number, pz: number, side: number): { x: number; z: number } {
  const dx = mx - px, dz = mz - pz;
  const d = Math.hypot(dx, dz) || 1;
  const nx = dx / d, nz = dz / d;
  return { x: mx + nx * 14 + -nz * side * 9, z: mz + nz * 14 + nx * side * 9 };
}
