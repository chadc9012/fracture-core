import { describe, expect, test } from "bun:test";
import { RAID_SET_ID, DROP_CHANCE, dropIdFor, pieceLevel, DUPLICATE_PARTS, ENCOUNTERS, RAID_STAGE_IDS, claimEncounters, clearedStages, dropRoll, encounterCleared, featuredStage, lockedOut, pieceFor, piecePower, remainingStages, resumeStageIndex, weekKey } from "./raid-lockout";
import { claimHollowStarClear, claimHollowStarTierClear, collectHollowStarEncounters } from "./hollow-star-raid";
import { RAID_TIERS } from "./difficulty-ladder";
import { PAYOUTS } from "./activity-payouts";
import { DEFAULT_PROGRESSION } from "./progression";
import { nexBalance } from "./nex";
import { HOLLOW_STAR } from "./hollow-star-data";
import { setById, setForRegion } from "./armor-sets";

const T = Date.UTC(2026, 9, 26, 12), DAY = 86_400_000, WEEK = 7 * DAY; // a Monday noon
const fresh = () => structuredClone(DEFAULT_PROGRESSION);

describe("the weekly raid loop (Destiny's)", () => {
  test("every encounter has a share and a named piece; shares sum to the whole raid, the boss pays most", () => {
    expect(RAID_STAGE_IDS).toEqual(HOLLOW_STAR.stages.map((s) => s.id));
    expect(Object.keys(ENCOUNTERS).sort()).toEqual([...RAID_STAGE_IDS].sort());
    expect(Object.values(ENCOUNTERS).reduce((n, e) => n + e.share, 0)).toBeCloseTo(1, 10);
    const boss = ENCOUNTERS["hollow-star-boss"]!.share;
    expect(Object.entries(ENCOUNTERS).every(([id, e]) => id === "hollow-star-boss" || e.share < boss)).toBe(true);
    expect(new Set(RAID_STAGE_IDS.map(dropIdFor)).size).toBe(RAID_STAGE_IDS.length);
    // five pieces of the raid armor set (one per slot) and one weapon
    const slots = RAID_STAGE_IDS.map((id) => ENCOUNTERS[id]!.drop).filter((d) => d.kind === "set").map((d) => (d as { slot: string }).slot).sort();
    expect(slots).toEqual(["chest", "classItem", "gauntlets", "helmet", "legs"]);
    expect(ENCOUNTERS["hollow-star-boss"]!.drop.kind).toBe("weapon");
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
  test("higher tiers roll more often and drop higher-level armor and higher-power weapons", () => {
    expect([...DROP_CHANCE]).toEqual([...DROP_CHANCE].sort((a, b) => a - b));
    expect(DROP_CHANCE[3]).toBeGreaterThan(DROP_CHANCE[0]!);
    expect(pieceFor("broken-gate", "contest").level).toBe(10); expect(pieceFor("broken-gate", "normal").level).toBe(1);
    expect(pieceFor("broken-gate", "contest").power).toBeGreaterThan(pieceFor("broken-gate", "normal").power);
    expect(pieceFor("hollow-star-boss", "contest").power).toBe(piecePower(3)); expect(pieceFor("hollow-star-boss", "normal").power).toBe(piecePower(0));
    expect([0, 1, 2, 3].map(pieceLevel)).toEqual([1, 4, 7, 10]);
  });
  test("raid armor is a real armor set with set bonuses, and no region enemy drops it", () => {
    const set = setById(RAID_SET_ID)!;
    expect(set.name).toBe("Hollow Star");
    expect(Object.values(set.pieces).sort()).toEqual(["Conduit Mark", "Echo Mantle", "Gatewarden Visor", "Sealkeeper Greaves", "Spanwalker Grips"]);
    expect(setForRegion("nexus")?.id).not.toBe(RAID_SET_ID);
    for (const region of ["nexus", "veridan", "swamps", "ember", "frostspire", "wastelands", "solara"]) expect(setForRegion(region)?.id).not.toBe(RAID_SET_ID);
    // an encounter's set drop is a real set piece (setId), so the existing equip, level and bonus rules apply to it
    const r = claimEncounters(fresh(), "normal", ["broken-gate"], { challenge: false }, T + 0).progression;
    const feat = featuredStage(T);
    const w = claimEncounters(fresh(), "normal", [feat], { challenge: true }, T).progression;
    const piece = w.inventory.find((g) => g.id === dropIdFor(feat))!;
    expect(r).toBeTruthy();
    if (ENCOUNTERS[feat]!.drop.kind === "set") { expect(piece.setId).toBe(RAID_SET_ID); expect(piece.level).toBe(1); }
  });
  test("over many weeks the drop rate follows the tier's chance (the whole table fills in)", () => {
    let hits = 0, n = 0;
    for (let w = 0; w < 60; w++) for (const id of RAID_STAGE_IDS) { n++; if (dropRoll("TITAN", "normal", id, T + w * WEEK) < DROP_CHANCE[0]!) hits++; }
    expect(hits / n).toBeGreaterThan(0.25); expect(hits / n).toBeLessThan(0.45);
  });
  test("a duplicate armor piece levels up, a higher tier upgrades it, a duplicate weapon becomes gear parts, and the challenge guarantees the featured drop", () => {
    const feat = featuredStage(T);
    const weaponWeek = Array.from({ length: 12 }, (_, w) => T + w * WEEK).find((t) => featuredStage(t) === "hollow-star-boss")!;
    const a = claimEncounters(fresh(), "normal", [feat], { challenge: true }, T);
    expect(a.drops.map((d) => d.id)).toEqual([dropIdFor(feat)]);
    const isSet = ENCOUNTERS[feat]!.drop.kind === "set";
    const dup = claimEncounters(a.progression, "normal", [feat], { challenge: true }, T + 6 * WEEK); // six weeks later the same encounter is featured again
    if (isSet) { expect(dup.drops[0]!.level).toBe(2); expect(dup.parts).toBe(0); }
    else { expect(dup.drops).toEqual([]); expect(dup.parts).toBe(DUPLICATE_PARTS); }
    const up = claimEncounters(dup.progression, "contest", [feat], { challenge: true }, T);
    expect(up.progression.inventory.filter((g) => g.id === dropIdFor(feat))).toHaveLength(1);
    expect(up.drops[0]!.level === 10 || up.drops[0]!.power === piecePower(3)).toBe(true);
    // the boss weapon: a second one is only gear parts
    const w1 = claimEncounters(fresh(), "normal", ["hollow-star-boss"], { challenge: true }, weaponWeek);
    expect(w1.drops.map((d) => d.id)).toEqual(["hs-astravore-fang"]);
    const w2 = claimEncounters(w1.progression, "normal", ["hollow-star-boss"], { challenge: true }, weaponWeek + 6 * WEEK);
    expect(w2.drops).toEqual([]); expect(w2.parts).toBe(DUPLICATE_PARTS);
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
