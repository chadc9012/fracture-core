// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import {
  BOSS_STORIES, BOSS_STORY_IDS, VAULT_RADIUS, applyBossStoryEvent, bossDialogueDue, bossGraphs, bossObjective, bossStoryFor, introDue, lairOf, phaseCaption, vaultNear, vaultSite,
  type BossStoryId,
} from "./boss-stories";
import { ENCOUNTERS } from "./scenario-encounters";
import { EMPTY_STORY, choose, enterNode, hasFlag, mergeStory, normalizeStory, runGraph, stageAtLeast, stageOf, visibleChoices, type DialogueGraph, type StoryState } from "./story";
import { DEFAULT_PROGRESSION } from "./progression";
import { createSim, defeatMachine, stepSim, summonScenarioBoss } from "./sim";
import { scenarioById } from "./unique-scenarios";
import { SCENARIO_LAIRS } from "./waypoints";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));

let clock = 1000;
let spy: { mockRestore: () => void };
beforeEach(() => { clock = 1000; spy = spyOn(performance, "now").mockImplementation(() => clock * 1000); });
afterEach(() => spy.mockRestore());

const defeat = (s: StoryState, id: string) => applyBossStoryEvent(s, { type: "BOSS_DEFEATED", scenarioId: id });
/** play every conversation of a boss story in the order the game offers them */
function playAll(s: StoryState, id: BossStoryId, picks: Record<string, Record<string, string>> = {}): StoryState {
  let story = runGraph(s, BOSS_STORIES[id].intro);
  story = defeat(story, id);
  for (let i = 0; i < 4; i++) {
    const g = bossDialogueDue(story, id, "vault");
    if (!g) break;
    story = runGraph(story, g, picks[g.id] ?? {});
  }
  return story;
}

describe("graph integrity", () => {
  for (const id of BOSS_STORY_IDS) {
    it(`${id}: every node/choice target exists, speakers fit the voice API, and the story ends on the archive stage`, () => {
      for (const g of bossGraphs(BOSS_STORIES[id])) {
        expect(g.nodes[g.start]).toBeDefined();
        for (const n of Object.values(g.nodes)) {
          expect(n.speaker.length).toBeGreaterThan(0);
          expect(n.speaker.length).toBeLessThanOrEqual(40);
          expect(n.text.length).toBeGreaterThan(0);
          if (n.next) expect(g.nodes[n.next]).toBeDefined();
          for (const c of n.choices ?? []) if (c.next) expect(g.nodes[c.next]).toBeDefined();
        }
      }
      expect(stageAtLeast(playAll(EMPTY_STORY, id), id, "archive")).toBe(true);
    });
    it(`${id}: one caption set per real encounter phase`, () => {
      const phases = ENCOUNTERS[id]!.phases.length;
      expect(BOSS_STORIES[id].phaseLines).toHaveLength(phases);
      for (let p = 0; p < phases; p++) expect(phaseCaption(id, p).length).toBeGreaterThan(0);
      expect(phaseCaption(id, 99)).toHaveLength(0);
    });
    it(`${id}: has a lair and a vault site on real coordinates`, () => {
      expect(SCENARIO_LAIRS.some((l) => l.scenarioId === id)).toBe(true);
      const lair = lairOf(id)!, v = vaultSite(id)!;
      expect(Number.isFinite(lair.x + lair.z + v.x + v.z)).toBe(true);
      expect(Math.hypot(v.x - lair.x, v.z - lair.z)).toBeGreaterThan(10); // outside the 10 m summon radius
    });
  }
  it("Vaelith and the other scenarios are not boss stories", () => {
    for (const id of ["vaelith", "unbroken-glass", "system-core", "red-ronin", undefined]) expect(bossStoryFor(id)).toBeNull();
  });
});

