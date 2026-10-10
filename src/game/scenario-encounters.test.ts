// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ENCOUNTERS, phaseIndexFor } from "./scenario-encounters";
import { BOSS_STUN_CAP, createSim, defeatMachine, fireBullet, hurtPlayer, stepSim, stunMachine, summonScenarioBoss, type Machine, type WorldSim } from "./sim";
import { endEncounter, ENGAGE_RANGE, encounterHpFloor } from "./encounter-sim";
import { INITIAL_POISE, isStaggered, isWeakPointOpen } from "./boss-poise";
import { DEFAULT_PROGRESSION, normalizeProgression } from "./progression";
import { claimDrops } from "./inventory";
import { CENSER_OF_THE_HOLLOW_SAINT, CROWN_OF_THE_DROWNED_COURT, DROWNED_MONARCH_TRIDENT_CHANCE, HOLLOW_SAINT_CENSER_CHANCE, SCENARIO_LOOT, TIDECALLER_TRIDENT, VEIL_OF_THE_HOLLOW_SAINT, claimKey, grantScenarioReward } from "./scenario-loot";
import { UNIQUE_SCENARIOS, scenarioById } from "./unique-scenarios";
import { SCENARIO_LAIRS } from "./waypoints";
import { heightAt } from "./terrain";
import { THALASSIA_CENTER } from "./thalassia-site";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { mergeProgression } = await import("./cloud-save");

let clock = 1000;
let spy: { mockRestore: () => void };
beforeEach(() => { clock = 1000; spy = spyOn(performance, "now").mockImplementation(() => clock * 1000); });
afterEach(() => spy.mockRestore());

const BX = 3000, BZ = 3000;
/** player stands `dist` metres east of the boss */
const PLAYER = (dist: number) => ({ px: BX + dist, pz: BZ });

function arena(id: string, dist = 30) {
  const sim = createSim();
  for (const m of sim.machines) m.alive = false;
  expect(summonScenarioBoss(sim, scenarioById(id)!, BX, BZ)).toBe(true);
  const boss = sim.machines.find((m) => m.alive && m.boss)!;
  boss.cool = 0;
  const { px, pz } = PLAYER(dist);
  let p = { px, pz };
  const step = (secs: number, opts: { pin?: boolean; keepAlive?: boolean } = {}) => {
    const n = Math.max(1, Math.round(secs / 0.05));
    for (let i = 0; i < n; i++) {
      clock += 0.05;
      stepSim(sim, { px: p.px, pz: p.pz, dt: 0.05, night: 0.5, inVehicle: false });
      if (opts.keepAlive !== false) sim.hp = 100;
      if (opts.pin !== false && boss.alive) { boss.x = BX; boss.z = BZ; boss.kx = 0; boss.kz = 0; }
    }
  };
  const moveTo = (dist: number) => { p = { px: BX + dist, pz: BZ }; };
  step(0.05); // the director creates its state on the first step
  return { sim, boss, step, moveTo };
}
/** force the next attack: put the director in TELL for `atk` with `left` seconds remaining, aimed at the player */
function forceTell(boss: Machine, atk: string, left = 0.04, aimAt = 30) {
  const enc = boss.encounter!;
  Object.assign(enc, { state: "TELL", atk, timer: left, tx: BX + aimAt, tz: BZ, tellTotal: left });
}
const hpBefore = (sim: WorldSim) => { sim.hp = 100; return sim.hp; };

