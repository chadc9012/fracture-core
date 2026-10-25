// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { ENCOUNTERS } from "./scenario-encounters";
import { createSim, defeatMachine, stepSim, summonScenarioBoss } from "./sim";
import { MAX_SUMMONED, encounterHpFloor, isSummoned, resetEncounters } from "./encounter-sim";
import { isStaggered } from "./boss-poise";
import { DEFAULT_PROGRESSION } from "./progression";
import { HOLLOW_STAR_LENS, STARBREAKER_PLATE, SCENARIO_LOOT, grantScenarioReward } from "./scenario-loot";
import { scenarioById } from "./unique-scenarios";
import { SCENARIO_LAIRS } from "./waypoints";
import { heightAt, WATER_LEVEL } from "./terrain";
import { regionAt, NEON_SITE, NEON_FLAT } from "./world";
import { cluesFor } from "./encounter-journal";
import { HOLLOW_STAR, STARBREAKER_KEY, DIMENSIONAL_BLUEPRINT_KEY, FIRST_CLEAR_APPEARANCE, applyAstravoreKill, ASTRAVORE_ATTACKS } from "./hollow-star-raid";

let clock = 1000;
let spy: { mockRestore: () => void };
beforeEach(() => { clock = 1000; spy = spyOn(performance, "now").mockImplementation(() => clock * 1000); });
afterEach(() => spy.mockRestore());

const BX = 3000, BZ = 3000;
function arena(dist = 45) {
  const sim = createSim();
  for (const m of sim.machines) m.alive = false;
  expect(summonScenarioBoss(sim, scenarioById("astravore")!, BX, BZ)).toBe(true);
  const boss = sim.machines.find((m) => m.alive && m.boss)!;
  boss.cool = 0;
  const step = (secs: number) => {
    for (let i = 0; i < Math.max(1, Math.round(secs / 0.05)); i++) {
      clock += 0.05;
      stepSim(sim, { px: BX + dist, pz: BZ, dt: 0.05, night: 0.5, inVehicle: false });
      sim.hp = 100;
      if (boss.alive) { boss.x = BX; boss.z = BZ; boss.kx = 0; boss.kz = 0; }
    }
  };
  step(0.05);
  return { sim, boss, step };
}

