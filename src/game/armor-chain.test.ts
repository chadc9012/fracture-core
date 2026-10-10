// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, test } from "bun:test";
import { loadoutAttributes, loadoutEffects } from "./armor-attributes";
import { armorSummary, setSlotPiece } from "./deployment/forgeState";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "./progression";
import type { GearItem } from "./inventory";

const piece = (id: string, slot: "helmet" | "chest" | "legs", power: number, setId?: string): GearItem =>
  ({ id, name: id, slot, power, level: 1, element: "KINETIC", source: "test", ...(setId ? { setId } : {}) });

/** Equipping armor must move the same numbers on every surface: forge summary, inventory evaluation and combat effects. */
describe("armor to stats to combat uses one path", () => {
  const heavy = piece("heavy-chest", "chest", 160);
  const base: PlayerProgression = { ...DEFAULT_PROGRESSION, inventory: [...DEFAULT_PROGRESSION.inventory, heavy] };

  test("forge summary stats equal loadoutAttributes for any equipped mix", () => {
    const swapped = setSlotPiece(base, "chest", "heavy-chest");
    expect(armorSummary(swapped).stats).toEqual(loadoutAttributes(swapped).effective);
    expect(armorSummary(base).stats).toEqual(loadoutAttributes(base).effective);
  });

  test("a stronger chest piece changes the attributes and never lowers combat resistance", () => {
    const swapped = setSlotPiece(base, "chest", "heavy-chest");
    expect(swapped.equippedGear.chest).toBe("heavy-chest");
    expect(loadoutAttributes(swapped).raw.defense).toBeGreaterThan(loadoutAttributes(base).raw.defense);
    expect(loadoutEffects(swapped).resist).toBeGreaterThanOrEqual(loadoutEffects(base).resist);
  });

  test("removing every piece zeroes attributes and effects", () => {
    let bare = base;
    for (const slot of ["helmet", "chest", "legs"] as const) bare = setSlotPiece(bare, slot, null);
    expect(loadoutAttributes(bare).worn).toBe(0);
    expect(loadoutEffects(bare).resist).toBe(0);
  });

  test("resistance never exceeds the 50% cap", () => {
    expect(loadoutEffects(base).resist).toBeLessThanOrEqual(0.5);
  });
});
