/** Compass threat ticks: enemies that have noticed (SUSPICIOUS) or engaged (ALERT / SEARCH) the player, shown on the compass strip.
 * Pure read of the same enemy-perception state the AI runs on; it never changes what an enemy knows. Bearing uses the compass
 * convention of waypoints.ts track() (0 = dead ahead, + = to the right), so a tick lands where the enemy actually is. Threats outside
 * the compass's ±90° window are pinned to its edge and flagged, so one behind you still reads as "that side". */
import type { AiState } from "./enemy-perception";

export type ThreatLevel = "SUSPICIOUS" | "ALERT";
export type ThreatTick = { id: number; bearing: number; dist: number; level: ThreatLevel; offscreen: boolean };
export type ThreatSource = { alive: boolean; x: number; z: number; ai?: { state: AiState } | undefined };

export const THREAT_RANGE = 60;
export const THREAT_MAX = 6;
const HALF_VIEW = Math.PI / 2;

export function threatTicks(enemies: readonly ThreatSource[], px: number, pz: number, yaw: number, range = THREAT_RANGE, max = THREAT_MAX): ThreatTick[] {
  const out: ThreatTick[] = [];
  enemies.forEach((m, id) => {
    if (!m.alive || !m.ai || m.ai.state === "PATROL") return;
    const dx = m.x - px, dz = m.z - pz, dist = Math.hypot(dx, dz);
    if (dist > range) return;
    let b = Math.atan2(dx, dz) - yaw;
    b = -Math.atan2(Math.sin(b), Math.cos(b));
    const offscreen = Math.abs(b) > HALF_VIEW;
    out.push({ id, bearing: Math.max(-HALF_VIEW, Math.min(HALF_VIEW, b)), dist, level: m.ai.state === "SUSPICIOUS" ? "SUSPICIOUS" : "ALERT", offscreen });
  });
  return out.sort((a, b) => a.dist - b.dist).slice(0, max);
}