describe("gating on the real defeat", () => {
  it("nothing after the fight is available before the boss is defeated", () => {
    for (const id of BOSS_STORY_IDS) {
      let s = runGraph(EMPTY_STORY, BOSS_STORIES[id].intro);
      expect(bossDialogueDue(s, id, "vault")).toBeNull();
      expect(bossDialogueDue(s, id, "defeat")).toBeNull();
      const v = vaultSite(id)!;
      expect(vaultNear(s, v.x, v.z)).toBeNull();
      expect(bossObjective(s)).toBeNull();
      s = defeat(s, id);
      expect(hasFlag(s, BOSS_STORIES[id].defeatedFlag)).toBe(true);
      expect(stageAtLeast(s, id, "defeated")).toBe(true);
      expect(bossDialogueDue(s, id, "vault")).not.toBeNull();
    }
  });
  it("the lair intro is due once, and a skipped intro (BOSS_INTRO_SEEN) still lets the fight start", () => {
    for (const id of BOSS_STORY_IDS) {
      expect(introDue(EMPTY_STORY, id)).toBe(true);
      const skipped = applyBossStoryEvent(EMPTY_STORY, { type: "BOSS_INTRO_SEEN", scenarioId: id });
      expect(introDue(skipped, id)).toBe(false);
      expect(introDue(runGraph(EMPTY_STORY, BOSS_STORIES[id].intro), id)).toBe(false);
      expect(bossDialogueDue(skipped, id, "lair")).toBeNull();
    }
  });
  it("events for unknown scenarios, and repeated defeats, change nothing", () => {
    expect(defeat(EMPTY_STORY, "vaelith")).toBe(EMPTY_STORY);
    expect(applyBossStoryEvent(EMPTY_STORY, { type: "BOSS_DEFEATED", scenarioId: "nope" })).toBe(EMPTY_STORY);
    const once = defeat(EMPTY_STORY, "dark-knight");
    expect(defeat(once, "dark-knight")).toBe(once);
  });
  it("the vault trigger fires only on the site, only when due, and the objective points at it", () => {
    for (const id of BOSS_STORY_IDS) {
      const s = defeat(EMPTY_STORY, id), v = vaultSite(id)!;
      expect(vaultNear(s, v.x, v.z)).toBe(id);
      expect(vaultNear(s, v.x + VAULT_RADIUS + 1, v.z)).toBeNull();
      expect(bossObjective(s)!.target).toEqual({ x: v.x, z: v.z });
    }
    const done = playAll(EMPTY_STORY, "rime-alpha");
    const v = vaultSite("rime-alpha")!;
    expect(vaultNear(done, v.x, v.z)).toBeNull();
    expect(bossObjective(done)).toBeNull();
  });
});

describe("Dark Knight: The Last Oath", () => {
  const lastWords = () => bossDialogueDue(defeat(EMPTY_STORY, "dark-knight"), "dark-knight", "defeat")!;
  const answer = (pick: string) => runGraph(defeat(EMPTY_STORY, "dark-knight"), lastWords(), { n5: pick });
  const BRANCHES = [["compassion", "vale_response_compassion"], ["confront", "vale_response_confrontation"], ["investigate", "vale_response_investigation"]] as const;

  it("the last-words conversation is offered right after the kill (place defeat) and the archive waits behind it", () => {
    expect(lastWords().id).toBe("dark-knight.last-words");
    expect(bossDialogueDue(defeat(EMPTY_STORY, "dark-knight"), "dark-knight", "lair")).toBeNull();
    const released = answer("compassion");
    expect(bossDialogueDue(released, "dark-knight", "defeat")).toBeNull();
    expect(bossDialogueDue(released, "dark-knight", "vault")!.id).toBe("dark-knight.archive");
  });
  for (const [pick, flag] of BRANCHES) {
    it(`branch ${pick}: saves its own response flag + choice, frees Vale, and keeps the same core outcome`, () => {
      const s = answer(pick);
      expect(s.choices["dark-knight.response"]).toBe(pick);
      expect(hasFlag(s, flag)).toBe(true);
      expect(hasFlag(s, "vale_released")).toBe(true);
      expect(stageOf(s, "dark-knight")).toBe("released");
      for (const [, other] of BRANCHES) if (other !== flag) expect(hasFlag(s, other)).toBe(false);
      const done = playAll(EMPTY_STORY, "dark-knight", { "dark-knight.last-words": { n5: pick } });
      for (const f of ["dark_knight_defeated", "vale_released", "world_anchor_evidence", "command_signature_recovered"]) expect(hasFlag(done, f)).toBe(true);
      expect(done.collectibles).toContain("evidence:world-anchor-schematic");
      expect(stageOf(done, "dark-knight")).toBe("archive");
    });
  }
  it("all three responses lead to an identical campaign state apart from the response record", () => {
    const strip = (s: StoryState) => ({ ...s, flags: s.flags.filter((f) => !f.startsWith("vale_response_") && !f.includes("last-words:n5")).sort(), choices: {} });
    const [a, b, c] = BRANCHES.map(([p]) => strip(playAll(EMPTY_STORY, "dark-knight", { "dark-knight.last-words": { n5: p } })));
    expect(b).toEqual(a); expect(c).toEqual(a);
  });
  it("evidence flags are not set until the archive conversation is actually heard", () => {
    const s = answer("investigate");
    expect(hasFlag(s, "world_anchor_evidence")).toBe(false);
    expect(hasFlag(s, "command_signature_recovered")).toBe(false);
  });
  it("a skipped last-words conversation can be reopened at the vault and answered later", () => {
    let s = defeat(EMPTY_STORY, "dark-knight");
    const g = lastWords();
    const entered = enterNode(s, g, "n0")!; s = entered.story; // player skips at once: only the once-keyed n0 flag was applied
    expect(stageOf(s, "dark-knight")).toBe("defeated");
    expect(bossDialogueDue(s, "dark-knight", "vault")!.id).toBe("dark-knight.last-words");
    s = runGraph(s, bossDialogueDue(s, "dark-knight", "vault")!, { n5: "confront" });
    expect(s.choices["dark-knight.response"]).toBe("confront");
  });
});

