// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { EMPTY_STORY, applyEffects, choose, enterNode, mergeStory, normalizeStory, runGraph, stageAtLeast, stageOf, trustOf, visibleChoices, type DialogueGraph, type StoryState } from "./story";
import {
  ALLIANCE_DIALOGUE, ARTIFACT_DIALOGUE, GATE_DIALOGUE, LAIR_DEFENSE_COUNT, MEMORY_SITES, TRUTH_DIALOGUE, VAELITH, VAELITH_GRAPHS, VAELITH_LAIR,
  applyVaelithEvent, bondLevel, callVaelith, dialogueDue, grantVaelithRewards, lairDefenseCleared, memoryNear, objectiveFor, startLairDefense, vaelithBond, vaelithClaims, vaelithFightable,
} from "./vaelith";
import { DEFAULT_PROGRESSION, normalizeProgression } from "./progression";
import { SCENARIO_LOOT, DRAGONHEART_PLATE, EMBER_LANCE, DRAGON_SCALE_MANTLE } from "./scenario-loot";
import { ENCOUNTERS } from "./scenario-encounters";
import { TRUCE_DEPART_SECONDS } from "./encounter-sim";
import { createSim, defeatMachine, hurtPlayer, stepSim, summonScenarioBoss, type WorldSim } from "./sim";
import { scenarioById } from "./unique-scenarios";
import { SCENARIO_LAIRS } from "./waypoints";
import { REGIONS } from "./world";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { mergeProgression } = await import("./cloud-save");

let clock = 1000; let spy: { mockRestore: () => void };
beforeEach(() => { clock = 1000; spy = spyOn(performance, "now").mockImplementation(() => clock * 1000); });
afterEach(() => spy.mockRestore());

const kind = { gate: "listen", truth: "why", alliance: "equal" };
/** a full playthrough of the story beats (no combat) */
function play(picks: { gate: string; truth: string; artifact: string; alliance: string }, s: StoryState = EMPTY_STORY): StoryState {
  s = runGraph(s, GATE_DIALOGUE, { vaelith: picks.gate });
  s = applyVaelithEvent(s, { type: "TRIAL_SURVIVED" });
  s = runGraph(s, TRUTH_DIALOGUE, { truth: picks.truth });
  for (const m of MEMORY_SITES) s = applyVaelithEvent(s, { type: "MEMORY", id: m.id });
  s = applyVaelithEvent(s, { type: "DEFENSE_CLEARED" });
  s = runGraph(s, ARTIFACT_DIALOGUE, { intro: picks.artifact });
  return runGraph(s, ALLIANCE_DIALOGUE, { open: picks.alliance });
}

describe("dialogue graph integrity", () => {
  it("every node/choice target exists, ids are stable and unique per graph", () => {
    for (const g of Object.values(VAELITH_GRAPHS)) {
      expect(g.nodes[g.start]).toBeDefined();
      for (const [id, n] of Object.entries(g.nodes)) {
        expect(n.id).toBe(id);
        if (n.next) expect(g.nodes[n.next]).toBeDefined();
        for (const c of n.choices ?? []) if (c.next) expect(g.nodes[c.next]).toBeDefined();
        expect(new Set((n.choices ?? []).map((c) => c.id)).size).toBe((n.choices ?? []).length);
      }
    }
  });
  it("invalid node/choice/locked choices change nothing", () => {
    expect(choose(EMPTY_STORY, GATE_DIALOGUE, "nope", "x")).toEqual({ ok: false, reason: "no-node" });
    expect(choose(EMPTY_STORY, GATE_DIALOGUE, "vaelith", "nope")).toEqual({ ok: false, reason: "no-choice" });
    expect(choose(EMPTY_STORY, ALLIANCE_DIALOGUE, "open", "terms")).toEqual({ ok: false, reason: "locked" });
    expect(enterNode(EMPTY_STORY, GATE_DIALOGUE, "missing")).toBeNull();
  });
  it("locked choices are hidden until their condition holds", () => {
    const node = ALLIANCE_DIALOGUE.nodes["open"]!;
    expect(visibleChoices(EMPTY_STORY, node)).toHaveLength(0);
    const s = applyEffects(EMPTY_STORY, [{ trust: { who: VAELITH, amount: 45 } }]);
    expect(visibleChoices(s, node).map((c) => c.id)).toEqual(["kind", "terms"]);
    expect(visibleChoices(applyEffects(s, [{ trust: { who: VAELITH, amount: 20 } }]), node).map((c) => c.id)).toContain("equal");
  });
});

