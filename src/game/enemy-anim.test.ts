import { describe, expect, test } from "bun:test";
import { enemyClipWeights, strideRate } from "./enemy-anim";

const all = { idle: true, walk: true, run: true, shoot: true };
const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

describe("enemy clip weights", () => {
  test("standing = idle, walking = walk, sprinting = run; always sums to 1", () => {
    expect(enemyClipWeights({ speed: 0, aiming: false }, all).idle).toBe(1);
    expect(enemyClipWeights({ speed: 1.5, aiming: false }, all).walk).toBeGreaterThan(0.9);
    expect(enemyClipWeights({ speed: 8, aiming: false }, all).run).toBe(1);
    for (const s of [0, 0.5, 1, 2, 3, 5, 9]) for (const a of [false, true]) expect(sum(enemyClipWeights({ speed: s, aiming: a }, all))).toBeCloseTo(1, 6);
  });
  test("aiming on the move plays the walk-and-shoot clip; aiming in place stays in the combat idle", () => {
    expect(enemyClipWeights({ speed: 2, aiming: true }, all).shoot).toBe(1);
    expect(enemyClipWeights({ speed: 0, aiming: true }, all).idle).toBe(1);
  });
  test("missing clips fold into the ones that exist", () => {
    const w = enemyClipWeights({ speed: 0, aiming: true }, { walk: true });
    expect(w.walk).toBe(1);
    expect(sum(w)).toBeCloseTo(1, 6);
  });
  test("nonfinite speed never produces NaN clip weights", () => {
    for (const speed of [NaN, Infinity, -Infinity, -3]) {
      const weights = enemyClipWeights({ speed, aiming: false }, all);
      expect(Object.values(weights).every(Number.isFinite)).toBe(true);
      expect(sum(weights)).toBeCloseTo(1, 6);
      expect(Number.isFinite(strideRate(speed, "walk"))).toBe(true);
    }
  });
  test("single available shoot clip receives weight even while idle", () => {
    expect(enemyClipWeights({ speed: 0, aiming: false }, { shoot: true }).shoot).toBe(1);
  });
  test("stride rate is clamped", () => {
    expect(strideRate(0, "walk")).toBe(0.6);
    expect(strideRate(100, "run")).toBe(1.8);
  });
});
