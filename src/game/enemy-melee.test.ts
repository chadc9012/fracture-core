import { describe, expect, spyOn, test } from "bun:test";
import { MELEE, startSwing, swingBones, swingDone, swingPhase, windupFor } from "./enemy-melee";
import { createSim, fireBullet, stepSim, type Machine, type WorldSim } from "./sim";
import { walkHeight } from "./terrain";
import { ENEMY_TUNING } from "./enemy-tuning";

describe("swing rules", () => {
  test("wind-up, then strike-and-recover, then done; bosses wind up longer", () => {
    const s = startSwing(10, false);
    expect(s.hitAt).toBeCloseTo(10 + MELEE.windup, 9);
    expect(swingPhase(s, 10.1).phase).toBe("WINDUP");
    expect(swingPhase(s, s.hitAt + 0.01).phase).toBe("STRIKE");
    expect(swingDone(s, s.hitAt + MELEE.recover)).toBe(true);
    expect(windupFor(true)).toBeGreaterThan(windupFor(false));
    expect(swingBones(s, s.hitAt + MELEE.recover + 0.01)).toBeNull();
  });
  test("the pose is continuous (no bone jumps a quarter turn between 60 fps frames) and the lunge peaks in the strike", () => {
    const s = startSwing(0, false);
    let prev = swingBones(s, 0)!.body, peak = 0;
    for (let t = 1 / 60; t < s.hitAt + MELEE.recover; t += 1 / 60) {
      const cur = swingBones(s, t);
      if (!cur) break;
      for (const [b, e] of Object.entries(cur.body)) for (let i = 0; i < 3; i++) expect(Math.abs(e[i]! - (prev[b]?.[i] ?? 0)), `${b} at ${t.toFixed(2)}`).toBeLessThan(Math.PI / 4);
      prev = cur.body; peak = Math.max(peak, cur.lunge);
      if (t < s.hitAt) expect(cur.lunge).toBe(0);
    }
    expect(peak).toBeGreaterThan(MELEE.lunge * 0.9);
  });
});

describe("a trooper's melee in the sim", () => {
  const PX = -240, PZ = -230;
  let clock = 1000;
  /** a trooper `dist` m in front of a standing player; `move(f)` can move the player per frame; returns per-frame player hp */
  function brawl(o: Partial<Machine>, dist: number, frames: number, each: (f: number, sim: WorldSim, m: Machine) => { px?: number; pz?: number } | void = () => {}) {
    const spy = spyOn(performance, "now").mockImplementation(() => clock * 1000);
    try {
      const sim = createSim();
      for (const t of sim.trucks) t.alive = false;
      for (const m of sim.machines) m.alive = false;
      const m = sim.machines[0]!;
      const x = PX, z = PZ + dist;
      Object.assign(m, { alive: true, x, z, y: walkHeight(x, z) + 2.2 * 0.95, hp: 1e6, maxHp: 1e6, rot: Math.PI, scale: 0.95, zone: "wastelands", cool: 0, elite: false, boss: false, profile: "Test Grunt", kind: "RAIDER", drop: "scrapMetal", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, mission: true, react: undefined, evadeCool: Infinity, swing: undefined }, o);
      delete m.ai; delete m.los;
      const hp: number[] = [];
      for (let f = 0; f < frames; f++) {
        clock += 1 / 60;
        const p = each(f, sim, m) ?? {};
        m.x = x; m.z = z; m.kx = 0; m.kz = 0; // it holds its ground: the test is about the swing, not the chase
        stepSim(sim, { px: p.px ?? PX, pz: p.pz ?? PZ, dt: 1 / 60, night: 0, inVehicle: false, yaw: 0, py: walkHeight(PX, PZ) + 1.7, pspeed: 0, stance: "STAND" });
        hp.push(sim.hp);
      }
      return { hp, sim, m };
    } finally { spy.mockRestore(); }
  }
  const firstHurt = (hp: number[]) => hp.findIndex((h) => h < 100);
  test("the hit lands at the end of the wind-up, not the moment the trooper is in range", () => {
    const r = brawl({}, 3, 60);
    const f = firstHurt(r.hp);
    expect(f).toBeGreaterThanOrEqual(Math.floor(MELEE.windup * 60) - 2);
    expect(f).toBeLessThanOrEqual(Math.ceil(MELEE.windup * 60) + 4);
  });
  test("stepping out of reach during the wind-up makes it whiff", () => {
    const r = brawl({}, 3, 60, (f) => (f >= 4 ? { pz: PZ - 12 } : {}));
    expect(firstHurt(r.hp)).toBe(-1);
  });
  test("a stagger during the wind-up cancels the swing", () => {
    // a heavy round to the chest at frame 6 (half an elite's health share: a stagger), fired from where the player stands
    let swinging = false;
    const r = brawl({ hp: 1000, maxHp: 10 }, 3, 40, (f, sim, m) => {
      if (f === 6) { swinging = !!m.swing && !m.swing.landed; fireBullet(sim, PX, walkHeight(PX, PZ) + 1.15, PZ, 0, false, 0, 5, 0, 1, undefined, "BULLET"); }
    });
    expect(swinging).toBe(true);
    expect(r.m.react?.kind).toBe("stagger");
    expect(firstHurt(r.hp)).toBe(-1);
  });
  test("swings are spaced by the melee cooldown; a boss winds up longer", () => {
    const r = brawl({}, 3, 60 * 4);
    let hits = 0; for (let i = 1; i < r.hp.length; i++) if (r.hp[i]! < r.hp[i - 1]! - 0.5) hits++;
    expect(hits).toBeGreaterThanOrEqual(2);
    expect(hits).toBeLessThanOrEqual(Math.ceil(4 / ENEMY_TUNING.meleeCooldown) + 1);
    const b = brawl({ boss: true, hp: 1e6, maxHp: 1e6 }, 3, 90);
    expect(firstHurt(b.hp)).toBeGreaterThan(firstHurt(brawl({}, 3, 90).hp));
  });
  test("a swing left on a body that went still never lands late", () => {
    const r = brawl({ swing: { start: clock - 5, hitAt: clock - 4.6, landed: false } }, 3, 3);
    expect(r.hp.every((h) => h === 100)).toBe(true);
  });
});