describe("choices have real, persistent consequences", () => {
  it("a kind opening earns trust, a hostile one does not, and both advance to the fight", () => {
    const kindS = runGraph(EMPTY_STORY, GATE_DIALOGUE, { vaelith: "listen" });
    const hostile = runGraph(EMPTY_STORY, GATE_DIALOGUE, { vaelith: "hunt" });
    expect(trustOf(kindS, VAELITH)).toBe(5); expect(trustOf(hostile, VAELITH)).toBe(0);
    expect(hostile.flags).toContain("vaelith.gate-hostile");
    expect(stageOf(kindS, VAELITH)).toBe("gate"); expect(stageOf(hostile, VAELITH)).toBe("gate");
  });
  it("replaying a conversation never farms trust", () => {
    let s = runGraph(EMPTY_STORY, GATE_DIALOGUE, { vaelith: "listen" });
    for (let i = 0; i < 5; i++) s = runGraph(s, GATE_DIALOGUE, { vaelith: "listen" });
    expect(trustOf(s, VAELITH)).toBe(5);
  });
  it("the artifact decision is recorded, final (first choice stands) and changes the outcome", () => {
    const base = play({ gate: "listen", truth: "why", artifact: "preserve", alliance: "kind" });
    expect(base.choices["vaelith.artifact"]).toBe("preserve");
    expect(base.collectibles).toContain("relic:ember-heart");
    const again = applyEffects(base, [{ choice: { key: "vaelith.artifact", value: "destroy" } }]);
    expect(again.choices["vaelith.artifact"]).toBe("preserve");
    const d = play({ gate: "listen", truth: "why", artifact: "destroy", alliance: "kind" });
    expect(d.choices["vaelith.artifact"]).toBe("destroy");
    expect(d.collectibles).not.toContain("relic:ember-heart");
  });
});

describe("trust ladder and quest order", () => {
  it("bond thresholds", () => {
    expect([0, 9, 10, 39, 40, 79, 80, 100].map(bondLevel)).toEqual(["HOSTILE", "HOSTILE", "WARY", "WARY", "ALLIED", "ALLIED", "BONDED", "BONDED"]);
  });
  it("events out of order or repeated change nothing", () => {
    expect(applyVaelithEvent(EMPTY_STORY, { type: "TRIAL_SURVIVED" })).toBe(EMPTY_STORY); // no gate yet
    expect(applyVaelithEvent(EMPTY_STORY, { type: "MEMORY", id: MEMORY_SITES[0].id })).toBe(EMPTY_STORY);
    expect(applyVaelithEvent(EMPTY_STORY, { type: "DEFENSE_CLEARED" })).toBe(EMPTY_STORY);
    let s = runGraph(EMPTY_STORY, GATE_DIALOGUE, { vaelith: "hunt" });
    s = applyVaelithEvent(s, { type: "TRIAL_SURVIVED" });
    expect(trustOf(s, VAELITH)).toBe(10);
    expect(applyVaelithEvent(s, { type: "TRIAL_SURVIVED" })).toBe(s);
    s = runGraph(s, TRUTH_DIALOGUE, { truth: "doubt" });
    expect(applyVaelithEvent(s, { type: "MEMORY", id: "memory:bogus" })).toBe(s);
    s = applyVaelithEvent(s, { type: "MEMORY", id: MEMORY_SITES[0].id });
    expect(applyVaelithEvent(s, { type: "MEMORY", id: MEMORY_SITES[0].id })).toBe(s);
    expect(trustOf(s, VAELITH)).toBe(20);
    expect(applyVaelithEvent(s, { type: "DEFENSE_CLEARED" })).toBe(s); // memories incomplete
  });
  it("memories are only collectible by proximity after the truth, once each", () => {
    const site = MEMORY_SITES[1];
    expect(memoryNear(EMPTY_STORY, site.x, site.z)).toBeNull();
    let s: StoryState = { ...EMPTY_STORY, stages: { [VAELITH]: "truth" } };
    expect(memoryNear(s, site.x, site.z)).toBe(site.id);
    expect(memoryNear(s, site.x + 50, site.z)).toBeNull();
    s = applyVaelithEvent(s, { type: "MEMORY", id: site.id });
    expect(memoryNear(s, site.x, site.z)).toBeNull();
  });
  it("kind route reaches BONDED; the minimum route still reaches ALLIED but not BONDED", () => {
    const best = play({ gate: "listen", truth: "why", artifact: "preserve", alliance: "equal" });
    expect(vaelithBond(best)).toBe("BONDED"); expect(stageOf(best, VAELITH)).toBe("alliance");
    const worst = play({ gate: "hunt", truth: "doubt", artifact: "destroy", alliance: "terms" });
    expect(vaelithBond(worst)).toBe("ALLIED"); expect(stageOf(worst, VAELITH)).toBe("alliance");
  });
  it("objectives follow the stage and point at real places", () => {
    expect(objectiveFor(EMPTY_STORY)!.target).toEqual(VAELITH_LAIR);
    const s = { ...EMPTY_STORY, stages: { [VAELITH]: "truth" } };
    expect(objectiveFor(s)!.text).toContain("0/3");
    expect(objectiveFor(play({ gate: "listen", truth: "why", artifact: "preserve", alliance: "kind" }))).toBeNull();
    expect(dialogueDue(EMPTY_STORY)!.graph.id).toBe("vaelith.gate");
    expect(dialogueDue({ ...EMPTY_STORY, stages: { [VAELITH]: "gate" } })).toBeNull();
  });
  it("the lair and memories sit inside Ember Peaks; the lair is fightable only before the trial is survived", () => {
    const ember = REGIONS.find((r) => r.id === "ember")!;
    for (const p of [VAELITH_LAIR, ...MEMORY_SITES]) expect(Math.hypot(p.x - ember.x, p.z - ember.z)).toBeLessThan(ember.radius);
    expect(SCENARIO_LAIRS.some((l) => l.scenarioId === "vaelith")).toBe(true);
    expect(vaelithFightable(EMPTY_STORY)).toBe(true);
    expect(vaelithFightable({ ...EMPTY_STORY, stages: { [VAELITH]: "trial" } })).toBe(false);
  });
});

