import { describe, expect, test } from "bun:test";
import {
  AFFINITY, enemyPower, hitMultiplier, operatorPower, OVER_MAX, powerScale, precisionFor, rangeFalloff, shotsToKill, timeToKill, UNDER_FLOOR, WEAPON_META,
} from "./weapon-meta";
import { STARTER_GEAR } from "./inventory";
import { WEAPONS, type WeaponId } from "./weapons";
import { REGIONS } from "./world";

const GUNS: WeaponId[] = ["SHOTGUN", "AUTO", "PULSE", "SIDEARM", "HEAVY"];
/** a fresh build's damage scale: Scene's 1.2 base x the smallest ability-synergy bonus (combat-engine.ts) */
const FRESH = 1.2 * 1.08;
const GRUNT = 5, ELITE = 11; // a regular trooper and an elite in a mid / the hardest region (sim.ts spawnMachine)
const ttk = (id: WeaponId, hp: number, distance: number, precision = false, scale = FRESH) => timeToKill(id, hp, { distance, precision, scale });
const fastestAt = (distance: number, hp = ELITE) => GUNS.reduce((a, b) => (ttk(b, hp, distance) < ttk(a, hp, distance) ? b : a));

describe("weapon classes own their range (CoD meta)", () => {
  test("full damage inside the band, falling off to the class floor past it, never below the floor", () => {
    for (const id of GUNS) {
      const m = WEAPON_META[id];
      expect(rangeFalloff(id, 0)).toBe(1);
      expect(rangeFalloff(id, m.rangeFull)).toBe(1);
      expect(rangeFalloff(id, (m.rangeFull + m.rangeEnd) / 2)).toBeCloseTo((1 + m.rangeFloor) / 2, 6);
      expect(rangeFalloff(id, m.rangeEnd * 3)).toBe(m.rangeFloor);
      for (let d = 0; d < 200; d += 5) expect(rangeFalloff(id, d + 5)).toBeLessThanOrEqual(rangeFalloff(id, d));
    }
    expect(rangeFalloff("ROCKET", 500)).toBe(1);
  });
  test("each range has its king: shotgun up close, a rifle in the middle, the heavy cannon far out", () => {
    expect(fastestAt(5)).toBe("SHOTGUN");
    expect(["AUTO", "PULSE"]).toContain(fastestAt(30));
    expect(fastestAt(90)).toBe("HEAVY");
    // the shotgun is the worst choice at rifle range
    expect(GUNS.every((g) => g === "SHOTGUN" || ttk(g, ELITE, 30) < ttk("SHOTGUN", ELITE, 30))).toBe(true);
  });
  test("kill times at a gun's own range sit in a fast-but-readable band for a fresh build", () => {
    const own: Record<string, number> = { SHOTGUN: 5, AUTO: 20, PULSE: 30, SIDEARM: 18, HEAVY: 60 };
    for (const id of GUNS) {
      expect(ttk(id, GRUNT, own[id]!), id).toBeLessThanOrEqual(0.5);
      expect(ttk(id, ELITE, own[id]!), id).toBeLessThanOrEqual(1.1);
      expect(ttk(id, ELITE, own[id]!), id).toBeGreaterThan(0.3); // an elite is never deleted instantly by body shots
    }
  });
});

describe("precision rewards aim", () => {
  test("a head-band hit is never slower and the precision guns gain the most", () => {
    for (const id of GUNS) for (const d of [5, 25, 50]) expect(ttk(id, ELITE, d, true), `${id} ${d}`).toBeLessThanOrEqual(ttk(id, ELITE, d));
    expect(WEAPON_META.SIDEARM.precision).toBeGreaterThan(WEAPON_META.AUTO.precision);
    expect(WEAPON_META.SHOTGUN.precision).toBeLessThan(WEAPON_META.AUTO.precision);
  });
  test("the hand cannon one-shots a trooper's head inside its band; body shots take two", () => {
    expect(shotsToKill("SIDEARM", GRUNT, { distance: 15, precision: true, scale: FRESH })).toBe(1);
    expect(shotsToKill("SIDEARM", GRUNT, { distance: 15, precision: false, scale: FRESH })).toBe(2);
  });
  test("an elite dies at least a third faster to headshots with a precision gun", () => {
    for (const id of ["SIDEARM", "AUTO", "PULSE"] as WeaponId[]) expect(ttk(id, ELITE, 15, true), id).toBeLessThanOrEqual(ttk(id, ELITE, 15) * 0.67);
  });
});

