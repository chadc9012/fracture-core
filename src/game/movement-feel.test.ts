// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { createStride, stepStride, strideHz, RUN_SPEED } from "./movement-feel";

const run = (speed: number, seconds: number, grounded = true) => {
  const s = createStride();
  let v = stepStride(s, { speed, grounded, sliding: false, vy: 0, dt: 0.016 }, 0);
  const ys: number[] = [];
  for (let t = 0; t < seconds; t += 0.016) { v = stepStride(s, { speed, grounded, sliding: false, vy: 0, dt: 0.016 }, 0); ys.push(v.bobY); }
  return { s, v, ys };
};

describe("stride", () => {
  it("stays still when standing and bobs when moving", () => {
    const idle = run(0, 1);
    expect(Math.max(...idle.ys.map(Math.abs))).toBeLessThan(0.001);
    const walk = run(27, 2);
    expect(Math.max(...walk.ys) - Math.min(...walk.ys)).toBeGreaterThan(0.02);
  });
  it("runs faster and harder than it walks", () => {
    expect(strideHz(RUN_SPEED)).toBeGreaterThan(strideHz(27));
    expect(run(RUN_SPEED, 2).v.swing).toBeGreaterThan(run(27, 2).v.swing);
    expect(run(RUN_SPEED, 2).s.phase).toBeGreaterThan(run(27, 2).s.phase);
  });
  it("dips the camera on a hard landing then recovers", () => {
    const s = createStride();
    stepStride(s, { speed: 0, grounded: false, sliding: false, vy: -20, dt: 0.016 }, 0);
    const hit = stepStride(s, { speed: 0, grounded: true, sliding: false, vy: -20, dt: 0.016 }, 0);
    expect(hit.bobY).toBeLessThan(-0.1);
    let v = hit;
    for (let i = 0; i < 90; i++) v = stepStride(s, { speed: 0, grounded: true, sliding: false, vy: 0, dt: 0.016 }, 0);
    expect(Math.abs(v.bobY)).toBeLessThan(0.01);
  });
  it("rolls into a strafe", () => {
    const s = createStride();
    expect(stepStride(s, { speed: 40, grounded: true, sliding: false, vy: 0, dt: 0.016 }, 1).roll).toBeLessThan(0);
  });
});