describe("rewards", () => {
  it("nothing is claimable before the alliance, and the dragon itself has no kill-loot table", () => {
    expect(vaelithClaims(EMPTY_STORY)).toEqual([]);
    expect(SCENARIO_LOOT[VAELITH]).toBeUndefined();
    expect(grantVaelithRewards({ ...DEFAULT_PROGRESSION, story: runGraph(EMPTY_STORY, GATE_DIALOGUE) }).cards).toHaveLength(0);
  });
  it("alliance pays Dragonheart Plate + Ember Lance exactly once; a repeat pays nothing", () => {
    const story = play({ gate: "hunt", truth: "doubt", artifact: "preserve", alliance: "terms" });
    const first = grantVaelithRewards({ ...DEFAULT_PROGRESSION, story });
    expect(first.progress.inventory.some((i) => i.id === DRAGONHEART_PLATE.id)).toBe(true);
    expect(first.progress.inventory.some((i) => i.id === EMBER_LANCE.id)).toBe(true);
    expect(first.progress.inventory.some((i) => i.id === DRAGON_SCALE_MANTLE.id)).toBe(false); // ALLIED, not BONDED
    expect(first.progress.story.collectibles).not.toContain("cosmetic:dragon-bond");
    const again = grantVaelithRewards(first.progress);
    expect(again.cards).toHaveLength(0);
    expect(again.progress.inventory.filter((i) => i.id === EMBER_LANCE.id)).toHaveLength(1);
  });
  it("being Bonded adds the Dragon-Scale Mantle and the bond cosmetic flag, once; a later bond upgrade still pays only the missing claim", () => {
    const allied = grantVaelithRewards({ ...DEFAULT_PROGRESSION, story: play({ gate: "hunt", truth: "doubt", artifact: "preserve", alliance: "terms" }) }).progress;
    const bonded = grantVaelithRewards({ ...allied, story: { ...allied.story, trust: { [VAELITH]: 90 } } });
    expect(bonded.progress.inventory.some((i) => i.id === DRAGON_SCALE_MANTLE.id)).toBe(true);
    expect(bonded.progress.story.collectibles).toContain("cosmetic:dragon-bond");
    expect(bonded.progress.inventory.filter((i) => i.id === EMBER_LANCE.id)).toHaveLength(1);
    expect(grantVaelithRewards(bonded.progress).cards).toHaveLength(0);
  });
  it("the artifact choice changes the payout: destroying it pays 150 shards with the alliance, preserving it does not", () => {
    const destroy = grantVaelithRewards({ ...DEFAULT_PROGRESSION, story: play({ gate: "listen", truth: "why", artifact: "destroy", alliance: "kind" }) }).progress;
    const preserve = grantVaelithRewards({ ...DEFAULT_PROGRESSION, story: play({ gate: "listen", truth: "why", artifact: "preserve", alliance: "kind" }) }).progress;
    expect(destroy.fractureShards - preserve.fractureShards).toBe(150);
  });
  it("new gear is real: chest, primary and class-item slots with rarity and stable ids", () => {
    expect([DRAGONHEART_PLATE.slot, EMBER_LANCE.slot, DRAGON_SCALE_MANTLE.slot]).toEqual(["chest", "primary", "classItem"]);
    expect(new Set([DRAGONHEART_PLATE.id, EMBER_LANCE.id, DRAGON_SCALE_MANTLE.id]).size).toBe(3);
  });
});

