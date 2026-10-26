import { describe, expect, test } from "bun:test";
import { RAID_TIERS, STRIKE_TIERS, highestUnlocked, scaleEncounter, tierById, tierCleared, tierTarget, tierUnlocked, weekIndex, weeklyMult, weeklyRaidChallenge, RAID_CHALLENGES } from "./difficulty-ladder";
import { STRIKES, STRIKE_IDS, canClaimStrike, claimStrikeClear, strikePayout, weeklyStrike } from "./strikes";
import { ENCOUNTERS, featuredStage } from "./raid-lockout";
import { HOLLOW_STAR_ID, HOLLOW_STAR, canClaimHollowStarTier, claimHollowStarClear, claimHollowStarTierClear, hollowStarTierUnlocked } from "./hollow-star-raid";
import { PAYOUTS } from "./activity-payouts";
import { DUNGEONS } from "./dungeons";
import { DEFAULT_PROGRESSION } from "./progression";
import { nexBalance } from "./nex";
import { advanceEncounter, createEncounterRun, loseEncounterLife, type EncounterRun } from "./raid-stages";

const T = Date.UTC(2026, 9, 26, 12), DAY = 86_400_000; // a Monday noon
const fresh = () => structuredClone(DEFAULT_PROGRESSION);

describe("ladders", () => {
  test("each ladder gets strictly harder and pays strictly more", () => {
    for (const tiers of [STRIKE_TIERS, RAID_TIERS]) for (let i = 1; i < tiers.length; i++) {
      const a = tiers[i - 1]!, b = tiers[i]!;
      expect(b.rank).toBe(a.rank + 1);
      expect(b.enemyScale).toBeGreaterThan(a.enemyScale); expect(b.bossHealthScale).toBeGreaterThan(a.bossHealthScale);
      expect(b.peak).toBeGreaterThan(a.peak); expect(b.payMult).toBeGreaterThan(a.payMult);
      expect(b.livesDelta).toBeLessThanOrEqual(a.livesDelta); expect(b.power).toBeGreaterThan(a.power);
    }
  });
  test("raids pay more than strikes at every comparable tier and base", () => {
    for (let i = 0; i < 4; i++) expect(PAYOUTS.raid.first * RAID_TIERS[i]!.payMult).toBeGreaterThan(PAYOUTS.strike.first * STRIKE_TIERS[i]!.payMult * 3);
    expect(PAYOUTS.strike.first).toBeLessThan(PAYOUTS.dungeon.first);
    expect(PAYOUTS.strike.repeat).toBeLessThan(PAYOUTS.dungeon.repeat);
  });
  test("scaling makes a harder, deadlier encounter and leaves the base tier alone", () => {
    const base = HOLLOW_STAR;
    expect(scaleEncounter(base, RAID_TIERS[0]!)).toBe(base);
    const hard = scaleEncounter(base, tierById("raid", "contest"));
    expect(hard.id).toBe(base.id);
    expect(hard.maxLives).toBe(Math.max(1, base.maxLives - 3));
    expect(hard.stages.length).toBe(base.stages.length);
    hard.stages.forEach((s, i) => expect(s.target).toBeGreaterThanOrEqual(base.stages[i]!.target));
    expect(hard.stages.reduce((n, s) => n + s.target, 0)).toBeGreaterThan(base.stages.reduce((n, s) => n + s.target, 0));
    expect(hard.name).toContain("Contest");
  });
  test("a scaled strike still plays through to the end on the stage engine", () => {
    for (const tier of STRIKE_TIERS) {
      const def = scaleEncounter(STRIKES[0]!, tier);
      let run: EncounterRun = { ...createEncounterRun(def), status: "ACTIVE" };
      let steps = 0;
      while (run.status === "ACTIVE" && steps++ < 200) run = advanceEncounter(def, run);
      expect(["COMPLETE", "WIPED"]).toContain(run.status);
    }
    const def = scaleEncounter(STRIKES[0]!, tierById("strike", "master"));
    expect(loseEncounterLife(def, { ...createEncounterRun(def), status: "ACTIVE" }).lives).toBe(def.maxLives - 1);
  });
});
describe("strikes", () => {
  test("four strikes of three stages, each ending in a boss, and none collide with dungeon ids", () => {
    expect(STRIKES.length).toBeGreaterThanOrEqual(4);
    for (const s of STRIKES) { expect(s.stages.length).toBe(3); expect(s.stages.at(-1)!.type).toBe("BOSS_FIGHT"); expect(s.activity).toBe("STRIKE"); expect(DUNGEONS.some((d) => d.id === s.id)).toBe(false); }
    expect(new Set(STRIKE_IDS).size).toBe(STRIKE_IDS.length);
  });
  test("tiers unlock one after another across the whole playlist", () => {
    let p = fresh();
    expect(tierUnlocked(p, "strike", STRIKE_IDS, "standard")).toBe(true);
    expect(tierUnlocked(p, "strike", STRIKE_IDS, "hero")).toBe(false);
    expect(claimStrikeClear(p, STRIKES[0]!.id, "hero", T).paid).toBe(0); // locked: nothing happens
    p = claimStrikeClear(p, STRIKES[0]!.id, "standard", T).progression;
    expect(tierUnlocked(p, "strike", STRIKE_IDS, "hero")).toBe(true); // a clear in ANY strike opens Hero for all of them
    expect(tierUnlocked(p, "strike", STRIKE_IDS, "legend")).toBe(false);
    expect(highestUnlocked(p, "strike", STRIKE_IDS).id).toBe("hero");
  });
  test("a strike pays Nex scaled by tier, once per strike per tier per day, and first clears pay more than repeats", () => {
    const id = STRIKES.find((s) => s.id !== weeklyStrike(T).id)!.id; // avoid the Ordeal so the numbers are plain
    const a = claimStrikeClear(fresh(), id, "standard", T);
    expect(a.paid).toBe(PAYOUTS.strike.first); expect(a.first).toBe(true);
    expect(canClaimStrike(a.progression, id, "standard", T + 1000)).toBe(false);
    expect(claimStrikeClear(a.progression, id, "standard", T + 1000).paid).toBe(0);
    const hero = claimStrikeClear(a.progression, id, "hero", T + 2000);
    expect(hero.paid).toBe(Math.round(PAYOUTS.strike.first * 1.5)); // hero has its own first clear
    const next = claimStrikeClear(hero.progression, id, "standard", T + DAY);
    expect(next.paid).toBe(PAYOUTS.strike.repeat);
    expect(nexBalance(next.progression.nexLedger)).toBe(a.paid + hero.paid + next.paid);
  });
  test("the weekly Ordeal pays extra from Hero up, and rotates", () => {
    const ord = weeklyStrike(T).id;
    let p = claimStrikeClear(fresh(), ord, "standard", T).progression;
    expect(strikePayout(p, ord, "standard", T + 5)).toBeNull(); // already paid today
    expect(strikePayout(fresh(), ord, "standard", T)!.nex).toBe(PAYOUTS.strike.first); // no bonus at Standard
    expect(strikePayout(p, ord, "hero", T)!.nex).toBe(Math.round(PAYOUTS.strike.first * 1.5 * 1.5));
    const seen = new Set([0, 1, 2, 3].map((w) => weeklyStrike(T + w * 7 * DAY).id));
    expect(seen.size).toBe(STRIKES.length);
    expect(weeklyStrike(T + 3 * DAY).id).toBe(ord); // same week, same Ordeal
  });
  test("a cloud merge (earnedRewards + ledger union) keeps tier clears and cannot double-pay", () => {
    const a = claimStrikeClear(fresh(), STRIKES[1]!.id, "standard", T).progression;
    const merged = { ...a, earnedRewards: Array.from(new Set([...a.earnedRewards, ...a.earnedRewards])), nexLedger: { ...a.nexLedger, ...a.nexLedger } };
    expect(tierCleared(merged, "strike", STRIKE_IDS, "standard")).toBe(true);
    expect(claimStrikeClear(merged, STRIKES[1]!.id, "standard", T + 10).paid).toBe(0);
  });
});
describe("raid tiers", () => {
  const cleared = () => claimHollowStarTierClear(fresh(), "STANDARD", [], "normal", false, T);
  test("heroic is locked until the raid is cleared once, and each tier opens the next", () => {
    let p = fresh();
    expect(hollowStarTierUnlocked(p, "heroic")).toBe(false);
    expect(claimHollowStarTierClear(p, "STANDARD", [], "heroic", false, T)).toBe(p);
    p = cleared();
    expect(hollowStarTierUnlocked(p, "heroic")).toBe(true); expect(hollowStarTierUnlocked(p, "mastery")).toBe(false);
    p = claimHollowStarTierClear(p, "STANDARD", [], "heroic", false, T + 1000);
    expect(hollowStarTierUnlocked(p, "mastery")).toBe(true); expect(hollowStarTierUnlocked(p, "contest")).toBe(false);
  });
  test("players who cleared the raid before tiers existed already have Heroic", () => {
    const old = { ...fresh(), dungeonClears: { [HOLLOW_STAR_ID]: 1 } };
    expect(hollowStarTierUnlocked(old, "heroic")).toBe(true);
    expect(hollowStarTierUnlocked(old, "mastery")).toBe(false);
  });
  test("every tier pays its own first clear at its multiplier, and harder always pays more", () => {
    let p = cleared();
    expect(nexBalance(p.nexLedger)).toBe(PAYOUTS.raid.first);
    const paid: number[] = [PAYOUTS.raid.first];
    for (const t of ["heroic", "mastery", "contest"]) {
      const before = nexBalance(p.nexLedger);
      p = claimHollowStarTierClear(p, "STANDARD", [], t, false, T + 1000);
      paid.push(nexBalance(p.nexLedger) - before);
      expect(paid.at(-1)).toBe(Math.round(PAYOUTS.raid.first * tierById("raid", t).payMult));
    }
    expect(paid).toEqual([...paid].sort((a, b) => a - b));
    expect(paid.at(-1)).toBe(PAYOUTS.raid.first * 5);
  });
  test("a tier is locked out for the week once finished; Monday pays the repeat rate; the first-clear gear is not re-granted", () => {
    let p = cleared();
    p = claimHollowStarTierClear(p, "STANDARD", [], "heroic", false, T + 1000);
    expect(canClaimHollowStarTier(p, "heroic", T + 2000)).toBe(false);
    expect(claimHollowStarTierClear(p, "STANDARD", [], "heroic", false, T + 2000)).toBe(p);
    expect(claimHollowStarTierClear(p, "STANDARD", [], "heroic", false, T + 3 * DAY)).toBe(p); // still the same week
    const before = nexBalance(p.nexLedger);
    const nextWeek = claimHollowStarTierClear(p, "STANDARD", [], "heroic", false, T + 7 * DAY);
    expect(nexBalance(nextWeek.nexLedger) - before).toBe(Math.round(PAYOUTS.raid.repeat * 1.75));
    expect(nextWeek.dungeonClears[HOLLOW_STAR_ID]).toBe(p.dungeonClears[HOLLOW_STAR_ID]); // harder tiers do not re-run the first-clear pipeline
  });
  test("the weekly challenge doubles the featured encounter and guarantees its drop; the 12-player variant stacks with the tier", () => {
    const feat = featuredStage(T), share = ENCOUNTERS[feat]!.share;
    const plain = claimHollowStarTierClear(fresh(), "STANDARD", [], "normal", false, T);
    const weekly = claimHollowStarTierClear(fresh(), "STANDARD", [], "normal", true, T);
    expect(nexBalance(plain.nexLedger)).toBe(PAYOUTS.raid.first);
    expect(nexBalance(weekly.nexLedger)).toBe(PAYOUTS.raid.first + Math.round(PAYOUTS.raid.first * share));
    expect(weekly.inventory.some((g) => g.id === ENCOUNTERS[feat]!.piece.id)).toBe(true);
    expect(nexBalance(claimHollowStarTierClear(fresh(), "CHALLENGE", [], "normal", false, T).nexLedger)).toBe(Math.round(PAYOUTS.raid.first * 1.5));
    const a = cleared();
    expect(nexBalance(claimHollowStarTierClear(a, "CHALLENGE", [], "heroic", false, T + 1000).nexLedger) - nexBalance(a.nexLedger)).toBe(Math.round(PAYOUTS.raid.first * 1.75 * 1.5));
  });
  test("a normal clear still behaves exactly as before (variant bonus, no double payout)", () => {
    const direct = claimHollowStarClear(fresh(), "CHALLENGE", [], T);
    const viaTier = claimHollowStarTierClear(fresh(), "CHALLENGE", [], "normal", false, T);
    expect(nexBalance(viaTier.nexLedger)).toBe(nexBalance(direct.nexLedger));
  });
  test("targets keep the base id for the base tier and suffix the rest", () => {
    expect(tierTarget("raid", "r", "normal")).toBe("r"); expect(tierTarget("raid", "r", "heroic")).toBe("r@heroic");
    expect(tierTarget("strike", "s", "standard")).toBe("s"); expect(tierTarget("strike", "s", "master")).toBe("s@master");
  });
});
describe("weekly rotation", () => {
  test("a Monday starts a new week and the raid challenge cycles through every modifier", () => {
    expect(weekIndex(T)).toBe(weekIndex(T + 6 * DAY)); expect(weekIndex(T + 7 * DAY)).toBe(weekIndex(T) + 1);
    expect(new Set(RAID_CHALLENGES.map((_, w) => weeklyRaidChallenge(T + w * 7 * DAY).id)).size).toBe(RAID_CHALLENGES.length);
    expect(weeklyMult("strike", tierById("strike", "hero"), true, false)).toBe(1.5);
    expect(weeklyMult("strike", tierById("strike", "standard"), true, false)).toBe(1);
    expect(weeklyMult("strike", tierById("strike", "hero"), false, false)).toBe(1);
  });
});

