// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { AMBUSH_AFTER, AMBUSH_COOLDOWN, MAX_ALIVE, MAX_RANK, ambushDue, applyNemesisKill, applyPlayerDeath, mergeNemeses, nemesisStats, normalizeNemeses, onPlayerKilled, type KillerSnapshot } from "./nemesis";
import { DEFAULT_PROGRESSION, normalizeProgression, type PlayerProgression } from "./progression";
import { applyMachineDamageMods, createSim, defeatMachine, hurtPlayer, spawnNemesis } from "./sim";
import { createLivingRuntime, stepLivingRuntime, type LivingEmit } from "./living-runtime";
import { EMPTY_LIVING } from "./living-world";
import { REGIONS } from "./world";

const NOW = 1_800_000_000_000;
const grunt: KillerSnapshot = { profile: "Wasteland Grunt", zone: "wastelands", elite: true, boss: false };
const base = (): PlayerProgression => ({ ...DEFAULT_PROGRESSION, materials: {}, earnedRewards: [], nemeses: [] });

describe("nemesis rules", () => {
  it("a regular killer is promoted with one strength and one weakness; bosses never are", () => {
    const r = onPlayerKilled([], grunt, "The Wastelands", NOW);
    expect(r.list.length).toBe(1);
    const n = r.list[0]!;
    expect(n.rank).toBe(2); expect(n.traits.length).toBe(2); expect(n.regionId).toBe("wastelands");
    expect(onPlayerKilled([], { ...grunt, boss: true }, "x", NOW).list.length).toBe(0);
  });
  it("killing you again ranks it up (capped), and the cap on live nemeses holds", () => {
    let list = onPlayerKilled([], grunt, "W", NOW).list;
    for (let i = 0; i < 10; i++) list = onPlayerKilled(list, { ...grunt, nemesis: list[0]!.id }, "W", NOW + i).list;
    expect(list[0]!.rank).toBe(MAX_RANK); expect(list[0]!.kills).toBe(11);
    let many = list;
    for (let i = 0; i < 20; i++) many = onPlayerKilled(many, { ...grunt, profile: `P${i}` }, "W", NOW + 100 + i).list;
    expect(many.filter((n) => n.status === "ALIVE").length).toBe(MAX_ALIVE);
  });
  it("killing it pays once; a Survivor comes back once and pays again for its second life", () => {
    let p = applyPlayerDeath(base(), grunt, "W", NOW).progression;
    p = { ...p, nemeses: p.nemeses.map((n) => ({ ...n, traits: ["SURVIVOR", "FIRE_SCARRED"] as typeof n.traits })) };
    const id = p.nemeses[0]!.id;
    const k1 = applyNemesisKill(p, id, NOW + 1);
    expect(k1.progression.nemeses[0]!.status).toBe("ALIVE"); expect(k1.progression.nemeses[0]!.returns).toBe(1);
    const shards1 = k1.progression.fractureShards;
    expect(shards1).toBeGreaterThan(p.fractureShards);
    const k2 = applyNemesisKill(k1.progression, id, NOW + 2);
    expect(k2.progression.nemeses[0]!.status).toBe("SLAIN");
    expect(k2.progression.fractureShards).toBeGreaterThan(shards1);
    expect(applyNemesisKill(k2.progression, id, NOW + 3).progression).toBe(k2.progression);
  });
  it("ambushes wait for time in the region and a cooldown; a map summon skips the wait", () => {
    const list = onPlayerKilled([], grunt, "W", NOW).list;
    expect(ambushDue(list, "wastelands", AMBUSH_AFTER - 1, 1e9, null)).toBeNull();
    expect(ambushDue(list, "wastelands", AMBUSH_AFTER + 1, 1e9, null)?.id).toBe(list[0]!.id);
    expect(ambushDue(list, "wastelands", AMBUSH_AFTER + 1, AMBUSH_COOLDOWN - 1, null)).toBeNull();
    expect(ambushDue(list, "veridan", 999, 1e9, null)).toBeNull();
    expect(ambushDue(list, "wastelands", 5, 0, list[0]!.id)?.id).toBe(list[0]!.id);
  });
  it("saves and merges: SLAIN wins, rank is the max", () => {
    const list = onPlayerKilled([], grunt, "W", NOW).list;
    const slain = [{ ...list[0]!, status: "SLAIN" as const, lastSeenAt: NOW - 5 }];
    const ranked = [{ ...list[0]!, rank: 4, lastSeenAt: NOW + 5 }];
    const m = mergeNemeses(slain, ranked);
    expect(m[0]!.status).toBe("SLAIN"); expect(m[0]!.rank).toBe(4);
    expect(normalizeProgression(JSON.parse(JSON.stringify({ ...DEFAULT_PROGRESSION, nemeses: list }))).nemeses).toEqual(list);
    expect(normalizeNemeses([{ bad: 1 }, null])).toEqual([]);
  });
});

