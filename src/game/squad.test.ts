import { describe, expect, test } from "bun:test";
import { BOSS_FLOOR, ENGAGE_RANGE, createSquad, formationSlot, pickTarget, squadDamage, stepSquad, type SquadTarget } from "./squad";

const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const run = (targets: SquadTarget[], heat: number, steps = 200) => {
  const sq = createSquad(0, 0);
  let dealt = 0;
  for (let i = 0; i < steps; i++) for (const h of stepSquad(sq, targets, { px: 0, pz: 0, yaw: 0, dt: 0.05, heat, inVehicle: false, rand })) { dealt += h.damage; targets[h.index]!.hp -= h.damage; }
  return { sq, dealt };
};

describe("squad", () => {
  test("formation sits behind the player in their facing frame", () => {
    const a = formationSlot(0, 0, 0, 0);
    expect(a.z).toBeLessThan(0);
    const b = formationSlot(0, 0, 0, Math.PI);
    expect(b.z).toBeGreaterThan(0);
  });
  test("mates follow and snap back when left far behind", () => {
    const sq = createSquad(0, 0);
    stepSquad(sq, [], { px: 500, pz: 0, yaw: 0, dt: 0.05, heat: 0, inVehicle: false, rand });
    for (const m of sq.mates) expect(Math.hypot(m.x - 500, m.z)).toBeLessThan(6);
  });
  test("no fire unless the player is fighting", () => {
    const t: SquadTarget[] = [{ x: 0, z: 12, alive: true, boss: false, hp: 100 }];
    expect(run(t, 0).dealt).toBe(0);
    expect(run([{ ...t[0]! }], 5).dealt).toBeGreaterThan(0);
  });
  test("only enemies near the player, never decoys", () => {
    expect(pickTarget([{ x: 0, z: ENGAGE_RANGE + 5, alive: true, boss: false, hp: 3 }], 0, 0, 0, 0)).toBe(-1);
    expect(pickTarget([{ x: 0, z: 5, alive: true, boss: false, hp: 3, decoy: true }], 0, 0, 0, 0)).toBe(-1);
  });
  test("squad can never take a boss below the floor", () => {
    const boss: SquadTarget = { x: 0, z: 10, alive: true, boss: true, hp: 28, maxHp: 28 };
    run([boss], 50, 3000);
    expect(boss.hp).toBeGreaterThanOrEqual(28 * BOSS_FLOOR - 1e-9);
    expect(squadDamage({ ...boss, hp: 28 * BOSS_FLOOR }, 5)).toBe(0);
  });
  test("support-sized damage: well under the player's rifle", () => {
    const { dealt } = run([{ x: 0, z: 12, alive: true, boss: false, hp: 1e6 }], 50, 200); // 10 s
    expect(dealt / 10).toBeLessThan(5);
    expect(dealt / 10).toBeGreaterThan(0.5);
  });
  test("disabled squad does nothing", () => {
    const sq = createSquad(0, 0, false);
    expect(stepSquad(sq, [{ x: 0, z: 5, alive: true, boss: false, hp: 3 }], { px: 0, pz: 0, yaw: 0, dt: 0.1, heat: 9, inVehicle: false, rand })).toEqual([]);
  });
});