describe("Rime Alpha, Drowned Monarch, Hollow Saint", () => {
  it("Rime Alpha sets the research and continuity flags and marks Thalassia", () => {
    const s = playAll(EMPTY_STORY, "rime-alpha");
    for (const f of ["rime_alpha_defeated", "rime_research_archive_found", "chrono_resonance_revealed", "preconstruction_signal_found", "thalassia_signal_marked"]) expect(hasFlag(s, f)).toBe(true);
  });
  it("Hollow Saint sets the identity and network flags", () => {
    const s = playAll(EMPTY_STORY, "hollow-saint");
    for (const f of ["hollow_saint_defeated", "elian_archive_found", "identity_truth_revealed", "haven_records_preserved", "fracture_network_evidence_found", "anchor_network_lead_found"]) expect(hasFlag(s, f)).toBe(true);
  });
  it("Drowned Monarch: the archive offers exactly the two choices, and a skipped choice stays open", () => {
    const s0 = defeat(EMPTY_STORY, "drowned-monarch");
    const g = bossDialogueDue(s0, "drowned-monarch", "vault")!;
    const mid = enterNode(enterNode(enterNode(s0, g, "n0")!.story, g, "n1")!.story, g, "n2")!;
    expect(visibleChoices(mid.story, mid.node).map((c) => c.id)).toEqual(["preserve", "expose"]);
    expect(stageOf(mid.story, "drowned-monarch")).toBe("defeated");
    expect(mid.story.choices["drowned.archive"]).toBeUndefined();
  });
  const DROWNED = (pick: string) => playAll(EMPTY_STORY, "drowned-monarch", { "drowned-monarch.archive": { n2: pick } });
  it("both archive choices are saved, differ only in the decision record, and neither blocks the main lead", () => {
    const keep = DROWNED("preserve"), expose = DROWNED("expose");
    expect(keep.choices["drowned.archive"]).toBe("preserve"); expect(hasFlag(keep, "drowned_archive_preserved")).toBe(true); expect(hasFlag(keep, "drowned_truth_released")).toBe(false);
    expect(expose.choices["drowned.archive"]).toBe("expose"); expect(hasFlag(expose, "drowned_truth_released")).toBe(true); expect(hasFlag(expose, "drowned_archive_preserved")).toBe(false);
    for (const s of [keep, expose]) {
      for (const f of ["drowned_monarch_defeated", "aurelian_archive_found", "previous_convergence_revealed", "anchor_continuity_record_found", "origin_signal_marked"]) expect(hasFlag(s, f)).toBe(true);
      expect(stageOf(s, "drowned-monarch")).toBe("archive");
    }
    const strip = (s: StoryState) => ({ ...s, flags: s.flags.filter((f) => !["drowned_archive_preserved", "drowned_truth_released"].includes(f) && !f.includes(":n2:")).sort(), choices: {}, stages: s.stages });
    expect(strip(keep)).toEqual(strip(expose));
  });
  it("the first archive decision stands: replaying the conversation with the other pick changes nothing", () => {
    const keep = DROWNED("preserve");
    const again = runGraph(keep, BOSS_STORIES["drowned-monarch"].due["defeated"]!.graph, { n2: "expose" });
    expect(again.choices["drowned.archive"]).toBe("preserve");
    expect(hasFlag(again, "drowned_truth_released")).toBe(false);
  });
});

