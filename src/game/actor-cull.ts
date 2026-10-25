/** Render-distance culling for enemies and NPCs: beyond these ranges the model is hidden
 *  (the simulation keeps running). Bosses and scenario bosses are never culled so
 *  long-range fights and their tells stay visible. */
export const ENEMY_RENDER_RANGE = 220;
export const NPC_RENDER_RANGE = 140;

export function enemyVisible(
  m: { alive: boolean; boss?: boolean; scenarioId?: string | null },
  distSq: number,
  range = ENEMY_RENDER_RANGE,
): boolean {
  if (!m.alive) return false;
  if (m.boss || m.scenarioId) return true;
  return distSq < range * range;
}

export function npcVisible(distSq: number, range = NPC_RENDER_RANGE): boolean {
  return distSq < range * range;
}
