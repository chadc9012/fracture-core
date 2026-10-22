import { describe, expect, test } from "bun:test";
import { colorwayFor, recolorTexel, type RGB } from "./operator-colorway";
import { appearanceById, operatorByClass } from "./loadout";

describe("operator colorway", () => {
  test("an operator in their own signature colours is left exactly as authored", () => {
    for (const cls of ["TITAN", "HUNTER", "WARLOCK"] as const) expect(colorwayFor(cls, appearanceById(operatorByClass(cls).appearanceId))).toBeNull();
  });
  test("only the channel that changed is applied", () => {
    const preset = appearanceById(operatorByClass("HUNTER").appearanceId);
    const plateOnly = colorwayFor("HUNTER", { ...preset, armor: "#c8cdd2" })!;
    expect(plateOnly.plate).toBeGreaterThan(0); expect(plateOnly.glow).toBe(0);
    const glowOnly = colorwayFor("HUNTER", { ...preset, visor: "#5ad0ff" })!;
    expect(glowOnly.glow).toBeGreaterThan(0); expect(glowOnly.plate).toBe(0);
  });
  test("neutral plate takes the armor colour and keeps its shading; coloured strips take the accent hue and glow", () => {
    const w = colorwayFor("HUNTER", { armor: "#2060c0", visor: "#00ff66" })!;
    const dark: RGB = [0.2, 0.2, 0.2], light: RGB = [0.5, 0.5, 0.5];
    const d = recolorTexel(dark, w).color, li = recolorTexel(light, w).color;
    expect(d[2]).toBeGreaterThan(d[0]); // bluer
    expect(li[2]).toBeGreaterThan(d[2]); // shading kept
    const strip = recolorTexel([0.9, 0.2, 0.8], w);
    expect(strip.color[1]).toBeGreaterThan(strip.color[0]); // green now dominates the magenta strip
    expect(strip.glow).toBeGreaterThan(0.2);
    expect(recolorTexel(dark, w).glow).toBe(0); // plate never glows
  });
  test("near-white highlights are left alone; black stays darker than the armor colour", () => {
    const w = colorwayFor("TITAN", { armor: "#ff0000", visor: "#00ff00" })!;
    const white = recolorTexel([0.98, 0.98, 0.98], w).color;
    for (const v of white) expect(v).toBeCloseTo(0.98, 2);
    const black = recolorTexel([0.01, 0.01, 0.01], w).color;
    expect(Math.max(...black)).toBeLessThan(0.4);
    expect(black[0]).toBeGreaterThan(black[1]); // tinted toward the armor colour
  });
});