describe("save, reload and cloud merge", () => {
  const done = () => ({ ...DEFAULT_PROGRESSION, story: play({ gate: "listen", truth: "why", artifact: "preserve", alliance: "equal" }) });
  it("story survives JSON reload; old saves without story load with an empty story; garbage is sanitised", () => {
    const p = grantVaelithRewards(done()).progress;
    const re = normalizeProgression(JSON.parse(JSON.stringify(p)));
    expect(re.story).toEqual(p.story);
    const { story: _drop, ...old } = JSON.parse(JSON.stringify(DEFAULT_PROGRESSION));
    expect(normalizeProgression(old).story).toEqual(EMPTY_STORY);
    expect(normalizeStory({ flags: [1, "a"], trust: { x: 999, y: -5, z: "n" }, stages: { a: 3 }, choices: 7 })).toEqual({ flags: ["a"], choices: {}, trust: { x: 100, y: 0 }, stages: {}, collectibles: [] });
  });
  it("merging two devices keeps the furthest stage, max trust, unioned flags/collectibles and the newer decision", () => {
    const a: StoryState = { ...EMPTY_STORY, stages: { [VAELITH]: "memories" }, trust: { [VAELITH]: 50 }, flags: ["x"], collectibles: ["memory:ash-garden"], choices: { k: "a" } };
    const b: StoryState = { ...EMPTY_STORY, stages: { [VAELITH]: "truth" }, trust: { [VAELITH]: 70 }, flags: ["y"], collectibles: ["memory:glass-bell"], choices: { k: "b" } };
    const m = mergeStory(a, b, true);
    expect(m.stages[VAELITH]).toBe("memories"); expect(m.trust[VAELITH]).toBe(70);
    expect(m.flags.sort()).toEqual(["x", "y"]); expect(m.collectibles).toHaveLength(2); expect(m.choices["k"]).toBe("a");
    expect(mergeStory(a, b, false).choices.k).toBe("b");
    expect(new Set(mergeStory(a, b, true).flags)).toEqual(new Set(mergeStory(b, a, false).flags));
  });
  it("merged progression never re-awards: claims union and the story carries over", () => {
    const claimed = grantVaelithRewards(done()).progress;
    const merged = mergeProgression(claimed, DEFAULT_PROGRESSION, true);
    expect(merged.story.stages[VAELITH]).toBe("alliance");
    expect(grantVaelithRewards(merged).cards).toHaveLength(0);
    const other = mergeProgression(DEFAULT_PROGRESSION, claimed, false);
    expect(other.inventory.filter((i) => i.id === EMBER_LANCE.id)).toHaveLength(1);
    expect(grantVaelithRewards(other).cards).toHaveLength(0);
  });
});

