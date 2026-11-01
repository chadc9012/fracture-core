import { describe, expect, test } from "bun:test";
import { ASHEN_CHOIR, ASHEN_CHOIR_ID } from "./ashen-choir-data";
import { DUNGEONS } from "./dungeons";
import { RAIDS, claimEncounters, clearedStages, dropIdFor, featuredStage, isRaidId, lockedOut, pieceFor, raidOfStage, resumeStageIndex } from "./raid-lockout";
import { canClaimRaidTier, claimRaidTierClear, collectRaidEncounters, raidTierUnlocked } from "./raid-claims";
import { HOLLOW_STAR_ID } from "./hollow-star-data";
import { setById } from "./armor-sets";
import { payoutClassOfDungeon, PAYOUTS } from "./activity-payouts";
import { flawlessPeak, scaleEncounter, tierById } from "./difficulty-ladder";
import { DEFAULT_PROGRESSION } from "./progression";

const T = Date.UTC(2026, 10, 3, 12);
const fresh = () => ({ ...DEFAULT_PROGRESSION, pocketClass: "TITAN" as const });

describe("Raid 02 · The Ashen Choir", () => {
  test("is a raid in the dungeon list with six encounters and its own boss", () => {
    expect(DUNGEONS.some((d) => d.id === ASHEN_CHOIR_ID)).toBe(true);
    expect(isRaidId(ASHEN_CHOIR_ID)).toBe(true);
    expect(payoutClassOfDungeon(ASHEN_CHOIR_ID)).toBe("raid");
    expect(ASHEN_CHOIR.stages.length).toBe(6);
    expect(ASHEN_CHOIR.stages.at(-1)!.type).toBe("BOSS_FIGHT");
  });
  test("encounter shares sum to 1, stage ids never collide with the Hollow Star, drops fill the whole set", () => {
    const r = RAIDS[ASHEN_CHOIR_ID]!;
    expect(Object.values(r.encounters).reduce((n, e) => n + e.share, 0)).toBeCloseTo(1, 10);
    for (const id of r.stageIds) expect(raidOfStage(id).id).toBe(ASHEN_CHOIR_ID);
    for (const id of RAIDS[HOLLOW_STAR_ID]!.stageIds) expect(raidOfStage(id).id).toBe(HOLLOW_STAR_ID);
    const slots = r.stageIds.map((id) => r.encounters[id]!.drop).filter((d) => d.kind === "set").map((d) => (d as { slot: string }).slot).sort();
    expect(slots).toEqual(["chest", "classItem", "gauntlets", "helmet", "legs"]);
    expect(setById("ashen-choir")).toBeDefined();
  });
  test("drops are its own set and weapon", () => {
    const piece = pieceFor("cinder-nave", "normal"), weapon = pieceFor("cantor-boss", "heroic");
    expect(piece.setId).toBe("ashen-choir");
    expect(weapon.id).toBe("ac-cantors-dirge");
    expect(weapon.source).toBe("The Ashen Choir");
    expect(dropIdFor("cantor-boss")).toBe("ac-cantors-dirge");
  });
  test("claims pay per encounter, lock out for the week and do not touch the Hollow Star", () => {
    const p = fresh();
    expect(canClaimRaidTier(p, ASHEN_CHOIR_ID, "normal", T)).toBe(true);
    const done = claimRaidTierClear(p, ASHEN_CHOIR_ID, "STANDARD", [], "normal", false, T);
    const paid = Object.values(done.nexLedger).reduce((n, v) => n + v, 0);
    expect(paid).toBe(Math.round(PAYOUTS.raid.first * 1) || paid);
    expect(paid).toBeGreaterThan(0);
    expect(clearedStages(done, "normal", T, ASHEN_CHOIR_ID).length).toBe(6);
    expect(clearedStages(done, "normal", T, HOLLOW_STAR_ID).length).toBe(0);
    expect(lockedOut(done, "normal", T, ASHEN_CHOIR_ID)).toBe(true);
    expect(lockedOut(done, "normal", T, HOLLOW_STAR_ID)).toBe(false);
    expect(claimRaidTierClear(done, ASHEN_CHOIR_ID, "STANDARD", [], "normal", false, T)).toBe(done);
    expect(Object.keys(done.nexLedger).every((k) => !k.includes(`${HOLLOW_STAR_ID}`))).toBe(true);
  });
  test("a clear unlocks Heroic for this raid only", () => {
    const p = fresh();
    expect(raidTierUnlocked(p, ASHEN_CHOIR_ID, "heroic")).toBe(false);
    const done = claimRaidTierClear(p, ASHEN_CHOIR_ID, "STANDARD", [], "normal", false, T);
    expect(raidTierUnlocked(done, ASHEN_CHOIR_ID, "heroic")).toBe(true);
    expect(raidTierUnlocked(done, HOLLOW_STAR_ID, "heroic")).toBe(false);
    const heroic = claimRaidTierClear(done, ASHEN_CHOIR_ID, "STANDARD", [], "heroic", false, T);
    expect(heroic).not.toBe(done);
    expect(lockedOut(heroic, "heroic", T, ASHEN_CHOIR_ID)).toBe(true);
  });
  test("a wipe keeps the cleared encounters and the run resumes after them", () => {
    const p = fresh();
    const r = collectRaidEncounters(p, ASHEN_CHOIR_ID, "STANDARD", "normal", ["cinder-nave", "bellwright-gallery"], false, T);
    expect(r.stages).toEqual(["cinder-nave", "bellwright-gallery"]);
    expect(resumeStageIndex(r.progression, "normal", T, ASHEN_CHOIR_ID)).toBe(2);
    expect(claimEncounters(r.progression, "normal", ["cinder-nave"], { raidId: ASHEN_CHOIR_ID }, T).stages).toEqual([]);
  });
  test("the featured encounter rotates through its own stages and the weekly challenge doubles it", () => {
    expect(RAIDS[ASHEN_CHOIR_ID]!.stageIds).toContain(featuredStage(T, ASHEN_CHOIR_ID));
    const feat = featuredStage(T, ASHEN_CHOIR_ID), share = RAIDS[ASHEN_CHOIR_ID]!.encounters[feat]!.share;
    const plain = claimEncounters(fresh(), "normal", [feat], { raidId: ASHEN_CHOIR_ID }, T).paid;
    const chall = claimEncounters(fresh(), "normal", [feat], { raidId: ASHEN_CHOIR_ID, challenge: true }, T).paid;
    expect(plain).toBe(Math.round(PAYOUTS.raid.first * share));
    expect(chall).toBe(Math.round(PAYOUTS.raid.first * share * 2));
  });
  test("every tier is winnable by design (flawless play peaks under the tier's target)", () => {
    for (const id of ["normal", "heroic", "mastery", "contest"]) {
      const t = tierById("raid", id);
      expect(flawlessPeak(scaleEncounter(ASHEN_CHOIR, t))).toBeLessThanOrEqual(t.peak + 3);
    }
  });
});
