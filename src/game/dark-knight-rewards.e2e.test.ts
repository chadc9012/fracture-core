// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { DEFAULT_PROGRESSION, normalizeProgression, type PlayerProgression } from "./progression";
import { equipPiece } from "./armor-sets";
import { claimDrops } from "./inventory";
import { DARK_KNIGHT_MANTLE_CHANCE, PARTICIPATION_HITS, claimKey, planScenarioRewardCards } from "./scenario-loot";
import { createSim, defeatMachine, summonBoss, summonScenarioBoss, type WorldSim } from "./sim";
import { scenarioById } from "./unique-scenarios";
import { mock } from "bun:test";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { mergeProgression } = await import("./cloud-save");

let rng: { mockRestore: () => void } | null = null;
afterEach(() => { rng?.mockRestore(); rng = null; });
/** Math.random drives rollScenario (and the set-drop roll); the FIRST draw in defeatMachine is the set drop, so feed it a miss. */
const stubRandom = (...vals: number[]) => { let i = 0; rng = spyOn(Math, "random").mockImplementation(() => vals[Math.min(i++, vals.length - 1)]!); };

/** a real Dark Knight kill: summon -> player hits -> defeatMachine; returns the sim's drops exactly as Scene.onDrops receives them */
function kill(hits = PARTICIPATION_HITS, id = "dark-knight"): WorldSim["drops"] {
  const sim = createSim();
  expect(summonScenarioBoss(sim, scenarioById(id)!, 0, 0)).toBe(true);
  const boss = sim.machines.find((m) => m.alive && m.boss)!;
  boss.playerHits = hits; boss.hp = 0;
  defeatMachine(sim, boss);
  return sim.drops;
}
const owns = (p: PlayerProgression, id: string) => p.inventory.filter((i) => i.id === id).length;
const reload = (p: PlayerProgression) => normalizeProgression(JSON.parse(JSON.stringify(p)));
/** what GameCanvas does on onDrops: plan cards against the current save, then claim */
function deliver(p: PlayerProgression, drops: WorldSim["drops"], shown = new Set<string>()) {
  const cards = planScenarioRewardCards(p, drops, shown).flatMap((x) => x.cards);
  return { progress: claimDrops(p, drops), cards };
}