describe("power level (Destiny)", () => {
  test("over-levelled hits harder, capped; under-levelled softer, floored", () => {
    expect(powerScale(0)).toBe(1);
    expect(powerScale(50)).toBeGreaterThan(1);
    expect(powerScale(10_000)).toBeCloseTo(1 + OVER_MAX, 6);
    expect(powerScale(-40)).toBeLessThan(1);
    expect(powerScale(-10_000)).toBe(UNDER_FLOOR);
    expect(powerScale(NaN)).toBe(1);
    for (let d = -300; d < 300; d += 10) expect(powerScale(d + 10)).toBeGreaterThanOrEqual(powerScale(d));
  });
  test("levelling up and better gear raise power; the level bonus stops at the cap", () => {
    const starter = STARTER_GEAR.map((g) => g.power);
    expect(operatorPower(starter, 10)).toBeGreaterThan(operatorPower(starter, 1));
    expect(operatorPower([240, 240], 1)).toBeGreaterThan(operatorPower(starter, 1));
    expect(operatorPower(starter, 500)).toBe(operatorPower(starter, 50));
    expect(operatorPower([], 1)).toBe(90);
  });
  test("a fresh character is close to par in the starting region and never crippled anywhere", () => {
    const fresh = operatorPower(STARTER_GEAR.map((g) => g.power), 1);
    expect(Math.abs(fresh - enemyPower(0))).toBeLessThan(15);
    for (const r of REGIONS) expect(powerScale(fresh - enemyPower(r.difficulty, true)), r.id).toBeGreaterThanOrEqual(UNDER_FLOOR);
  });
  test("a fresh character kills no slower than before kill-time tuning (old: skill-tree damage only, x1) at a gun's own range", () => {
    const fresh = operatorPower(STARTER_GEAR.map((g) => g.power), 1);
    for (const r of REGIONS) {
      const hp = 3 + Math.round(r.difficulty * 0.8);
      const scale = FRESH * powerScale(fresh - enemyPower(r.difficulty));
      for (const id of GUNS) expect(ttk(id, hp, 5, false, scale), `${r.id} ${id}`).toBeLessThanOrEqual(ttk(id, hp, 5, false, 1) / rangeFalloff(id, 5));
    }
  });
  test("a levelled operator in endgame gear drops the hardest region's elites much faster than a fresh one", () => {
    const fresh = FRESH * powerScale(operatorPower(STARTER_GEAR.map((g) => g.power), 1) - enemyPower(5, true));
    const vet = FRESH * powerScale(operatorPower([340, 340, 340, 340, 340, 340], 20) - enemyPower(5, true));
    for (const id of ["AUTO", "PULSE", "SIDEARM"] as WeaponId[]) expect(ttk(id, ELITE, 20, false, vet), id).toBeLessThan(ttk(id, ELITE, 20, false, fresh) * 0.75);
  });
});

describe("class affinity (Destiny classes)", () => {
  test("every class has signature weapons, they hit harder and reward precision more", () => {
    for (const [cls, ids] of Object.entries(AFFINITY)) {
      expect(ids.length).toBeGreaterThanOrEqual(2);
      for (const id of ids) {
        expect(WEAPONS[id], id).toBeDefined();
        expect(hitMultiplier(id, { distance: 5, precision: false, cls: cls as never })).toBeGreaterThan(hitMultiplier(id, { distance: 5, precision: false, cls: null }));
        if (WEAPON_META[id].precision > 1) expect(precisionFor(id, cls as never)).toBeGreaterThan(precisionFor(id, null));
      }
    }
    // no class owns every gun
    for (const ids of Object.values(AFFINITY)) expect(GUNS.filter((g) => ids.includes(g)).length).toBeLessThan(GUNS.length);
  });
});

describe("kill-time arithmetic", () => {
  test("bursts, pellets and reloads count", () => {
    // pulse: 3 rounds per pull 0.06 s apart, 0.42 s between pulls
    expect(timeToKill("PULSE", 1, { distance: 0, precision: false, scale: 100 })).toBe(0);
    expect(timeToKill("PULSE", WEAPONS.PULSE.damage * 2.5, { distance: 0, precision: false, scale: 1 })).toBeCloseTo(WEAPONS.PULSE.burstGap * 2, 6);
    expect(timeToKill("PULSE", WEAPONS.PULSE.damage * 3.5, { distance: 0, precision: false, scale: 1 })).toBeCloseTo(WEAPONS.PULSE.fireRate, 6);
    // a target tougher than the magazine forces a reload
    const mag = WEAPONS.HEAVY.mag, per = WEAPONS.HEAVY.damage;
    expect(timeToKill("HEAVY", per * (mag + 0.5), { distance: 0, precision: false, scale: 1 })).toBeCloseTo(mag * WEAPONS.HEAVY.fireRate + WEAPONS.HEAVY.reload, 6);
    expect(shotsToKill("SHOTGUN", WEAPONS.SHOTGUN.damage * 8, { distance: 0, precision: false, scale: 1 })).toBe(8);
    expect(timeToKill("SHOTGUN", WEAPONS.SHOTGUN.damage * 8, { distance: 0, precision: false, scale: 1 })).toBe(0);
  });
});
