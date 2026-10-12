// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { CHALLENGES, PATROL_DAILY_CAP, PATROL_KILLS, patrolsToday, recordPatrolKills, regionActivities, setChallenge, startPatrol } from "./map-activities";
import { DEFAULT_PROGRESSION, normalizeProgression, type PlayerProgression } from "./progression";
import { REGIONS, regionAt } from "./world";
import { cityAt } from "./living-world";
import { createSim, spawnEventSquad, hurtPlayer } from "./sim";

const NOW = Date.parse("2026-10-11T12:00:00Z");
const base = (): PlayerProgression => ({ ...DEFAULT_PROGRESSION, materials: {}, earnedRewards: [], missionRuns: {}, completedMissions: [] });

describe("map activities", () => {
  it("every region lists something to do, every drop lands in that region, and the next story chapter is marked", () => {
    const p = base();
    let nexts = 0;
    for (const r of REGIONS) {
      const acts = regionActivities(p, r.id, NOW);
      expect(acts.length).toBeGreaterThan(0);
      for (const a of acts) expect(Math.hypot(a.drop.x - r.x, a.drop.z - r.z) < r.radius * 1.2 || cityAt(a.drop.x, a.drop.z) !== null || a.drop.y !== undefined).toBe(true);
      nexts += acts.filter((a) => a.status === "NEXT").length;
    }
    expect(nexts).toBe(1);
  });
  it("safe zones and cities are offered; hostile regions get a patrol; boss drops land outside the lair", () => {
    const nexus = regionActivities(base(), "nexus", NOW);
    expect(nexus.some((a) => a.kind === "SAFE_ZONE" && a.name === "Neon City")).toBe(true);
    const war = REGIONS.find((r) => r.kind !== "safe")!;
    const acts = regionActivities(base(), war.id, NOW);
    expect(acts.some((a) => a.kind === "PATROL")).toBe(true);
    for (const b of acts.filter((a) => a.kind === "BOSS")) expect(Math.hypot(b.drop.x - b.x, b.drop.z - b.z)).toBeGreaterThan(10);
  });
});

describe("patrols", () => {
  it("count only kills in their own region, pay once through the mission taper, and respect the daily cap", () => {
    const region = REGIONS.find((r) => r.kind !== "safe")!.id;
    let r = startPatrol(base(), region, NOW);
    if ("error" in r) throw new Error(r.error);
    let p = r.progression;
    p = recordPatrolKills(p, "nexus", 50, NOW).progression;
    expect(p.patrol?.kills).toBe(0);
    p = recordPatrolKills(p, region, PATROL_KILLS - 1, NOW).progression;
    expect(p.patrol?.kills).toBe(PATROL_KILLS - 1);
    const done = recordPatrolKills(p, region, 5, NOW);
    expect(done.progression.patrol).toBeNull();
    expect(done.message).toContain("patrol complete");
    expect(patrolsToday(done.progression, NOW)).toBe(1);
    expect(Object.keys(done.progression.materials).length).toBeGreaterThan(0);
    expect(done.progression.inventory.length).toBe(p.inventory.length); // side contract: no completion weapon
    let q = done.progression;
    for (let i = 1; i < PATROL_DAILY_CAP; i++) { const s = startPatrol(q, region, NOW); if ("error" in s) throw new Error(s.error); q = recordPatrolKills(s.progression, region, PATROL_KILLS, NOW).progression; }
    expect(patrolsToday(q, NOW)).toBe(PATROL_DAILY_CAP);
    expect("error" in startPatrol(q, region, NOW)).toBe(true);
    expect("error" in startPatrol(q, region, NOW + 86_400_000)).toBe(false);
  });
});

describe("challenge", () => {
  it("is gated by level, saved, and scales real enemy health and damage", () => {
    expect("error" in setChallenge(base(), "HARD")).toBe(true);
    const r = setChallenge({ ...base(), level: 20 }, "VERY_HARD");
    if ("error" in r) throw new Error(r.error);
    expect(normalizeProgression(JSON.parse(JSON.stringify(r.progression))).challenge).toBe("VERY_HARD");
    expect(normalizeProgression({ ...DEFAULT_PROGRESSION, challenge: "nonsense" }).challenge).toBe("STANDARD");
    const sim = createSim();
    for (const m of sim.machines) m.alive = false;
    const r0 = REGIONS[0]!;
    spawnEventSquad(sim, "a", r0.x, r0.z, 1, 0, r0.id);
    const easy = sim.machines.find((m) => m.alive)!.hp;
    for (const m of sim.machines) m.alive = false;
    sim.challenge = { enemyHp: CHALLENGES.VERY_HARD.enemyHp, enemyDamage: CHALLENGES.VERY_HARD.enemyDamage };
    spawnEventSquad(sim, "b", r0.x, r0.z, 1, 0, r0.id);
    expect(sim.machines.find((m) => m.alive)!.hp).toBeCloseTo(easy * 1.8);
    const hp0 = sim.hp; hurtPlayer(sim, 10, "test");
    const hardHit = hp0 - sim.hp;
    const s2 = createSim(); const h0 = s2.hp; hurtPlayer(s2, 10, "test");
    expect(hardHit).toBeCloseTo((h0 - s2.hp) * 1.6);
    expect(regionAt(r0.x, r0.z)?.id).toBe(r0.id);
  });
});
