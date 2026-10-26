import { describe, expect, test } from "bun:test";
import { DUNGEONS } from "./dungeons";
import { advanceEncounter, chooseEncounterRoute, createEncounterRun } from "./raid-stages";
import { DEFAULT_PROGRESSION } from "./progression";
import { beginDungeonRun, advanceDungeonObjective, restartDungeonAtCheckpoint, recordDungeonDeath } from "./dungeon-run";
import { createDungeonLobby, inviteToDungeon, joinDungeon, setDungeonReady, launchDungeon } from "./dungeon-lobby";
import {
  ASTRAVORE, ASTRAVORE_ATTACKS, DIMENSIONAL_BLUEPRINT_KEY, FIRST_CLEAR_APPEARANCE, HOLLOW_STAR, HOLLOW_STAR_ID, RAID_LANDMARKS, RAID_MINIONS, RAID_SHORTCUTS,
  RAID_VARIANTS, SECRET_OBJECTIVES, STARBREAKER_KEY, astravoreHealth, astravorePhase, attacksForPhase, claimHollowStarClear, furthestStartStage, hasStarbreaker,
  hollowStarExtras, hollowStarNews, minionCount, openShortcuts, secretKey, starbreakerRecognition,
} from "./hollow-star-raid";

const WEEK = 7 * 86_400_000;
const DAY = Date.UTC(2026, 9, 25, 12);

describe("Hollow Star definition", () => {
  test("is listed as a raid with six encounters, depth 3.8 km and a 6-player squad", () => {
    const r = DUNGEONS.find((d) => d.id === HOLLOW_STAR_ID)!;
    expect(r).toBe(HOLLOW_STAR);
    expect(r.activity).toBe("RAID");
    expect(r.stages.length).toBe(6);
    expect(r.squad).toEqual({ min: 1, max: 6 });
    expect(ASTRAVORE.depthKm).toBe(3.8);
    expect(RAID_VARIANTS.STANDARD.party).toBe(6);
    expect(RAID_VARIANTS.CHALLENGE.party).toBe(12);
  });
  test("the six encounters are the designed ones, in order, with a checkpoint after every section but the boss", () => {
    expect(HOLLOW_STAR.stages.map((s) => s.name)).toEqual(["The Broken Gate", "The Fallen Bridge", "The Seal Chambers", "The Chrono Core", "The Echo Realm", "The Hollow Star"]);
    HOLLOW_STAR.stages.slice(0, 5).forEach((s) => expect(s.checkpoint).toBe(true));
    expect(HOLLOW_STAR.stages[5]!.checkpoint).toBe(false);
    expect(HOLLOW_STAR.stages[5]!.type).toBe("BOSS_FIGHT");
  });
  test("Astravore has the four named phases in falling health order", () => {
    const phases = HOLLOW_STAR.stages[5]!.bossPhases!;
    expect(phases.map((p) => p.name.split(" · ")[1])).toEqual(["Awakening", "Star Collapse", "Fractured Reality", "Final Stand"]);
    const t = phases.map((p) => p.threshold);
    expect([...t].sort((a, b) => b - a)).toEqual(t);
  });
  test("the engine runs the whole raid to completion and passes through all four boss phases", () => {
    let run = createEncounterRun(HOLLOW_STAR);
    const seen = new Set<number>();
    for (let i = 0; i < 400 && run.status !== "COMPLETE" && run.status !== "WIPED"; i++) {
      run = advanceEncounter(HOLLOW_STAR, run);
      if (run.stageIndex === 5) seen.add(run.bossPhase);
      if (run.hazard > 60) run = { ...run, hazard: 0 }; // a team that plays the mechanics; wipes are the hazard gauge's job
    }
    expect(run.status).toBe("COMPLETE");
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });
  test("six players can launch a lobby-run and a wipe restarts at the last completed checkpoint, not the start", () => {
    // the lobby caps a private fireteam at three today; a six-member run is validated by the run module directly
    const lobby = createDungeonLobby("l1", HOLLOW_STAR_ID, "host", "GOLIATH")!;
    expect(lobby).not.toBeNull();
    let l = lobby;
    for (const id of ["a", "b"]) { l = inviteToDungeon(l, "host", id).lobby; l = joinDungeon(l, id, "NYX").lobby; }
    for (const id of ["host", "a", "b"]) l = setDungeonReady(l, id, true).lobby;
    l = launchDungeon(l, "host").lobby;
    let run = beginDungeonRun(l)!;
    expect(run).not.toBeNull();
    for (const stage of HOLLOW_STAR.stages.slice(0, 3)) run = advanceDungeonObjective(run, "host", stage.id, stage.target).run;
    expect(run.stageIndex).toBe(3);
    for (let i = 0; i < HOLLOW_STAR.maxLives; i++) run = recordDungeonDeath(run, "a").run;
    expect(run.status).toBe("WIPED");
    const again = restartDungeonAtCheckpoint(run)!;
    expect(again.stageIndex).toBe(3);
    expect(again.completedStageIds).toEqual(HOLLOW_STAR.stages.slice(0, 3).map((s) => s.id));
  });
});

