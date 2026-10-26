/** weapon-meta.ts applied by the real sim: bullets fired with fireBullet and resolved by stepSim. */
import { describe, expect, test } from "bun:test";
import { createSim, fireBullet, stepSim, type Machine, type WorldSim } from "./sim";
import { walkHeight } from "./terrain";
/** sim.ts: the drawn body grows slower than the sim scale */
const enemyBodyScaleOf = (simScale: number) => 1 + (simScale - 1) * 0.35;
import { AFFINITY_DAMAGE, enemyPower, precisionFor, powerScale, rangeFalloff } from "./weapon-meta";
import type { FrameId } from "./weapon-classes";

/** flat open ground outside every region (same spot as combat-playtest-onfoot.test.ts) */
const PX = -240, PZ = -230;
function arena(): WorldSim {
  const sim = createSim();
  for (const t of sim.trucks) t.alive = false;
  for (const m of sim.machines) m.alive = false;
  sim.emergencyQuest = { ...sim.emergencyQuest, state: "DORMANT", timer: 1e9 };
  return sim;
}
function target(sim: WorldSim, dist: number, o: Partial<Machine> = {}): Machine {
  const m = sim.machines.find((e) => !e.alive)!;
  const x = PX, z = PZ + dist;
  Object.assign(m, { alive: true, x, z, y: walkHeight(x, z), hp: 1e6, maxHp: 1e6, rot: Math.PI, scale: 0.95, zone: "wastelands", cool: 99, elite: false, boss: false, profile: "Test Grunt", kind: "RAIDER", drop: "scrapMetal", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, mission: true, react: undefined, evadeCool: Infinity }, o);
  delete m.ai; delete m.lastPlayerDamage;
  return m;
}
/** one round from the player straight down +z at height `aimY` above the target's feet; the damage it did */
function shoot(dist: number, aimFrac: number, weapon: FrameId | undefined, setup: (sim: WorldSim, m: Machine) => void = () => {}): { dealt: number; crit: boolean } {
  const sim = arena(), m = target(sim, dist);
  setup(sim, m);
  const feet = walkHeight(m.x, m.z), y = feet + aimFrac * 1.85 * enemyBodyScaleOf(m.scale);
  const hp0 = m.hp;
  fireBullet(sim, PX, y, PZ, 0, false, 0, 1, 0, 1, undefined, "BULLET", weapon ? { weapon } : undefined);
  // a stationary target: an alert trooper strafes ~3 m during a 100 m flight, and these tests measure damage, not leading
  const hold = { x: m.x, z: m.z };
  for (let f = 0; f < 120 && m.hp === hp0; f++) { m.x = hold.x; m.z = hold.z; m.kx = 0; m.kz = 0; stepSim(sim, { px: PX, pz: PZ, dt: 1 / 60, night: 0, inVehicle: false, yaw: 0 }); }
  return { dealt: hp0 - m.hp, crit: sim.lastCrit > 0 };
}
const HEAD = 0.9, CHEST = 0.62;

describe("the sim applies the weapon classes", () => {
  test("a head-band hit lands the class's precision multiplier and flags a crit; a chest hit does not", () => {
    for (const w of ["SIDEARM", "AUTO", "HEAVY"] as FrameId[]) {
      const head = shoot(10, HEAD, w), chest = shoot(10, CHEST, w);
      expect(chest.dealt, w).toBeGreaterThan(0);
      expect(head.crit, w).toBe(true);
      expect(chest.crit, w).toBe(false);
      expect(head.dealt / chest.dealt, w).toBeCloseTo(precisionFor(w), 3);
    }
  });
  test("a gear class's round (a sniper in the Auto Rifle's slot) uses its own precision and reach", () => {
    const head = shoot(150, HEAD, "SNIPER"), chest = shoot(150, CHEST, "SNIPER"), near = shoot(10, CHEST, "SNIPER");
    expect(head.dealt / chest.dealt).toBeCloseTo(precisionFor("SNIPER"), 3);
    expect(chest.dealt).toBeCloseTo(near.dealt, 3); // no falloff at 150 m
    expect(shoot(30, CHEST, "SMG").dealt).toBeLessThan(shoot(10, CHEST, "SMG").dealt * 0.8); // an SMG is done by 30 m
  });
  test("bosses take no headshot bonus (they have weak points instead)", () => {
    const head = shoot(10, HEAD, "SIDEARM", (_s, m) => { m.boss = true; }), chest = shoot(10, CHEST, "SIDEARM", (_s, m) => { m.boss = true; });
    expect(head.crit).toBe(false);
    expect(head.dealt).toBeCloseTo(chest.dealt, 3);
  });
  test("past its band a gun's hit falls off (the hand cannon at 40 m)", () => {
    const near = shoot(10, CHEST, "SIDEARM"), far = shoot(40, CHEST, "SIDEARM");
    expect(far.dealt / near.dealt).toBeCloseTo(rangeFalloff("SIDEARM", 40 - 0) / rangeFalloff("SIDEARM", 10), 1);
    expect(far.dealt).toBeLessThan(near.dealt * 0.85);
  });
  test("vehicle guns (no weapon on the round) skip the class rules", () => {
    const a = shoot(10, HEAD, undefined), b = shoot(10, CHEST, undefined);
    expect(a.crit).toBe(false);
    expect(a.dealt).toBeCloseTo(b.dealt, 3);
  });
  test("a signature weapon hits harder for its class only", () => {
    const titan = shoot(10, CHEST, "AUTO", (s) => { s.operatorClass = "TITAN"; }), hunter = shoot(10, CHEST, "AUTO", (s) => { s.operatorClass = "HUNTER"; });
    expect(titan.dealt / hunter.dealt).toBeCloseTo(AFFINITY_DAMAGE, 3);
  });
});

describe("power level and build damage reach every hit", () => {
  test("an over-levelled operator hits harder, an under-levelled one softer, against the enemy's region", () => {
    const base = shoot(10, CHEST, "AUTO").dealt; // untracked power: no scaling
    const zonePower = enemyPower(3); // wastelands
    const over = shoot(10, CHEST, "AUTO", (s) => { s.operatorPower = zonePower + 200; }).dealt;
    const under = shoot(10, CHEST, "AUTO", (s) => { s.operatorPower = zonePower - 40; }).dealt;
    expect(over / base).toBeCloseTo(powerScale(200), 3);
    expect(under / base).toBeCloseTo(powerScale(-40), 3);
  });
  test("the build's damage (synergy, momentum) multiplies bullets: it used to be wiped by the mods rebuild before any bullet landed", () => {
    const base = shoot(10, CHEST, "AUTO").dealt;
    const built = shoot(10, CHEST, "AUTO", (s) => { s.buildDamage = 1.5; }).dealt;
    expect(built / base).toBeCloseTo(1.5, 3);
  });
  test("the incoming-damage curve survives the per-step mods rebuild", () => {
    const sim = arena();
    sim.mods.incomingDamageScale = 0.8;
    stepSim(sim, { px: PX, pz: PZ, dt: 1 / 60, night: 0, inVehicle: false, yaw: 0 });
    expect(sim.mods.incomingDamageScale).toBe(0.8);
  });
});