describe("replay safety, save/load and rewards", () => {
  it("replaying every conversation is a no-op on the saved state", () => {
    let s = EMPTY_STORY;
    for (const id of BOSS_STORY_IDS) s = playAll(s, id);
    const again = BOSS_STORY_IDS.reduce((acc, id) => playAll(acc, id), s);
    expect(again).toEqual(s);
    // the choice record is still there after a replay with different picks
    const other = runGraph(s, BOSS_STORIES["dark-knight"].due["defeated"]!.graph, { n5: "confront" });
    expect(other.choices["dark-knight.response"]).toBe(s.choices["dark-knight.response"]);
  });
  it("the whole boss story set survives a JSON save/load round trip", () => {
    let s = EMPTY_STORY;
    for (const id of BOSS_STORY_IDS) s = playAll(s, id, { "drowned-monarch.archive": { n2: "expose" }, "dark-knight.last-words": { n5: "investigate" } });
    expect(normalizeStory(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it("cloud merge keeps every unlock from both devices, furthest stage, and the newer copy's decision", () => {
    const a = playAll(EMPTY_STORY, "dark-knight", { "dark-knight.last-words": { n5: "compassion" } });
    const b = defeat(playAll(EMPTY_STORY, "rime-alpha"), "hollow-saint");
    const m = mergeStory(a, b, true);
    expect(stageOf(m, "dark-knight")).toBe("archive"); expect(stageOf(m, "rime-alpha")).toBe("archive"); expect(stageOf(m, "hollow-saint")).toBe("defeated");
    for (const f of [...a.flags, ...b.flags]) expect(hasFlag(m, f)).toBe(true);
    const x = playAll(EMPTY_STORY, "dark-knight", { "dark-knight.last-words": { n5: "confront" } });
    expect(mergeStory(a, x, true).choices["dark-knight.response"]).toBe("compassion");
    expect(mergeStory(a, x, false).choices["dark-knight.response"]).toBe("confront");
    // a late merge cannot move a finished stage backwards
    expect(stageOf(mergeStory(a, defeat(EMPTY_STORY, "dark-knight"), false), "dark-knight")).toBe("archive");
  });
  it("story progress never touches rewards, inventory or credits (the scenario claim path stays authoritative)", () => {
    let s = EMPTY_STORY;
    for (const id of BOSS_STORY_IDS) s = playAll(s, id);
    const { story: _a, ...before } = DEFAULT_PROGRESSION;
    const { story: _b, ...after } = { ...DEFAULT_PROGRESSION, story: s };
    expect(after).toEqual(before);
    expect(after.earnedRewards).toEqual(DEFAULT_PROGRESSION.earnedRewards);
  });
  it("no choice is locked and every visible choice is selectable", () => {
    for (const id of BOSS_STORY_IDS) for (const g of bossGraphs(BOSS_STORIES[id])) for (const n of Object.values(g.nodes))
      for (const c of visibleChoices(EMPTY_STORY, n)) expect(choose(EMPTY_STORY, g as DialogueGraph, n.id, c.id).ok).toBe(true);
  });
});

describe("story layer: decided choices close", () => {
  it("a decision made one way hides the other answers and refuses them, but re-picking the same answer is harmless", () => {
    const g = BOSS_STORIES["drowned-monarch"].due["defeated"]!.graph;
    const kept = runGraph(defeat(EMPTY_STORY, "drowned-monarch"), g, { n2: "preserve" });
    const node = g.nodes["n2"]!;
    expect(visibleChoices(kept, node).map((c) => c.id)).toEqual(["preserve"]);
    expect(choose(kept, g, "n2", "expose")).toEqual({ ok: false, reason: "locked" });
    const same = choose(kept, g, "n2", "preserve");
    expect(same.ok && same.story).toBe(kept);
  });
});

describe("tied to the real encounter", () => {
  /** apply encounter events to the story exactly as Scene forwards them */
  const forward = (events: { id: number; kind: string; scenarioId: string }[], s: StoryState, seen = 0) => {
    let story = s;
    for (const e of events) if (e.id > seen && e.kind === "VICTORY" && bossStoryFor(e.scenarioId)) story = applyBossStoryEvent(story, { type: "BOSS_DEFEATED", scenarioId: e.scenarioId });
    return story;
  };
  it("a kill that the finale floor refuses emits no VICTORY, so the story does not advance; the real kill advances it exactly once", () => {
    const sim = createSim();
    for (const m of sim.machines) m.alive = false;
    expect(summonScenarioBoss(sim, scenarioById("dark-knight")!, 3000, 3000)).toBe(true);
    const boss = sim.machines.find((m) => m.alive && m.boss)!;
    const step = (secs: number) => { for (let i = 0; i < Math.round(secs / 0.05); i++) { clock += 0.05; stepSim(sim, { px: 3025, pz: 3000, dt: 0.05, night: 0.5, inVehicle: false }); sim.hp = 100; if (boss.alive) { boss.x = 3000; boss.z = 3000; boss.kx = 0; boss.kz = 0; } } };
    step(0.05);
    boss.hp = boss.maxHp! * 0.1; step(0.1);
    boss.hp = -50; defeatMachine(sim, boss); // hp floor holds him up
    expect(boss.alive).toBe(true);
    let story = forward(sim.encounterEvents, EMPTY_STORY);
    expect(stageOf(story, "dark-knight")).toBeUndefined();
    boss.encounter!.sinceFinale = 99; boss.encounter!.state = "IDLE"; boss.encounter!.timer = 0; boss.cool = 0;
    step(2.5);
    boss.hp = -1; defeatMachine(sim, boss);
    expect(boss.alive).toBe(false);
    story = forward(sim.encounterEvents, story);
    expect(hasFlag(story, "dark_knight_defeated")).toBe(true);
    expect(forward(sim.encounterEvents, story)).toBe(story);
    expect(sim.encounterEvents.filter((e) => e.kind === "VICTORY")).toHaveLength(1);
  });
});
