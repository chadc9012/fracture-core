import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/** Regression for the "big white circle in the sky": the dome sphere is larger than the camera far plane, so its
 * vertex shader must pin depth to the far plane (`.xyww`); otherwise everything within acos(far / radius) of the
 * view axis is clipped away and the canvas background colour shows through as a disc. */
describe("sky dome far-plane clipping", () => {
  const dome = readFileSync("src/components/game/SkyDome.tsx", "utf8");
  const canvas = readFileSync("src/components/game/GameCanvas.tsx", "utf8");
  const radius = Number(/sphereGeometry args=\{\[(\d+)/.exec(dome.slice(dome.indexOf("renderOrder={-5}")))?.[1]);
  const far = Number(/far:\s*(\d+)/.exec(canvas)?.[1]);

  test("the dome is bigger than the camera far plane (so pinning is required)", () => {
    expect(radius).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(0);
    expect(radius).toBeGreaterThan(far);
  });
  test("the vertex shader pins depth to the far plane", () => {
    expect(dome).toContain("gl_Position = p.xyww");
  });
  test("the clipped cone would have been about 53 degrees", () => {
    expect((Math.acos(far / radius) * 180) / Math.PI).toBeGreaterThan(50);
  });
});
