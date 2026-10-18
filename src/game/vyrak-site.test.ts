import { describe, expect, test } from "bun:test";
import { REGIONS } from "./world";
import { recordClue } from "./encounter-journal";
import { SCENARIO_LAIRS } from "./waypoints";
import { VYRAK_CLUE_SITES, clueSiteWorld, lairRevealed, nearClueSite, nearHiddenLair, vyrakLair } from "./vyrak-site";

describe("finding Vyrak", () => {
  test("clue sites sit inside their regions and match real journal clues", () => {
    for (const s of VYRAK_CLUE_SITES) {
      const r = REGIONS.find((x) => x.id === s.regionId)!, w = clueSiteWorld(s);
      expect(Math.hypot(w.x - r.x, w.z - r.z)).toBeLessThan(r.radius);
      expect(nearClueSite(w.x, w.z)?.clueId).toBe(s.clueId);
    }
  });
  test("the lair is hidden until two clues discover it, and other lairs are unaffected", () => {
    const p0 = { earnedRewards: [] as string[] };
    expect(lairRevealed(p0, "vyrak")).toBe(false);
    expect(lairRevealed(p0, "dark-knight")).toBe(true);
    const one = recordClue(p0, "vyrak", "inscription").progression;
    expect(lairRevealed(one, "vyrak")).toBe(false);
    expect(lairRevealed(recordClue(one, "vyrak", "ember").progression, "vyrak")).toBe(true);
  });
  test("walking near the hidden lair is a third route; discovery is account-wide", () => {
    const l = vyrakLair()!;
    expect(nearHiddenLair(l.x + 30, l.z)).toBe(true); expect(nearHiddenLair(l.x + 200, l.z)).toBe(false);
    const viaSite = recordClue(recordClue({ earnedRewards: [] as string[] }, "vyrak", "site").progression, "vyrak", "ember").progression;
    expect(lairRevealed(viaSite, "vyrak")).toBe(true);
    expect(SCENARIO_LAIRS.some((x) => x.scenarioId === "vyrak")).toBe(true);
  });
  test("clue sites are far from the lair so they are found by exploring", () => {
    const l = vyrakLair()!;
    for (const s of VYRAK_CLUE_SITES) { const w = clueSiteWorld(s); expect(Math.hypot(w.x - l.x, w.z - l.z)).toBeGreaterThan(30); }
  });
});
