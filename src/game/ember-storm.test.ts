import { describe, expect, test } from "bun:test";
import { EMBER_STORM, boltPath, emberStrike, stormLevel } from "./ember-storm";

describe("Ember lightning storm", () => {
  test("no lightning by day; it builds through dusk to full at night", () => {
    expect(stormLevel(0)).toBe(0); expect(stormLevel(1)).toBe(1);
    let any = false; for (let t = 0; t < 200; t += 0.05) if (emberStrike(t, 0).on) any = true;
    expect(any).toBe(false);
  });
  test("at night bolts strike every few seconds, each a short flash", () => {
    let strikes = 0, last = -1;
    for (let t = 0; t < 120; t += 0.02) { const s = emberStrike(t, 1); if (s.on && s.seed !== last) { strikes++; last = s.seed; } if (s.on) expect(s.k).toBeLessThanOrEqual(1); }
    expect(strikes).toBeGreaterThan(8); expect(strikes).toBeLessThanOrEqual(Math.ceil(120 / EMBER_STORM.period));
  });
  test("a bolt runs from the cloud base down to its ground point, with forks", () => {
    const b = boltPath(7, 100, 40, -50);
    expect(b.main[0]![1]).toBe(EMBER_STORM.cloudY);
    expect(b.main.at(-1)).toEqual([100, 40, -50]);
    expect(b.forks.length).toBe(2);
    expect(boltPath(7, 100, 40, -50)).toEqual(b);
  });
});
