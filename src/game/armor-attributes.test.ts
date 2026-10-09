// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { SET_SLOTS, makeSetPiece, type SetSlot } from "./armor-sets";
import { FLEX_BONUS, SOFT_CAP, hasFlexibility, loadoutAttributes, loadoutEffects, loadoutWarnings, pieceAttributes } from "./armor-attributes";
import type { GearItem } from "./inventory";
import { DEFAULT_PROGRESSION } from "./progression";

const wear = (items: GearItem[]) => ({
  inventory: items,
  equippedGear: Object.fromEntries(items.map((item) => [item.slot, item.id])),
});
const piece = (setId: string, slot: SetSlot, level = 1) => makeSetPiece(setId, slot, level)!;
const generic = (slot: SetSlot, power = 100, source = "Salvage"): GearItem => ({ id: `gen-${slot}-${source}`, name: slot, slot, power, level: 1, element: "KINETIC", source });

describe("piece attributes follow the slot role", () => {
  it("helmet leans intellect, chest defense, legs mobility", () => {
    const h = pieceAttributes({ slot: "helmet", power: 100 });
    const c = pieceAttributes({ slot: "chest", power: 100 });
    const l = pieceAttributes({ slot: "legs", power: 100 });
    expect(h.intellect).toBeGreaterThan(h.defense);
    expect(c.defense).toBeGreaterThan(c.intellect);
    expect(l.mobility).toBeGreaterThan(l.defense);
  });
  it("set tilt changes the lean and higher power means more", () => {
    expect(pieceAttributes({ slot: "chest", power: 100, setId: "frostwrought-aegis" }).defense).toBeGreaterThan(pieceAttributes({ slot: "chest", power: 100, setId: "dune-seeker" }).defense);
    expect(pieceAttributes({ slot: "chest", power: 200 }).defense).toBeGreaterThan(pieceAttributes({ slot: "chest", power: 100 }).defense);
  });
  it("non-armor gear has no attributes", () => {
    expect(pieceAttributes({ slot: "primary", power: 500 })).toEqual({ intellect: 0, mobility: 0, defense: 0 });
  });
});

describe("loadout rules keep any stat from dominating", () => {
  it("applies diminishing returns past the soft cap", () => {
    const heavy = wear(SET_SLOTS.map((slot) => generic(slot, 400)));
    const { raw, effective } = loadoutAttributes(heavy);
    const top = (["intellect", "mobility", "defense"] as const).find((a) => raw[a] > SOFT_CAP)!;
    expect(effective[top]).toBeLessThan(raw[top]);
  });
  it("heavy defense costs mobility; heavy intellect costs defense", () => {
    const tank = loadoutAttributes(wear([generic("chest", 500), generic("legs", 100)]));
    expect(tank.effective.mobility).toBeLessThan(tank.raw.mobility);
    const smart = loadoutAttributes(wear([generic("helmet", 800), generic("chest", 100)]));
    expect(smart.effective.defense).toBeLessThan(smart.raw.defense);
  });
  it("resistance stays capped at 50% even stacked with set bonuses", () => {
    const frost = wear(SET_SLOTS.map((slot) => piece("frostwrought-aegis", slot, 10)));
    expect(loadoutEffects(frost).resist).toBeLessThanOrEqual(0.5);
  });
});

describe("mixed gear is viable", () => {
  const mixed = wear([piece("dune-seeker", "legs", 5), piece("cinder-vanguard", "chest", 5), piece("verdant-warden", "helmet", 5), generic("gauntlets", 120, "Salvage")]);
  it("earns a flexibility bonus with no set bonus active", () => {
    expect(hasFlexibility(mixed)).toBe(true);
    const withFlex = loadoutEffects(mixed);
    expect(withFlex.abilityRecharge).toBeGreaterThan(FLEX_BONUS.abilityRecharge!);
  });
  it("loses it when a matching set bonus is live, or too few pieces are worn", () => {
    expect(hasFlexibility(wear(SET_SLOTS.map((slot) => piece("dune-seeker", slot))))).toBe(false);
    expect(hasFlexibility(wear([piece("dune-seeker", "legs"), piece("cinder-vanguard", "chest")]))).toBe(false);
  });
  it("a mix can out-move a matching set (the Ghost Runner build)", () => {
    const fullFrost = loadoutEffects(wear(SET_SLOTS.map((slot) => piece("frostwrought-aegis", slot, 5))));
    const runner = loadoutEffects(wear([piece("dune-seeker", "legs", 5), piece("dune-seeker", "gauntlets", 5), piece("mire-stalker", "helmet", 5), piece("verdant-warden", "chest", 5)]));
    expect(runner.moveSpeed).toBeGreaterThan(fullFrost.moveSpeed);
  });
});

describe("warnings are soft", () => {
  it("flags empty slots and fragile builds without blocking", () => {
    expect(loadoutWarnings(DEFAULT_PROGRESSION).length).toBeGreaterThanOrEqual(0);
    const fragile = wear([generic("helmet", 30), generic("legs", 30), generic("gauntlets", 30)]);
    const warnings = loadoutWarnings(fragile);
    expect(warnings.some((w) => w.startsWith("Fragile"))).toBe(true);
    expect(warnings.some((w) => w.includes("empty"))).toBe(true);
  });
});