describe("Astravore in the world", () => {
  it("is a registered scenario with a lair on dry, flat ground outside every region and away from Neon City", () => {
    const sc = scenarioById("astravore")!;
    expect(sc.bossName).toContain("Astravore");
    const lair = SCENARIO_LAIRS.find((l) => l.scenarioId === "astravore")!;
    expect(lair).toBeDefined();
    expect(lair.regionId).toBe("nexus");
    expect(heightAt(lair.x, lair.z)).toBeGreaterThan(WATER_LEVEL + 5);
    expect(regionAt(lair.x, lair.z)).toBeNull();
    expect(Math.hypot(lair.x - NEON_SITE.x, lair.z - NEON_SITE.z)).toBeGreaterThan(NEON_FLAT + 40);
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < 16; i++) { const h = heightAt(lair.x + 60 * Math.cos(i * 0.3927), lair.z + 60 * Math.sin(i * 0.3927)); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    expect(hi - lo, "the arena is graded level (terrain.ts hollowStarWeight)").toBeLessThan(0.5);
  });
  it("has hidden-discovery clues, and a fight whose phases match the raid design", () => {
    expect(cluesFor("astravore").length).toBeGreaterThanOrEqual(4);
    const def = ENCOUNTERS["astravore"]!;
    const raidPhases = HOLLOW_STAR.stages[5]!.bossPhases!;
    expect(def.phases.map((p) => p.below)).toEqual(raidPhases.map((p) => p.threshold / 100));
    expect(def.phases.map((p) => p.name)).toEqual(raidPhases.map((p) => p.name.split(" · ")[1]));
    // every raid attack the design names exists in the fight under the same id
    for (const a of ASTRAVORE_ATTACKS.filter((x) => x.id !== "core-exposure")) expect(def.attacks[a.id], a.id).toBeDefined();
    expect(def.phases[3]!.finale?.floorHp).toBeGreaterThan(0);
  });
  it("walks through the four phases as its health falls and never rewinds", () => {
    const { boss, step } = arena();
    expect(boss.encounter!.phase).toBe(0);
    boss.hp = boss.maxHp! * 0.65; step(0.1); expect(boss.encounter!.phase).toBe(1);
    boss.hp = boss.maxHp! * 0.35; step(0.1); expect(boss.encounter!.phase).toBe(2);
    boss.hp = boss.maxHp! * 0.1; step(0.1); expect(boss.encounter!.phase).toBe(3);
    boss.hp = boss.maxHp!; step(0.1); expect(boss.encounter!.phase).toBe(3);
  });
  it("telegraphs before it hits: the first attacks begin with a tell event", () => {
    const { sim, step } = arena();
    step(6);
    expect(sim.encounterEvents.some((e) => e.kind === "TELL")).toBe(true);
  });
  it("cannot be killed before the finale; the overload opens a window and one hit in it ends the fight exactly once with a claim", () => {
    const { sim, boss, step } = arena(45);
    boss.hp = boss.maxHp! * 0.1; step(0.1);
    boss.hp = -50; defeatMachine(sim, boss);
    expect(boss.alive).toBe(true);
    expect(sim.drops.filter((d) => d.scenarioClaim)).toHaveLength(0);
    boss.hp = boss.maxHp! * 0.1;
    boss.encounter!.sinceFinale = 99; boss.encounter!.state = "IDLE"; boss.encounter!.timer = 0; boss.cool = 0;
    step(0.1);
    expect(boss.encounter!.atk).toBe("overload");
    step(3); // the 28 m overload misses a player standing 45 m out
    expect(sim.encounterEvents.some((e) => e.kind === "FINALE")).toBe(true);
    expect(isStaggered(boss.poiseState!, clock)).toBe(true);
    expect(encounterHpFloor(boss, clock)).toBe(0);
    boss.hp = -1; defeatMachine(sim, boss);
    expect(boss.alive).toBe(false);
    defeatMachine(sim, boss);
    expect(sim.drops.filter((d) => d.scenarioClaim)).toHaveLength(1);
    expect(sim.drops.find((d) => d.scenarioClaim)!.scenarioClaim!.scenarioId).toBe("astravore");
  });
});

describe("Astravore rewards", () => {
  it("the signature gear pays once per run, and the raid extras follow: first kill gives Starbreaker, the blueprint and the regalia; later kills only a small payout", () => {
    expect(SCENARIO_LOOT["astravore"]!.guaranteed.map((i) => i.id)).toEqual([HOLLOW_STAR_LENS.id, STARBREAKER_PLATE.id]);
    const g = grantScenarioReward(DEFAULT_PROGRESSION, { scenarioId: "astravore", runId: "run-a", participated: true, rolls: [], elapsed: 90, deaths: 0 } as never);
    expect(g.status).toBe("granted");
    expect(g.progress.inventory.map((i) => i.id)).toEqual(expect.arrayContaining([HOLLOW_STAR_LENS.id, STARBREAKER_PLATE.id]));
    const first = applyAstravoreKill(g.progress);
    expect(first.firstKill).toBe(true);
    expect(first.progress.earnedRewards).toEqual(expect.arrayContaining([STARBREAKER_KEY, DIMENSIONAL_BLUEPRINT_KEY, FIRST_CLEAR_APPEARANCE]));
    const again = applyAstravoreKill(first.progress);
    expect(again.firstKill).toBe(false);
    expect(again.progress.earnedRewards.filter((k) => k === STARBREAKER_KEY)).toHaveLength(1);
    expect(again.progress.fractureShards - first.progress.fractureShards).toBeLessThan(first.progress.fractureShards - g.progress.fractureShards);
  });
  it("a real kill in the sim attaches a claim for the reward pipeline", () => {
    const { sim, boss, step } = arena(45);
    boss.hp = boss.maxHp! * 0.1; step(0.1);
    boss.encounter!.sinceFinale = 99; boss.encounter!.state = "IDLE"; boss.encounter!.timer = 0; boss.cool = 0; step(3.2);
    // a participating player has hit it at least five times
    (boss as unknown as { playerHits?: number }).playerHits = 99;
    boss.hp = -1; defeatMachine(sim, boss);
    const claims = sim.drops.filter((d) => d.scenarioClaim);
    expect(claims).toHaveLength(1);
    expect(claims[0]!.scenarioClaim!.scenarioId).toBe("astravore");
  });
});

