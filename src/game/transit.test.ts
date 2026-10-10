import { describe, expect, test } from "bun:test";
import { TRANSIT_PLAN, TRANSIT_PLAN_REDUCED, swapAt, totalSeconds, transitFrame, transitPlan } from "./transit";
import { CITY_DESTINATIONS, dropPoint } from "./destinations";

describe("transit timeline", () => {
  for (const [name, plan] of [["full", TRANSIT_PLAN], ["reduced", TRANSIT_PLAN_REDUCED]] as const) {
    test(`${name}: the world is fully covered at the swap and for the whole settle`, () => {
      const s = swapAt(plan);
      expect(transitFrame(s, plan).cover).toBe(1);
      expect(transitFrame(s - 0.001, plan).swapped).toBe(false);
      expect(transitFrame(s, plan).swapped).toBe(true);
      expect(transitFrame(plan.charge + plan.warp + plan.settle - 0.01, plan).cover).toBe(1);
    });
    test(`${name}: starts clear, ends clear and done`, () => {
      expect(transitFrame(0, plan).cover).toBe(0);
      const end = totalSeconds(plan);
      expect(transitFrame(end, plan).phase).toBe("done");
      expect(transitFrame(end, plan).cover).toBe(0);
    });
    test(`${name}: cover never goes down before the swap`, () => {
      let last = 0;
      for (let t = 0; t <= swapAt(plan); t += 0.01) { const c = transitFrame(t, plan).cover; expect(c).toBeGreaterThanOrEqual(last - 1e-9); last = c; }
    });
  }
  test("reduced motion has no streaks or flash and is shorter", () => {
    expect(transitPlan(true)).toBe(TRANSIT_PLAN_REDUCED);
    for (let t = 0; t < totalSeconds(TRANSIT_PLAN_REDUCED); t += 0.02) { const f = transitFrame(t, TRANSIT_PLAN_REDUCED, true); expect(f.streak).toBe(0); expect(f.flash).toBe(0); }
    expect(totalSeconds(TRANSIT_PLAN_REDUCED)).toBeLessThan(totalSeconds(TRANSIT_PLAN));
  });
  test("full plan has streaks in the warp", () => {
    const peak = Math.max(...Array.from({ length: 60 }, (_, i) => transitFrame(TRANSIT_PLAN.charge + i * (TRANSIT_PLAN.warp / 60), TRANSIT_PLAN).streak));
    expect(peak).toBeGreaterThan(0.9);
  });
});

describe("city destinations", () => {
  test("Neon City is deployable, Thalassia is not and says why", () => {
    const neon = CITY_DESTINATIONS.find((c) => c.id === "neon-city")!, th = CITY_DESTINATIONS.find((c) => c.id === "thalassia")!;
    expect(neon.deployable).toBe(true);
    expect(th.deployable).toBe(false);
    expect(th.blockedReason).toBeTruthy();
    expect(dropPoint(neon).z).toBe(neon.z + 6);
  });
});
