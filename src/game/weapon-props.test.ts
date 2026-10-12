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
      expect(propLength(id)).toBeGreaterThan(id === "SIDEARM" ? 0.2 : 0.3); // a hand cannon is short
      expect(propLength(id)).toBeLessThan(1.6);
    }
  });
  test("launchers read bigger than the auto rifle, and attach to the hand bone", () => {
    expect(propLength("ROCKET")).toBeGreaterThan(propLength("AUTO") * 0.9);
    expect(HAND_BONE).toBe("mixamorig:RightHand");
  });
  test("rifles carry stock, magazine, optic and side-rail detail", () => {
    const parts = WEAPON_PROPS.AUTO;
    expect(parts.length).toBeGreaterThanOrEqual(10);
    expect(parts.some((p) => p.shape === "cylinder" && p.rot?.[0] === Math.PI / 2)).toBe(true);
    expect(parts.filter((p) => p.tone === "trim").length).toBeGreaterThan(2);
  });
  test("weapon silhouettes remain distinct across primary, heavy, blade and launcher classes", () => {
    expect(WEAPON_PROPS.HEAVY.length).toBeGreaterThan(WEAPON_PROPS.AUTO.length);
    expect(WEAPON_PROPS.SWORD.some((p) => p.shape === "box" && p.size[2] > 0.8)).toBe(true);
    expect(WEAPON_PROPS.FROSTBITE.some((p) => p.shape === "sphere")).toBe(true);
    expect(WEAPON_PROPS.ROCKET.some((p) => p.shape === "cylinder")).toBe(true);
  });
});
