// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { createReticle, markHit, stepReticle, type ReticleInput } from "./crosshair";

const base: ReticleInput = { motion: "IDLE", bloom: 0, aiming: false, lookRight: 0, lookUp: 0 };
const settle = (s: ReturnType<typeof createReticle>, i: ReticleInput) => { let v = stepReticle(s, i, 0.016); for (let n = 0; n < 120; n++) v = stepReticle(s, i, 0.016); return v; };

describe("reticle", () => {
  it("opens with sprint and firing bloom, tightens when aiming", () => {
    const idle = settle(createReticle(), base).gap;
    const sprint = settle(createReticle(), { ...base, motion: "SPRINT" }).gap;
    const fired = settle(createReticle(), { ...base, bloom: 1 }).gap;
    const ads = settle(createReticle(), { ...base, aiming: true }).gap;
    expect(sprint).toBeGreaterThan(idle);
    expect(fired).toBeGreaterThan(sprint);
    expect(ads).toBeLessThan(idle);
  });
  it("barrel lags opposite the look direction and is clamped", () => {
    const v = settle(createReticle(), { ...base, lookRight: 3, lookUp: -3 });
    expect(v.barrelX).toBeLessThan(0);
    expect(v.barrelY).toBeLessThan(0);
    expect(Math.abs(settle(createReticle(), { ...base, lookRight: 500 }).barrelX)).toBeLessThanOrEqual(44.001);
  });
  it("recentres when the camera stops", () => {
    const s = createReticle();
    settle(s, { ...base, lookRight: 4 });
    expect(Math.abs(settle(s, base).barrelX)).toBeLessThan(0.1);
  });
  it("hit markers expire and kills outrank hits", () => {
    const s = createReticle();
    markHit(s, "KILL"); markHit(s, "HIT");
    expect(s.hit).toBe("KILL");
    expect(stepReticle(s, base, 0.1).hit).toBe("KILL");
    expect(stepReticle(s, base, 0.5).hit).toBe("NONE");
  });
});
