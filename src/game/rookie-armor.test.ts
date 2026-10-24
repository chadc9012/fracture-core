import { describe, expect, test } from "bun:test";
import { OPERATORS } from "./loadout";
import { ROOKIE_SETS, applyVariant, currentVariant, rookieSetForClass, rookieStartColors } from "./rookie-armor";
import { defaultAppearance, forgeInitial } from "./deployment/forgeState";

describe("rookie armor", () => {
  test("every operator has a Common rookie set with three colour variations", () => {
    for (const op of OPERATORS) {
      const set = rookieSetForClass(op.classId);
      expect(set.operator).toBe(op.id); expect(set.tier).toBe("COMMON"); expect(set.variants.length).toBe(3);
      expect(set.variants[0]!.id).toBe("standard");
    }
    expect([ROOKIE_SETS.goliath.name, ROOKIE_SETS.nyx.name, ROOKIE_SETS.cipher.name]).toEqual(["Rookie Bulwark", "Rookie Shadow", "Rookie Arcanist"]);
  });
  test("a new operator starts in the Standard rookie colours; a variant swaps the colours and keeps the callsign", () => {
    const a = defaultAppearance("WARLOCK");
    expect(currentVariant(ROOKIE_SETS.cipher, a)?.id).toBe("standard");
    const v = applyVariant(a, ROOKIE_SETS.cipher.variants[2]!);
    expect(v.callsign).toBe(a.callsign); expect(currentVariant(ROOKIE_SETS.cipher, v)?.id).toBe("void");
    expect(currentVariant(ROOKIE_SETS.cipher, { ...v, armor: "#123456" })).toBeNull();
    expect(rookieStartColors("nyx").visor).toBe(ROOKIE_SETS.nyx.variants[0]!.visor);
  });
  test("an existing save keeps its own colours (nothing is overwritten)", () => {
    const saved = { classId: "HUNTER" as const, appearance: { armor: "#2a3442", cloth: "#14181f", visor: "#38e8ff", trim: "#ff6a3d", callsign: "NYX" } };
    expect(forgeInitial(saved).appearance.armor).toBe("#2a3442");
  });
});