/* ------------------------------ the First Trial, through the real sim ------------------------------ */
const BX = 3000, BZ = 3000;
function trial(dist = 30) {
  const sim = createSim();
  for (const m of sim.machines) m.alive = false;
  expect(summonScenarioBoss(sim, scenarioById("vaelith")!, BX, BZ)).toBe(true);
  const boss = sim.machines.find((m) => m.alive && m.boss)!;
  boss.cool = 0;
  const step = (secs: number) => {
    for (let i = 0; i < Math.round(secs / 0.05); i++) {
      clock += 0.05; stepSim(sim, { px: BX + dist, pz: BZ, dt: 0.05, night: 0.5, inVehicle: false }); sim.hp = 100;
      if (boss.alive) { boss.x = BX; boss.z = BZ; boss.kx = 0; boss.kz = 0; }
    }
  };
  step(0.05);
  return { sim, boss, step };
}
describe("Vaelith's First Trial (non-lethal encounter)", () => {
  it("has the specified attacks, each with a tell and recovery, and a truce instead of a kill", () => {
    const def = ENCOUNTERS[VAELITH]!;
    expect(Object.keys(def.attacks).sort()).toEqual(["dive", "fire-sweep", "shockwave", "wing-gust"]);
    for (const a of Object.values(def.attacks)) { expect(a.tellTime).toBeGreaterThan(0); expect(a.recovery).toBeGreaterThan(0); }
    expect(def.truce).toBeDefined();
  });
  it("attacks hit by geometry before the truce (a wing gust catches a close player, misses a far one)", () => {
    const near = trial(5); Object.assign(near.boss.encounter!, { state: "TELL", atk: "wing-gust", timer: 0.04, tx: BX + 5, tz: BZ }); near.sim.hp = 100;
    const before = near.sim.hp; clock += 0.1; stepSim(near.sim, { px: BX + 5, pz: BZ, dt: 0.1, night: 0.5, inVehicle: false });
    expect(near.sim.hp).toBeLessThan(before);
    const far = trial(40); Object.assign(far.boss.encounter!, { state: "TELL", atk: "wing-gust", timer: 0.04, tx: BX + 40, tz: BZ }); far.sim.hp = 100;
    clock += 0.1; stepSim(far.sim, { px: BX + 40, pz: BZ, dt: 0.1, night: 0.5, inVehicle: false });
    expect(far.sim.hp).toBe(100);
  });
  it("lethal damage cannot kill it: no kill, credit, drops or claim, before or after the truce", () => {
    const { sim, boss, step } = trial();
    boss.hp = -500; defeatMachine(sim, boss);
    expect(boss.alive).toBe(true); expect(sim.kills).toBe(0); expect(sim.credits).toBe(0); expect(sim.drops).toHaveLength(0);
    step(0.2);
    expect(boss.encounter!.truce).toBe(true);
    boss.hp = -500; defeatMachine(sim, boss);
    expect(boss.alive).toBe(true); expect(sim.drops).toHaveLength(0);
  });
  it("reaching the truce stops all attacks and emits TRUCE (the story trigger)", () => {
    const { sim, boss, step } = trial(5);
    boss.hp = boss.maxHp! * 0.39; step(0.2);
    expect(sim.encounterEvents.filter((e) => e.kind === "TRUCE")).toHaveLength(1);
    sim.hp = 100; step(10);
    expect(sim.hp).toBe(100);
    expect(sim.encounterEvents.filter((e) => e.kind === "TELL" && e.id > sim.encounterEvents.find((x) => x.kind === "TRUCE")!.id)).toHaveLength(0);
  });
  it("the dragon withdraws after the truce without a kill, freeing the boss slot and clearing its encounter state", () => {
    const { sim, boss, step } = trial();
    boss.hp = boss.maxHp! * 0.3; step(0.2);
    step(TRUCE_DEPART_SECONDS + 1);
    expect(boss.alive).toBe(false);
    expect(sim.kills).toBe(0); expect(sim.drops).toHaveLength(0);
    expect(boss.scenarioId).toBeUndefined(); expect(boss.encounter).toBeUndefined();
    expect(sim.encounterEvents.some((e) => e.kind === "DEPART")).toBe(true);
    expect(sim.machines.some((m) => m.alive && m.boss)).toBe(false);
  });
  it("dying mid-trial resets the dragon to full health and the first phase (no truce)", () => {
    const { sim, boss, step } = trial();
    boss.hp = boss.maxHp! * 0.5; step(0.1);
    sim.hp = 0; // hull gone
    hurtPlayer(sim, 1e6, "test");
    expect(boss.hp).toBe(boss.maxHp); expect(boss.encounter!.phase).toBe(0); expect(boss.encounter!.truce).toBeFalsy();
  });
});

