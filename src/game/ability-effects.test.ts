// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { createSim, fireBullet, hurtPlayer, stepSim, summonScenarioBoss, applyMachineDamageMods, BOSS_STUN_CAP, type Machine, type WorldSim } from "./sim";
import { AREA_SCALE, DISRUPT_BOSS_POISE, IMPACT_STUN_SECONDS, MAX_ABILITY_EVENTS, abilityHud, cancelAbilities, castAbility, dashLanding, holdDisabledField, rejectionFor, syncSimFromLive, type Pose } from "./ability-effects";
import { addObstacle, resetObstacles } from "./obstacles";
import { classBuild, createLiveBuild, rebindLiveBuild, tickLiveBuild, type LiveBuild } from "./live-build";
import { ABILITY_CONFIGS } from "./combat-engine";
import { INITIAL_POISE } from "./boss-poise";
import { heightAt } from "./terrain";
import { scenarioById } from "./unique-scenarios";
import { NULL_PERK, NULL_PULSE_STUN_SECONDS } from "./null-disruption";
import { abilityChord, DEFAULT_BINDINGS, maskChord } from "./bindings";
import type { ClassId } from "./loadout";

/** Everything here goes through the real sim (createSim / stepSim / hurtPlayer / defeatMachine) with performance.now under test control. */
let clock = 2000;
let spy: { mockRestore: () => void };
const TX = 3000, TZ = 3000;
const POSE: Pose = { x: TX, z: TZ, yaw: 0 };
beforeEach(() => { clock = 2000; spy = spyOn(performance, "now").mockImplementation(() => clock * 1000); });
afterEach(() => spy.mockRestore());

const world = () => { const sim = createSim(); for (const m of sim.machines) m.alive = false; return sim; };
let slot = 0;
function put(sim: WorldSim, dx: number, dz: number, over: Partial<Machine> = {}): Machine {
  const m = sim.machines[slot++ % sim.machines.length]!;
  Object.assign(m, { alive: true, x: TX + dx, z: TZ + dz, y: heightAt(TX, TZ), hp: 10, rot: 0, scale: 1, zone: "wastelands", cool: 0, elite: false, boss: false, profile: "Test Drone", kind: "OVERCLOCKED", kx: 0, kz: 0, mission: false, vulnUntil: 0, vulnMult: 1, aim: 0, poiseState: undefined, scenarioId: undefined, playerHits: undefined, ...over });
  return m;
}
const knight = (sim: WorldSim, dx = 3, dz = 0) => { slot = 0; expect(summonScenarioBoss(sim, scenarioById("dark-knight")!, TX + dx, TZ + dz)).toBe(true); const m = sim.machines.find((x) => x.alive && x.scenarioId === "dark-knight")!; Object.assign(m, { hp: 1e6, maxHp: 1e6, cool: 0, aim: 0 }); return m; };
const build = (cls: ClassId, branches: Record<string, string> = {}): LiveBuild => createLiveBuild(classBuild(cls), branches);
const cast = (sim: WorldSim, live: LiveBuild, slotName: "PRIMARY" | "TACTICAL" | "ULTIMATE", pose: Pose = POSE, inVehicle = false) => castAbility(sim, live, slotName, pose, { environment: "war", inVehicle });
const step = (sim: WorldSim, dt: number) => { clock += dt; stepSim(sim, { px: TX, pz: TZ + 150, dt, night: 0.5, inVehicle: false }); };

