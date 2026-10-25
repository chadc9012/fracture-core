import { describe, expect, test } from "bun:test";
import { bossCineFor, BOSS_CINE_CHAIN } from "./campaign-cine-triggers";
import { campaignCinematicById } from "./campaign-cinematics";
import { UNIQUE_SCENARIOS } from "./unique-scenarios";
describe("boss cinematic triggers", () => {
  test("every mapped cinematic exists and has dialogue", () => {
    for (const id of ["rime-alpha", "dark-knight"]) for (const m of ["intro", "defeat"] as const) {
      const c = campaignCinematicById(bossCineFor(id, m)!);
      expect(c).toBeTruthy();
      expect(c!.shots.some((s) => s.lines.length > 0)).toBe(true);
    }
  });
  test("mapped scenarios exist; unmapped ones play nothing", () => {
    const ids = UNIQUE_SCENARIOS.map((s) => s.id);
    expect(ids).toContain("rime-alpha"); expect(ids).toContain("dark-knight");
    expect(bossCineFor("vaelith", "intro")).toBeNull();
  });
  test("chain targets exist and never loop", () => {
    for (const [a, b] of Object.entries(BOSS_CINE_CHAIN)) { expect(campaignCinematicById(a)).toBeTruthy(); expect(campaignCinematicById(b)).toBeTruthy(); expect(BOSS_CINE_CHAIN[b]).not.toBe(a); }
  });
});
