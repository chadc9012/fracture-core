import { describe, expect, test } from "bun:test";
import { STORM_ISLAND_QUESTS, STORM_ISLAND_SITES, STORM_ISLANDS_CENTER, stormQuestById, stormSiteById, stormSiteWorld } from "./storm-islands";
import { heightAt, WATER_LEVEL } from "./terrain";

describe("storm islands", () => {
  test("every quest objective points at a real site and chained quests exist", () => {
    for (const q of STORM_ISLAND_QUESTS) {
      for (const o of q.objectives) expect(stormSiteById(o.siteId)).toBeTruthy();
      if (q.nextQuestId) expect(stormQuestById(q.nextQuestId)).toBeTruthy();
    }
  });
  test("the chain floats over open ocean, high above the water", () => {
    expect(heightAt(STORM_ISLANDS_CENTER.x, STORM_ISLANDS_CENTER.z)).toBeLessThan(WATER_LEVEL);
    for (const s of STORM_ISLAND_SITES) { const w = stormSiteWorld(s); expect(w.y).toBeGreaterThan(100); expect(heightAt(w.x, w.z)).toBeLessThan(WATER_LEVEL + 5); }
  });
});
