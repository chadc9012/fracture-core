import { describe, expect, test } from "bun:test";
import { ENEMY_RENDER_RANGE, NPC_RENDER_RANGE, enemyVisible, npcVisible } from "./actor-cull";

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
});