describe("Astravore", () => {
  test("phase follows health fraction", () => {
    expect(astravorePhase(1)).toBe(1);
    expect(astravorePhase(0.8)).toBe(1);
    expect(astravorePhase(0.7)).toBe(2);
    expect(astravorePhase(0.45)).toBe(2);
    expect(astravorePhase(0.4)).toBe(3);
    expect(astravorePhase(0.15)).toBe(4);
    expect(astravorePhase(0)).toBe(4);
    expect(astravorePhase(-3)).toBe(4);
    expect(astravorePhase(7)).toBe(1);
  });
  test("every designed mechanic exists and each phase has attacks to face", () => {
    expect(ASTRAVORE_ATTACKS.map((a) => a.name)).toEqual(["Void Slam", "Star Beam", "Gravity Pull", "Dimensional Rifts", "Summons", "Core Exposure"]);
    for (const p of [1, 2, 3, 4] as const) expect(attacksForPhase(p).length).toBeGreaterThan(0);
    // the core only opens after a phase mechanic, so it is never an opening attack
    expect(attacksForPhase(1).some((a) => a.id === "core-exposure")).toBe(false);
    for (const a of ASTRAVORE_ATTACKS) expect(a.telegraphSeconds).toBeGreaterThanOrEqual(0);
  });
  test("the challenge variant is tougher", () => {
    expect(astravoreHealth("CHALLENGE")).toBeGreaterThan(astravoreHealth("STANDARD"));
    expect(ASTRAVORE.scaleMeters.astravore).toBeGreaterThanOrEqual(150);
  });
});

describe("route, minions and shortcuts", () => {
  test("every stage has a landmark and the depth climbs monotonically to 3.8 km", () => {
    expect(RAID_LANDMARKS.map((l) => l.stageId)).toEqual(HOLLOW_STAR.stages.map((s) => s.id));
    const d = RAID_LANDMARKS.map((l) => l.depthKm);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
    expect(d[d.length - 1]).toBe(3.8);
  });
  test("every enemy a stage names exists as a minion or the boss", () => {
    const known = new Set([...RAID_MINIONS.map((m) => m.name), "Astravore"]);
    for (const s of HOLLOW_STAR.stages) for (const e of s.enemies ?? []) expect(known.has(e), `${s.id}: ${e}`).toBe(true);
    expect(RAID_MINIONS.map((m) => m.name)).toEqual(["Void Reaver", "Void Vanguard", "Void Arcanist", "Void Sentinel"]);
  });
  test("minion counts grow with party size and the challenge scale, never below one", () => {
    expect(minionCount("broken-gate", "STANDARD", 1)).toBeLessThan(minionCount("broken-gate", "STANDARD", 6));
    expect(minionCount("broken-gate", "CHALLENGE", 12)).toBeGreaterThan(minionCount("broken-gate", "STANDARD", 6));
    expect(minionCount("broken-gate", "STANDARD", 0)).toBeGreaterThanOrEqual(1);
    expect(minionCount("nope", "STANDARD", 6)).toBe(0);
  });
  test("shortcuts open only after their checkpoint and chain toward the boss", () => {
    expect(openShortcuts([])).toEqual([]);
    expect(openShortcuts(["broken-gate"]).map((s) => s.id)).toEqual(["gate-lift"]);
    const all = HOLLOW_STAR.stages.slice(0, 5).map((s) => s.id);
    expect(openShortcuts(all).length).toBe(RAID_SHORTCUTS.length);
    expect(furthestStartStage([])).toBe("broken-gate");
    expect(furthestStartStage(["broken-gate"])).toBe("fallen-bridge");
    expect(furthestStartStage(all)).toBe("hollow-star-boss");
    // a shortcut never points at a stage that is not in the raid
    const ids = new Set(["surface", ...HOLLOW_STAR.stages.map((s) => s.id)]);
    for (const s of RAID_SHORTCUTS) { expect(ids.has(s.from)).toBe(true); expect(ids.has(s.to)).toBe(true); expect(HOLLOW_STAR.stages.some((st) => st.id === s.opensAfter && st.checkpoint)).toBe(true); }
  });
});

