import { describe, expect, test } from "bun:test";
import { applyAstravoreKill, claimHollowStarClear, claimHollowStarTierClear, hollowStarTierUnlocked, HOLLOW_STAR_ID, STARBREAKER_KEY, DIMENSIONAL_BLUEPRINT_KEY, FIRST_CLEAR_APPEARANCE, ASTRAVORE_SCENARIO_ID } from "./hollow-star-raid";
import { raidBrief } from "./director-activities";
import { PAYOUTS, claimBossBounty } from "./activity-payouts";
import { DEFAULT_PROGRESSION } from "./progression";
import { nexBalance } from "./nex";
import { advanceEncounter, createEncounterRun, type EncounterRun } from "./raid-stages";
import { HOLLOW_STAR } from "./hollow-star-data";
import { RAID_TIERS, scaleEncounter } from "./difficulty-ladder";

const T = Date.UTC(2026, 9, 26, 12), DAY = 86_400_000;
const fresh = () => structuredClone(DEFAULT_PROGRESSION);

describe("Raid 01 playtest: a player's whole road through The Hollow Star", () => {
  test("the real kill in the world is a full raid clear: title, gear extras, 12,000 Nex, a cleared brief, and Heroic opens", () => {
    const k = applyAstravoreKill(fresh(), T);
    expect(k.firstKill).toBe(true);
    expect(k.progress.earnedRewards).toEqual(expect.arrayContaining([STARBREAKER_KEY, DIMENSIONAL_BLUEPRINT_KEY, FIRST_CLEAR_APPEARANCE]));
    expect(nexBalance(k.progress.nexLedger)).toBe(PAYOUTS.raid.first);
    expect(k.progress.dungeonClears[HOLLOW_STAR_ID]).toBe(1);
    expect(raidBrief(k.progress, HOLLOW_STAR_ID)!.cleared).toBe(true);
    expect(hollowStarTierUnlocked(k.progress, "heroic")).toBe(true);
    expect(hollowStarTierUnlocked(k.progress, "mastery")).toBe(false);
  });
  test("Astravore does not also pay a boss bounty", () => {
    expect(claimBossBounty(fresh(), ASTRAVORE_SCENARIO_ID, T).paid).toBe(0);
    expect(claimBossBounty(fresh(), "vyrak", T).paid).toBeGreaterThan(0);
  });
  test("killing it again before Monday pays nothing (the arena resets, so it must not be farmable); next week pays the repeat rate", () => {
    const a = applyAstravoreKill(fresh(), T).progress;
    const again = applyAstravoreKill(a, T + 60_000);
    expect(again.firstKill).toBe(false); expect(again.progress).toBe(a);
    expect(applyAstravoreKill(a, T + 3 * DAY).progress).toBe(a); // same week
    const next = applyAstravoreKill(a, T + 7 * DAY);
    expect(nexBalance(next.progress.nexLedger) - nexBalance(a.nexLedger)).toBe(PAYOUTS.raid.repeat);
    expect(next.progress.fractureShards).toBeGreaterThan(a.fractureShards);
    expect(next.progress.earnedRewards.filter((k) => k === STARBREAKER_KEY)).toHaveLength(1);
  });
  test("a hub clear the same day as a real kill cannot double-pay the Normal tier, but a harder tier is its own claim", () => {
    const a = applyAstravoreKill(fresh(), T).progress;
    expect(claimHollowStarClear(a, "STANDARD", [], T + 5)).toBe(a);
    expect(claimHollowStarTierClear(a, "STANDARD", [], "normal", false, T + 5)).toBe(a);
    const heroic = claimHollowStarTierClear(a, "STANDARD", [], "heroic", false, T + 5);
    expect(nexBalance(heroic.nexLedger) - nexBalance(a.nexLedger)).toBe(Math.round(PAYOUTS.raid.first * 1.75));
  });
  test("a hub-first player gets the same title and the same Normal payout, and the real kill that day adds nothing", () => {
    const hub = claimHollowStarTierClear(fresh(), "STANDARD", [], "normal", false, T);
    expect(hub.earnedRewards).toContain(STARBREAKER_KEY);
    const kill = applyAstravoreKill(hub, T + 1000);
    expect(kill.progress).toBe(hub);
    expect(nexBalance(hub.nexLedger)).toBe(PAYOUTS.raid.first);
  });
  test("the climb: Normal, Heroic, Mastery, Contest in order pays 12k, 21k, 36k, 60k and each stage engine run is winnable", () => {
    let p = applyAstravoreKill(fresh(), T).progress;
    const gained: number[] = [nexBalance(p.nexLedger)];
    for (const t of RAID_TIERS.slice(1)) {
      expect(hollowStarTierUnlocked(p, t.id)).toBe(true);
      const def = scaleEncounter(HOLLOW_STAR, t);
      let run: EncounterRun = { ...createEncounterRun(def), status: "ACTIVE" };
      for (let i = 0; i < 500 && run.status === "ACTIVE"; i++) run = advanceEncounter(def, run);
      expect(run.status).toBe("COMPLETE");
      const before = nexBalance(p.nexLedger);
      p = claimHollowStarTierClear(p, "STANDARD", [], t.id, false, T + 10);
      gained.push(nexBalance(p.nexLedger) - before);
    }
    expect(gained).toEqual([12000, 21000, 36000, 60000]);
  });
});

import { applyAstravoreKill as kill } from "./hollow-star-raid";
import { getRaidLaunchTier, raidBossHealthScale, setRaidLaunchTier } from "./raid-launch";
describe("launching and killing on a harder tier (the live arena)", () => {
  test("the launch tier defaults to Normal, ignores junk, and scales the boss by tier", () => {
    expect(getRaidLaunchTier()).toBe("normal");
    setRaidLaunchTier("nonsense"); expect(getRaidLaunchTier()).toBe("normal");
    setRaidLaunchTier("contest"); expect(getRaidLaunchTier()).toBe("contest"); expect(raidBossHealthScale("contest")).toBe(3.4);
    setRaidLaunchTier("normal"); expect(raidBossHealthScale("normal")).toBe(1);
  });
  test("a Heroic kill pays Heroic (not Normal), only once unlocked, and a locked tier counts as Normal", () => {
    const locked = kill(fresh(), T, "heroic");
    expect(locked.firstKill).toBe(true); expect(nexBalance(locked.progress.nexLedger)).toBe(PAYOUTS.raid.first); // fell back to Normal
    const normal = kill(fresh(), T, "normal").progress;
    const heroic = kill(normal, T + 10, "heroic");
    expect(heroic.firstKill).toBe(false);
    expect(nexBalance(heroic.progress.nexLedger) - nexBalance(normal.nexLedger)).toBe(Math.round(PAYOUTS.raid.first * 1.75));
    expect(kill(heroic.progress, T + 20, "heroic").progress).toBe(heroic.progress); // same tier, same day: nothing
    expect(hollowStarTierUnlocked(heroic.progress, "mastery")).toBe(true);
  });
});
