import { describe, expect, test } from "bun:test";
import { ENEMY_BUDGET, CLOSE_ALWAYS, budgetedEnemies, ENEMY_RENDER_RANGE, NPC_RENDER_RANGE, enemyVisible, npcVisible } from "./actor-cull";

describe("actor-cull", () => {
  test("dead enemies are never visible", () => {
    expect(enemyVisible({ alive: false }, 0)).toBe(false);
  });
  test("enemies hide beyond the range", () => {
    const r = ENEMY_RENDER_RANGE;
    expect(enemyVisible({ alive: true }, (r - 1) ** 2)).toBe(true);
    expect(enemyVisible({ alive: true }, (r + 1) ** 2)).toBe(false);
  });
  test("bosses and scenario bosses are never culled", () => {
    expect(enemyVisible({ alive: true, boss: true }, 1e8)).toBe(true);
    expect(enemyVisible({ alive: true, scenarioId: "astravore" }, 1e8)).toBe(true);
  });
  test("npc range is shorter", () => {
    expect(NPC_RENDER_RANGE).toBeLessThan(ENEMY_RENDER_RANGE);
    expect(npcVisible((NPC_RENDER_RANGE - 1) ** 2)).toBe(true);
    expect(npcVisible((NPC_RENDER_RANGE + 1) ** 2)).toBe(false);
  });
  test("the budget keeps the nearest, drops the rest, and never drops anything very close", () => {
    const e = Array.from({ length: 30 }, (_, i) => ({ i, d2: ((i + 1) * 5) ** 2 }));
    const keep = budgetedEnemies(e, ENEMY_BUDGET.LOW.range, 5);
    expect(keep.has(0)).toBe(true);
    expect(keep.has(4)).toBe(true);
    expect(keep.has(25)).toBe(false);          // beyond range
    expect(keep.has(10)).toBe(false);          // past the cap and not close
    const crowd = Array.from({ length: 40 }, (_, i) => ({ i, d2: (5 + i * 0.2) ** 2 }));
    expect(budgetedEnemies(crowd, 130, 3).size).toBeGreaterThanOrEqual(crowd.filter((x) => x.d2 < CLOSE_ALWAYS ** 2).length);
  });
  test("weaker tiers draw fewer, nearer enemies", () => {
    expect(ENEMY_BUDGET.LOW.max).toBeLessThan(ENEMY_BUDGET.MEDIUM.max);
    expect(ENEMY_BUDGET.MEDIUM.max).toBeLessThan(ENEMY_BUDGET.HIGH.max);
    expect(ENEMY_BUDGET.LOW.range).toBeLessThan(ENEMY_BUDGET.ULTRA.range);
  });
});
