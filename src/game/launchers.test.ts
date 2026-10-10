import { describe, expect, test } from "bun:test";
import { LAUNCHERS, isLauncherId, pickLockTarget } from "./launchers";
import { STATUS_RULES, applyElementHit, burnDamage, freshStatuses, mergeVuln, statusSpeedMult } from "./weapon-elements";
import { WEAPONS, WEAPON_ORDER, freshAmmo } from "./weapons";
import { applyWeaponElement, createSim, defeatMachine, fireBullet, fireLauncher, stepSim } from "./sim";

describe("weapon elements: statuses", () => {
  test("kinetic applies nothing", () => {
    const e = applyElementHit(freshStatuses(), "KINETIC", 10, false);
    expect(e).toEqual({ status: null, stun: 0, vuln: null });
  });
  test("burn damages regular enemies over time and expires; bosses never burn", () => {
    const st = freshStatuses();
    expect(applyElementHit(st, "THERMAL", 10, false).status).toBe("BURN");
    expect(burnDamage(st, 11, 1)).toBeCloseTo(STATUS_RULES.BURN.dps);
    expect(burnDamage(st, 10 + STATUS_RULES.BURN.seconds + 0.1, 1)).toBe(0);
    const boss = freshStatuses();
    expect(applyElementHit(boss, "THERMAL", 10, true).status).toBeNull();
    expect(burnDamage(boss, 11, 1)).toBe(0);
  });
  test("chill slows regular enemies only", () => {
    const st = freshStatuses();
    applyElementHit(st, "CRYO", 5, false);
    expect(statusSpeedMult(st, 6)).toBe(STATUS_RULES.CHILL.speedMult);
    expect(statusSpeedMult(st, 20)).toBe(1);
    const boss = freshStatuses();
    applyElementHit(boss, "CRYO", 5, true);
    expect(statusSpeedMult(boss, 6)).toBe(1);
  });
  test("shock stuns once per cooldown: no stun-lock", () => {
    const st = freshStatuses();
    expect(applyElementHit(st, "ARC", 0, false).stun).toBe(STATUS_RULES.SHOCK.stunSeconds);
    expect(applyElementHit(st, "ARC", 1, false).stun).toBe(0);
    expect(applyElementHit(st, "ARC", STATUS_RULES.SHOCK.cooldown + 0.1, false).stun).toBeGreaterThan(0);
  });
  test("corrode is weaker on bosses and never weakens an active vulnerability", () => {
    const reg = applyElementHit(freshStatuses(), "BIO", 0, false).vuln!, boss = applyElementHit(freshStatuses(), "BIO", 0, true).vuln!;
    expect(boss.mult).toBeLessThan(reg.mult);
    expect(mergeVuln({ mult: 1.5, until: 10 }, { mult: 1.25, until: 4 }, 1)).toEqual({ mult: 1.5, until: 10 });
    expect(mergeVuln({ mult: 1, until: 0 }, reg, 1)).toEqual(reg);
  });
});

describe("launcher weapons", () => {
  test("four distinct launchers with distinct elements, in the weapon table and ordering", () => {
    const ids = Object.keys(LAUNCHERS);
    expect(ids.length).toBe(4);
    expect(new Set(Object.values(LAUNCHERS).map((l) => l.element)).size).toBe(4);
    for (const id of ids) { expect(isLauncherId(id)).toBe(true); expect(WEAPONS[id as keyof typeof WEAPONS].kind).toBe("launcher"); expect(WEAPON_ORDER).toContain(id as never); }
    expect(freshAmmo().FROSTBITE.mag).toBe(WEAPONS.FROSTBITE.mag);
  });
  test("only some weapons are elemental", () => {
    expect(WEAPONS.AUTO.element).toBeUndefined();
    expect(WEAPONS.SWORD.element).toBeUndefined();
    expect(WEAPONS.PULSE.element).toBe("ARC");
    expect(WEAPONS.HEAVY.element).toBe("THERMAL");
  });
  test("only the Frostbite missile is guided", () => {
    expect(Object.values(LAUNCHERS).filter((l) => l.guided).map((l) => l.id)).toEqual(["FROSTBITE"]);
  });
  test("lock picks the nearest target inside the cone and ignores behind/out of range/dead", () => {
    const c = [{ x: 0, z: 30, alive: true }, { x: 0, z: 10, alive: true }, { x: 0, z: -10, alive: true }, { x: 0, z: 8, alive: false }, { x: 0, z: 200, alive: true }, { x: 40, z: 10, alive: true }];
    expect(pickLockTarget({ x: 0, z: 0 }, 0, c, 0.45, 90)).toBe(1);
    expect(pickLockTarget({ x: 0, z: 0 }, Math.PI, c, 0.45, 90)).toBe(2);
    expect(pickLockTarget({ x: 0, z: 0 }, 0, [c[4]!], 0.45, 90)).toBe(-1);
  });
});

