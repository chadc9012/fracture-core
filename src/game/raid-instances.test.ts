// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { RAID_INSTANCES, clampToArena, offMap, raidArrival, raidAt, raidExitPad, raidReturn, ARENA_WALK_R } from "./raid-instances";
import { LAIR_SCENARIOS, UNIQUE_SCENARIOS, scenarioById } from "./unique-scenarios";
import { SCENARIO_LAIRS } from "./waypoints";
import { walkHeight, WATER_LEVEL } from "./terrain";
import { worldAt } from "./planet";

describe("raids are instances, not places on the map", () => {
  it("every raid boss is a raid scenario with no walk-in lair and no map marker", () => {
    for (const r of RAID_INSTANCES) {
      const sc = scenarioById(r.scenarioId)!;
      expect(sc.raid).toBe(true);
      expect(LAIR_SCENARIOS.some((s) => s.id === sc.id)).toBe(false);
      expect(SCENARIO_LAIRS.some((l) => l.scenarioId === sc.id)).toBe(false);
    }
    // and nothing that is not a raid lost its lair
    expect(LAIR_SCENARIOS.length).toBe(UNIQUE_SCENARIOS.filter((s) => (s.lair || s.lairAt) && !s.raid).length);
  });
  it("every raid arena is far outside the world, on level dry ground of its own", () => {
    for (const r of RAID_INSTANCES) {
      expect(offMap(r)).toBe(true);
      const a = raidArrival(r);
      expect(raidAt(a.x, a.z)?.id).toBe(r.id);
      expect(walkHeight(r.site.x, r.site.z)).toBeGreaterThan(WATER_LEVEL);
      expect(Math.abs(walkHeight(a.x, a.z) - walkHeight(r.site.x, r.site.z))).toBeLessThan(0.2);
    }
  });
  it("you are held inside the arena; the exit pad is inside it; the way out lands at the home city", () => {
    for (const r of RAID_INSTANCES) {
      const far = clampToArena(r, r.site.x + 500, r.site.z);
      expect(Math.hypot(far.x - r.site.x, far.z - r.site.z)).toBeCloseTo(ARENA_WALK_R(r), 5);
      const e = raidExitPad(r);
      expect(Math.hypot(e.x - r.site.x, e.z - r.site.z)).toBeLessThan(ARENA_WALK_R(r));
      const back = raidReturn(r);
      expect(worldAt(back.x, back.z)).toBe("aetheria");
      expect(raidAt(back.x, back.z)).toBeNull();
    }
  });
});
