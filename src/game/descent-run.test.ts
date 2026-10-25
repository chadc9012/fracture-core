import { describe, expect, test } from "bun:test";
import { RANKS, gatesForDay, shownDepth, type FractureGate } from "./fracture-gates";
import {
  LIVES, WAVE_CAP, arrive, bossDefeated, bossEngaged, checkEnrage, claimDescentClear, claimTierLoot, clearTier, clearedTodayKey, died,
  enrageLeft, gateBreaking, openWays, riftMissionId, sealKey, sealsFor, startDescent, takeExit, tierPlan, weekOf,
} from "./descent-run";
import { DEFAULT_PROGRESSION } from "./progression";

const NOW = Date.UTC(2026, 9, 25, 12);
const gate = (over: Partial<FractureGate> = {}): FractureGate => ({ ...gatesForDay(NOW).find((g) => g.dungeonId === "iron-grave")!, shownRank: "B", trueRank: "B", ...over });

describe("tier plans", () => {
  test("every wave fits the sim's machine pool with room for a boss", () => {
    const run = startDescent(gate({ shownRank: "S", trueRank: "S" }), NOW, 3);
    for (const t of [...run.layout.tiers, run.layout.nested]) for (const w of tierPlan(t, "S", 3).waves) {
      expect(w.count).toBeLessThanOrEqual(WAVE_CAP);
      expect(w.count + (w.gatekeeper ? 1 : 0) + 1).toBeLessThanOrEqual(18);
    }
  });
  test("encounters send two waves; only the boss floors have a boss; champions only from C up", () => {
    const run = startDescent(gate(), NOW);
    const enc = run.layout.tiers.find((t) => t.kind === "ENCOUNTER")!;
    expect(tierPlan(enc, "B").waves.length).toBe(2);
    expect(tierPlan(run.layout.tiers.at(-1)!, "B").boss).toBe(true);
    expect(tierPlan(run.layout.tiers[0]!, "B").boss).toBe(false);
    expect(tierPlan(enc, "D").waves.every((w) => w.champions.length === 0)).toBe(true);
    expect(tierPlan(enc, "B").waves[1]!.champions).toEqual(["BULWARK", "SURGE"]);
  });
  test("a fireteam faces a tougher wave (more elites once the pool is full), not more waves", () => {
    const run = startDescent(gate(), NOW);
    const ch = run.layout.tiers.find((t) => t.kind === "CHAMBER")!;
    const solo = tierPlan(ch, "B", 1).waves[0]!, team = tierPlan(ch, "B", 3).waves[0]!;
    expect(team.count).toBeGreaterThanOrEqual(solo.count);
    expect(team.elites).toBeGreaterThan(solo.elites);
    expect(tierPlan(ch, "B", 3).waves.length).toBe(tierPlan(ch, "B", 1).waves.length);
  });
});

describe("a run", () => {
  test("gated drops open only once their tier is cleared; the threshold drop is always open", () => {
    let run = startDescent(gate(), NOW);
    const enc = run.layout.tiers.find((t) => t.kind === "ENCOUNTER")!;
    expect(openWays(run).drops.has(0)).toBe(true);
    expect(openWays(run).drops.has(enc.index)).toBe(false);
    run = arrive(run, enc.index);
    run = clearTier(run);
    expect(openWays(run).drops.has(enc.index)).toBe(true);
  });
  test("you never arrive back upward", () => {
    const run = arrive(startDescent(gate(), NOW), 3);
    expect(arrive(run, 2).tier).toBe(3);
  });
  test("a lying gate is revealed once you pass the depth it claimed", () => {
    const g = gate({ shownRank: "B", trueRank: "A" });
    let run = startDescent(g, NOW);
    const past = run.layout.tiers.findIndex((t) => run.layout.tiers[0]!.floorY - t.floorY > shownDepth(g.dungeonId, "B"));
    expect(past).toBeGreaterThan(0);
    run = arrive(run, past - 1);
    expect(run.rankRevealed).toBe(false);
    run = arrive(run, past);
    expect(run.rankRevealed).toBe(true);
  });
  test("deaths spend shared lives; the last one fails the run unless the boss is already down", () => {
    let run = startDescent(gate(), NOW);
    for (let i = 0; i < LIVES(1); i++) run = died(run);
    expect(run.status).toBe("FAILED");
    let won = bossDefeated(arrive(startDescent(gate(), NOW), 6), NOW);
    for (let i = 0; i < LIVES(1); i++) won = died(won);
    expect(won.status).toBe("CLEARED");
  });
  test("a boss left standing too long collapses the descent", () => {
    let run = bossEngaged(arrive(startDescent(gate(), NOW), 6), NOW);
    expect(enrageLeft(run, NOW)).toBe(RANKS.B.enrage);
    run = checkEnrage(run, NOW + (RANKS.B.enrage + 1) * 1000);
    expect(run.status).toBe("FAILED");
  });
  test("the boss falls, you take the exit, the run is cleared", () => {
    const run = bossDefeated(arrive(startDescent(gate(), NOW), 6), NOW);
    expect(run.status).toBe("ACTIVE");
    expect(run.bossDown).toBe(true);
    expect(takeExit(run).status).toBe("CLEARED");
    expect(takeExit(startDescent(gate(), NOW)).status).toBe("LEFT");
  });
  test("about one boss room in five cracks onto hidden depths", () => {
    let cracks = 0;
    for (let i = 0; i < 400; i++) if (bossDefeated(arrive(startDescent(gate(), NOW + i * 977), 6), NOW).nested) cracks++;
    expect(cracks).toBeGreaterThan(40);
    expect(cracks).toBeLessThan(140);
  });
});

