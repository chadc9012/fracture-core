// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it, mock } from "bun:test";
import { DEFAULT_PROGRESSION, normalizeProgression } from "./progression";
import { ARMOR_LEVEL_MAX, equipPiece } from "./armor-sets";
import { armorSummary } from "./deployment/forgeState";
import { armorLook } from "./armor-look";
import { claimDrops, MATERIALS } from "./inventory";
import { DARK_KNIGHT_MANTLE_CHANCE, DUPLICATE_CAP_SHARDS, MANTLE_OF_THE_NULL_SOVEREIGN, NULL_SOVEREIGN, PARTICIPATION_HITS, SCENARIO_LOOT, claimKey, grantScenarioReward, rollScenario, type ScenarioClaim } from "./scenario-loot";
import { createSim, defeatMachine, summonScenarioBoss, summonBoss } from "./sim";
import { scenarioById } from "./unique-scenarios";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { mergeProgression } = await import("./cloud-save");

const claim = (over: Partial<ScenarioClaim> = {}): ScenarioClaim => ({ scenarioId: "dark-knight", runId: "run-1", participated: true, rolls: [0.9], ...over });
const reload = (p: typeof DEFAULT_PROGRESSION) => normalizeProgression(JSON.parse(JSON.stringify(p)));

describe("Dark Knight reward table", () => {
  it("is configured: guaranteed weapon, chance-based class item with a named chance", () => {
    const t = SCENARIO_LOOT["dark-knight"]!;
    expect(t.guaranteed.map((i) => i.id)).toEqual(["null-sovereign"]);
    expect(t.chance[0]!.item.id).toBe("mantle-null-sovereign");
    expect(t.chance[0]!.chance).toBe(DARK_KNIGHT_MANTLE_CHANCE);
    expect(DARK_KNIGHT_MANTLE_CHANCE).toBeGreaterThan(0);
    expect(DARK_KNIGHT_MANTLE_CHANCE).toBeLessThan(1);
  });
  it("items are real: exotic perk weapon in a weapon slot, legendary item in the class-item slot", () => {
    expect(NULL_SOVEREIGN).toMatchObject({ slot: "primary", rarity: "EXOTIC", perk: "NULL_DISRUPTION", source: "The Dark Knight" });
    expect(MANTLE_OF_THE_NULL_SOVEREIGN).toMatchObject({ slot: "classItem", rarity: "LEGENDARY", source: "The Dark Knight" });
    expect(scenarioById("dark-knight")?.drop).toBeDefined();
    expect(MATERIALS[scenarioById("dark-knight")!.drop as keyof typeof MATERIALS]).toBeDefined(); // crafting material stays separate from gear
  });
});

