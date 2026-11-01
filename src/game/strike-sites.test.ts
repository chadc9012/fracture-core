import { describe, expect, test } from "bun:test";
import { STRIKE_MODE_NAME, STRIKE_SITES, parseStrikeRun, strikeRank, strikeRegionOf, strikeRunId, strikeSiteById, tierOfStrikeRank } from "./strike-sites";
import { STRIKES, isStrike, strikeTierUnlocked } from "./strikes";
import { buildDescent, dungeonById, gatesForDay } from "./fracture-gates";
import { launchGate } from "./director-activities";
import { claimDescentClear, startDescent, tierPlan } from "./descent-run";
import { createDescentRuntime, stepDescentRuntime, bossExit, drainEndedRuns } from "./descent-runtime";
import { createSim, defeatMachine } from "./sim";
import { PAYOUTS } from "./activity-payouts";
import { STRIKE_TIERS, tierById } from "./difficulty-ladder";
import { DEFAULT_PROGRESSION } from "./progression";

const NOW = Date.UTC(2026, 10, 3, 12);
const fresh = () => ({ ...DEFAULT_PROGRESSION, pocketClass: "TITAN" as const });

describe("playable strike sites", () => {
  test("each hub strike has a site with the same id, a region and three floors: approach, trial, boss", () => {
    expect(STRIKE_SITES.length).toBe(STRIKES.length);
    for (const s of STRIKES) {
      const site = strikeSiteById(s.id)!;
      expect(site).not.toBeNull();
      expect(isStrike(site.id)).toBe(true);
      expect(strikeRegionOf(site.id)).not.toBeNull();
      expect(site.kinds[0]).toBe("ENCOUNTER");
      expect(["PARKOUR", "PUZZLE"]).toContain(site.kinds[1]);
      expect(site.kinds[2]).toBe("BOSS");
      const layout = buildDescent(site.id, "D", undefined, "x");
      expect(layout.tiers.map((t) => t.kind)).toEqual([...site.kinds]);
      expect(layout.tiers[1]!.trial).toBeDefined();
      expect(dungeonById(site.id)).toBe(site);
    }
    expect(STRIKE_MODE_NAME.length).toBeGreaterThan(0);
  });
  test("strikes never open a world gate", () => {
    const ids = new Set(STRIKE_SITES.map((s) => s.id));
    expect(gatesForDay(NOW).some((g) => ids.has(g.dungeonId))).toBe(false);
  });
  test("the tier maps to a gate rank and back; harder tiers have more enemies and a harder trial", () => {
    expect(STRIKE_TIERS.map((t) => strikeRank(t.id))).toEqual(["D", "C", "B", "A"]);
    for (const t of STRIKE_TIERS) expect(tierOfStrikeRank(strikeRank(t.id))).toBe(t.id);
    const l = (tier: string) => buildDescent("strike-slagworks", strikeRank(tier), undefined, "x");
    const std = tierPlan(l("standard").tiers[0]!, "D"), master = tierPlan(l("master").tiers[0]!, "A");
    expect(master.waves[0]!.count).toBeGreaterThanOrEqual(std.waves[0]!.count);
  });
  test("a launch id parses to a gate at the tier's rank, sealed", () => {
    const id = strikeRunId("strike-bloom", "legend");
    expect(parseStrikeRun(id)).toEqual({ strikeId: "strike-bloom", tierId: "legend" });
    const g = launchGate(id, NOW)!;
    expect(g.dungeonId).toBe("strike-bloom");
    expect(g.trueRank).toBe("B");
    expect(g.sealed).toBe(true);
    expect(parseStrikeRun("rootbound-labyrinth")).toBeNull();
  });
  test("a cleared strike pays the strike bounty for its tier once a day and unlocks the next tier", () => {
    const g = launchGate(strikeRunId("strike-slagworks", "standard"), NOW)!;
    const run = { ...startDescent(g, NOW), status: "CLEARED" as const };
    const r = claimDescentClear(fresh(), run, NOW);
    expect(r.nex).toBe(Math.round(PAYOUTS.strike.first * tierById("strike", "standard").payMult * 1));
    expect(r.drop).toBeNull();
    expect(strikeTierUnlocked(r.progression, "hero")).toBe(true);
    expect(claimDescentClear(r.progression, run, NOW).nex).toBe(0);
    expect(Object.keys(r.progression.nexLedger).some((k) => k.includes("dungeon"))).toBe(false);
  });
  test("plays through the real runtime: approach, trial, boss, out", () => {
    const gate = launchGate(strikeRunId("strike-bloom", "standard"), NOW)!;
    const sim = createSim(); for (const m of sim.machines) m.alive = false;
    const rt = createDescentRuntime();
    const pos = { x: 0, y: 5, z: 0 };
    let now = NOW;
    const emits: string[] = [];
    const step = (launch: typeof gate | null = null) => { now += 200; const r = stepDescentRuntime(rt, sim, { now, px: pos.x, py: pos.y, pz: pos.z, inVehicle: false, blocked: false, earnedRewards: [], gates: () => [], launch }); emits.push(...r.emits.map((e) => e.type)); if (r.teleport) { pos.x = r.teleport.x; pos.y = r.teleport.y; pos.z = r.teleport.z; } return r; };
    const kill = () => { for (const m of sim.machines) if (m.alive && m.living?.startsWith("rift:")) { m.hp = 0; defeatMachine(sim, m, "player"); } };
    expect(step(gate).teleport).not.toBeNull();
    const layout = rt.run!.layout;
    expect(layout.tiers.length).toBe(3);
    for (const tier of layout.tiers) {
      pos.x = tier.landing.x; pos.z = tier.landing.z; pos.y = tier.floorY + 1.6;
      if (tier.trial?.puzzle) { const sp = tier.trial.puzzle; step(); if (sp.kind === "BEACONS") for (const p of sp.plates) for (let i = 0; i < 80; i++) { pos.x = p.x; pos.z = p.z; step(); } else for (const p of [...sp.plates].sort((a, b) => a.order - b.order)) { pos.x = tier.landing.x; pos.z = tier.landing.z; step(); pos.x = p.x; pos.z = p.z; step(); } }
      if (tier.trial?.parkour) { const c = tier.trial.parkour, p = c.platforms[c.summit]!; step(); pos.x = p.x; pos.z = p.z; pos.y = p.top + 1.6; step(); }
      for (let w = 0; w < 4; w++) { step(); kill(); }
      step();
      if (tier.kind === "BOSS") break;
    }
    expect(rt.run!.bossDown).toBe(true);
    expect(rt.run!.nested).toBe(false); // a strike has no hidden depths
    const exit = bossExit(rt.run!); pos.x = exit.x; pos.z = exit.z; pos.y = layout.tiers[2]!.floorY + 1.6;
    step();
    const ended = emits.includes("END") || drainEndedRuns().length > 0;
    expect(ended).toBe(true);
    expect(rt.run).toBeNull();
  });
});
