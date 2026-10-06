// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { windStrength } from "./wind";

describe("windStrength", () => {
  it("rises with wind and stays bounded", () => {
    expect(windStrength(14)).toBeGreaterThan(windStrength(2));
    expect(windStrength(1)).toBeGreaterThanOrEqual(0.15);
    expect(windStrength(500)).toBeLessThanOrEqual(1.4);
    expect(windStrength(-3)).toBeGreaterThanOrEqual(0.15);
  });
});
