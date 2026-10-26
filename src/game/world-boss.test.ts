import { describe, expect, it } from "bun:test";
import { RAID_SITES, WORLD_BOSS, WORLD_BOSS_REWARD, payWorldBoss, worldBossAt, worldBossBanner, worldBossKey } from "./world-boss";

describe("world boss raids", () => {
  it("rotates through every region and is live only in its window", () => {
    const period = WORLD_BOSS.periodMin * 60_000, seen = new Set<string>();
    for (let k = 0; k < RAID_SITES.length; k++) {
      const t = k * period + 1000, r = worldBossAt(t).current;
      expect(r.live).toBe(true); seen.add(r.site.region);
      expect(worldBossAt(t + WORLD_BOSS.windowMin * 60_000).current.live).toBe(false);
    }
    expect(seen.size).toBe(RAID_SITES.length);
  });
  it("pays once per raid", () => {
    const p0: { nexLedger: Record<string, number>; materials: Record<string, number> } = { nexLedger: {}, materials: {} };
    const p1 = payWorldBoss(p0, "wb-7"), p2 = payWorldBoss(p1, "wb-7");
    expect(p1.nexLedger[worldBossKey("wb-7")]).toBe(WORLD_BOSS_REWARD.nex);
    expect(p2).toBe(p1);
    expect(payWorldBoss(p1, "wb-8")).not.toBe(p1);
  });
  it("banner reads", () => { expect(worldBossBanner(1000)).toContain("WORLD BOSS"); });
});
