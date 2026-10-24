/** Headless melee playtest. Scene.tsx's sword branch (`if (wpn.kind === "sword")`) is inline in the frame loop, so `swing()` below is a
 * line-for-line copy of it (combo counter, swingStats reach/damage, the half-plane test, knockback, defeatMachine) run against the REAL
 * sim. If Scene's block changes, update `swing()` to match. Bug repros that currently fail are test.todo. */
import { describe, expect, test } from "bun:test";
import { applyMachineDamageMods, createSim, defeatMachine, fireBullet, stepSim, summonScenarioBoss, type Machine, type WorldSim } from "./sim";
import { walkHeight } from "./terrain";
import { WEAPONS } from "./weapons";
import { swingStats } from "./foundries";
import { inSwordArc } from "./melee-arc";
import { scenarioById } from "./unique-scenarios";
import { encounterHpFloor } from "./encounter-sim";
import { PARTICIPATION_HITS } from "./scenario-loot";

/** bun runs test.todo (skipped unless `bun test --todo`); the repo's bun:test type shim does not declare it */
const todo = (test as unknown as { todo: (name: string, fn: () => void) => void }).todo;
const DT = 1 / 60;
const PX = -240, PZ = -230;
const sword = WEAPONS.SWORD;

function arena(): WorldSim {
  const sim = createSim();
  for (const t of sim.trucks) t.alive = false;
  for (const m of sim.machines) m.alive = false;
  sim.emergencyQuest = { ...sim.emergencyQuest, state: "DORMANT", timer: 1e9 };
  return sim;
}
function grunt(sim: WorldSim, x: number, z: number, o: Partial<Machine> = {}): Machine {
  const m = sim.machines.find((e) => !e.alive)!;
  Object.assign(m, { alive: true, x, z, y: walkHeight(x, z), hp: 3.5, maxHp: 3.5, rot: 0, scale: 0.95, zone: "wastelands", cool: 99, elite: false, boss: false, profile: "Test Grunt", kind: "RAIDER", drop: "scrapMetal", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, mission: true, react: undefined }, o);
  delete m.ai; delete m.lastPlayerDamage;
  return m;
}
type Fighter = { x: number; z: number; feet?: number; yaw: number; fireCool: number; combo: number; comboTime: number; swings: number };
const fighter = (o: Partial<Fighter> = {}): Fighter => ({ x: PX, z: PZ, yaw: 0, fireCool: 0, combo: 0, comboTime: 0, swings: 0, ...o });

/** Scene's sword frame: timers, then (trigger && fireCool <= 0) one swing over every live machine (no foundry blade equipped) */
function swordFrame(sim: WorldSim, s: Fighter, trigger: boolean, dt = DT) {
  s.fireCool -= dt;
  s.comboTime = Math.max(0, s.comboTime - dt);
  if (s.comboTime <= 0) s.combo = 0;
  if (!(trigger && s.fireCool <= 0)) return;
  s.fireCool = sword.fireRate;
  s.combo = (s.combo % 3) + 1;
  s.comboTime = 0.9;
  s.swings++;
  const sw = swingStats(null, s.combo, { damage: sword.damage, reach: s.combo === 3 ? 8 : 6 }, false);
  const reach = sw.reach;
  for (const enemy of sim.machines) {
    if (!enemy.alive) continue;
    const dx = enemy.x - s.x, dz = enemy.z - s.z, d = Math.hypot(dx, dz);
    if (!inSwordArc({ x: s.x, z: s.z, feet: s.feet ?? walkHeight(s.x, s.z), yaw: s.yaw }, { x: enemy.x, z: enemy.z, feet: Math.max(walkHeight(enemy.x, enemy.z), enemy.y - 2.2 * enemy.scale), scale: enemy.scale }, reach)) continue;
    const dmg = applyMachineDamageMods(sim, enemy, swingStats(null, s.combo, { damage: sword.damage, reach }, enemy.elite || enemy.boss).damage, "KINETIC", s.x, s.z);
    enemy.hp -= dmg;
    enemy.kx += (dx / Math.max(d, 0.1)) * sword.knock * 8;
    enemy.kz += (dz / Math.max(d, 0.1)) * sword.knock * 8;
    enemy.cool = Math.max(enemy.cool, 0.6);
    sim.lastHit = performance.now();
    defeatMachine(sim, enemy);
  }
}
const step = (sim: WorldSim) => stepSim(sim, { px: PX, pz: PZ, dt: DT, night: 0, inVehicle: false, yaw: 0 });