describe("grantScenarioReward", () => {
  it("a valid clear grants the guaranteed weapon and reports it as NEW + guaranteed", () => {
    const r = grantScenarioReward(DEFAULT_PROGRESSION, claim());
    expect(r.status).toBe("granted");
    expect(r.progress.inventory.some((i) => i.id === "null-sovereign")).toBe(true);
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0]).toMatchObject({ itemId: "null-sovereign", guaranteed: true, outcome: "NEW" });
  });
  it("class item: roll below the chance drops it, at or above does not (deterministic rolls)", () => {
    const hit = grantScenarioReward(DEFAULT_PROGRESSION, claim({ rolls: [DARK_KNIGHT_MANTLE_CHANCE - 0.001] }));
    expect(hit.progress.inventory.some((i) => i.id === "mantle-null-sovereign")).toBe(true);
    expect(hit.cards.find((c) => c.itemId === "mantle-null-sovereign")).toMatchObject({ guaranteed: false, outcome: "NEW" });
    const miss = grantScenarioReward(DEFAULT_PROGRESSION, claim({ rolls: [DARK_KNIGHT_MANTLE_CHANCE] }));
    expect(miss.progress.inventory.some((i) => i.id === "mantle-null-sovereign")).toBe(false);
    expect(miss.cards).toHaveLength(1);
  });
  it("rollScenario draws one number per chance entry from the injected RNG", () => {
    expect(rollScenario("dark-knight", () => 0.42)).toEqual([0.42]);
    expect(rollScenario("rime-alpha", () => 0.1)).toEqual([]);
  });
  it("the same run never pays twice (repeated events, reconnects, reloads)", () => {
    const first = grantScenarioReward(DEFAULT_PROGRESSION, claim());
    const again = grantScenarioReward(first.progress, claim());
    expect(again.status).toBe("already-claimed");
    expect(again.progress).toBe(first.progress);
    const reloaded = reload(first.progress);
    expect(grantScenarioReward(reloaded, claim()).status).toBe("already-claimed");
    expect(reloaded.earnedRewards).toContain(claimKey("run-1"));
    expect(reloaded.inventory.filter((i) => i.id === "null-sovereign")).toHaveLength(1);
  });
  it("a new run on a duplicate weapon levels the owned copy instead of adding another", () => {
    const first = grantScenarioReward(DEFAULT_PROGRESSION, claim());
    const second = grantScenarioReward(first.progress, claim({ runId: "run-2" }));
    expect(second.progress.inventory.filter((i) => i.id === "null-sovereign")).toHaveLength(1);
    expect(second.cards[0]).toMatchObject({ outcome: "DUPLICATE_LEVEL", level: 2 });
    expect(second.progress.inventory.find((i) => i.id === "null-sovereign")!.power).toBe(NULL_SOVEREIGN.power + 15);
  });
  it("at the level cap a duplicate converts to fracture shards", () => {
    let p = grantScenarioReward(DEFAULT_PROGRESSION, claim()).progress;
    p = { ...p, inventory: p.inventory.map((i) => (i.id === "null-sovereign" ? { ...i, level: ARMOR_LEVEL_MAX } : i)) };
    const r = grantScenarioReward(p, claim({ runId: "run-9" }));
    expect(r.cards[0]).toMatchObject({ outcome: "DUPLICATE_SHARDS" });
    expect(r.progress.fractureShards).toBe(p.fractureShards + DUPLICATE_CAP_SHARDS);
  });
  it("ineligible or invalid claims pay nothing and do not burn the run id", () => {
    const noPart = grantScenarioReward(DEFAULT_PROGRESSION, claim({ participated: false }));
    expect(noPart.status).toBe("ineligible");
    expect(noPart.progress).toBe(DEFAULT_PROGRESSION);
    expect(grantScenarioReward(DEFAULT_PROGRESSION, claim({ runId: "" })).status).toBe("invalid");
    expect(grantScenarioReward(DEFAULT_PROGRESSION, claim({ scenarioId: "nope" })).status).toBe("invalid");
    expect(grantScenarioReward(DEFAULT_PROGRESSION, claim({ scenarioId: "rime-alpha" })).progress).toBe(DEFAULT_PROGRESSION);
  });
});

describe("the Mantle as equipment", () => {
  const withMantle = () => grantScenarioReward(DEFAULT_PROGRESSION, claim({ rolls: [0] })).progress;
  it("equips into the class-item slot without touching the other armor slots, and unequips cleanly", () => {
    const p = withMantle();
    const before = { ...p.equippedGear };
    const worn = equipPiece(p, "mantle-null-sovereign");
    expect(worn.equippedGear.classItem).toBe("mantle-null-sovereign");
    for (const slot of ["helmet", "chest", "legs", "gauntlets"] as const) expect(worn.equippedGear[slot]).toBe(before[slot]);
    const { classItem: _gone, ...rest } = worn.equippedGear;
    expect({ ...worn, equippedGear: rest }.equippedGear).toEqual(Object.fromEntries(Object.entries(before).filter(([k]) => k !== "classItem")));
  });
  it("feeds Defense/Mobility/Intellect through the existing calculation", () => {
    const p = withMantle();
    const base = armorSummary(p).stats;
    const worn = armorSummary(equipPiece(p, "mantle-null-sovereign")).stats;
    expect(worn.intellect).toBeGreaterThan(base.intellect);
    expect(worn.mobility).toBeGreaterThan(base.mobility);
    expect(worn.defense).toBeGreaterThan(base.defense);
  });
  it("renders through the existing mantle motif only while worn, and survives save/reload", () => {
    const worn = equipPiece(withMantle(), "mantle-null-sovereign");
    expect(armorLook(withMantle()).classItem).toBeUndefined();
    expect(armorLook(worn).classItem).toMatchObject({ motif: "mantle" });
    const back = reload(worn);
    expect(back.equippedGear.classItem).toBe("mantle-null-sovereign");
    expect(back.inventory.find((i) => i.id === "null-sovereign")).toMatchObject({ rarity: "EXOTIC", perk: "NULL_DISRUPTION" });
  });
  it("older saves without these items or fields still load", () => {
    const old = normalizeProgression({ ...DEFAULT_PROGRESSION, inventory: DEFAULT_PROGRESSION.inventory.map(({ rarity: _r, perk: _p, ...i }) => i) });
    expect(old.inventory.length).toBe(DEFAULT_PROGRESSION.inventory.length);
  });
});

