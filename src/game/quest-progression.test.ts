import { describe, expect, test } from "bun:test";
import { gameTick, reconcileQuests, QUESTS, type QuestEvent } from "./quests";
import { NEW_QUEST_SIGNALS, questEventsFromHud, MAX_SURVIVE_DT, type QuestHud, type QuestSignals } from "./quest-signals";
import { DEFAULT_PROGRESSION, normalizeProgression, rewardMission, rewardVehicle, type PlayerProgression } from "./progression";
import { brokenSignalReady, hasVehicle } from "./mission-gates";

/** Drives the real HUD→events bridge the game uses, then the real quest engine. */
class Run {
  p: PlayerProgression;
  sig: QuestSignals = NEW_QUEST_SIGNALS;
  hud: QuestHud = { regionId: "veridan", heatLevel: 1, nexusLockdownTier: "MONITORING", hackProgress: 0, diving: false, kills: 0, hp: 100 };
  constructor(p: PlayerProgression = DEFAULT_PROGRESSION) { this.p = p; this.snap(0); }
  snap(dt: number, over: Partial<QuestHud> = {}) {
    this.hud = { ...this.hud, ...over };
    const r = questEventsFromHud(this.sig, this.hud, dt);
    this.sig = r.next;
    for (const e of r.events) this.p = gameTick(this.p, e);
    return r.events;
  }
  enter(regionId: string) { this.snap(0.18, { regionId }); }
  kill(n: number) { this.snap(0.18, { kills: this.hud.kills + n }); }
  /** plays `seconds` of play in snapshots as the HUD would deliver them (~0.18 s) */
  stay(seconds: number) { for (let t = 0; t < seconds; t += 0.18) this.snap(0.18); }
  /** exactly what GameCanvas does when a scripted mission finishes */
  mission(id: string, mats = {}) { this.p = gameTick(rewardMission(this.p, id, mats), { type: "MISSION_COMPLETE", missionId: id }); }
}
const active = (r: Run) => r.p.activeQuestId;
const withActive = (id: string): PlayerProgression => ({ ...DEFAULT_PROGRESSION, activeQuestId: id });

describe("B1 — kill and survive events come from gameplay", () => {
  test("kills are credited once per defeated machine, to the region fought in", () => {
    const r = new Run();
    expect(r.snap(0.18, { kills: 3 }).filter((e) => e.type === "KILL")).toEqual([{ type: "KILL", world: "veridan" }, { type: "KILL", world: "veridan" }, { type: "KILL", world: "veridan" }]);
    expect(r.snap(0.18, { kills: 3 }).filter((e) => e.type === "KILL")).toEqual([]); // no new kills, no event
    r.enter("ember");
    expect(r.snap(0.18, { kills: 4 }).filter((e) => e.type === "KILL")).toEqual([{ type: "KILL", world: "ember" }]);
  });
  test("kills made before the first snapshot or before a counter reset are never back-credited", () => {
    const sig = questEventsFromHud(NEW_QUEST_SIGNALS, { regionId: "veridan", heatLevel: 1, nexusLockdownTier: "MONITORING", hackProgress: 0, diving: false, kills: 40, hp: 100 }, 0.18);
    expect(sig.events.some((e) => e.type === "KILL")).toBe(false);
    const reset = questEventsFromHud({ ...sig.next, kills: 40 }, { regionId: "veridan", heatLevel: 1, nexusLockdownTier: "MONITORING", hackProgress: 0, diving: false, kills: 2, hp: 100 }, 0.18);
    expect(reset.events.some((e) => e.type === "KILL")).toBe(false);
    expect(reset.next.kills).toBe(2);
  });
  test("survive time counts only while alive and never banks a long pause", () => {
    const r = new Run();
    expect(r.snap(0.18, {}).some((e) => e.type === "SURVIVED" && e.world === "veridan")).toBe(true);
    expect(r.snap(0.18, { hp: 0 }).some((e) => e.type === "SURVIVED")).toBe(false);
    const long = r.snap(60, { hp: 100 }).find((e) => e.type === "SURVIVED");
    expect(long && long.type === "SURVIVED" ? long.seconds : 0).toBe(MAX_SURVIVE_DT);
  });

  const cases: { id: string; region: string; kind: "kills" | "survive"; amount: number; mission?: string }[] = [
    { id: "fd-02", region: "veridan", kind: "kills", amount: 5 },
    { id: "fd-05", region: "swamps", kind: "survive", amount: 90, mission: "drowned-relay" },
    { id: "fd-08", region: "solara", kind: "survive", amount: 90, mission: "solar-array" },
    { id: "fd-11", region: "frostspire", kind: "survive", amount: 90 },
    { id: "fd-12", region: "ember", kind: "kills", amount: 8 },
    { id: "fd-13", region: "ember", kind: "survive", amount: 60 },
    { id: "fd-14", region: "wastelands", kind: "kills", amount: 10 },
  ];
  for (const c of cases) {
    test(`${c.id} (${QUESTS[c.id]!.title}) completes from ${c.kind} in ${c.region}`, () => {
      const r = new Run(withActive(c.id));
      if (c.mission) r.mission(c.mission);
      r.enter(c.region);
      expect(active(r)).toBe(c.id); // not satisfied by merely arriving
      if (c.kind === "kills") { r.kill(c.amount - 1); expect(active(r)).toBe(c.id); r.kill(1); }
      else { r.stay(c.amount - 5); expect(active(r)).toBe(c.id); r.stay(8); }
      expect(r.p.completedMissions).toContain(c.id);
      expect(active(r)).toBe(QUESTS[c.id]!.nextQuestId);
    });
    test(`${c.id} is not credited from the wrong region`, () => {
      const r = new Run(withActive(c.id));
      r.enter("nexus");
      if (c.kind === "kills") r.kill(c.amount + 5); else r.stay(c.amount + 10);
      expect(r.p.completedMissions).not.toContain(c.id);
    });
  }
});