describe("rewards", () => {
  test("encounter chests pay once per tier per week", () => {
    let run = startDescent(gate(), NOW);
    const enc = run.layout.tiers.find((t) => t.kind === "ENCOUNTER")!;
    run = clearTier(arrive(run, enc.index));
    const WED = Date.UTC(2026, 9, 21, 12);
    const a = claimTierLoot(DEFAULT_PROGRESSION, run, enc.index, WED);
    expect(Object.keys(a.paid).length).toBeGreaterThan(0);
    const b = claimTierLoot(a.progression, run, enc.index, WED + 86400_000);
    expect(b.paid).toEqual({});
    expect(weekOf(WED)).toBe(weekOf(WED + 86400_000));
    expect(weekOf(WED)).not.toBe(weekOf(WED + 7 * 86400_000));
    const c = claimTierLoot(a.progression, run, enc.index, WED + 7 * 86400_000);
    expect(Object.keys(c.paid).length).toBeGreaterThan(0);
  });
  test("plain chambers have no chest", () => {
    const run = startDescent(gate(), NOW);
    const ch = run.layout.tiers.find((t) => t.kind === "CHAMBER")!;
    expect(claimTierLoot(DEFAULT_PROGRESSION, run, ch.index, NOW).paid).toEqual({});
  });
  test("a clear pays through the mission path once a day and records seals", () => {
    const run = takeExit(bossDefeated(arrive(startDescent(gate(), NOW), 6), NOW));
    expect(sealsFor(run)).toEqual(["FLAWLESS", "SOLO", "SOLO_FLAWLESS"]);
    const a = claimDescentClear(DEFAULT_PROGRESSION, run, NOW);
    expect(a.progression.completedMissions.includes(riftMissionId("iron-grave")) || a.progression.missionRuns[riftMissionId("iron-grave")]).toBeTruthy();
    expect(a.progression.earnedRewards).toContain(clearedTodayKey("iron-grave", run.day));
    expect(a.progression.earnedRewards).toContain(sealKey("iron-grave", "SOLO_FLAWLESS"));
    expect(a.seals.length).toBe(3);
    const b = claimDescentClear(a.progression, run, NOW);
    expect(b.progression).toBe(a.progression);
  });
  test("a failed run pays nothing", () => {
    let run = startDescent(gate(), NOW);
    for (let i = 0; i < LIVES(1); i++) run = died(run);
    expect(claimDescentClear(DEFAULT_PROGRESSION, run, NOW).progression).toBe(DEFAULT_PROGRESSION);
  });
  test("an unclosed gate breaks in the evening, not once it is cleared", () => {
    const g = gate();
    expect(gateBreaking(g, Date.UTC(2026, 9, 25, 10), [])).toBe(false);
    expect(gateBreaking(g, Date.UTC(2026, 9, 25, 19), [])).toBe(true);
    expect(gateBreaking(g, Date.UTC(2026, 9, 25, 19), [clearedTodayKey(g.dungeonId, g.day)])).toBe(false);
  });
});
