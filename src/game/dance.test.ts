import { describe, expect, test } from "bun:test";
import { DANCE_VENUES, LEAD_IN, WINDOW, danceBest, danceSet, expire, finished, keyArrow, press, recordDance, result } from "./dance";

describe("dance floor", () => {
  test("tonight's set is the same for everyone and different tomorrow", () => {
    const a = danceSet("pulse-array", "2026-10-24"), b = danceSet("pulse-array", "2026-10-24"), c = danceSet("pulse-array", "2026-10-25");
    expect(a.map((x) => x.arrow).join()).toBe(b.map((x) => x.arrow).join());
    expect(a.map((x) => x.arrow).join()).not.toBe(c.map((x) => x.arrow).join());
    expect(a.length).toBe(DANCE_VENUES["pulse-array"]!.beats);
    expect(a[0]!.t).toBe(LEAD_IN);
    for (let i = 1; i < a.length; i++) expect(a[i]!.t).toBeGreaterThan(a[i - 1]!.t);
  });
  test("timing windows: perfect, good, too early does nothing", () => {
    const s = danceSet("afterglow", "d");
    expect(press(s, s[0]!.arrow, s[0]!.t - 0.5)).toBeNull();
    expect(press(s, s[0]!.arrow, s[0]!.t + WINDOW.perfect / 2)).toBe("perfect");
    expect(press(s, s[1]!.arrow, s[1]!.t + (WINDOW.perfect + WINDOW.good) / 2)).toBe("good");
  });
  test("unplayed beats expire as misses and the set finishes", () => {
    const s = danceSet("afterglow", "d");
    expire(s, 1e9);
    expect(finished(s)).toBe(true);
    expect(result(s)).toMatchObject({ score: 0, miss: s.length, grade: "D" });
  });
  test("a clean run grades S and scores the combo", () => {
    const s = danceSet("pulse-array", "x");
    for (const b of s) press(s, b.arrow, b.t);
    const r = result(s);
    expect(r.grade).toBe("S"); expect(r.bestCombo).toBe(s.length); expect(r.score).toBe(s.length * 300 + s.length * 20);
  });
  test("only a new best is saved, one key per venue", () => {
    let p = { earnedRewards: [] as string[] };
    p = recordDance(p, "afterglow", 3000);
    expect(recordDance(p, "afterglow", 2000)).toBe(p);
    p = recordDance(p, "afterglow", 5200);
    expect(danceBest(p, "afterglow")).toBe(5200);
    expect(p.earnedRewards.filter((k) => k.startsWith("venue-best:afterglow:")).length).toBe(1);
    expect(keyArrow("ArrowLeft")).toBe("left"); expect(keyArrow("KeyQ")).toBeNull();
  });
});
