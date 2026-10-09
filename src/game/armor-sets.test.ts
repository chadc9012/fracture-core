// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { ARMOR_LEVEL_MAX, ARMOR_SETS, MAX_RESIST, SET_SLOTS, armorEffects, equipPiece, grantSetPiece, rollSetDrop, setPieceId, setStatuses } from "./armor-sets";
import { DEFAULT_PROGRESSION } from "./progression";

const wearAll = (setId: string, count: number, level = 1) => {
  let p = DEFAULT_PROGRESSION;
  SET_SLOTS.slice(0, count).forEach((slot) => {
    for (let i = 0; i < level; i++) p = grantSetPiece(p, { setId, slot })!.progress;
    p = equipPiece(p, setPieceId(setId, slot));
  });
  return p;
};

describe("armor set drops", () => {
  it("only drops for regions with a set and when the roll beats the tier chance", () => {
    expect(rollSetDrop("veridan", "BOSS", 0.99)).toBeNull();
    expect(rollSetDrop("nowhere", "BOSS", 0)).toBeNull();
    expect(rollSetDrop("veridan", "BOSS", 0)?.setId).toBe("verdant-warden");
  });
  it("covers every slot across the roll range", () => {
    const slots = new Set<string>();
    for (let r = 0; r < 0.6; r += 0.01) { const d = rollSetDrop("ember", "BOSS", r); if (d) slots.add(d.slot); }
    expect(slots.size).toBe(SET_SLOTS.length);
  });
});

describe("granting pieces", () => {
  it("adds new, upgrades duplicates, and stops at max level", () => {
    const drop = { setId: "dune-seeker", slot: "helmet" as const };
    let r = grantSetPiece(DEFAULT_PROGRESSION, drop)!;
    expect(r.result).toBe("NEW");
    r = grantSetPiece(r.progress, drop)!;
    expect(r.result).toBe("UPGRADED");
    expect(r.item.level).toBe(2);
    let p = r.progress;
    for (let i = 0; i < 20; i++) p = grantSetPiece(p, drop)!.progress;
    expect(grantSetPiece(p, drop)!.result).toBe("MAXED");
    expect(p.inventory.find((i) => i.id === setPieceId("dune-seeker", "helmet"))!.level).toBe(ARMOR_LEVEL_MAX);
  });
});

describe("set bonuses", () => {
  it("needs 2 pieces for the first bonus and 4 for the second", () => {
    const set = ARMOR_SETS[0]!;
    expect(setStatuses(wearAll(set.id, 1)).find((s) => s.set.id === set.id)!.twoActive).toBe(false);
    expect(setStatuses(wearAll(set.id, 2)).find((s) => s.set.id === set.id)!.twoActive).toBe(true);
    expect(setStatuses(wearAll(set.id, 4)).find((s) => s.set.id === set.id)!.fourActive).toBe(true);
  });
  it("scales with piece level and caps resist", () => {
    const set = ARMOR_SETS[3]!;
    const low = armorEffects(wearAll(set.id, 4, 1));
    const high = armorEffects(wearAll(set.id, 4, ARMOR_LEVEL_MAX));
    const sum = (e: typeof low) => e.resist + e.weaponDamage + e.moveSpeed + e.regen + e.slideBoost;
    expect(sum(high)).toBeGreaterThan(sum(low));
    expect(high.resist).toBeLessThanOrEqual(MAX_RESIST);
  });
  it("gives nothing with no gear", () => {
    expect(armorEffects(DEFAULT_PROGRESSION).resist).toBe(0);
  });
});
