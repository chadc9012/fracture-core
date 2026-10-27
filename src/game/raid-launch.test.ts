import { describe, expect, test } from "bun:test";
import { raidBossDamageScale, raidBossHealthScale } from "./raid-launch";

describe("raid launch tier scaling", () => {
  test("Normal is unscaled and harder tiers hit harder", () => {
    expect(raidBossDamageScale("normal")).toBe(1);
    expect(raidBossDamageScale("heroic")).toBeCloseTo(1.15);
    expect(raidBossDamageScale("mastery")).toBeCloseTo(1.35);
    expect(raidBossDamageScale("contest")).toBeCloseTo(1.6);
  });
  test("damage rises with health across the ladder", () => {
    const ids = ["normal", "heroic", "mastery", "contest"];
    for (let i = 1; i < ids.length; i++) {
      expect(raidBossDamageScale(ids[i]!)).toBeGreaterThan(raidBossDamageScale(ids[i - 1]!));
      expect(raidBossHealthScale(ids[i]!)).toBeGreaterThan(raidBossHealthScale(ids[i - 1]!));
    }
  });
});