describe("GOLIATH · Kinetic Slam (E)", () => {
  it("damages, knocks back, stuns and interrupts every enemy in the real radius and nobody outside it", () => {
    const sim = world(), live = build("TITAN");
    const near = put(sim, 6, 0, { aim: 0.3 }), edge = put(sim, 0, 13.5), far = put(sim, 0, 14.5);
    const r = cast(sim, live, "TACTICAL");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event).toMatchObject({ kind: "CAST", effect: "DAMAGE", hits: 2, radius: 7 * AREA_SCALE });
    expect(near.hp).toBeCloseTo(10 - 3); expect(edge.hp).toBeCloseTo(7); expect(far.hp).toBe(10);
    expect(near.x - TX).toBeGreaterThanOrEqual(6 + 5.9);          // pushed away from the player
    expect(near.cool).toBeGreaterThanOrEqual(IMPACT_STUN_SECONDS); // stunned
    expect(near.aim).toBe(0);                                      // wind-up interrupted
    expect(far.cool).toBe(0);
  });
  it("costs 20 energy and starts the 18 s cooldown; a second press is refused and spends nothing", () => {
    const sim = world(), live = build("TITAN"); put(sim, 5, 0);
    expect(cast(sim, live, "TACTICAL").ok).toBe(true);
    expect(live.energy).toBe(80); expect(live.runtime.TACTICAL.cooldown).toBe(18);
    const again = cast(sim, live, "TACTICAL");
    expect(again).toMatchObject({ ok: false, reason: "COOLDOWN" });
    expect(live.energy).toBe(80);
    tickLiveBuild(live, 18);
    expect(cast(sim, live, "TACTICAL").ok).toBe(true);
  });
  it("refuses with too little energy, spending nothing and not starting a cooldown", () => {
    const sim = world(), live = build("TITAN"); live.energy = 19;
    expect(cast(sim, live, "TACTICAL")).toMatchObject({ ok: false, reason: "ENERGY" });
    expect(live.energy).toBe(19); expect(live.runtime.TACTICAL.cooldown).toBe(0);
  });
  it("branches: Fault Line (Power) +18% damage, Safeguard (Utility) -15% cost, Aftershock (Control) leaves damage and cost alone", () => {
    const run = (b: string) => { const sim = world(), live = build("TITAN", { "kinetic-slam": b }); const m = put(sim, 5, 0); cast(sim, live, "TACTICAL"); return { dmg: 10 - m.hp, spent: 100 - live.energy }; };
    expect(run("fault-line").dmg).toBeCloseTo(3 * 1.18); expect(run("safeguard").spent).toBeCloseTo(17); expect(run("aftershock")).toMatchObject({ spent: 20 });
    expect(run("aftershock").dmg).toBeCloseTo(3);
  });
  it("a kill is credited through defeatMachine (kills counter, drops) and reported on the event", () => {
    const sim = world(), live = build("TITAN"); put(sim, 5, 0, { hp: 1 });
    const r = cast(sim, live, "TACTICAL");
    expect(r.ok && r.event.kills).toBe(1); expect(sim.kills).toBe(1); expect(sim.drops.length).toBe(1);
  });
  it("Weaken/Marked raises ability damage through the same modifier as bullets", () => {
    const sim = world(), live = build("TITAN"); const m = put(sim, 5, 0, { vulnUntil: clock + 5, vulnMult: 1.5 });
    cast(sim, live, "TACTICAL");
    expect(10 - m.hp).toBeCloseTo(3 * 1.5);
  });
  it("on a boss: no displacement, stun capped, poise and Unique Scenario rules apply, and it counts toward reward participation", () => {
    const sim = world(), live = build("TITAN"); const boss = knight(sim, 4);
    const x0 = boss.x;
    const r = cast(sim, live, "TACTICAL");
    expect(r.ok && r.event.bossHits).toBe(1);
    expect(boss.x).toBe(x0);
    expect(boss.cool).toBeLessThanOrEqual(BOSS_STUN_CAP);
    expect(boss.poiseState!.poise).toBeGreaterThan(0);
    expect(boss.playerHits).toBe(1);
    expect(1e6 - boss.hp).toBeLessThan(3); // Dark Knight is near-immune outside its window
  });
});