function forceTell(boss: ReturnType<typeof arena>["boss"], atk: string) {
  Object.assign(boss.encounter!, { state: "TELL", atk, timer: 0.04, tx: BX + 45, tz: BZ, tellTotal: 0.04 });
}
describe("Astravore calls in real troops", () => {
  it("Summons brings three Void Hounds; the guardians call brings a Knight and two Mages; a Sentinel is one big elite", () => {
    const { sim, boss, step } = arena();
    forceTell(boss, "summons"); step(0.2);
    let live = sim.machines.filter(isSummoned);
    expect(live.map((m) => m.profile)).toEqual(["Void Hound", "Void Hound", "Void Hound"]);
    expect(live.every((m) => m.hp > 0 && !m.boss && m.summoned)).toBe(true);
    forceTell(boss, "call-guardians"); boss.encounter!.timer = 0.04; step(0.2);
    live = sim.machines.filter(isSummoned);
    expect(live.map((m) => m.profile).sort()).toEqual(["Dimensional Knight", "Reality Mage", "Reality Mage", "Void Hound", "Void Hound", "Void Hound"].sort());
    expect(live.find((m) => m.profile === "Dimensional Knight")!.elite).toBe(true);
    expect(sim.encounterEvents.filter((e) => e.kind === "SUMMON").length).toBe(6);
  });
  it("never more than the cap alive at once, however many calls", () => {
    const { sim, boss, step } = arena();
    for (let i = 0; i < 6; i++) { forceTell(boss, i % 2 ? "call-guardians" : "summons"); step(0.2); }
    expect(sim.machines.filter(isSummoned).length).toBeLessThanOrEqual(MAX_SUMMONED);
    expect(sim.machines.filter(isSummoned).length).toBeGreaterThan(0);
  });
  it("they leave when the encounter resets, and when the boss dies, without a kill or loot", () => {
    const a = arena();
    forceTell(a.boss, "summons"); a.step(0.2);
    expect(a.sim.machines.filter(isSummoned).length).toBe(3);
    resetEncounters(a.sim);
    expect(a.sim.machines.filter(isSummoned).length).toBe(0);
    const b = arena();
    forceTell(b.boss, "summons"); b.step(0.2);
    const kills = b.sim.kills;
    b.boss.hp = b.boss.maxHp! * 0.1; b.step(0.1);
    b.boss.encounter!.sinceFinale = 99; b.boss.encounter!.state = "IDLE"; b.boss.encounter!.timer = 0; b.boss.cool = 0; b.step(3.2);
    (b.boss as unknown as { playerHits?: number }).playerHits = 99;
    b.boss.hp = -1; defeatMachine(b.sim, b.boss);
    expect(b.sim.machines.filter(isSummoned).length).toBe(0);
    expect(b.sim.kills).toBe(kills + 1); // only the boss counted
  });
  it("a recycled machine slot is not mistaken for a summon", () => {
    const { sim } = arena();
    const m = sim.machines.find((x) => !x.alive)!;
    Object.assign(m, { alive: true, summoned: true, profile: "Regional Raider" });
    expect(isSummoned(m)).toBe(false);
  });
});