describe("Dark Knight defeat -> rewards, end to end", () => {
  it("weapon is granted when not owned; a successful Mantle roll is granted AND shown; the cards match the inventory", () => {
    stubRandom(0.99, 0.5, 0.0); // 0.99 set-drop miss, then DK mantle roll (< 25%) = success
    const drops = kill();
    const { progress, cards } = deliver(DEFAULT_PROGRESSION, drops);
    expect(owns(progress, "null-sovereign")).toBe(1);
    const shownIds = cards.map((c) => c.itemId).sort();
    const ownedNew = ["null-sovereign", "mantle-null-sovereign"].filter((id) => owns(progress, id) === 1).sort();
    expect(shownIds).toEqual(ownedNew); // never show what wasn't awarded, never hide what was
  });
  it("a FAILED Mantle roll: weapon only, no Mantle card, nothing in inventory", () => {
    const drops = kill();
    const claim = drops.find((d) => d.scenarioClaim)!.scenarioClaim!;
    const forced = drops.map((d) => (d.scenarioClaim ? { ...d, scenarioClaim: { ...claim, rolls: [DARK_KNIGHT_MANTLE_CHANCE + 0.01] } } : d));
    const { progress, cards } = deliver(DEFAULT_PROGRESSION, forced);
    expect(owns(progress, "mantle-null-sovereign")).toBe(0);
    expect(cards.map((c) => c.itemId)).toEqual(["null-sovereign"]);
  });
  it("a SUCCESSFUL roll (forced) shows both cards, weapon marked guaranteed and the Mantle as the chance drop", () => {
    const drops = kill();
    const claim = drops.find((d) => d.scenarioClaim)!.scenarioClaim!;
    const forced = drops.map((d) => (d.scenarioClaim ? { ...d, scenarioClaim: { ...claim, rolls: [0] } } : d));
    const { progress, cards } = deliver(DEFAULT_PROGRESSION, forced);
    expect(cards.find((c) => c.itemId === "null-sovereign")!.guaranteed).toBe(true);
    expect(cards.find((c) => c.itemId === "mantle-null-sovereign")!.guaranteed).toBe(false);
    expect(owns(progress, "mantle-null-sovereign")).toBe(1);
  });
  it("replaying the same drops (reconnect, double delivery, reload) neither re-awards nor re-shows cards", () => {
    const drops = kill();
    const shown = new Set<string>();
    const first = deliver(DEFAULT_PROGRESSION, drops, shown);
    const again = deliver(first.progress, drops, shown);
    expect(again.cards).toEqual([]);
    expect(owns(again.progress, "null-sovereign")).toBe(1);
    const afterReload = deliver(reload(first.progress), drops, new Set());
    expect(afterReload.cards).toEqual([]); // ledger persisted, so even a fresh session shows nothing
    expect(afterReload.progress.earnedRewards).toContain(claimKey(drops.find((d) => d.scenarioClaim)!.scenarioClaim!.runId));
    // stale-render race: the same drops delivered twice before React re-rendered must show cards once
    const sh = new Set<string>();
    const a = planScenarioRewardCards(DEFAULT_PROGRESSION, drops, sh), b = planScenarioRewardCards(DEFAULT_PROGRESSION, drops, sh);
    expect(a.length).toBe(1); expect(b.length).toBe(0);
  });
  it("a NEW run is a new claim: it can roll the Mantle again, and a duplicate weapon levels instead of stacking", () => {
    const run1 = kill();
    const p1 = deliver(DEFAULT_PROGRESSION, run1).progress;
    const run2 = kill();
    const c2 = run2.find((d) => d.scenarioClaim)!.scenarioClaim!;
    const forced = run2.map((d) => (d.scenarioClaim ? { ...d, scenarioClaim: { ...c2, rolls: [0] } } : d));
    const r2 = deliver(p1, forced);
    expect(owns(r2.progress, "null-sovereign")).toBe(1);
    expect(r2.cards.find((c) => c.itemId === "null-sovereign")!.outcome).toBe("DUPLICATE_LEVEL");
    expect(owns(r2.progress, "mantle-null-sovereign")).toBe(1);
  });
  it("no participation: nothing is granted and no card is shown (opening the lair is not a clear)", () => {
    const drops = kill(PARTICIPATION_HITS - 1);
    const r = deliver(DEFAULT_PROGRESSION, drops);
    expect(r.cards).toEqual([]);
    expect(owns(r.progress, "null-sovereign")).toBe(0);
  });
  it("inventory and the equipped class item survive reload and cloud merge (both directions, stale remote)", () => {
    const drops = kill();
    const claim = drops.find((d) => d.scenarioClaim)!.scenarioClaim!;
    const forced = drops.map((d) => (d.scenarioClaim ? { ...d, scenarioClaim: { ...claim, rolls: [0] } } : d));
    const local = equipPiece(deliver(DEFAULT_PROGRESSION, forced).progress, "mantle-null-sovereign");
    expect(local.equippedGear.classItem).toBe("mantle-null-sovereign");
    const back = reload(local);
    expect(back.equippedGear.classItem).toBe("mantle-null-sovereign");
    expect(owns(back, "null-sovereign")).toBe(1);
    for (const merged of [mergeProgression(local, DEFAULT_PROGRESSION, true), mergeProgression(DEFAULT_PROGRESSION, local, false), mergeProgression(back, local, false)]) {
      expect(owns(merged, "null-sovereign")).toBe(1);
      expect(owns(merged, "mantle-null-sovereign")).toBe(1);
      expect(merged.earnedRewards).toContain(claimKey(claim.runId));
    }
    expect(mergeProgression(local, DEFAULT_PROGRESSION, true).equippedGear.classItem).toBe("mantle-null-sovereign");
  });
  it("Rime Alpha and a catalog boss reward exactly as before (material only, no gear, no cards)", () => {
    stubRandom(0.99); // pin the unrelated random armor-set drop roll so inventory counts are deterministic
    const rime = kill(20, "rime-alpha");
    expect(planScenarioRewardCards(DEFAULT_PROGRESSION, rime, new Set())).toEqual([]);
    const r = claimDrops(DEFAULT_PROGRESSION, rime);
    expect(r.inventory.length).toBe(DEFAULT_PROGRESSION.inventory.length);
    expect((r.materials.glacierFang ?? 0)).toBeGreaterThan(DEFAULT_PROGRESSION.materials.glacierFang ?? 0);
    const sim = createSim();
    expect(summonBoss(sim, "frostspire", 0, 0)).toBe(true);
    const b = sim.machines.find((m) => m.alive && m.boss)!; b.hp = 0; defeatMachine(sim, b);
    expect(planScenarioRewardCards(DEFAULT_PROGRESSION, sim.drops, new Set())).toEqual([]);
  });
});