describe("GOLIATH · Siege Mode (Q) and Bastion Shield (R)", () => {
  it("Siege: 8 s, +30% outgoing damage via the sim, costs 25, 25 s cooldown; Control lasts 10 s; Power boosts the multiplier", () => {
    const sim = world(), live = build("TITAN"); expect(cast(sim, live, "PRIMARY").ok).toBe(true);
    expect(live.siegeTime).toBe(8); expect(live.energy).toBe(75); expect(live.runtime.PRIMARY.cooldown).toBe(25);
    syncSimFromLive(sim, live); expect(sim.verbDamageMult).toBeCloseTo(1.3);
    const c = build("TITAN", { "siege-mode": "suppressor" }); cast(world(), c, "PRIMARY"); expect(c.siegeTime).toBeCloseTo(10);
    const p = build("TITAN", { "siege-mode": "hold-fast" }); cast(world(), p, "PRIMARY"); expect(p.siegeBoost).toBeCloseTo(1.18);
  });
  it("Siege really changes a real bullet's damage", () => {
    const hit = (mult: number) => { const sim = world(); sim.verbDamageMult = mult; const m = put(sim, 0, 0, { cool: 99, hp: 1e6 }); clock += 0.016; fireBullet(sim, m.x, heightAt(m.x, m.z) + 3, m.z, 0); step(sim, 0.016); return 1e6 - m.hp; };
    expect(hit(1.3)).toBeCloseTo(hit(1) * 1.3, 3);
  });
  it("Bastion Shield: while up every hit is absorbed (any class), then damage resumes; Control extends it to 12.5 s", () => {
    const sim = world(), live = build("TITAN"); expect(sim.titanActive).toBe(false);
    expect(cast(sim, live, "ULTIMATE").ok).toBe(true);
    expect(live.energy).toBe(60); expect(live.runtime.ULTIMATE.cooldown).toBe(24); expect(sim.barrierTime).toBe(10);
    hurtPlayer(sim, 30, "test"); expect(sim.hp).toBe(100); expect(sim.lastBlockedAt).toBe(clock * 1000);
    step(sim, 10.5); hurtPlayer(sim, 30, "test"); expect(sim.hp).toBeLessThan(100);
    const long = build("TITAN", { "bastion-shield": "mirror-plate" }); const s2 = world(); cast(s2, long, "ULTIMATE"); expect(s2.barrierTime).toBeCloseTo(12.5);
  });
});

