import { describe, expect, spyOn, test } from "bun:test";
import { BIG_SHARE, damageFrame, damageText, DISPLAY_SCALE, freshDamageNumbers, LIFE, MAX_LIVE, MERGE_SECONDS, pruneDamage, recordDamage } from "./damage-numbers";
import { createSim, fireBullet, stepSim, type Machine, type WorldSim } from "./sim";
import { walkHeight } from "./terrain";

const hit = (o: Partial<Parameters<typeof recordDamage>[1]> = {}) => ({ target: 0, x: 0, y: 2, z: 0, amount: 1, crit: false, maxHp: 10, now: 0, ...o });

describe("damage number rules", () => {
  test("display units, rounding and thousands separators", () => {
    expect(damageText(1.39)).toBe(String(Math.round(1.39 * DISPLAY_SCALE)));
    expect(damageText(360)).toBe("36,000");
    expect(damageText(0.001)).toBe("1"); // never a zero
  });
  test("hits on one enemy inside the merge window add up; a precision hit turns the number gold", () => {
    const s = freshDamageNumbers();
    recordDamage(s, hit({ amount: 1, now: 0 }));
    recordDamage(s, hit({ amount: 1, now: MERGE_SECONDS * 0.5, crit: true }));
    expect(s.list.length).toBe(1);
    expect(s.list[0]!.amount).toBe(2);
    expect(s.list[0]!.crit).toBe(true);
    // a later hit, or a hit on another enemy, is its own number
    recordDamage(s, hit({ amount: 1, now: MERGE_SECONDS * 3 }));
    recordDamage(s, hit({ target: 1, amount: 1, now: MERGE_SECONDS * 3 }));
    expect(s.list.length).toBe(3);
  });
  test("a big share of an enemy's health is drawn big; zero or broken amounts are ignored", () => {
    const s = freshDamageNumbers();
    recordDamage(s, hit({ amount: 10 * BIG_SHARE, maxHp: 10 }));
    recordDamage(s, hit({ target: 1, amount: 1, maxHp: 10 }));
    expect(s.list.map((n) => n.big)).toEqual([true, false]);
    recordDamage(s, hit({ amount: 0 })); recordDamage(s, hit({ amount: NaN })); recordDamage(s, hit({ amount: -3 }));
    expect(s.list.length).toBe(2);
  });
  test("at most MAX_LIVE at once (the oldest go) and faded numbers are pruned", () => {
    const s = freshDamageNumbers();
    for (let i = 0; i < MAX_LIVE + 10; i++) recordDamage(s, hit({ target: i, now: 0 }));
    expect(s.list.length).toBe(MAX_LIVE);
    expect(s.list[0]!.target).toBe(10);
    pruneDamage(s, LIFE + 0.01);
    expect(s.list.length).toBe(0);
  });
  test("a number rises and fades over its life, pops when it appears, crits and big hits drawn larger", () => {
    const a = damageFrame({ crit: false, big: false }, 0)!, b = damageFrame({ crit: false, big: false }, LIFE * 0.5)!, c = damageFrame({ crit: false, big: false }, LIFE)!;
    expect(a.rise).toBe(0); expect(b.rise).toBeGreaterThan(0); expect(c.rise).toBeGreaterThan(b.rise);
    expect(a.opacity).toBe(1); expect(c.opacity).toBeCloseTo(0, 6);
    expect(a.scale).toBeGreaterThan(b.scale);
    expect(damageFrame({ crit: true, big: false }, 0.5)!.scale).toBeGreaterThan(damageFrame({ crit: false, big: false }, 0.5)!.scale);
    expect(damageFrame({ crit: false, big: true }, 0.5)!.scale).toBeGreaterThan(damageFrame({ crit: false, big: false }, 0.5)!.scale);
    expect(damageFrame({ crit: false, big: false }, LIFE + 0.1)).toBeNull();
  });
});

describe("the sim records the player's hits", () => {
  const PX = -240, PZ = -230;
  let clock = 1000;
  function shootAt(o: Partial<Machine>, aimFrac: number, pellets = 1) {
    const spy = spyOn(performance, "now").mockImplementation(() => clock * 1000);
    try {
      const sim: WorldSim = createSim();
      for (const t of sim.trucks) t.alive = false;
      for (const m of sim.machines) m.alive = false;
      const m = sim.machines[3]!;
      const x = PX, z = PZ + 10;
      Object.assign(m, { alive: true, x, z, y: walkHeight(x, z), hp: 1e6, maxHp: 1e6, rot: Math.PI, scale: 0.95, zone: "wastelands", cool: 99, elite: false, boss: false, profile: "T", kind: "RAIDER", drop: "scrapMetal", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, mission: true, react: undefined, evadeCool: Infinity, decoy: undefined }, o);
      delete m.ai;
      const y = walkHeight(x, z) + aimFrac * 1.85 * (1 + (0.95 - 1) * 0.35);
      for (let p = 0; p < pellets; p++) fireBullet(sim, PX, y, PZ, 0, false, 0, 1, 0, 1, undefined, pellets > 1 ? "PELLET" : "BULLET", { weapon: pellets > 1 ? "SHOTGUN" : "SIDEARM" });
      const hp0 = m.hp;
      for (let f = 0; f < 30; f++) { clock += 1 / 60; m.x = x; m.z = z; stepSim(sim, { px: PX, pz: PZ, dt: 1 / 60, night: 0, inVehicle: false, yaw: 0 }); }
      return { list: sim.damageNumbers.list, dealt: hp0 - m.hp, m };
    } finally { spy.mockRestore(); }
  }
  test("a body hit floats one white number of exactly the damage dealt, above that enemy", () => {
    const r = shootAt({}, 0.62);
    expect(r.list.length).toBe(1);
    expect(r.list[0]!.amount).toBeCloseTo(r.dealt, 6);
    expect(r.list[0]!.crit).toBe(false);
    expect(r.list[0]!.target).toBe(3);
    expect(r.list[0]!.y).toBeGreaterThan(walkHeight(r.m.x, r.m.z) + 1.8);
  });
  test("a headshot's number is gold", () => {
    const r = shootAt({}, 0.9);
    expect(r.list.length).toBe(1);
    expect(r.list[0]!.crit).toBe(true);
  });
  test("a shotgun's pellets land as one number", () => {
    const r = shootAt({}, 0.62, 8);
    expect(r.list.length).toBe(1);
    expect(r.list[0]!.amount).toBeCloseTo(r.dealt, 6);
  });
  test("decoys float nothing", () => {
    const r = shootAt({ decoy: true } as Partial<Machine>, 0.62);
    expect(r.list.length).toBe(0);
  });
});
