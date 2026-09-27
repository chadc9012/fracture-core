/**
 * Neon City chase system: a 1-5 heat level derived from live combat intensity
 * (`sim.combatHeat` / `sim.director.threat`, both already tracked in sim.ts) rather than
 * a parallel simulation. Pure/deterministic so Scene.tsx can call it every frame and the
 * HUD can render it directly — no new state to keep in sync.
 */

export type HeatLevel = 1 | 2 | 3 | 4 | 5;

export const HEAT_RESPONSE: Record<HeatLevel, { label: string; response: string }> = {
  1: { label: "MONITORED", response: "Patrol units aware of your position" },
  2: { label: "PURSUED", response: "Traffic rerouting · pursuit vehicles inbound" },
  3: { label: "ENGAGED", response: "Police units dispatched · roadblocks forming" },
  4: { label: "SUPPRESSED", response: "Drones + armored units · roadblocks active" },
  5: { label: "LOCKDOWN", response: "City status: LOCKED DOWN · all districts on active pursuit" },
};

/** Heat rises with sustained combat intensity and time spent engaged, decays when the player disengages. */
export function heatLevelFor(heat: number): HeatLevel {
  if (heat >= 80) return 5;
  if (heat >= 55) return 4;
  if (heat >= 32) return 3;
  if (heat >= 12) return 2;
  return 1;
}

const HEAT_RISE_PER_SEC = 6;
const HEAT_DECAY_PER_SEC = 4;

/**
 * `heat` is a 0-100 meter driven by `combatIntensity` (pass `sim.combatHeat` or a
 * 0-100 read on `sim.director.threat`) — matches the design spec's
 * `heatLevel += timeInCombat * 0.1` but frame-rate independent and self-decaying.
 */
export function stepHeatMeter(heat: number, combatIntensity: number, dt: number): number {
  const engaged = combatIntensity > 8;
  const next = engaged ? heat + HEAT_RISE_PER_SEC * dt : heat - HEAT_DECAY_PER_SEC * dt;
  return Math.max(0, Math.min(100, next));
}

export function heatStatus(heat: number): { level: HeatLevel; label: string; response: string } {
  const level = heatLevelFor(heat);
  return { level, ...HEAT_RESPONSE[level] };
}