describe("NYX · Phase Veil (Q), Rift Dash (E), Shadow Strike (R)", () => {
  it("Phase Veil: 6 s of concealment, enemy sight scaled to 15% through the sim, cost 15, cooldown 18", () => {
    const sim = world(), live = build("HUNTER"); expect(cast(sim, live, "PRIMARY").ok).toBe(true);
    syncSimFromLive(sim, live);
    expect(live.veilTime).toBe(6); expect(sim.stealthMult).toBeCloseTo(0.15); expect(live.energy).toBe(85); expect(live.runtime.PRIMARY.cooldown).toBe(18);
    const c = build("HUNTER", { "phase-veil": "afterglow" }); cast(world(), c, "PRIMARY"); expect(c.veilTime).toBeCloseTo(7.5);
    live.veilTime = 0; syncSimFromLive(sim, live); expect(sim.stealthMult).toBe(1);
  });
  it("Rift Dash: moves 11 m along the facing, grants real i-frames that stop damage, then damage resumes", () => {
    const sim = world(), live = build("HUNTER"); const r = cast(sim, live, "TACTICAL", { x: TX, z: TZ, yaw: 0 });
    expect(r.ok && r.pose.z).toBeCloseTo(TZ + 11, 1); expect(sim.iframes).toBeCloseTo(0.28);
    hurtPlayer(sim, 40, "test"); expect(sim.hp).toBe(100);
    step(sim, 0.3); hurtPlayer(sim, 40, "test"); expect(sim.hp).toBeLessThan(100);
    expect(live.energy).toBe(88); expect(live.runtime.TACTICAL.cooldown).toBe(10);
  });
  it("Rift Dash: Control stretches the i-frames; the landing stops short of solid obstacles", () => {
    const sim = world(), live = build("HUNTER", { "rift-dash": "ghost-step" }); cast(sim, live, "TACTICAL");
    expect(sim.iframes).toBeCloseTo(0.28 * 1.25);
    const to = dashLanding(TX, TZ, 0, 11); expect(to.z).toBeCloseTo(TZ + 11, 1);
    resetObstacles(); addObstacle("rock", TX, TZ + 6, 2, 999, 1);
    const stopped = dashLanding(TX, TZ, 0, 11);
    expect(stopped.z).toBeLessThan(TZ + 4); expect(stopped.z).toBeGreaterThan(TZ); // halted before the rock, not inside it
    const sim2 = world(); resetObstacles(); addObstacle("rock", TX, TZ + 6, 2, 999, 1); // createSim rebuilds the world obstacles, so add ours after it
    const r = cast(sim2, build("HUNTER"), "TACTICAL"); expect(r.ok && r.pose.z).toBeLessThan(TZ + 4);
    resetObstacles();
  });
  it("Shadow Strike with no target in reach is REFUSED: no energy, no cooldown, a rejection event and HUD text", () => {
    const sim = world(), live = build("HUNTER"); put(sim, 0, 17); // just outside 16 m
    expect(rejectionFor(sim, live, "ULTIMATE", POSE)).toBe("NO_TARGET");
    const r = cast(sim, live, "ULTIMATE");
    expect(r).toMatchObject({ ok: false, reason: "NO_TARGET" });
    expect(live.energy).toBe(100); expect(live.runtime.ULTIMATE.cooldown).toBe(0);
    expect(live.effect).toBe("Shadow Strike · no target in reach");
    expect(sim.abilityEvents.at(-1)).toMatchObject({ kind: "REJECTED", reason: "NO_TARGET" });
  });
  it("Shadow Strike: lands behind the nearest enemy, deals 4 (8 under Veil, x1.18 Power), stuns, breaks the veil, costs 35", () => {
    const sim = world(), live = build("HUNTER", { "shadow-strike": "killing-edge" }); const t = put(sim, 0, 10, { hp: 20, aim: 0.3 }); put(sim, 0, 14);
    live.veilTime = 5;
    const r = cast(sim, live, "ULTIMATE");
    expect(r.ok).toBe(true);
    expect(20 - t.hp).toBeCloseTo(8 * 1.18);
    expect(t.cool).toBeGreaterThanOrEqual(IMPACT_STUN_SECONDS); expect(t.aim).toBe(0); expect(live.veilTime).toBe(0);
    if (r.ok) { expect(r.pose.z).toBeGreaterThan(TZ + 10); expect(r.pose.yaw).toBeCloseTo(Math.atan2(t.x - r.pose.x, t.z - r.pose.z)); }
    expect(live.energy).toBeCloseTo(65); expect(live.runtime.ULTIMATE.cooldown).toBe(22);
  });
  it("Shadow Strike on the Dark Knight goes through boss poise and counts as participation", () => {
    const sim = world(), live = build("HUNTER"); const boss = knight(sim, 0); boss.z = TZ + 8;
    expect(cast(sim, live, "ULTIMATE").ok).toBe(true);
    expect(boss.poiseState!.poise).toBeGreaterThan(0); expect(boss.playerHits).toBe(1); expect(boss.cool).toBeLessThanOrEqual(BOSS_STUN_CAP);
  });
});