describe("B1 — the whole chain is completable with only events the game emits", () => {
  test("fd-01 → fd-18 using HUD snapshots, mission completions and the raid clear", () => {
    const r = new Run();
    r.mission("awakening", { dataShards: 2 });                    // fd-01
    r.enter("veridan"); r.kill(5);                                // fd-02
    r.mission("broken-signal", { dataShards: 3 });                // fd-03
    r.enter("swamps");                                            // fd-04
    r.stay(95); r.mission("drowned-relay", { bioCatalyst: 2, dataShards: 2 }); // fd-05
    r.enter("neon"); r.mission("blackout-protocol", { microCircuits: 4 }); r.snap(0.18, { heatLevel: 3 }); // fd-06
    r.mission("stitched-neon-core", { aegisCore: 1 }); r.snap(0.18, { heatLevel: 5 });                    // fd-07
    r.enter("solara"); r.stay(95); r.mission("solar-array", { anomalyCarbon: 2, dataShards: 2 }); // fd-08
    r.enter("nexus"); r.snap(0.18, { hackProgress: 100 });        // fd-09
    r.snap(0.18, { nexusLockdownTier: "LOCKDOWN_PURGE" });        // fd-10
    r.enter("frostspire"); r.stay(95);                            // fd-11
    r.enter("ember"); r.kill(8); r.stay(65);                      // fd-12, fd-13
    r.enter("wastelands"); r.kill(10);                            // fd-14
    // fd-15: the raid claim in OperationsHub (dungeonClears + both events)
    const cleared = { ...r.p, dungeonClears: { ...r.p.dungeonClears, "wasteland-fuel-king": 1 } };
    r.p = gameTick(gameTick(cleared, { type: "DUNGEON_CLEARED", dungeonId: "wasteland-fuel-king" }), { type: "BOSS_DEFEATED", encounterId: "wasteland-fuel-king" });
    r.enter("thalassia"); r.mission("descent-protocol", { dataShards: 5 }); r.snap(0.18, { diving: true }); // fd-16
    for (let t = 0; t < 250; t += 0.18) r.snap(0.18, { diving: true });                                  // fd-16 (60 s) then fd-17 (180 s)
    expect(active(r)).toBe("fd-18"); // the finale mission's own gate (activeQuestId === "fd-18") is now satisfiable
    r.p = gameTick(rewardMission(r.p, "system-core", { fractureCore: 1 }), { type: "BOSS_DEFEATED", encounterId: "system-core" });
    expect(r.p.completedMissions).toEqual(expect.arrayContaining(Object.keys(QUESTS)));
    expect(active(r)).toBeNull();
  });
  test("the same chain still completes when every scripted mission is finished early", () => {
    const r = new Run();
    for (const id of ["awakening", "broken-signal", "blackout-protocol", "stitched-neon-core", "descent-protocol"]) r.mission(id);
    expect(active(r)).toBe("fd-02"); // waits on real kills
    r.kill(5);
    expect(r.p.completedMissions).toContain("fd-03"); // ledger credited the earlier mission
    expect(active(r)).toBe("fd-04");
  });
});

