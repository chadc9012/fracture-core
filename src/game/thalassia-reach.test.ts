import { describe, expect, test } from "bun:test";
import { THALASSIA_CENTER } from "./thalassia-site";
import { CITY_RADIUS, airlockSite } from "./thalassia-sectors";
import { WORLD_RADIUS } from "./world";

/** Thalassia lies past the world disc; Scene exempts its city radius (+80 m approach) from the bounds clamp. These are the
 * geometric facts that exemption relies on: the exempt zone overlaps the disc, so you can swim in, and it covers the airlock. */
describe("Thalassia is reachable", () => {
  test("the exempt zone overlaps the world disc", () => {
    expect(Math.hypot(THALASSIA_CENTER.x, THALASSIA_CENTER.z) - (CITY_RADIUS + 80)).toBeLessThan(WORLD_RADIUS - 6);
  });
  test("the airlock is inside the exempt zone", () => {
    const a = airlockSite();
    expect(Math.hypot(a.x - THALASSIA_CENTER.x, a.z - THALASSIA_CENTER.z)).toBeLessThan(CITY_RADIUS + 80);
  });
});

import { REACTOR_REACH as RR } from "./thalassia-sectors";
import { THALASSIA_CENTER as TC } from "./thalassia-site";
import { reactorSite as rs } from "./thalassia-sectors";
test("the reactor trace is reachable from outside the central tower's 10 m footprint", () => {
  const r = rs();
  expect(Math.hypot(r.x - TC.x, r.z - TC.z) + 10 + 1).toBeLessThan(RR); // tower radius + player radius
});