describe("CIPHER · Recon Swarm (Q), Disruption Pulse (E), Rift Turret (R)", () => {
  it("Recon Swarm marks every enemy within 30 m (x1.25 damage for 8 s), costs 18 — and does NOT leave a permanent damage buff", () => {
    const sim = world(), live = build("WARLOCK"); const a = put(sim, 0, 29), b = put(sim, 0, 31); const before = live.damageMultiplier;
    const r = cast(sim, live, "PRIMARY");
    expect(r.ok && r.event.hits).toBe(1);
    expect(a.vulnMult).toBeCloseTo(1.25); expect(a.vulnUntil).toBeCloseTo(clock + 8); expect(b.vulnUntil).toBe(0);
    expect(live.damageMultiplier).toBe(before);
    expect(live.energy).toBe(82); expect(live.runtime.PRIMARY.cooldown).toBeCloseTo(20 * 0.9); // Cipher builds run cooldowns 10% faster (synergy)
    expect(applyMachineDamageMods(sim, a, 2, "KINETIC", TX, TZ)).toBeCloseTo(2.5);
    clock += 9; expect(applyMachineDamageMods(sim, a, 2, "KINETIC", TX, TZ)).toBe(2);
  });
  it("Recon Swarm branches: Deep Scan stronger mark, Hunter Swarm longer", () => {
    const sim = world(), m = put(sim, 0, 5);
    cast(sim, build("WARLOCK", { "recon-swarm": "deep-scan" }), "PRIMARY"); expect(m.vulnMult).toBeCloseTo(1 + 0.25 * 1.18);
    cast(sim, build("WARLOCK", { "recon-swarm": "hunter-swarm" }), "PRIMARY"); expect(m.vulnUntil).toBeCloseTo(clock + 10);
  });
  it("Disruption Pulse stuns ordinary enemies for 5 s inside 14 m, caps bosses and adds boss poise, spares those outside", () => {
    const sim = world(), live = build("WARLOCK"); const inside = put(sim, 0, 13, { aim: 0.3 }), outside = put(sim, 0, 15); const boss = knight(sim, 5);
    boss.poiseState = INITIAL_POISE;
    const r = cast(sim, live, "TACTICAL");
    expect(r.ok && r.event).toMatchObject({ effect: "SILENCE", hits: 2, bossHits: 1, radius: 14 });
    expect(inside.cool).toBe(5); expect(inside.aim).toBe(0); expect(outside.cool).toBe(0);
    expect(boss.cool).toBeLessThanOrEqual(BOSS_STUN_CAP); expect(boss.poiseState!.poise).toBeCloseTo(DISRUPT_BOSS_POISE);
    expect(live.hackTime).toBe(5); expect(live.energy).toBe(76); expect(live.runtime.TACTICAL.cooldown).toBeCloseTo(18 * 0.9);
  });
  it("the disable field keeps ordinary enemies from firing while it lasts but never locks a boss", () => {
    const sim = world(), live = build("WARLOCK"); cast(sim, live, "TACTICAL");
    const grunt = put(sim, 0, 8), boss = knight(sim, 6); grunt.cool = 0; boss.cool = 0;
    holdDisabledField(sim, live, POSE);
    expect(grunt.cool).toBeGreaterThanOrEqual(0.3); expect(boss.cool).toBe(0);
    live.hackTime = 0; grunt.cool = 0; holdDisabledField(sim, live, POSE); expect(grunt.cool).toBe(0);
  });
  it("Rift Turret deploys, lasts 20 s (Control 25 s), caps at two, and its shots go through the shared damage rules", () => {
    const sim = world(), live = build("WARLOCK"); const boss = knight(sim, 10); boss.cool = 99;
    expect(cast(sim, live, "ULTIMATE").ok).toBe(true);
    expect(sim.riftTurrets).toHaveLength(1); expect(sim.riftTurrets[0]!.until).toBeCloseTo(clock + 20);
    expect(live.energy).toBe(55); expect(live.runtime.ULTIMATE.cooldown).toBeCloseTo(30 * 0.9);
    for (let i = 0; i < 30; i++) step(sim, 0.1);
    expect(boss.playerHits).toBeGreaterThan(0); expect(boss.poiseState!.poise).toBeGreaterThan(0);
    const l2 = build("WARLOCK", { "rift-turret": "shared-clock" }); const s2 = world(); cast(s2, l2, "ULTIMATE"); expect(s2.riftTurrets[0]!.until).toBeCloseTo(clock + 20); // Utility: cost only
    const l3 = build("WARLOCK", { "rift-turret": "twin-mount" }); const s3 = world(); cast(s3, l3, "ULTIMATE"); expect(s3.riftTurrets[0]!.until).toBeCloseTo(clock + 25);
    step(sim, 21); expect(sim.riftTurrets).toHaveLength(0);
  });
});

