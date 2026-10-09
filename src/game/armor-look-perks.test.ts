// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { ARMOR_SETS, SET_SLOTS, makeSetPiece } from "./armor-sets";
import { ARMOR_PERKS, perkEffects, perkScale, wornPerks } from "./armor-perks";
import { BODY_FIT, SET_MOTIFS, armorLook, fitFor } from "./armor-look";
import { loadoutEffects } from "./armor-attributes";
import { BODY_TYPES } from "./operators";

const wearPieces = (pieces: ReturnType<typeof makeSetPiece>[]) => {
  const items = pieces.filter((x): x is NonNullable<typeof x> => !!x);
  return { inventory: items, equippedGear: Object.fromEntries(items.map((i) => [i.slot, i.id])) };
};

describe("per-piece perks", () => {
  it("every set has a perk for every slot, all uniquely named", () => {
    const names = new Set<string>();
    for (const set of ARMOR_SETS) for (const slot of SET_SLOTS) {
      const perk = ARMOR_PERKS[set.id]?.[slot];
      expect(perk).toBeTruthy();
      expect(Object.keys(perk!.effects).length).toBeGreaterThan(0);
      names.add(perk!.name);
    }
    expect(names.size).toBe(ARMOR_SETS.length * SET_SLOTS.length);
  });
  it("a single piece's perk works without the rest of the set", () => {
    const one = wearPieces([makeSetPiece("cinder-vanguard", "gauntlets", 1)]);
    expect(perkEffects(one).weaponDamage).toBeCloseTo(0.05);
    expect(wornPerks(one)).toHaveLength(1);
  });
  it("perks scale with level and stack with set bonuses", () => {
    const lv10 = wearPieces([makeSetPiece("cinder-vanguard", "gauntlets", 10)]);
    expect(perkEffects(lv10).weaponDamage).toBeCloseTo(0.05 * perkScale(10));
    const full = wearPieces(SET_SLOTS.map((s) => makeSetPiece("cinder-vanguard", s, 1)));
    const perksOnly = perkEffects(full).weaponDamage;
    expect(loadoutEffects(full).weaponDamage).toBeGreaterThan(perksOnly);
  });
  it("non-set gear has no perk", () => {
    const generic = { inventory: [{ id: "g", name: "g", slot: "helmet" as const, power: 100, level: 1, element: "KINETIC" as const, source: "x" }], equippedGear: { helmet: "g" } };
    expect(wornPerks(generic)).toHaveLength(0);
  });
});

describe("look and body fit", () => {
  it("every set has a motif per slot and the worn look uses the set color", () => {
    for (const set of ARMOR_SETS) for (const slot of SET_SLOTS) expect(SET_MOTIFS[set.id]?.[slot]).toBeTruthy();
    const look = armorLook(wearPieces([makeSetPiece("dune-seeker", "helmet", 1)]));
    expect(look.helmet?.color).toBe(ARMOR_SETS.find((s) => s.id === "dune-seeker")!.color);
    expect(look.chest).toBeUndefined();
  });
  it("each body has fit for every slot; female is narrower than male, robot deeper", () => {
    for (const body of BODY_TYPES) for (const slot of SET_SLOTS) expect(BODY_FIT[body][slot]).toBeTruthy();
    expect(fitFor("female", "chest").w).toBeLessThan(fitFor("male", "chest").w);
    expect(fitFor("robot", "chest").d).toBeGreaterThan(fitFor("male", "chest").d);
  });
});
