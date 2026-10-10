// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { skyFxAt } from "./sky-effects";

describe("signature sky effects", () => {
  it("ash falls over Ember and glows after dark", () => {
    expect(skyFxAt("ember", 0, "CLEAR", 0).density).toBeGreaterThan(0.5);
    expect(skyFxAt("ember", 1, "CLEAR", 0).glow).toBeGreaterThan(0.5);
  });
  it("Frostspire aurora only at night under clear skies", () => {
    expect(skyFxAt("frostspire", 0, "CLEAR", 0).aurora).toBe(0);
    expect(skyFxAt("frostspire", 1, "CLEAR", 0).aurora).toBe(1);
    expect(skyFxAt("frostspire", 1, "OVERCAST", 0.9).aurora).toBe(0);
  });
  it("no aurora outside Frostspire and nothing over unknown ground", () => {
    expect(skyFxAt("ember", 1, "CLEAR", 0).aurora).toBe(0);
    expect(skyFxAt(undefined, 1, "CLEAR", 0).density).toBe(0);
  });
  it("rain washes airborne particles out", () => {
    expect(skyFxAt("swamps", 0, "RAIN", 0).density).toBeLessThan(skyFxAt("swamps", 0, "CLEAR", 0).density);
  });
});
