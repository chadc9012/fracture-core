import { describe, expect, test } from "bun:test";
import { HAND_BONE, WEAPON_PROPS, propLength } from "./weapon-props";
import { WEAPON_ORDER } from "./weapons";

describe("held weapon props", () => {
  test("every weapon has a visible prop with sane part sizes and an accent", () => {
    for (const id of WEAPON_ORDER) {
      const parts = WEAPON_PROPS[id];
      expect(parts.length).toBeGreaterThan(2);
      expect(parts.some((p) => p.tone === "accent")).toBe(true);
      for (const p of parts) for (const v of p.size) { expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(1.2); }
      expect(propLength(id)).toBeGreaterThan(0.3);
      expect(propLength(id)).toBeLessThan(1.6);
    }
  });
  test("launchers read bigger than the auto rifle, and attach to the hand bone", () => {
    expect(propLength("ROCKET")).toBeGreaterThan(propLength("AUTO") * 0.9);
    expect(HAND_BONE).toBe("mixamorig:RightHand");
  });
});