describe("shared rules, targets and the event boundary", () => {
  it("abilities that are not equipped cannot be cast; the equipped build alone decides what each key does", () => {
    const sim = world(), live = build("HUNTER");
    live.equipped = { ...live.equipped, slots: { ...live.equipped.slots, TACTICAL: "nonsense" } };
    expect(cast(sim, live, "TACTICAL")).toMatchObject({ ok: false, reason: "NO_ABILITY" });
    const cross = createLiveBuild({ mode: "HYBRID", slots: { PRIMARY: "siege-mode", TACTICAL: "rift-dash", ULTIMATE: "rift-turret" } });
    expect(cast(sim, cross, "PRIMARY").ok && cross.siegeTime).toBe(8);
    expect(cast(sim, cross, "ULTIMATE").ok && sim.riftTurrets.length).toBe(1);
  });
  it("nothing can be cast from a vehicle", () => {
    const sim = world(), live = build("TITAN");
    expect(cast(sim, live, "TACTICAL", POSE, true)).toMatchObject({ ok: false, reason: "IN_VEHICLE" });
    expect(live.energy).toBe(100);
  });
  it("every shipped ability has a handler: casting each one on a fresh sim succeeds and reports its effect kind", () => {
    for (const cfg of ABILITY_CONFIGS) {
      const sim = world(), live = createLiveBuild({ mode: "HYBRID", slots: { PRIMARY: cfg.slot === "PRIMARY" ? cfg.id : "siege-mode", TACTICAL: cfg.slot === "TACTICAL" ? cfg.id : "rift-dash", ULTIMATE: cfg.slot === "ULTIMATE" ? cfg.id : "rift-turret" } });
      put(sim, 0, 6);
      const r = cast(sim, live, cfg.slot);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.event.effect).toBe(cfg.effects[0]!.kind);
    }
  });
  it("events: stable increasing ids, bounded log, rejections and casts both recorded", () => {
    const sim = world(), live = build("TITAN"); put(sim, 4, 0);
    for (let i = 0; i < MAX_ABILITY_EVENTS + 10; i++) cast(sim, live, "TACTICAL");
    expect(sim.abilityEvents).toHaveLength(MAX_ABILITY_EVENTS);
    const ids = sim.abilityEvents.map((e) => e.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b)); expect(new Set(ids).size).toBe(ids.length);
    expect(sim.abilityEvents.filter((e) => e.kind === "CAST")).toHaveLength(0); // the first cast scrolled out; the rest were refused
    expect(sim.abilityEvents.every((e) => e.kind === "REJECTED" && e.reason === "COOLDOWN")).toBe(true);
  });
  it("a repeated cast event (stale input) cannot double-apply: one press = one CAST", () => {
    const sim = world(), live = build("TITAN"); const m = put(sim, 4, 0);
    cast(sim, live, "TACTICAL"); cast(sim, live, "TACTICAL"); cast(sim, live, "TACTICAL");
    expect(sim.abilityEvents.filter((e) => e.kind === "CAST")).toHaveLength(1); expect(10 - m.hp).toBeCloseTo(3);
  });
});