describe("B2 — early mission completion", () => {
  test("a mission finished before its quest is active still completes it, once", () => {
    const early = gameTick(rewardMission(withActive("fd-02"), "broken-signal", { dataShards: 3 }), { type: "MISSION_COMPLETE", missionId: "broken-signal" });
    expect(early.completedMissions).not.toContain("fd-03");
    const afterKills = reconcileQuests([1, 2, 3, 4, 5].reduce((p) => gameTick(p, { type: "KILL", world: "veridan" }), early));
    expect(afterKills.completedMissions).toEqual(expect.arrayContaining(["fd-02", "fd-03"]));
    expect(afterKills.activeQuestId).toBe("fd-04");
  });
  test("a later quest activation credits the persisted completion", () => {
    const p = reconcileQuests({ ...withActive("fd-03"), completedMissions: ["awakening", "broken-signal"] });
    expect(p.completedMissions).toContain("fd-03");
    expect(p.activeQuestId).toBe("fd-04");
  });
  test("duplicate delivery pays nothing twice", () => {
    let p = withActive("fd-03");
    const ev: QuestEvent = { type: "MISSION_COMPLETE", missionId: "broken-signal" };
    p = gameTick(p, ev);
    const once = { shards: p.fractureShards, done: p.completedMissions.filter((x) => x === "fd-03").length, corruption: p.corruptionLevel };
    p = reconcileQuests(gameTick(gameTick(p, ev), ev));
    expect(p.fractureShards).toBe(once.shards);
    expect(p.completedMissions.filter((x) => x === "fd-03").length).toBe(once.done);
    expect(p.corruptionLevel).toBe(once.corruption);
  });
  test("a raid clear recorded before fd-15 is active is credited", () => {
    const p = reconcileQuests({ ...withActive("fd-15"), dungeonClears: { "wasteland-fuel-king": 1 } });
    expect(p.completedMissions).toContain("fd-15");
  });
  test("counters and region entry are never back-filled", () => {
    const p = reconcileQuests(withActive("fd-02"));
    expect(p.activeQuestId).toBe("fd-02");
    expect(reconcileQuests(withActive("fd-04")).activeQuestId).toBe("fd-04");
  });
  test("survives a save/load round trip and repairs a save that was already stuck", () => {
    const stuck: PlayerProgression = { ...withActive("fd-03"), completedMissions: ["fd-01", "fd-02", "awakening", "broken-signal"] };
    const loaded = normalizeProgression(JSON.parse(JSON.stringify(stuck)));
    expect(loaded.activeQuestId).toBe("fd-03");
    const fixed = reconcileQuests(loaded);
    expect(fixed.activeQuestId).toBe("fd-04");
    expect(normalizeProgression(JSON.parse(JSON.stringify(fixed))).completedMissions).toContain("fd-03");
    expect(reconcileQuests(fixed)).toEqual(fixed); // idempotent
  });
});

describe("B2 — returning player and the broken-signal prerequisite", () => {
  const returning = (): PlayerProgression => rewardVehicle({ ...DEFAULT_PROGRESSION, tutorialComplete: true, completedMissions: ["mission-01", "awakening"] }, "scrap-interceptor");
  const gate = (p: PlayerProgression, over = {}) => brokenSignalReady({ phase: "world", tutorialActive: false, progression: p, missionRunning: false, ...over });
  test("a saved vehicle counts as unlocked after save/load, so Continue does not ask again", () => {
    const loaded = normalizeProgression(JSON.parse(JSON.stringify(returning())));
    expect(loaded.selectedVehicle).toBe("scrap-interceptor");
    expect(hasVehicle(loaded)).toBe(true);
  });
  test("broken-signal can start for a returning player", () => { expect(gate(normalizeProgression(JSON.parse(JSON.stringify(returning()))))).toBe(true); });
  test("it still waits for the vehicle, Awakening, the world phase and the tutorial", () => {
    expect(gate({ ...returning(), selectedVehicle: null as never })).toBe(false);
    expect(gate({ ...returning(), completedMissions: ["mission-01"] })).toBe(false);
    expect(gate(returning(), { phase: "hub" })).toBe(false);
    expect(gate(returning(), { tutorialActive: true })).toBe(false);
  });
  test("it does not restart once completed", () => { expect(gate({ ...returning(), completedMissions: ["awakening", "broken-signal"] })).toBe(false); });
});

describe("fd-05 needs the Drowned Relay as well as the survive timer", () => {
  test("surviving alone no longer finishes fd-05; the relay mission then does", () => {
    const r = new Run(withActive("fd-05"));
    r.enter("swamps"); r.stay(120);
    expect(active(r)).toBe("fd-05");
    r.mission("drowned-relay", { bioCatalyst: 2, dataShards: 2 });
    expect(r.p.completedMissions).toContain("fd-05");
    expect(active(r)).toBe("fd-06");
  });
  test("a save mid-way through the old survive timer keeps its progress", () => {
    const old = { ...withActive("fd-05"), questObjectiveProgress: { "fd-05": [45] } };
    const r = new Run(old);
    r.mission("drowned-relay");
    r.enter("swamps"); r.stay(50);
    expect(r.p.completedMissions).toContain("fd-05");
  });
});

describe("fd-08 needs Solar Array Alpha as well as the survive timer", () => {
  test("surviving alone no longer finishes fd-08; the array mission then does", () => {
    const r = new Run(withActive("fd-08"));
    r.enter("solara"); r.stay(120);
    expect(active(r)).toBe("fd-08");
    r.mission("solar-array", { anomalyCarbon: 2, dataShards: 2 });
    expect(active(r)).toBe("fd-09");
  });
});
