import { describe, expect, test } from "bun:test";
import { UNIQUE_SCENARIOS } from "./unique-scenarios";
import { cluesFor, discoveryThreshold, isCompleted, isDiscovered, journalFor, knownClues, masteryCount, novaHint, recordClue, recordEncounterClear, recordMastery } from "./encounter-journal";

const p0 = { earnedRewards: [] as string[] };
describe("encounter journal", () => {
  test("every encounter has at least the site clue and the eight special ones have several routes", () => {
    for (const s of UNIQUE_SCENARIOS) expect(cluesFor(s.id).some((c) => c.id === "site")).toBe(true);
    for (const id of ["hollow-colossus", "exiled-architect", "verdant-sovereign", "black-market-phantom", "vyrak"]) expect(new Set(cluesFor(id).map((c) => c.route)).size).toBeGreaterThanOrEqual(2);
  });
  test("clues are idempotent and discovery needs the threshold, account-wide", () => {
    const a = recordClue(p0, "hollow-colossus", "site");
    expect(a.newClue).toBe(true); expect(a.discovered).toBe(false);
    expect(recordClue(a.progression, "hollow-colossus", "site").newClue).toBe(false);
    const b = recordClue(a.progression, "hollow-colossus", "tremors");
    expect(b.discovered).toBe(true); expect(isDiscovered(b.progression, "hollow-colossus")).toBe(true);
    expect(discoveryThreshold("hollow-colossus")).toBe(2);
  });
  test("unknown encounters and clues change nothing", () => {
    expect(recordClue(p0, "nope", "site").progression).toBe(p0);
    expect(recordClue(p0, "vyrak", "nope").progression).toBe(p0);
  });
  test("completion and mastery are per Operator while discovery is shared", () => {
    let p = recordEncounterClear(p0, "HUNTER", "exiled-architect");
    expect(isDiscovered(p, "exiled-architect")).toBe(true);
    expect(isCompleted(p, "HUNTER", "exiled-architect")).toBe(true);
    expect(isCompleted(p, "TITAN", "exiled-architect")).toBe(false);
    p = recordMastery(p, "HUNTER", "exiled-architect", "chained-abilities");
    p = recordMastery(p, "HUNTER", "exiled-architect", "chained-abilities");
    expect(masteryCount(p, "HUNTER", "exiled-architect")).toBe(1);
    expect(masteryCount(recordMastery(p, "TITAN", "exiled-architect", "x"), "TITAN", "exiled-architect")).toBe(0);
  });
  test("NOVA hints appear only after a clue and stop once discovered", () => {
    expect(novaHint(p0, "verdant-sovereign")).toBeNull();
    const one = recordClue(p0, "verdant-sovereign", "ecosystem").progression;
    expect(novaHint(one, "verdant-sovereign")).toContain("second clue");
    const two = recordClue(one, "verdant-sovereign", "keeper").progression;
    expect(novaHint(two, "verdant-sovereign")).toBeNull();
  });
  test("the journal masks what is not yet known", () => {
    const p = recordClue(p0, "black-market-phantom", "rumour").progression;
    const e = journalFor(p, "HUNTER").find((x) => x.id === "black-market-phantom")!;
    expect(e.name).toBe("Unknown encounter");
    expect(e.clues.filter((c) => c.known).length).toBe(1);
    expect(e.clues.some((c) => c.text === "???")).toBe(true);
    expect(knownClues(p, "black-market-phantom").length).toBe(1);
    expect(journalFor(p0, "HUNTER")).toEqual([]);
  });
});

test("Vyrak is flagged as a special journal entry", () => {
  const p = recordClue({ earnedRewards: [] as string[] }, "vyrak", "inscription").progression;
  expect(journalFor(p, "HUNTER").find((e) => e.id === "vyrak")?.special).toBe(true);
  expect(journalFor(recordClue(p, "hollow-colossus", "site").progression, "HUNTER").find((e) => e.id === "hollow-colossus")?.special).toBe(false);
});