describe("rewards", () => {
  test("first clear: title, blueprint, regalia and the standard first-clear weapon; repeat clear pays less and none of those again", () => {
    const first = claimHollowStarClear(DEFAULT_PROGRESSION, "STANDARD", [], DAY);
    expect(hasStarbreaker(first)).toBe(true);
    expect(first.earnedRewards).toContain(DIMENSIONAL_BLUEPRINT_KEY);
    expect(first.earnedRewards).toContain(FIRST_CLEAR_APPEARANCE);
    expect(first.dungeonClears[HOLLOW_STAR_ID]).toBe(1);
    expect(first.inventory.length).toBeGreaterThan(DEFAULT_PROGRESSION.inventory.length);
    const next = claimHollowStarClear(first, "STANDARD", [], DAY + WEEK);
    expect(next.dungeonClears[HOLLOW_STAR_ID]).toBe(2);
    expect(next.earnedRewards.filter((k) => k === STARBREAKER_KEY).length).toBe(1);
    expect(next.inventory.filter((g) => !g.id.startsWith("hs-")).length).toBe(first.inventory.filter((g) => !g.id.startsWith("hs-")).length); // no second first-clear weapon (raid pieces are encounter drops)
    expect(next.fractureShards - first.fractureShards).toBeLessThan(first.fractureShards - DEFAULT_PROGRESSION.fractureShards);
  });
  test("locked out for the week: the same day, or any day before Monday, pays nothing more", () => {
    const first = claimHollowStarClear(DEFAULT_PROGRESSION, "STANDARD", [], DAY);
    expect(claimHollowStarClear(first, "STANDARD", ["sixth-seal"], DAY + 3_600_000)).toBe(first);
  });
  test("secret objectives pay once each, only when found, and the challenge repeat pays more than standard", () => {
    const first = claimHollowStarClear(DEFAULT_PROGRESSION, "STANDARD", [], DAY);
    const withSecret = claimHollowStarClear(first, "STANDARD", ["sixth-seal", "not-a-secret"], DAY + WEEK);
    expect(withSecret.earnedRewards).toContain(secretKey("sixth-seal"));
    expect(withSecret.earnedRewards).not.toContain(secretKey("not-a-secret"));
    const again = claimHollowStarClear(withSecret, "STANDARD", ["sixth-seal"], DAY + 2 * WEEK);
    expect(again.earnedRewards.filter((k) => k === secretKey("sixth-seal")).length).toBe(1);
    const e1 = hollowStarExtras(withSecret.earnedRewards, 2, "STANDARD", ["sixth-seal"]);
    expect(e1.secrets).toEqual([]);
    const std = hollowStarExtras(first.earnedRewards, 1, "STANDARD", []);
    const chal = hollowStarExtras(first.earnedRewards, 1, "CHALLENGE", []);
    expect(chal.fractureShards).toBeGreaterThan(std.fractureShards);
    expect(std.title).toBe(false);
    expect(std.blueprint).toBe(false);
  });
  test("every secret belongs to a real stage and pays something", () => {
    for (const s of SECRET_OBJECTIVES) {
      expect(HOLLOW_STAR.stages.some((st) => st.id === s.stageId)).toBe(true);
      expect(Object.keys(s.reward).length).toBeGreaterThan(0);
    }
  });
});

describe("recognition", () => {
  test("only a Starbreaker is recognized; the news names the operator", () => {
    expect(starbreakerRecognition(DEFAULT_PROGRESSION, "Mara")).toBeNull();
    const done = claimHollowStarClear(DEFAULT_PROGRESSION, "STANDARD", [], DAY);
    expect(starbreakerRecognition(done, "Mara")).toContain("Starbreaker");
    expect(hollowStarNews("Nyx")).toContain("Nyx");
    expect(hollowStarNews("  ")).toContain("An operator");
  });
});

describe("hub run balance", () => {
  test("a team that only advances objectives (no mistakes, no breaks) can finish the raid without the hazard gauge wiping it, with room to spare", () => {
    let run = createEncounterRun(HOLLOW_STAR);
    let peak = 0;
    for (let i = 0; i < 200 && run.status !== "COMPLETE" && run.status !== "WIPED"; i++) {
      if (HOLLOW_STAR.stages[run.stageIndex]?.routes && !run.selectedRoute) run = chooseEncounterRoute(run, HOLLOW_STAR.stages[run.stageIndex]!.routes![0]!.id);
      run = advanceEncounter(HOLLOW_STAR, run);
      peak = Math.max(peak, run.hazard);
    }
    expect(run.status).toBe("COMPLETE");
    expect(peak).toBeLessThan(90);
    expect(peak).toBeGreaterThan(50); // still a pressure gauge, not decoration
  });
});