describe("launchers in the sim", () => {
  const fresh = () => { const sim = createSim(); const m = sim.machines[0]!; Object.assign(m, { alive: true, x: 0, z: 20, hp: 3, boss: false, scale: 1, cool: 0 }); for (const o of sim.machines) if (o !== m) o.alive = false; return { sim, m }; };
  const run = (sim: ReturnType<typeof createSim>, steps: number) => { for (let i = 0; i < steps; i++) stepSim(sim, { dt: 0.05, px: 0, pz: 0, night: 0 } as never); };

  test("a launcher round detonates, damages with falloff, logs a burst and never hurts the player", () => {
    const { sim, m } = fresh();
    const hp0 = sim.hp;
    expect(fireLauncher(sim, "ROCKET", 0, m.y + 1, 0, 0, 0, 5)).toBe(true);
    run(sim, 40);
    expect(sim.rounds.every((r) => !r.alive)).toBe(true);
    expect(sim.burstEvents.length).toBe(1);
    expect(m.alive).toBe(false);
    expect(sim.hp).toBe(hp0);
  });
  test("overheated launcher does not fire; pool recycles", () => {
    const { sim } = fresh();
    sim.overheated = true;
    expect(fireLauncher(sim, "ROCKET", 0, 1, 0, 0, 0, 5)).toBe(false);
  });
  test("thermal burst burns a survivor but DOT does not count as scenario participation", () => {
    const { sim, m } = fresh();
    m.hp = 50; // survives the burst
    delete m.scenarioId;
    const before = m.playerHits ?? 0;
    applyWeaponElement(sim, m, "THERMAL");
    const hp1 = m.hp;
    run(sim, 20);
    expect(m.hp).toBeLessThan(hp1);
    expect(m.playerHits ?? 0).toBe(before);
  });
  test("bosses do not burn or chill; corrode and stun stay capped", () => {
    const { sim, m } = fresh();
    Object.assign(m, { boss: true, hp: 30, maxHp: 30 });
    applyWeaponElement(sim, m, "THERMAL");
    applyWeaponElement(sim, m, "CRYO");
    expect(sim.statuses.get(m)).toMatchObject({ burnUntil: 0, chillUntil: 0 });
    applyWeaponElement(sim, m, "ARC");
    expect(m.cool).toBeLessThanOrEqual(0.7 + 1e-9);
    applyWeaponElement(sim, m, "BIO");
    expect(m.vulnMult).toBeCloseTo(STATUS_RULES.CORRODE.bossVulnMult);
  });
  test("a defeated machine drops its statuses so a pooled slot never inherits them", () => {
    const { sim, m } = fresh();
    applyWeaponElement(sim, m, "CRYO");
    expect(sim.statuses.has(m)).toBe(true);
    m.hp = 0; defeatMachine(sim, m);
    expect(sim.statuses.has(m)).toBe(false);
  });
  test("elemental bullets carry their element; plain bullets keep legacy behaviour", () => {
    const { sim } = fresh();
    fireBullet(sim, 0, 1, 0, 0, false, 0, 1, 1, 1, "ARC");
    expect(sim.bullets.find((b) => b.alive)!.element).toBe("ARC");
    sim.bullets.forEach((b) => (b.alive = false));
    fireBullet(sim, 0, 1, 0, 0);
    expect(sim.bullets.find((b) => b.alive)!.element).toBeUndefined();
  });
});