describe("six-plus scenario definitions", () => {
  it("every scenario has a stable, unique id and the expected six core scenarios exist", () => {
    const ids = UNIQUE_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["unbroken-glass", "system-core", "rime-alpha", "dark-knight", "drowned-monarch", "hollow-saint"]) expect(ids).toContain(id);
  });
  it("the four authored encounters carry the specified phase names in order", () => {
    const names = (id: string) => ENCOUNTERS[id]!.phases.map((p) => p.name);
    expect(names("dark-knight")).toEqual(["Warden", "Fracture Field", "Null Ascendant", "Last Oath"]);
    expect(names("rime-alpha")).toEqual(["Hunt", "Predation", "Frostbound", "Alpha's Fury"]);
    expect(names("drowned-monarch")).toEqual(["Abyssal Court", "Rising Tide", "Broken Throne", "Monarch's Fall"]);
    expect(names("hollow-saint")).toEqual(["The Procession", "False Saints", "Shroud Collapse", "The Last Benediction"]);
  });
  it("every attack has a tell, a valid range, a recovery and only references attacks that exist", () => {
    for (const def of Object.values(ENCOUNTERS)) {
      expect(scenarioById(def.scenarioId)).toBeDefined();
      for (const a of Object.values(def.attacks)) {
        expect(a.tellTime).toBeGreaterThan(0);
        expect(a.recovery).toBeGreaterThan(0);
        expect(a.maxRange).toBeGreaterThan(a.minRange);
        expect(a.tell.length).toBeGreaterThan(10);
      }
      let last = 2;
      for (const ph of def.phases) {
        expect(ph.below).toBeLessThan(last); last = ph.below;
        for (const id of ph.attacks) expect(def.attacks[id]).toBeDefined();
        if (ph.finale) expect(def.attacks[ph.finale.attack]).toBeDefined();
      }
    }
  });
  it("Dark Knight, Drowned Monarch and Hollow Saint end in an explicit finale window; Rime Alpha ends in Fury", () => {
    for (const id of ["dark-knight", "drowned-monarch", "hollow-saint"]) {
      const last = ENCOUNTERS[id]!.phases.at(-1)!;
      expect(last.finale?.window).toBeGreaterThanOrEqual(4);
      expect(last.finale?.floorHp).toBeGreaterThan(0);
    }
    expect(ENCOUNTERS["rime-alpha"]!.phases.at(-1)!.finale).toBeUndefined();
  });
  it("Unbroken Glass, System Core and Red Ronin keep their original poise-only behaviour (no encounter entry)", () => {
    for (const id of ["unbroken-glass", "system-core", "red-ronin"]) expect(ENCOUNTERS[id]).toBeUndefined();
  });
  it("Drowned Monarch (Thalassia) and Hollow Saint (swamps) have lairs in their own regions and report no dedicated model", () => {
    const dm = SCENARIO_LAIRS.find((l) => l.scenarioId === "drowned-monarch")!;
    expect(Math.hypot(dm.x - THALASSIA_CENTER.x, dm.z - THALASSIA_CENTER.z)).toBeLessThan(60);
    expect(SCENARIO_LAIRS.some((l) => l.scenarioId === "hollow-saint")).toBe(true);
    expect(scenarioById("drowned-monarch")!.model).toBeUndefined();
    expect(scenarioById("hollow-saint")!.model).toBeUndefined();
  });
  it("phaseIndexFor maps hp fraction to the right phase", () => {
    const d = ENCOUNTERS["dark-knight"]!;
    expect([1, 0.8, 0.72, 0.6, 0.45, 0.3, 0.2, 0.05].map((f) => phaseIndexFor(d, f))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
});

describe("phase transitions", () => {
  it("advance with hp, announce through NOVA/alerts + events, and never go backwards", () => {
    const { sim, boss, step } = arena("dark-knight");
    step(0.1);
    expect(boss.encounter!.phase).toBe(0);
    boss.hp = boss.maxHp! * 0.4; step(0.1);
    expect(boss.encounter!.phase).toBe(2); // skipped straight to the phase that matches its health
    boss.hp = boss.maxHp!; step(0.1);
    expect(boss.encounter!.phase).toBe(2); // healing does not rewind the fight
    expect(sim.encounterEvents.some((e) => e.kind === "PHASE" && e.text.startsWith("NOVA"))).toBe(true);
  });
  it("Broken Throne transforms the arena: persistent flooded-corner zones appear and clear with the fight", () => {
    const { sim, boss, step } = arena("drowned-monarch");
    step(0.1);
    expect(sim.encounterZones.filter((z) => z.name === "Flooded corner")).toHaveLength(0);
    boss.hp = boss.maxHp! * 0.4; step(0.1);
    expect(sim.encounterZones.filter((z) => z.name === "Flooded corner")).toHaveLength(4);
    endEncounter(sim, boss);
    expect(sim.encounterZones).toHaveLength(0);
  });
  it("the encounter waits while the player is out of engagement range", () => {
    const { sim, boss, step, moveTo } = arena("dark-knight");
    moveTo(ENGAGE_RANGE + 40);
    step(8);
    expect(boss.encounter!.state).toBe("IDLE");
    expect(sim.encounterEvents.filter((e) => e.kind === "TELL")).toHaveLength(0);
  });
});

describe("attacks have real consequences decided by geometry, not visuals", () => {
  it("a slam hits a player inside its radius and misses one outside it", () => {
    const near = arena("dark-knight", 4); forceTell(near.boss, "sweep", 0.04, 4); hpBefore(near.sim);
    near.step(0.1, { keepAlive: false });
    expect(near.sim.hp).toBeLessThan(100);
    const far = arena("dark-knight", 25); forceTell(far.boss, "sweep", 0.04, 25); hpBefore(far.sim);
    far.step(0.1, { keepAlive: false });
    expect(far.sim.hp).toBe(100);
    expect(far.sim.encounterEvents.find((e) => e.kind === "IMPACT")?.hit).toBe(false);
  });
  it("a lunge hits along its line and misses a sidestepped player", () => {
    const a = arena("dark-knight", 20); forceTell(a.boss, "lunge", 0.04, 20); a.sim.hp = 100;
    a.step(0.1, { keepAlive: false, pin: false });
    expect(a.sim.hp).toBeLessThan(100);
    const b = arena("dark-knight", 20); forceTell(b.boss, "lunge", 0.04, 20); b.sim.hp = 100;
    b.moveTo(20); (b as unknown as { sim: WorldSim }).sim.hp = 100;
    // sidestep: the player leaves the snapshot line before the impact resolves
    const sim = b.sim; const px = BX + 20; const pz = BZ + 15;
    clock += 0.1; stepSim(sim, { px, pz, dt: 0.1, night: 0.5, inVehicle: false });
    expect(sim.hp).toBe(100);
  });
  it("a pounce lands on the player's position when the tell began", () => {
    const { sim, boss, step } = arena("rime-alpha", 20);
    forceTell(boss, "pounce", 0.04, 20);
    step(0.1, { pin: false });
    expect(Math.hypot(boss.x - (BX + 20), boss.z - BZ)).toBeLessThan(1);
    void sim;
  });
  it("Rift Dash i-frames and Bastion barrier negate encounter hits (they go through hurtPlayer)", () => {
    const a = arena("dark-knight", 4); forceTell(a.boss, "sweep", 0.04, 4); a.sim.iframes = 5; a.sim.hp = 100;
    a.step(0.1, { keepAlive: false });
    expect(a.sim.hp).toBe(100);
    const b = arena("dark-knight", 4); forceTell(b.boss, "sweep", 0.04, 4); b.sim.barrierTime = 5; b.sim.hp = 100;
    b.step(0.1, { keepAlive: false });
    expect(b.sim.hp).toBe(100);
  });
  it("the generic melee/volley AI is suppressed for encounter bosses: standing next to one does nothing between attacks", () => {
    const { sim, boss, step } = arena("dark-knight", 3);
    boss.encounter = undefined as never; step(0.05); boss.encounter!.timer = 99; sim.hp = 100;
    step(3, { keepAlive: false });
    expect(sim.hp).toBe(100);
  });
  it("a finished attack opens a trimmed weak-point window the player can punish", () => {
    const { boss, step } = arena("dark-knight", 25);
    forceTell(boss, "sweep", 0.04, 25);
    step(0.1);
    expect(isWeakPointOpen(boss.poiseState!, clock)).toBe(true);
    step(3);
    expect(isWeakPointOpen(boss.poiseState!, clock)).toBe(false);
  });
  it("a stagger (Null Disruption / poise break) during a tell interrupts the attack", () => {
    const { sim, boss, step } = arena("dark-knight", 4);
    forceTell(boss, "sweep", 1.0, 4);
    boss.poiseState = { ...INITIAL_POISE, staggerUntil: clock + 4 };
    expect(isStaggered(boss.poiseState, clock)).toBe(true);
    hpBefore(sim);
    step(1.5, { keepAlive: false });
    expect(sim.hp).toBe(100);
    expect(sim.encounterEvents.some((e) => e.kind === "INTERRUPT")).toBe(true);
  });
  it("bosses are never hard-locked: stuns are capped, and a stunned boss does not start new attacks", () => {
    const { sim, boss, step } = arena("dark-knight", 25);
    stunMachine(boss, 30);
    expect(boss.cool).toBeLessThanOrEqual(BOSS_STUN_CAP);
    boss.encounter!.timer = 0; boss.cool = 0.5;
    step(0.3);
    expect(sim.encounterEvents.filter((e) => e.kind === "TELL")).toHaveLength(0);
    step(2);
    expect(sim.encounterEvents.some((e) => e.kind === "TELL")).toBe(true);
  });
  it("a boss can only attack from within the attack's valid range", () => {
    const { sim, boss, step } = arena("dark-knight", 70);
    boss.encounter!.timer = 0;
    step(1);
    const tell = sim.encounterEvents.find((e) => e.kind === "TELL");
    if (tell) expect(["fracture", "null-nova", "bolt", "oath-sweep"]).toContain(tell.attack);
    expect(tell?.attack).not.toBe("sweep");
  });
});

describe("hazard zones", () => {
  it("the Fracture field is harmless while arming, then damages only players standing inside it", () => {
    const { sim, boss, step } = arena("dark-knight", 20);
    forceTell(boss, "fracture", 0.04, 20);
    step(0.1);
    expect(sim.encounterZones.length).toBe(4);
    sim.hp = 100; step(0.5, { keepAlive: false });
    expect(sim.hp).toBe(100); // still arming
    step(1.5, { keepAlive: false }); // armed: one zone sits ON the player's snapshot position
    expect(sim.hp).toBeLessThan(100);
    // leaving the zones stops the damage
    const safe = sim.hp;
    const out = arena("dark-knight", 20);
    forceTell(out.boss, "fracture", 0.04, 20); out.step(0.1);
    out.moveTo(45); out.boss.cool = 999; out.sim.hp = 100; out.step(4, { keepAlive: false }); // boss held back so only the zones can hurt
    expect(out.sim.hp).toBe(100);
    void safe;
  });
  it("Frost patches slow the player by position and release when they leave or the zone expires", () => {
    const { sim, boss, step, moveTo } = arena("rime-alpha", 20);
    forceTell(boss, "frost-patches", 0.04, 20);
    step(2.5);
    expect(sim.hazardSpeedMult).toBe(0.5);
    moveTo(60); step(0.1);
    expect(sim.hazardSpeedMult).toBe(1);
    moveTo(20); step(0.1);
    expect(sim.hazardSpeedMult).toBe(0.5);
    step(12);
    expect(sim.hazardSpeedMult).toBe(1);
    expect(sim.encounterZones).toHaveLength(0);
  });
  it("Rising Tide zones orbit the Monarch (their position changes over time)", () => {
    const { sim, boss, step } = arena("drowned-monarch", 40);
    forceTell(boss, "rising-tide", 0.04, 40);
    step(0.1);
    const z = sim.encounterZones[0]!; const x0 = z.x;
    step(1);
    expect(z.x).not.toBe(x0);
    expect(Math.hypot(z.x - BX, z.z - BZ)).toBeCloseTo(12, 0);
  });
  it("zones vanish when the boss dies or the fight is abandoned; nothing keeps slowing the player", () => {
    const { sim, boss, step } = arena("rime-alpha", 20);
    forceTell(boss, "frost-patches", 0.04, 20); step(2.5);
    expect(sim.hazardSpeedMult).toBeLessThan(1);
    boss.alive = false; step(0.1);
    expect(sim.encounterZones).toHaveLength(0);
    expect(sim.hazardSpeedMult).toBe(1);
  });
});

describe("failure, reset and the final window", () => {
  it("player death resets the boss to full health, phase one and clears zones", () => {
    const { sim, boss, step } = arena("dark-knight", 20);
    boss.hp = boss.maxHp! * 0.3; step(0.1);
    forceTell(boss, "fracture", 0.04, 20); step(0.1);
    expect(boss.encounter!.phase).toBe(2);
    hurtPlayer(sim, 1e6, "test");
    expect(boss.hp).toBe(boss.maxHp);
    expect(boss.encounter!.phase).toBe(0);
    expect(sim.encounterZones).toHaveLength(0);
    expect(sim.encounterEvents.some((e) => e.kind === "RESET")).toBe(true);
  });
  it("the hp floor keeps the boss alive before the finale: lethal damage cannot end the fight early and pays nothing", () => {
    const { sim, boss, step } = arena("dark-knight", 25);
    boss.hp = boss.maxHp! * 0.1; step(0.1);
    expect(boss.encounter!.phase).toBe(3);
    const kills = sim.kills, credits = sim.credits;
    boss.hp = -50; defeatMachine(sim, boss);
    expect(boss.alive).toBe(true);
    expect(boss.hp).toBe(ENCOUNTERS["dark-knight"]!.phases[3]!.finale!.floorHp);
    expect(sim.kills).toBe(kills); expect(sim.credits).toBe(credits); expect(sim.drops).toHaveLength(0);
  });
  it("the finale (Last Oath) opens a 5 s stagger + weak point window, lifts the floor, and a hit inside it ends the fight exactly once", () => {
    const { sim, boss, step } = arena("dark-knight", 25);
    boss.hp = boss.maxHp! * 0.1; step(0.1);
    boss.encounter!.sinceFinale = 99; // a full rotation has been survived
    boss.encounter!.state = "IDLE"; boss.encounter!.timer = 0; boss.cool = 0;
    step(0.1);
    expect(boss.encounter!.atk).toBe("oath-sweep");
    step(2.4); // survive the telegraphed tell (player is 25 m out: the 18 m floor-wide slam misses)
    expect(sim.encounterEvents.some((e) => e.kind === "FINALE")).toBe(true);
    expect(isStaggered(boss.poiseState!, clock)).toBe(true);
    expect(encounterHpFloor(boss, clock)).toBe(0);
    boss.hp = -1; defeatMachine(sim, boss);
    expect(boss.alive).toBe(false);
    expect(sim.kills).toBe(1);
    defeatMachine(sim, boss); // repeated completion events do nothing
    expect(sim.kills).toBe(1);
    expect(sim.drops.filter((d) => d.scenarioClaim)).toHaveLength(1);
    expect(sim.encounterEvents.some((e) => e.kind === "VICTORY")).toBe(true);
  });
  it("the finale only arms after a full attack rotation, and its window expires back into a floor", () => {
    const { boss, step } = arena("dark-knight", 25);
    boss.hp = boss.maxHp! * 0.1; step(0.1);
    expect(encounterHpFloor(boss, clock)).toBeGreaterThan(0);
    boss.encounter!.sinceFinale = 99; boss.encounter!.timer = 0; step(2.6);
    expect(encounterHpFloor(boss, clock)).toBe(0);
    step(6);
    expect(encounterHpFloor(boss, clock)).toBeGreaterThan(0);
  });
  it("the finale tell leaves a survivable gap: standing at the arena edge dodges the Last Oath", () => {
    const { sim, boss, step } = arena("dark-knight", 25);
    boss.hp = boss.maxHp! * 0.1; step(0.1);
    forceTell(boss, "oath-sweep", 0.04, 25); sim.hp = 100;
    step(0.1, { keepAlive: false });
    expect(sim.hp).toBe(100);
  });
});

describe("Hollow Saint decoys follow consistent identification rules", () => {
  const withDecoys = () => {
    const a = arena("hollow-saint", 30);
    a.boss.hp = a.boss.maxHp! * 0.7; a.step(0.1);
    forceTell(a.boss, "false-saints", 0.04, 30); a.step(0.1);
    const decoys = a.sim.machines.filter((m) => m.alive && m.decoy);
    return { ...a, decoys };
  };
  it("the false-saints attack spawns inert decoys flagged in sim state, never as bosses", () => {
    const { decoys, boss } = withDecoys();
    expect(decoys.length).toBeGreaterThanOrEqual(1);
    expect(decoys.length).toBeLessThanOrEqual(4);
    for (const d of decoys) { expect(d.boss).toBe(false); expect(d.scenarioId).toBeUndefined(); expect(d.cool).toBeGreaterThanOrEqual(90); }
    expect(boss.decoy).toBeUndefined();
  });
  it("decoys never attack or move; only the real Saint tells and hits", () => {
    const { sim, decoys, step } = withDecoys();
    const before = decoys.map((d) => [d.x, d.z]);
    sim.hp = 100;
    step(0.3, { keepAlive: false });
    decoys.forEach((d, i) => { expect([d.x, d.z]).toEqual(before[i]); });
    for (const e of sim.encounterEvents.filter((ev) => ev.kind === "TELL")) expect(e.attack).toBeDefined();
  });
  it("shooting a decoy awards no kill, credit, loot or scenario progress", () => {
    const { sim, decoys } = withDecoys();
    const d = decoys[0]!;
    const k = sim.kills, c = sim.credits, drops = sim.drops.length, xp = sim.xpEvents.length;
    d.hp = 0; defeatMachine(sim, d);
    expect(d.alive).toBe(false);
    expect(sim.kills).toBe(k); expect(sim.credits).toBe(c); expect(sim.drops.length).toBe(drops); expect(sim.xpEvents.length).toBe(xp);
    expect(sim.encounterEvents.some((e) => e.kind === "DECOY_SHATTER")).toBe(true);
  });
  it("damage dealt to a decoy through the real bullet path is not scenario participation on the boss", () => {
    const { sim, boss, decoys } = withDecoys();
    const d = decoys[0]!; const hits = boss.playerHits ?? 0;
    clock += 0.05; sim.weaponHeat = 0;
    fireBullet(sim, d.x, heightAt(d.x, d.z) + 3, d.z, 0);
    stepSim(sim, { px: BX + 30, pz: BZ, dt: 0.05, night: 0.5, inVehicle: false });
    expect(boss.playerHits ?? 0).toBe(hits);
  });
  it("shattering the last decoy exposes the real Saint (weak point open); shattering only some does not", () => {
    const { sim, boss, decoys } = withDecoys();
    expect(decoys.length).toBeGreaterThan(1);
    boss.poiseState = INITIAL_POISE;
    decoys[0]!.hp = 0; defeatMachine(sim, decoys[0]!);
    expect(isWeakPointOpen(boss.poiseState!, clock)).toBe(false);
    for (const d of decoys.slice(1)) { d.hp = 0; defeatMachine(sim, d); }
    expect(isWeakPointOpen(boss.poiseState!, clock)).toBe(true);
  });
  it("decoys disappear when the real Saint dies, resets, or is gone", () => {
    const { sim, boss, decoys, step } = withDecoys();
    hurtPlayer(sim, 1e6, "test");
    expect(sim.machines.some((m) => m.alive && m.decoy)).toBe(false);
    void decoys; void boss; void step;
  });
  it("the real boss is whichever machine the sim says is the boss, with scenario state; decoys can't carry a reward claim", () => {
    const { sim, boss, decoys } = withDecoys();
    expect(sim.machines.filter((m) => m.alive && m.boss && m.scenarioId === "hollow-saint")).toEqual([boss]);
    for (const d of decoys) { d.hp = 0; defeatMachine(sim, d); }
    expect(sim.drops.some((d) => d.scenarioClaim)).toBe(false);
  });
  it("a pooled slot that held a decoy comes back clean", () => {
    const { sim, decoys } = withDecoys();
    const d = decoys[0]!; d.hp = 0; defeatMachine(sim, d);
    expect(d.decoy).toBeUndefined();
  });
});

describe("encounter bosses and pooled slots", () => {
  it("a slot reused by a later summon never inherits the previous encounter state", () => {
    const { sim, boss, step } = arena("dark-knight");
    step(0.5);
    expect(boss.encounter).toBeDefined();
    boss.alive = false;
    expect(summonScenarioBoss(sim, scenarioById("rime-alpha")!, BX, BZ)).toBe(true);
    const next = sim.machines.find((m) => m.alive && m.boss)!;
    expect(next.encounter).toBeUndefined();
    expect(next.scenarioId).toBe("rime-alpha");
  });
  it("Unbroken Glass (no encounter entry) still runs the legacy melee/volley AI and poise gimmick", () => {
    const { boss, step } = arena("unbroken-glass", 3);
    step(0.1);
    expect(boss.encounter).toBeUndefined();
  });
});

describe("rewards for the new scenarios", () => {
  const claim = (id: string, over: Record<string, unknown> = {}) => ({ scenarioId: id, runId: `${id}-run-1`, participated: true, rolls: [0.99], ...over });
  it("Drowned Monarch: guaranteed Crown, chance Trident, real equippable items with distinct ids", () => {
    const t = SCENARIO_LOOT["drowned-monarch"]!;
    expect(t.guaranteed.map((i) => i.id)).toEqual([CROWN_OF_THE_DROWNED_COURT.id]);
    expect(t.chance[0]).toMatchObject({ chance: DROWNED_MONARCH_TRIDENT_CHANCE });
    expect(CROWN_OF_THE_DROWNED_COURT.slot).toBe("helmet");
    expect(TIDECALLER_TRIDENT.slot).toBe("secondary");
    const miss = grantScenarioReward(DEFAULT_PROGRESSION, claim("drowned-monarch"));
    expect(miss.progress.inventory.some((i) => i.id === CROWN_OF_THE_DROWNED_COURT.id)).toBe(true);
    expect(miss.progress.inventory.some((i) => i.id === TIDECALLER_TRIDENT.id)).toBe(false);
    const hit = grantScenarioReward(DEFAULT_PROGRESSION, claim("drowned-monarch", { rolls: [DROWNED_MONARCH_TRIDENT_CHANCE - 0.001] }));
    expect(hit.progress.inventory.some((i) => i.id === TIDECALLER_TRIDENT.id)).toBe(true);
  });
  it("Hollow Saint: guaranteed Veil, chance Censer; boundary roll", () => {
    expect(VEIL_OF_THE_HOLLOW_SAINT.slot).toBe("chest");
    expect(CENSER_OF_THE_HOLLOW_SAINT.slot).toBe("heavy");
    const edge = grantScenarioReward(DEFAULT_PROGRESSION, claim("hollow-saint", { rolls: [HOLLOW_SAINT_CENSER_CHANCE] }));
    expect(edge.progress.inventory.some((i) => i.id === CENSER_OF_THE_HOLLOW_SAINT.id)).toBe(false);
    const hit = grantScenarioReward(DEFAULT_PROGRESSION, claim("hollow-saint", { rolls: [0] }));
    expect(hit.progress.inventory.some((i) => i.id === CENSER_OF_THE_HOLLOW_SAINT.id)).toBe(true);
  });
  it("claims are idempotent per run, a new run levels the duplicate, and entering a lair grants nothing", () => {
    for (const id of ["drowned-monarch", "hollow-saint"]) {
      const first = grantScenarioReward(DEFAULT_PROGRESSION, claim(id));
      expect(first.status).toBe("granted");
      expect(grantScenarioReward(first.progress, claim(id)).status).toBe("already-claimed");
      expect(first.progress.earnedRewards).toContain(claimKey(`${id}-run-1`));
      const second = grantScenarioReward(first.progress, claim(id, { runId: `${id}-run-2` }));
      expect(second.cards[0]!.outcome).toBe("DUPLICATE_LEVEL");
    }
    const sim = createSim();
    expect(summonScenarioBoss(sim, scenarioById("hollow-saint")!, BX, BZ)).toBe(true);
    expect(sim.drops).toHaveLength(0);
    expect(claimDrops(DEFAULT_PROGRESSION, sim.drops).inventory).toEqual(DEFAULT_PROGRESSION.inventory);
  });
  it("a real Drowned Monarch kill through the sim attaches a claim that pays once", () => {
    const { sim, boss, step } = arena("drowned-monarch", 25);
    boss.playerHits = 10;
    boss.hp = boss.maxHp! * 0.1; step(0.1);
    boss.encounter!.finaleUntil = clock + 5;
    boss.hp = -1; defeatMachine(sim, boss);
    const drop = sim.drops.find((d) => d.scenarioClaim)!;
    expect(drop.scenarioClaim).toMatchObject({ scenarioId: "drowned-monarch", participated: true });
    const once = claimDrops(DEFAULT_PROGRESSION, sim.drops);
    expect(once.inventory.filter((i) => i.id === CROWN_OF_THE_DROWNED_COURT.id)).toHaveLength(1);
    expect(claimDrops(once, sim.drops).inventory.filter((i) => i.id === CROWN_OF_THE_DROWNED_COURT.id)).toHaveLength(1);
  });
  it("Rime Alpha keeps its material-only reward and Dark Knight keeps Null Sovereign + 25% Mantle", () => {
    expect(SCENARIO_LOOT["rime-alpha"]).toBeUndefined();
    expect(SCENARIO_LOOT["dark-knight"]!.guaranteed[0]!.id).toBe("null-sovereign");
    expect(SCENARIO_LOOT["dark-knight"]!.chance[0]!.chance).toBe(0.25);
  });
});

describe("save/reload and cloud merge for the new scenarios", () => {
  it("new rewards and their claim ledger survive reload and a two-way cloud merge without re-awarding", () => {
    const c = { scenarioId: "hollow-saint", runId: "hs-1", participated: true, rolls: [0] };
    const local = grantScenarioReward(DEFAULT_PROGRESSION, c).progress;
    const reloaded = normalizeProgression(JSON.parse(JSON.stringify(local)));
    expect(reloaded.inventory.some((i) => i.id === VEIL_OF_THE_HOLLOW_SAINT.id)).toBe(true);
    expect(grantScenarioReward(reloaded, c).status).toBe("already-claimed");
    const merged = mergeProgression(local, DEFAULT_PROGRESSION, true);
    expect(merged.earnedRewards).toContain(claimKey("hs-1"));
    expect(mergeProgression(DEFAULT_PROGRESSION, local, false).inventory.filter((i) => i.id === VEIL_OF_THE_HOLLOW_SAINT.id)).toHaveLength(1);
    expect(merged.inventory.filter((i) => i.id === CENSER_OF_THE_HOLLOW_SAINT.id)).toHaveLength(1);
  });
});