describe("HUD reflects the real state", () => {
  it("READY -> ACTIVE -> COOLDOWN with real seconds, NO_ENERGY when the cost cannot be paid, names from the equipped build", () => {
    const sim = world(), live = build("TITAN"); put(sim, 4, 0);
    let hud = abilityHud(live);
    expect(hud.map((a) => a.name)).toEqual(["Siege Mode", "Kinetic Slam", "Bastion Shield"]);
    expect(hud.map((a) => a.key)).toEqual(["Q", "E", "R"]); expect(hud.every((a) => a.state === "READY" && a.ready)).toBe(true);
    cast(sim, live, "TACTICAL");
    expect(abilityHud(live)[1]).toMatchObject({ state: "ACTIVE", ready: false });
    tickLiveBuild(live, 1);
    expect(abilityHud(live)[1]).toMatchObject({ state: "COOLDOWN", cooldownMax: 18 }); expect(abilityHud(live)[1]!.cooldown).toBeGreaterThan(15);
    live.energy = 10; hud = abilityHud(live);
    expect(hud[0]).toMatchObject({ state: "NO_ENERGY", ready: false, cost: 25 });
  });
  it("Utility branch lowers the displayed cost; a rejected cast leaves the HUD ability ready", () => {
    const live = build("HUNTER", { "shadow-strike": "zero-hour" }); expect(abilityHud(live)[2]!.cost).toBe(Math.round(35 * 0.85));
    const sim = world(); cast(sim, live, "ULTIMATE"); expect(abilityHud(live)[2]).toMatchObject({ state: "READY", ready: true });
  });
});

describe("interruption, death, respawn and loadout changes", () => {
  it("cancelAbilities clears timers, barrier, i-frames, queued verbs, turrets and cooldowns, keeps the build, and logs CANCELLED", () => {
    const sim = world(); let live = build("TITAN", { "kinetic-slam": "fault-line" });
    cast(sim, live, "PRIMARY"); cast(sim, live, "ULTIMATE"); sim.iframes = 1; sim.riftTurrets.push({ x: 0, z: 0, until: clock + 20, cool: 0, rot: 0, flash: 0 }); live.pendingVerb = { verb: "WEAKEN", magnitude: 1.3, duration: 5, radius: 5 };
    live = cancelAbilities(sim, live, POSE);
    expect(live.siegeTime).toBe(0); expect(live.pendingVerb).toBeNull(); expect(live.energy).toBe(100);
    expect(Object.values(live.runtime).every((r) => r.state === "READY" && r.cooldown === 0)).toBe(true);
    expect([sim.iframes, sim.barrierTime, sim.riftTurrets.length, sim.titan.domeTime]).toEqual([0, 0, 0, 0]);
    expect(live.branches).toEqual({ "kinetic-slam": "fault-line" }); expect(live.equipped.slots.TACTICAL).toBe("kinetic-slam");
    expect(sim.abilityEvents.filter((e) => e.kind === "CANCELLED")).toHaveLength(2);
    syncSimFromLive(sim, live); expect(sim.verbDamageMult).toBe(1);
    expect(cast(sim, live, "ULTIMATE").ok).toBe(true); // usable again immediately
  });
  it("a real death through hurtPlayer then cancelAbilities leaves no shield or i-frame behind", () => {
    const sim = world(); let live = build("HUNTER"); cast(sim, live, "TACTICAL");
    sim.iframes = 0; hurtPlayer(sim, 500, "test"); expect(sim.deaths).toBe(1);
    live = cancelAbilities(sim, live, POSE);
    hurtPlayer(sim, 20, "test"); expect(sim.hp).toBeLessThan(100);
  });
  it("changing loadout resets runtime through rebindLiveBuild; the new equipped slots decide what is castable", () => {
    const sim = world(); let live = build("TITAN"); cast(sim, live, "TACTICAL");
    live = rebindLiveBuild(live, classBuild("HUNTER"), {});
    expect(live.runtime.TACTICAL.cooldown).toBe(0);
    expect(abilityHud(live).map((a) => a.name)).toEqual(["Phase Veil", "Rift Dash", "Shadow Strike"]);
    expect(cast(sim, live, "TACTICAL").ok).toBe(true); expect(sim.iframes).toBeGreaterThan(0);
  });
  it("save/reload: the build and branches serialize and rebuild to identical costs, cooldowns and HUD", () => {
    const branches = { "kinetic-slam": "safeguard", "siege-mode": "suppressor" };
    const a = build("TITAN", branches), b = createLiveBuild(JSON.parse(JSON.stringify(classBuild("TITAN"))), JSON.parse(JSON.stringify(branches)));
    expect(abilityHud(b)).toEqual(abilityHud(a));
  });
});