describe("lair defence objective", () => {
  it("spawns the wave through the existing mission-drone spawner and clears when none are left alive", () => {
    const sim = createSim(); for (const m of sim.machines) m.alive = false;
    expect(startLairDefense(sim)).toBe(LAIR_DEFENSE_COUNT);
    expect(lairDefenseCleared(sim)).toBe(false);
    for (const m of sim.machines) if (m.mission) m.alive = false;
    expect(lairDefenseCleared(sim)).toBe(true);
  });
});

describe("companion assistance (allied only, limited)", () => {
  const allied = () => play({ gate: "hunt", truth: "doubt", artifact: "preserve", alliance: "terms" });
  const bonded = () => play({ gate: "listen", truth: "why", artifact: "preserve", alliance: "equal" });
  const field = (): WorldSim => {
    const sim = createSim(); for (const m of sim.machines) m.alive = false;
    sim.machines.slice(0, 4).forEach((m, i) => Object.assign(m, { alive: true, x: BX + 10 + i * 4, z: BZ, hp: 100, maxHp: undefined, boss: false, elite: false, cool: 99, scale: 1, vulnUntil: 0, vulnMult: 1, mission: false }));
    return sim;
  };
  const call = (over = {}) => ({ kind: "STRIKE" as const, px: BX, pz: BZ, yaw: Math.PI / 2, now: clock, indoors: false, ...over });
  it("refuses before the alliance, indoors, inside a scenario boss arena, and on cooldown", () => {
    const sim = field();
    expect(callVaelith(sim, EMPTY_STORY, { readyAt: 0 }, call())).toEqual({ ok: false, reason: "not-allied" });
    expect(callVaelith(sim, allied(), { readyAt: 0 }, call({ indoors: true }))).toEqual({ ok: false, reason: "indoors" });
    const arena = field(); Object.assign(arena.machines[5]!, { alive: true, boss: true, scenarioId: "dark-knight", x: BX + 20, z: BZ });
    expect(callVaelith(arena, allied(), { readyAt: 0 }, call())).toEqual({ ok: false, reason: "boss-arena" });
    const st = { readyAt: 0 };
    expect(callVaelith(sim, allied(), st, call()).ok).toBe(true);
    expect(callVaelith(sim, allied(), st, call())).toEqual({ ok: false, reason: "cooldown" });
    expect(callVaelith(sim, allied(), st, call({ now: clock + 91 })).ok).toBe(true);
  });
  it("aerial strike hits the three nearest hostiles; breath hits only those in the cone; bonded hits harder", () => {
    const sim = field();
    const r = callVaelith(sim, allied(), { readyAt: 0 }, call());
    expect(r).toEqual({ ok: true, hits: 3 });
    expect(sim.machines.filter((m) => m.alive && m.hp < 100)).toHaveLength(3);
    const cone = field(); cone.machines[1]!.z = BZ + 25; // off the +x facing
    const b = callVaelith(cone, allied(), { readyAt: 0 }, call({ kind: "BREATH" }));
    expect(b).toEqual({ ok: true, hits: 3 });
    const a1 = field(), a2 = field();
    callVaelith(a1, allied(), { readyAt: 0 }, call()); callVaelith(a2, bonded(), { readyAt: 0 }, call());
    expect(100 - a2.machines[0]!.hp).toBeGreaterThan(100 - a1.machines[0]!.hp);
  });
  it("a bonded dragon recovers faster", () => {
    const sA = { readyAt: 0 }, sB = { readyAt: 0 };
    callVaelith(field(), allied(), sA, call()); callVaelith(field(), bonded(), sB, call());
    expect(sB.readyAt).toBeLessThan(sA.readyAt);
  });
  it("never targets decoys and never hurts the player", () => {
    const sim = field(); sim.machines[0]!.decoy = true; sim.hp = 100;
    callVaelith(sim, allied(), { readyAt: 0 }, call());
    expect(sim.machines[0]!.hp).toBe(100); expect(sim.hp).toBe(100);
  });
  it("stage helpers agree with the alliance gate", () => {
    expect(stageAtLeast(allied(), VAELITH, "alliance")).toBe(true);
    expect(vaelithClaims(allied()).map((c) => c.scenarioId)).toEqual(["vaelith-alliance"]);
    expect(vaelithClaims(bonded()).map((c) => c.scenarioId)).toEqual(["vaelith-alliance", "vaelith-bond"]);
  });
});