describe("nemesis in the real sim", () => {
  it("the player's death to a machine is reported, and a nemesis machine takes double damage from its weak element", () => {
    const sim = createSim(); for (const m of sim.machines) m.alive = false;
    const w = REGIONS.find((r) => r.id === "wastelands")!;
    sim.lastHitBy = grunt; hurtPlayer(sim, 9999, grunt.profile);
    expect(sim.deathEvents.length).toBe(1);
    const n = { ...onPlayerKilled([], grunt, "W", NOW).list[0]!, traits: ["IRON_HIDE", "FIRE_SCARRED"] as ("IRON_HIDE" | "FIRE_SCARRED")[] };
    expect(spawnNemesis(sim, n, w.x, w.z)).toBe(true);
    const m = sim.machines.find((x) => x.alive && x.nemesis === n.id)!;
    expect(m.hp).toBeCloseTo(nemesisStats(n).hp);
    expect(applyMachineDamageMods(sim, m, 1, "THERMAL", w.x, w.z)).toBe(2);
    expect(applyMachineDamageMods(sim, m, 1, "CRYO", w.x, w.z)).toBe(1);
    m.hp = 0; defeatMachine(sim, m, "player");
    expect(sim.nemesisEvents).toEqual([{ id: n.id, killed: true }]);
    expect(m.nemesis).toBeUndefined();
  });
  it("the runtime ambushes in the nemesis's region and reports death/kill events", () => {
    const sim = createSim(); for (const m of sim.machines) m.alive = false;
    const w = REGIONS.find((r) => r.id === "wastelands")!;
    const rt = createLivingRuntime(sim); rt.director.next = 1e9;
    const list = onPlayerKilled([], grunt, "W", NOW).list;
    const emits: LivingEmit[] = [];
    for (let i = 0; i < 70; i++) emits.push(...stepLivingRuntime(rt, sim, { dt: 1, now: NOW, px: w.x, pz: w.z, blocked: false, living: EMPTY_LIVING, fallen: [], markers: [], rnd: () => 0.5, nemeses: list }).emits);
    expect(sim.machines.some((m) => m.alive && m.nemesis === list[0]!.id)).toBe(true);
    sim.lastHitBy = { ...grunt, nemesis: list[0]!.id, profile: "X" }; hurtPlayer(sim, 9999, "X");
    emits.push(...stepLivingRuntime(rt, sim, { dt: 0.1, now: NOW, px: w.x, pz: w.z, blocked: false, living: EMPTY_LIVING, fallen: [], markers: [], rnd: () => 0.5, nemeses: list }).emits);
    expect(emits.some((e) => e.type === "PLAYER_KILLED" && e.killer.nemesis === list[0]!.id)).toBe(true);
  });
});

describe("nemesis names", () => {
  it("are unique among the nemeses you have met", () => {
    let list = onPlayerKilled([], grunt, "x", NOW).list;
    for (let i = 1; i < 30 && list.filter((n) => n.status === "ALIVE").length < MAX_ALIVE; i++) list = onPlayerKilled(list, { ...grunt, profile: `P${i}` }, "x", NOW + i * 7919).list;
    expect(new Set(list.map((n) => n.name)).size).toBe(list.length);
  });
});