import { applyChallenge, flawlessPeak, challengeBump, CHALLENGE_PEAK_CAP } from "./difficulty-ladder";
describe("weekly raid challenge rules", () => {
  const def = HOLLOW_STAR;
  const total = (d: typeof def) => d.stages.reduce((n, s) => n + s.target, 0);
  const play = (d: typeof def) => { let run: EncounterRun = { ...createEncounterRun(d), status: "ACTIVE" }; let n = 0; while (run.status === "ACTIVE" && n++ < 500) run = advanceEncounter(d, run); return run; };
  test("every modifier changes the run in the way it says", () => {
    expect(applyChallenge(def, "no-revive").noCheckpointRelief).toBe(true);
    expect(applyChallenge(def, "blackout").blackout).toBe(true);
    expect(total(applyChallenge(def, "swarm"))).toBeGreaterThan(total(def));
    expect(applyChallenge(def, "swarm").stages.at(-1)!.target).toBe(def.stages.at(-1)!.target);
    expect(applyChallenge(def, "iron-boss").stages.at(-1)!.target).toBeGreaterThan(def.stages.at(-1)!.target);
    expect(flawlessPeak(scaleEncounter(def, RAID_TIERS[0]!, "short-fuse"))).toBeGreaterThan(flawlessPeak(def));
    const glass = applyChallenge(def, "glass");
    expect(glass.maxLives).toBe(def.maxLives - 2); expect(play(glass).damage).toBeGreaterThan(play(def).damage);
    expect(applyChallenge(def, "unknown")).toBe(def);
  });
  test("every weekly modifier has a rule, and no checkpoint relief means hazard carries between stages", () => {
    for (const m of RAID_CHALLENGES) expect(scaleEncounter(def, RAID_TIERS[0]!, m.id)).not.toBe(def);
    const d = applyChallenge(def, "no-revive");
    let r: EncounterRun = { ...createEncounterRun(d), status: "ACTIVE" };
    const first = d.stages[0]!;
    for (let i = 0; i < first.target; i++) r = advanceEncounter(d, r);
    expect(r.stageIndex).toBe(1);
    expect(r.hazard).toBe(Math.min(100, first.target * (first.hazardPerStep ?? 8)));
  });
});