describe("cloud merge", () => {
  it("keeps newly acquired items and the claim ledger, and a repeated sync never re-awards", () => {
    const local = grantScenarioReward(DEFAULT_PROGRESSION, claim({ rolls: [0] })).progress;
    const cloud = DEFAULT_PROGRESSION;
    const merged = mergeProgression(local, cloud, true);
    expect(merged.inventory.some((i) => i.id === "null-sovereign")).toBe(true);
    expect(merged.inventory.some((i) => i.id === "mantle-null-sovereign")).toBe(true);
    expect(merged.earnedRewards).toContain(claimKey("run-1"));
    expect(grantScenarioReward(merged, claim()).status).toBe("already-claimed");
    const remerged = mergeProgression(merged, local, false);
    expect(remerged.inventory.filter((i) => i.id === "null-sovereign")).toHaveLength(1);
    // the other device had not seen the claim: merge both ways keeps one copy and the claim
    expect(mergeProgression(cloud, local, false).inventory.filter((i) => i.id === "null-sovereign")).toHaveLength(1);
  });
});

describe("through the sim (defeatMachine → drops → claimDrops)", () => {
  const spawn = (scenarioId: string, hits: number) => {
    const sim = createSim();
    expect(summonScenarioBoss(sim, scenarioById(scenarioId)!, 0, 0)).toBe(true);
    const boss = sim.machines.find((m) => m.alive && m.boss)!;
    boss.playerHits = hits;
    boss.hp = 0;
    defeatMachine(sim, boss);
    return { sim, boss };
  };
  it("a Dark Knight kill with real participation attaches a claim that grants the weapon exactly once", () => {
    const { sim } = spawn("dark-knight", PARTICIPATION_HITS);
    const drop = sim.drops.find((d) => d.scenarioClaim)!;
    expect(drop.scenarioClaim).toMatchObject({ scenarioId: "dark-knight", participated: true });
    const once = claimDrops(DEFAULT_PROGRESSION, sim.drops);
    expect(once.inventory.filter((i) => i.id === "null-sovereign")).toHaveLength(1);
    expect(claimDrops(once, sim.drops).inventory.filter((i) => i.id === "null-sovereign")).toHaveLength(1);
  });
  it("a kill without participation attaches an ineligible claim that pays no gear", () => {
    const { sim } = spawn("dark-knight", 0);
    expect(sim.drops.find((d) => d.scenarioClaim)!.scenarioClaim!.participated).toBe(false);
    expect(claimDrops(DEFAULT_PROGRESSION, sim.drops).inventory.some((i) => i.id === "null-sovereign")).toBe(false);
  });
  it("Rime Alpha and catalog bosses keep their existing rewards (material only, no scenario claim)", () => {
    const { sim } = spawn("rime-alpha", 20);
    expect(sim.drops.some((d) => d.scenarioClaim)).toBe(false);
    expect(sim.drops[0]!.material).toBe("glacierFang");
    const s2 = createSim();
    expect(summonBoss(s2, "frostspire", 0, 0)).toBe(true);
    const b = s2.machines.find((m) => m.alive && m.boss)!;
    b.hp = 0; defeatMachine(s2, b);
    expect(s2.drops.some((d) => d.scenarioClaim)).toBe(false);
  });
  it("each summon gets its own run id, and the pooled slot forgets it afterwards", () => {
    const a = spawn("dark-knight", 9), b = spawn("dark-knight", 9);
    expect(a.sim.drops[0]!.scenarioClaim!.runId).not.toBe(b.sim.drops[0]!.scenarioClaim!.runId);
    expect(a.boss.scenarioRun).toBeUndefined();
    expect(a.boss.scenarioId).toBeUndefined();
  });
});