describe("compatibility with Null Disruption, bosses and weapons", () => {
  it("ability hits never award Null Charge or consume hit ids; the stun caps agree", () => {
    const sim = world(), live = build("TITAN"); sim.equippedPerk = NULL_PERK; put(sim, 4, 0, { aim: 0.4 });
    cast(sim, live, "TACTICAL");
    expect(sim.nullCharge.charge).toBe(0); expect(sim.nextHitId).toBe(0);
    expect(BOSS_STUN_CAP).toBe(NULL_PULSE_STUN_SECONDS);
  });
  it("bullets still go through the same modifier path: boss poise and participation behave as before after the refactor", () => {
    const sim = world(); const boss = knight(sim, 0); boss.cool = 99; clock += 0.016;
    fireBullet(sim, boss.x, heightAt(boss.x, boss.z) + 3, boss.z, 0); step(sim, 0.016);
    expect(boss.playerHits).toBe(1); expect(boss.poiseState!.poise).toBeGreaterThan(0);
  });
  it("Frost Wolf (poise scenario) takes slam poise and keeps its own rules", () => {
    const sim = world(), live = build("TITAN"); slot = 0;
    expect(summonScenarioBoss(sim, scenarioById("rime-alpha")!, TX + 4, TZ)).toBe(true);
    const wolf = sim.machines.find((m) => m.alive && m.scenarioId === "rime-alpha")!; Object.assign(wolf, { hp: 1e6, maxHp: 1e6, cool: 0 });
    cast(sim, live, "TACTICAL");
    expect(wolf.poiseState!.poise).toBeGreaterThan(0); expect(wolf.playerHits).toBe(1); expect(wolf.cool).toBeLessThanOrEqual(BOSS_STUN_CAP);
  });
  it("enemy reaction uses existing AI inputs: loud abilities raise player noise and combat heat; quiet ones do not", () => {
    const sim = world(); put(sim, 4, 0);
    cast(sim, build("TITAN"), "TACTICAL"); expect(sim.playerNoise).toBe(1); expect(sim.combatHeat).toBeGreaterThan(0);
    const quiet = world(); cast(quiet, build("HUNTER"), "PRIMARY"); expect(quiet.playerNoise).toBe(0);
  });
});

describe("controller input", () => {
  const g = DEFAULT_BINDINGS.gamepad;
  const pad = (...down: number[]) => { const p = Array(17).fill(false); for (const i of down) p[i] = true; return p as boolean[]; };
  it("the chord casts only while the modifier is held, mapping X/Y/B to Q/E/R", () => {
    expect(abilityChord(pad(g.abilityPrimary), g)).toEqual({ PRIMARY: false, TACTICAL: false, ULTIMATE: false });
    expect(abilityChord(pad(g.abilityModifier, g.abilityPrimary), g)).toEqual({ PRIMARY: true, TACTICAL: false, ULTIMATE: false });
    expect(abilityChord(pad(g.abilityModifier, g.abilityTactical, g.abilityUltimate), g)).toEqual({ PRIMARY: false, TACTICAL: true, ULTIMATE: true });
  });
  it("while chorded those buttons are consumed so reload / wheel / crouch do not also fire; other buttons are untouched", () => {
    const masked = maskChord(pad(g.abilityModifier, g.abilityPrimary, g.fire), g);
    expect(masked[g.abilityPrimary]).toBe(false); expect(masked[g.fire]).toBe(true);
    expect(maskChord(pad(g.abilityPrimary), g)[g.abilityPrimary]).toBe(true); // no modifier: reload still works
  });
  it("older saved bindings without the new actions still resolve to defaults", async () => {
    const { normalizeBindings } = await import("./bindings");
    const old = normalizeBindings({ gamepad: { reload: 2 } as never });
    expect(old.gamepad.abilityModifier).toBe(8);
  });
});