describe("sword combo", () => {
  test("held trigger chains 1-2-3 every 0.55 s for 3.2 / 3.2 / 5.76 damage, and the combo resets after 0.9 s idle", () => {
    const sim = arena();
    const m = grunt(sim, PX, PZ + 3, { hp: 100, maxHp: 100 });
    const seen: { combo: number; dmg: number }[] = [];
    const fighter_ = fighter();
    for (let f = 0; f < 140; f++) {
      const hp = m.hp;
      swordFrame(sim, fighter_, true);
      if (m.hp < hp) seen.push({ combo: fighter_.combo, dmg: Math.round((hp - m.hp) * 100) / 100 });
      m.x = PX; m.z = PZ + 3; m.kx = 0; m.kz = 0; // hold the dummy in place
    }
    expect(seen.slice(0, 4)).toEqual([{ combo: 1, dmg: 3.2 }, { combo: 2, dmg: 3.2 }, { combo: 3, dmg: 5.76 }, { combo: 1, dmg: 3.2 }]);
    for (let f = 0; f < 60; f++) swordFrame(sim, fighter_, false);
    expect(fighter_.combo).toBe(0);
  });

  test("two swings kill a basic grunt in a real fight (it walks in, gets cut down)", () => {
    const sim = arena();
    const m = grunt(sim, PX, PZ + 12, { cool: 0 });
    const s = fighter();
    let t = 0;
    for (; t < 6 && m.alive; t += DT) { s.yaw = Math.atan2(m.x - s.x, m.z - s.z); swordFrame(sim, s, Math.hypot(m.x - s.x, m.z - s.z) < 6); step(sim); }
    expect(m.alive).toBe(false);
    expect(s.swings).toBe(2);
    expect(sim.kills).toBe(1);
  });

  test("reach scales with the target's size: 6.7 m on a grunt, 8.6 m on the finisher", () => {
    const at = (d: number, combo: number) => {
      const sim = arena();
      const m = grunt(sim, PX, PZ + d, { hp: 100, maxHp: 100 });
      const s = fighter({ combo: combo - 1, comboTime: 1 });
      swordFrame(sim, s, true);
      return m.hp < 100;
    };
    expect(at(6.6, 1)).toBe(true);
    expect(at(6.8, 1)).toBe(false);
    expect(at(8.5, 3)).toBe(true);
    expect(at(8.7, 3)).toBe(false);
  });
});

describe("sword cone and targets", () => {
  test("nothing behind you is hit", () => {
    const sim = arena();
    const m = grunt(sim, PX, PZ - 2);
    swordFrame(sim, fighter(), true);
    expect(m.hp).toBe(3.5);
  });

  test("a forward slash misses a grunt standing directly to your side (150-degree arc)", () => {
    const sim = arena();
    const side = grunt(sim, PX + 5, PZ + 0.01);
    swordFrame(sim, fighter(), true);
    expect(side.hp).toBe(3.5);
  });
});

describe("sword vs bosses", () => {
  test("a catalog boss's reach is 3x a grunt's: the sword lands from 16 m (scale 2.3: 6 x 2.3 + 1 = 14.8 m)", () => {
    const sim = arena();
    const m = grunt(sim, PX, PZ + 14.5, { boss: true, elite: true, hp: 28, maxHp: 28, scale: 2.3 });
    swordFrame(sim, fighter(), true);
    expect(m.hp).toBeLessThan(28);
  });

  test("encounter hp floor holds against melee until the finale window opens", () => {
    const sim = arena();
    const dk = scenarioById("dark-knight")!;
    expect(summonScenarioBoss(sim, dk, PX, PZ + 4)).toBe(true);
    const boss = sim.machines.find((m) => m.alive && m.boss)!;
    stepSim(sim, { px: PX, pz: PZ, dt: DT, night: 0, inVehicle: false, yaw: 0 }); // creates the encounter state
    // jump the fight to its last phase (Last Oath) before its finale has played
    boss.hp = 1;
    boss.encounter!.phase = 3;
    const s = fighter();
    for (let f = 0; f < 120; f++) { swordFrame(sim, s, true); boss.x = PX; boss.z = PZ + 4; }
    expect(boss.alive).toBe(true);
    expect(boss.hp).toBe(encounterHpFloor(boss, performance.now() / 1000));
    expect(boss.hp).toBe(3);
  });

  test("sword damage on a scenario boss goes through applyMachineDamageMods (poise, gimmick, participation)", () => {
    const { boss, swordDmg, bulletDmg } = swordVsBullet();
    expect(swordDmg / bulletDmg).toBeLessThan(sword.damage * 1.8 * 2);
    expect(boss.playerHits ?? 0).toBeGreaterThan(0);
  });
  function swordVsBullet() {
    const sim = arena();
    expect(summonScenarioBoss(sim, scenarioById("dark-knight")!, PX, PZ + 4)).toBe(true);
    const boss = sim.machines.find((m) => m.alive && m.boss)!;
    // one slash
    let hp = boss.hp;
    const s = fighter({ combo: 2, comboTime: 1 }); // the finisher, 5.76
    swordFrame(sim, s, true);
    const swordDmg = hp - boss.hp;
    // one rifle round through the real bullet loop
    hp = boss.hp;
    fireBullet(sim, PX, walkHeight(PX, PZ) + 2.55, PZ, 0, false, 0, 1);
    stepSim(sim, { px: PX, pz: PZ, dt: DT, night: 0, inVehicle: false, yaw: 0 });
    const bulletDmg = hp - boss.hp;
    return { boss, swordDmg, bulletDmg };
  }

  test("applyMachineDamageMods on the same boss for reference: 1 dmg outside the window prices at outsideWindowMult", () => {
    const sim = arena();
    summonScenarioBoss(sim, scenarioById("dark-knight")!, PX, PZ + 4);
    const boss = sim.machines.find((m) => m.alive && m.boss)!;
    const d = applyMachineDamageMods(sim, boss, 1, "KINETIC", PX, PZ);
    expect(d).toBeLessThan(0.3);
    expect(d).toBeGreaterThan(0);
  });
});
