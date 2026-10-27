import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { BODY_TYPES, FACES } from "./operators";
import { DEFAULT_FACE, ROBOT_OPTICS, ROBOT_PLATING, SKIN_TONES, faceFor, faceLook, rookieBodyUrl, swatchOr } from "./operator-faces";

const pub = (url: string) => new URL(`../../public${url}`, import.meta.url);
const CLASSES = ["TITAN", "HUNTER", "WARLOCK"] as const;

describe("faces and bodies on disk", () => {
  test("every class has a headless body for every body type, and every face its head model and portrait", () => {
    for (const c of CLASSES) for (const b of BODY_TYPES) expect(existsSync(pub(rookieBodyUrl(c, b))), rookieBodyUrl(c, b)).toBe(true);
    for (const b of BODY_TYPES) for (const f of FACES[b]) { expect(existsSync(pub(f.url)), f.url).toBe(true); expect(existsSync(pub(f.thumb)), f.thumb).toBe(true); }
  });
  test("each class's default face per body exists on that body; human faces carry the skin luminance the tint needs", () => {
    for (const c of CLASSES) for (const b of BODY_TYPES) expect(FACES[b].some((f) => f.id === DEFAULT_FACE[c][b])).toBe(true);
    for (const b of ["female", "male"] as const) for (const f of FACES[b]) expect(f.skinLum).toBeGreaterThan(0.03);
  });
});

describe("look rules", () => {
  test("a face from another body type falls back to the class's own face for this body", () => {
    expect(faceFor("HUNTER", "female", "m-goliath")).toBe("f-nyx");
    expect(faceFor("TITAN", "male", "m-sage")).toBe("m-sage");
    expect(faceFor("WARLOCK", "robot", undefined)).toBe("r-mono");
  });
  test("swatches: unknown ids fall back; humans get a skin tone, robots plating and optics", () => {
    expect(swatchOr("skin", "nope")).toBe("natural"); expect(swatchOr("plating", "gold")).toBe("gold"); expect(swatchOr("optics", 3)).toBe("cyan");
    const human = faceLook("TITAN", "male", { face: "m-cipher", skin: "porcelain" });
    expect(human.headUrl).toContain("m-cipher"); expect(human.skin).toBe(SKIN_TONES.find((s) => s.id === "porcelain")!.hex); expect(human.plating).toBe("");
    expect(faceLook("TITAN", "male", {}).skin).toBe(""); // as modelled: no tint
    const bot = faceLook("HUNTER", "robot", { face: "r-slit", skin: "gold", eyes: "red" });
    expect(bot.plating).toBe(ROBOT_PLATING.find((s) => s.id === "gold")!.hex); expect(bot.optics).toBe(ROBOT_OPTICS.find((s) => s.id === "red")!.hex); expect(bot.skin).toBe("");
  });
});