describe("every tier is winnable on purpose, and harder tiers leave less room", () => {
  test("flawless play clears every strike at every tier, peaking near the tier's target", () => {
    for (const s of STRIKES) {
      const peaks = STRIKE_TIERS.map((t) => flawlessPeak(scaleEncounter(s, t)));
      peaks.forEach((p, i) => { expect(p).toBeLessThanOrEqual(STRIKE_TIERS[i]!.peak + TUNE_SLACK); expect(p).toBeGreaterThanOrEqual(STRIKE_TIERS[i]!.peak - 6); });
      expect(peaks).toEqual([...peaks].sort((a, b) => a - b));
    }
  });
  test("flawless play clears the raid at every tier, with and without the weekly challenge, at both party sizes' tiers", () => {
    for (const t of RAID_TIERS) {
      const p = flawlessPeak(scaleEncounter(HOLLOW_STAR, t));
      expect(p).toBeLessThanOrEqual(Math.min(CHALLENGE_PEAK_CAP, t.peak + TUNE_SLACK)); expect(p).toBeGreaterThanOrEqual(t.peak - 6);
      for (const m of RAID_CHALLENGES) {
        const pm = flawlessPeak(scaleEncounter(HOLLOW_STAR, t, m.id));
        expect(pm).toBeLessThan(100); expect(pm).toBeLessThanOrEqual(Math.min(CHALLENGE_PEAK_CAP, t.peak + challengeBump(m.id) + TUNE_SLACK));
      }
    }
    expect(flawlessPeak(HOLLOW_STAR)).toBe(80); // the authored raid is untouched
  });
  test("the base tier keeps room for all three secret searches (each costs 8% hazard in its own stage); harder tiers are tuned to their limit", () => {
    for (const t of RAID_TIERS.filter((x) => x.rank <= SEARCH_ROOM_RANK)) {
      const def = scaleEncounter(HOLLOW_STAR, t);
      let run: EncounterRun = { ...createEncounterRun(def), status: "ACTIVE" };
      let guard = 0;
      while (run.status === "ACTIVE" && guard++ < 500) {
        const id = def.stages[run.stageIndex]!.id;
        if (run.progress === 0 && ["broken-gate", "seal-chambers", "echo-realm"].includes(id)) run = { ...run, hazard: Math.min(100, run.hazard + 8) };
        run = advanceEncounter(def, run);
      }
      expect(run.status).toBe("COMPLETE");
    }
  });
});

import { SEARCH_STAGES, SEARCH_HAZARD, SEARCH_ROOM_RANK, TUNE_SLACK } from "./difficulty-ladder";
import { SECRET_OBJECTIVES } from "./hollow-star-raid";
test("the search-room table matches the raid's secret objectives", () => {
  expect([...SEARCH_STAGES[HOLLOW_STAR_ID]!].sort()).toEqual(SECRET_OBJECTIVES.map((o) => o.stageId).sort());
  expect(SEARCH_HAZARD).toBe(8);
});
