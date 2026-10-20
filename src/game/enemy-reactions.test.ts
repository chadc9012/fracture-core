import { describe, expect, test } from "bun:test";
import { DURATION, STAGGER_IMMUNITY, isStaggeredNow, reactTo, recoilAt } from "./enemy-reactions";

const hit = (damage: number, now: number, prev?: ReturnType<typeof reactTo>, o: { elite?: boolean; boss?: boolean } = {}) => reactTo(prev, { damage, maxHp: 10, elite: !!o.elite, boss: !!o.boss, now, dx: 0, dz: 1 });

describe("enemy hit reactions", () => {
  test("a small hit flinches, a big one staggers; elites need more; bosses never stagger", () => {
    expect(hit(1, 0)?.kind).toBe("flinch");
    expect(hit(3, 0)?.kind).toBe("stagger");
    expect(hit(3, 0, undefined, { elite: true })?.kind).toBe("flinch");
    expect(hit(9, 0, undefined, { boss: true })?.kind).toBe("flinch");
  });
  test("a stagger lasts its duration, a flinch never cuts it short, and it can't chain into a stun-lock", () => {
    const s = hit(5, 0)!;
    expect(isStaggeredNow(s, DURATION.stagger * 0.5)).toBe(true);
    expect(hit(1, 0.1, s)).toBe(s);
    expect(isStaggeredNow(s, DURATION.stagger + 0.01)).toBe(false);
    expect(hit(5, DURATION.stagger + 0.2, s)?.kind).toBe("flinch");
    expect(hit(5, DURATION.stagger + STAGGER_IMMUNITY + 0.05, s)?.kind).toBe("stagger");
  });
  test("recoil eases from full to nothing; bad input is ignored", () => {
    const s = hit(5, 0)!;
    expect(recoilAt(s, 0)).toBeCloseTo(1);
    expect(recoilAt(s, DURATION.stagger)).toBe(0);
    expect(recoilAt(s, 0.2)).toBeLessThan(recoilAt(s, 0.05));
    expect(hit(Number.NaN, 0)).toBeUndefined();
    expect(reactTo(undefined, { damage: 1, maxHp: 0, elite: false, boss: false, now: 0, dx: 0, dz: 0 })).toBeUndefined();
  });
});
