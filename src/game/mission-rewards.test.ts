// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { DEFAULT_PROGRESSION, rewardMission } from "./progression";

const NOW = Date.parse("2026-10-03T12:00:00Z");

describe("mission rewards", () => {
  test("first clear pays 1.5x materials and is recorded", () => {
    const p = rewardMission(DEFAULT_PROGRESSION, "awakening", { dataShards: 2 }, NOW);
    expect(p.lastMissionReward?.factor).toBe(1.5);
    expect(p.materials.dataShards).toBe(3);
    expect(p.completedMissions).toContain("awakening");
  });
  test("repeats pay full for 10 runs a day, then taper to 25%", () => {
    let p = rewardMission(DEFAULT_PROGRESSION, "awakening", { dataShards: 4 }, NOW);
    for (let i = 0; i < 9; i++) p = rewardMission(p, "awakening", { dataShards: 4 }, NOW);
    expect(p.lastMissionReward?.factor).toBe(1);
    p = rewardMission(p, "awakening", { dataShards: 4 }, NOW);
    expect(p.lastMissionReward?.factor).toBeCloseTo(0.85);
    for (let i = 0; i < 10; i++) p = rewardMission(p, "awakening", { dataShards: 4 }, NOW);
    expect(p.lastMissionReward?.factor).toBe(0.25);
  });
  test("taper resets the next day", () => {
    let p = rewardMission(DEFAULT_PROGRESSION, "awakening", { dataShards: 4 }, NOW);
    for (let i = 0; i < 15; i++) p = rewardMission(p, "awakening", { dataShards: 4 }, NOW);
    p = rewardMission(p, "awakening", { dataShards: 4 }, NOW + 86_400_000);
    expect(p.lastMissionReward?.factor).toBe(1);
  });
});
