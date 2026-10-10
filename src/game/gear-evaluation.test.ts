import { describe, expect, test } from "bun:test";
import { evaluateGear, gearScore, gradeOf, VERDICT_MARGIN } from "./gear-evaluation";
import { DEFAULT_PROGRESSION } from "./progression";
import type { GearItem } from "./inventory";

const base = DEFAULT_PROGRESSION;
const item = (over: Partial<GearItem>): GearItem => ({ ...(base.inventory[0] as GearItem), ...over });

describe("gear evaluation", () => {
  test("grade bands are monotonic and cover every score", () => {
    expect(gradeOf(0)).toBe("D"); expect(gradeOf(80)).toBe("C"); expect(gradeOf(100)).toBe("B"); expect(gradeOf(125)).toBe("A"); expect(gradeOf(999)).toBe("S");
  });
  test("score adds the documented bonuses", () => {
    const g = item({ power: 100, setId: undefined, perk: undefined, rarity: undefined });
    expect(gearScore(g)).toBe(100);
    expect(gearScore({ ...g, perk: "x" } as GearItem)).toBe(110);
  });
  test("an equipped item reports EQUIPPED with no deltas", () => {
    const worn = base.inventory.find((g) => base.equippedGear[g.slot] === g.id)!;
    expect(worn).toBeDefined();
    const ev = evaluateGear(base, worn);
    expect(ev.verdict).toBe("EQUIPPED"); expect(ev.powerDelta).toBe(0);
  });
  test("a clearly stronger item in a worn slot is an UPGRADE and a clearly weaker one a DOWNGRADE", () => {
    const worn = base.inventory.find((g) => base.equippedGear[g.slot] === g.id && g.slot === "primary")!;
    expect(worn).toBeDefined();
    const up = evaluateGear(base, { ...worn, id: "test-up", power: worn.power + 40 });
    const down = evaluateGear(base, { ...worn, id: "test-down", power: Math.max(0, worn.power - 40) });
    expect(up.powerDelta).toBe(40); expect(up.verdict).toBe("UPGRADE");
    expect(down.powerDelta).toBe(-Math.min(40, worn.power)); expect(worn.power >= 45 ? down.verdict : "DOWNGRADE").toBe("DOWNGRADE");
    expect(VERDICT_MARGIN).toBeGreaterThan(0);
  });
});
