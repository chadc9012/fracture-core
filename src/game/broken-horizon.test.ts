import { expect, test } from "bun:test";
import { brokenHorizon, HORIZON_MAX_REACH } from "./broken-horizon";
import { SKY_BODY } from "./sky-dome";

test("broken horizon: deterministic, inside the far plane, airborne, clear of the Fracture Moon, one inverted city", () => {
  const a = brokenHorizon(), b = brokenHorizon();
  expect(a).toEqual(b);
  expect(a.filter((i) => i.inverted).length).toBe(1);
  const moon = Math.atan2(SKY_BODY.dir[2], SKY_BODY.dir[0]);
  for (const i of a) {
    expect(Math.hypot(i.x, i.y, i.z) + i.r).toBeLessThan(HORIZON_MAX_REACH);
    expect(i.y - i.depth).toBeGreaterThan(-60); // the rock's tip stays above the horizon line, so islands float rather than sink into hills
    const d = Math.atan2(Math.sin(Math.atan2(i.z, i.x) - moon), Math.cos(Math.atan2(i.z, i.x) - moon));
    expect(Math.abs(d)).toBeGreaterThan(0.5);
  }
});
