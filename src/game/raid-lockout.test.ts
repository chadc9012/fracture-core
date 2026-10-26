import { describe, expect, test } from "bun:test";
import { DROP_CHANCE, DUPLICATE_PARTS, ENCOUNTERS, RAID_STAGE_IDS, claimEncounters, clearedStages, dropRoll, encounterCleared, featuredStage, lockedOut, pieceFor, piecePower, remainingStages, resumeStageIndex, weekKey } from "./raid-lockout";
import { claimHollowStarClear, claimHollowStarTierClear, collectHollowStarEncounters } from "./hollow-star-raid";
import { RAID_TIERS } from "./difficulty-ladder";
import { PAYOUTS } from "./activity-payouts";
import { DEFAULT_PROGRESSION } from "./progression";
import { nexBalance } from "./nex";
import { HOLLOW_STAR } from "./hollow-star-data";

const T = Date.UTC(2026, 9, 26, 12), DAY = 86_400_000, WEEK = 7 * DAY; // a Monday noon
const fresh = () => structuredClone(DEFAULT_PROGRESSION);

describe("the weekly raid loop (Destiny's)", () => {
  test("every encounter has a share and a named piece; shares sum to the whole raid, the boss pays most", () => {
    expect(RAID_STAGE_IDS).toEqual(HOLLOW_STAR.stages.map((s) => s.id));
    expect(Object.keys(ENCOUNTERS).sort()).toEqual([...RAID_STAGE_IDS].sort());
    expect(Object.values(ENCOUNTERS).reduce((n, e) => n + e.share, 0)).toBeCloseTo(1, 10);
    const boss = ENCOUNTERS["hollow-star-boss"]!.share;
    expect(Object.entries(ENCOUNTERS).every(([id, e]) => id === "hollow-star-boss" || e.share < boss)).toBe(true);
    expect(new Set(Object.values(ENCOUNTERS).map((e) => e.piece.id)).size).toBe(RAID_STAGE_IDS.length);
  });
  test("each encounter pays its own share the first time you clear it in a week, and a first clear pays the 'first' rate", () => {
    const r = claimEncounters(fresh(), "normal", ["broken-gate"], {}, T);
    expect(r.stages).toEqual(["broken-gate"]);
    expect(r.paid).toBe(Math.round(PAYOUTS.raid.first * ENCOUNTERS["broken-gate"]!.share));
    expect(nexBalance(r.progression.nexLedger)).toBe(r.paid);
    expect(encounterCleared(r.progression, "normal", "broken-gate", T)).toBe(true);
    expect(encounterCleared(r.progression, "normal", "fallen-bridge", T)).toBe(false);
    expect(encounterCleared(r.progression, "heroic", "broken-gate", T)).toBe(false); // each tier has its own lockout
  });
  test("a cleared encounter pays nothing more until Monday, then the repeat rate", () => {
    const a = claimEncounters(fresh(), "normal", ["seal-chambers"], {}, T).progression;
    const same = claimEncounters(a, "normal", ["seal-chambers"], {}, T + 3 * DAY);
    expect(same.stages).toEqual([]); expect(same.progression).toBe(a);
    const next = claimEncounters(a, "normal", ["seal-chambers"], {}, T + WEEK);
    expect(next.paid).toBe(Math.round(PAYOUTS.raid.repeat * ENCOUNTERS["seal-chambers"]!.share));
    expect(weekKey(T + WEEK)).not.toBe(weekKey(T));
  });
  test("a wipe keeps what you cleared: collecting some encounters locks only those, and the run resumes at the first one left", () => {
    let p = fresh();
    expect(resumeStageIndex(p, "normal", T)).toBe(0);
    p = collectHollowStarEncounters(p, "STANDARD", "normal", ["broken-gate", "fallen-bridge", "seal-chambers"], false, T).progression;
    expect(clearedStages(p, "normal", T)).toEqual(["broken-gate", "fallen-bridge", "seal-chambers"]);
    expect(remainingStages(p, "normal", T)).toEqual(["chrono-core", "echo-realm", "hollow-star-boss"]);
    expect(resumeStageIndex(p, "normal", T)).toBe(3);
    expect(lockedOut(p, "normal", T)).toBe(false); // the raid is not finished: no lockout yet
    expect(resumeStageIndex(p, "normal", T + WEEK)).toBe(0); // Monday resets the whole raid
  });
  test("finishing the raid collects the rest, and then you are locked out until reset (no extras, no pay)", () => {
    let p = collectHollowStarEncounters(fresh(), "STANDARD", "normal", ["broken-gate", "fallen-bridge"], false, T).progression;
    const part = nexBalance(p.nexLedger);
    p = claimHollowStarClear(p, "STANDARD", [], T + 1000);
    expect(nexBalance(p.nexLedger)).toBe(PAYOUTS.raid.first); // the rest of the raid paid the rest of the total
    expect(part).toBeLessThan(PAYOUTS.raid.first);
    expect(lockedOut(p, "normal", T + 2000)).toBe(true);
    expect(claimHollowStarClear(p, "STANDARD", [], T + 3 * DAY)).toBe(p);
    expect(claimHollowStarClear(p, "STANDARD", [], T + WEEK).dungeonClears["hollow-star"]).toBe(2);
  });
  test("operators have separate weeks", () => {
    const titan = { ...fresh(), pocketClass: "TITAN" as const }, hunter = { ...titan, pocketClass: "HUNTER" as const };
    const a = claimEncounters(titan, "normal", RAID_STAGE_IDS, {}, T).progression;
    expect(claimEncounters({ ...a, pocketClass: "HUNTER" as const }, "normal", RAID_STAGE_IDS, {}, T).stages.length).toBe(RAID_STAGE_IDS.length);
    expect(claimEncounters(hunter, "normal", RAID_STAGE_IDS, {}, T).stages.length).toBe(RAID_STAGE_IDS.length);
  });
});
describe("encounter loot", () => {
  test("drops are seeded: the same operator, week, tier and encounter always roll the same, and rolls vary", () => {
    expect(dropRoll("TITAN", "normal", "broken-gate", T)).toBe(dropRoll("TITAN", "normal", "broken-gate", T));
    const rolls = new Set(RAID_STAGE_IDS.flatMap((id) => [0, 1, 2, 3].map((w) => dropRoll("TITAN", "normal", id, T + w * WEEK))));
    expect(rolls.size).toBeGreaterThan(10);
  });
  test("higher tiers roll more often and drop higher-power pieces", () => {
    expect([...DROP_CHANCE]).toEqual([...DROP_CHANCE].sort((a, b) => a - b));
    expect(DROP_CHANCE[3]).toBeGreaterThan(DROP_CHANCE[0]!);
    expect(pieceFor("broken-gate", "contest").power).toBeGreaterThan(pieceFor("broken-gate", "normal").power);
    expect(pieceFor("broken-gate", "normal").power).toBe(piecePower(0));
  });
  test("over many weeks the drop rate follows the tier's chance (the whole table fills in)", () => {
    let hits = 0, n = 0;
    for (let w = 0; w < 60; w++) for (const id of RAID_STAGE_IDS) { n++; if (dropRoll("TITAN", "normal", id, T + w * WEEK) < DROP_CHANCE[0]!) hits++; }
    expect(hits / n).toBeGreaterThan(0.25); expect(hits / n).toBeLessThan(0.45);
  });
  test("a piece you own comes back as gear parts, a higher tier upgrades it, and the challenge guarantees the featured drop", () => {
    const feat = featuredStage(T), pieceId = ENCOUNTERS[feat]!.piece.id;
    const a = claimEncounters(fresh(), "normal", [feat], { challenge: true }, T);
    expect(a.drops.map((d) => d.id)).toEqual([pieceId]);
    const dup = claimEncounters(a.progression, "normal", [feat], { challenge: true }, T + 6 * WEEK); // six weeks later the same encounter is featured again
    expect(dup.drops).toEqual([]); expect(dup.parts).toBe(DUPLICATE_PARTS);
    expect(dup.progression.materials.gearParts).toBe((a.progression.materials.gearParts ?? 0) + DUPLICATE_PARTS);
    const up = claimEncounters(dup.progression, "contest", [feat], { challenge: true }, T);
    expect(up.drops[0]!.power).toBe(piecePower(3));
    expect(up.progression.inventory.filter((g) => g.id === pieceId)).toHaveLength(1);
    expect(up.progression.inventory.find((g) => g.id === pieceId)!.power).toBe(piecePower(3));
  });
  test("a full clear on every tier pays the raid's whole tier total", () => {
    let p = fresh();
    for (const t of RAID_TIERS) {
      const before = nexBalance(p.nexLedger);
      p = claimHollowStarTierClear(p, "STANDARD", [], t.id, false, T + 10);
      expect(nexBalance(p.nexLedger) - before).toBe(PAYOUTS.raid.first * t.payMult);
    }
  });
});
