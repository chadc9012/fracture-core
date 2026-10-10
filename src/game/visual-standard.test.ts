import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { SURFACES, conform, emissiveFor, fitScale, regionLook, SCALE } from "./visual-standard";
import { ASSET_INVENTORY } from "./asset-inventory";

describe("visual standard", () => {
  test("only bare metal is metallic", () => {
    for (const [k, p] of Object.entries(SURFACES)) if (k !== "bareMetal") expect(p.metalness).toBeLessThanOrEqual(0.2);
    expect(conform("paintedArmor", { metalness: 0.85 }).metalness).toBe(0.2);
  });
  test("glow is capped", () => {
    expect(emissiveFor("paintedArmor", 5, false)).toBe(0.6);
    expect(emissiveFor("energy", 5, true)).toBe(1.4);
  });
  test("operator fits its reference height", () => expect(fitScale(3.7, SCALE.operator)).toBeCloseTo(0.5, 2));
  test("unknown region falls back to nexus", () => expect(regionLook("nowhere").accent).toBe("#58e6ff"));
  test("every inventoried model file exists", () => {
    for (const a of ASSET_INVENTORY) if (a.url) expect(existsSync(`public${a.url}`)).toBe(true);
  });
});
