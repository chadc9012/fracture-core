import { describe, expect, test } from "bun:test";
import { coreLook, easeOpen, petalTilt } from "./core-reveal";

describe("core reveal", () => {
  test("pod stays shut until the hack, opens with progress, fully at the reveal", () => {
    expect(coreLook("INFILTRATE", 0).open).toBe(0);
    expect(coreLook("COMBAT_1", 0).alarm).toBe(true);
    expect(coreLook("HACKING", 0.5).open).toBeGreaterThan(0);
    expect(coreLook("HACKING", 0.5).open).toBeLessThan(coreLook("REVEAL", 0).open);
    expect(coreLook("REVEAL", 0).beam).toBe(true);
    expect(coreLook("COMPLETE", 0).open).toBe(1);
  });
  test("opening eases and never overshoots", () => {
    let o = 0;
    for (let i = 0; i < 200; i++) { o = easeOpen(o, 1, 1 / 60); expect(o).toBeLessThanOrEqual(1); }
    expect(o).toBeGreaterThan(0.95);
    expect(petalTilt(0)).toBe(0);
  });
});
