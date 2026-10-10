import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cloudPuffs, puffFarthestReach, CLOUD_REACH_LIMIT, CLOUD_COUNT } from "./cloud-layout";

/** Regression for the blocky rectangular sky patches seen in iso:sky comparisons: puffs past the camera far plane are clipped to straight edges. */
describe("cloud layout", () => {
  const far = Number(/far:\s*(\d+)/.exec(readFileSync("src/components/game/GameCanvas.tsx", "utf8"))?.[1]);
  const puffs = cloudPuffs();
  test("the camera far plane was found", () => { expect(far).toBeGreaterThan(0); });
  test("every puff, even fully grown, stays inside the far plane (no clipped straight edges)", () => {
    expect(puffs.length).toBe(CLOUD_COUNT);
    for (const p of puffs) expect(puffFarthestReach(p, 1)).toBeLessThan(far * CLOUD_REACH_LIMIT);
  });
  test("apparent size is preserved: scale / radius matches the previous layout", () => {
    // previous layout: r 900..2300, scale 220..560 from the same seed; ratio scale/r must be identical
    let s = 4471; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (const p of puffs) { rnd(); const oldR = 900 + rnd() * 1400; rnd(); const oldScale = 220 + rnd() * 340; rnd(); rnd(); rnd(); expect(p.scale / p.r).toBeCloseTo(oldScale / oldR, 6); }
  });
  test("deterministic", () => { expect(cloudPuffs()).toEqual(cloudPuffs()); });
});
