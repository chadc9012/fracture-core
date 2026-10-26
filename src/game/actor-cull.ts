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

/** Per-tier enemy render budgets: how far models draw, and how many ordinary enemies draw at once (nearest first). ~50 enemies at
 *  10-12k triangles each were the largest single triangle cost in the wilds, so weaker tiers draw only the nearest few. Bosses,
 *  scenario bosses, summoned troops and anything within CLOSE_ALWAYS metres are never dropped by the count cap. */
export const ENEMY_BUDGET = {
  LOW: { range: 130, max: 14 },
  MEDIUM: { range: 170, max: 22 },
  HIGH: { range: 220, max: 36 },
  ULTRA: { range: 260, max: 60 },
} as const;
export const CLOSE_ALWAYS = 30;

/** Given each live ordinary enemy's squared distance, returns the set of indices allowed to draw: all within CLOSE_ALWAYS, then
 *  the nearest up to `max` within `range`. Pure. */
export function budgetedEnemies(distSq: readonly { i: number; d2: number }[], range: number, max: number): Set<number> {
  const keep = new Set<number>(), r2 = range * range, c2 = CLOSE_ALWAYS * CLOSE_ALWAYS;
  const inRange = distSq.filter((e) => e.d2 < r2).sort((a, b) => a.d2 - b.d2);
  for (const e of inRange) if (keep.size < max || e.d2 < c2) keep.add(e.i);
  return keep;
}
