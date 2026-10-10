// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { ATTUNE_ORDER, ATTUNE_SECONDS, CLOSE_RANGE, FAR_RANGE, attunedElement, gimmickMultiplier, streakOf, type DamageElement } from "./scenario-gimmicks";
import { UNIQUE_SCENARIOS } from "./unique-scenarios";

const hit = (g: Parameters<typeof gimmickMultiplier>[0], element: DamageElement, history: DamageElement[] = [], nowSec = 0, distance = 10) => gimmickMultiplier(g, { element, history, nowSec, distance });

describe("scenario gimmicks", () => {
  it("there are six unique scenarios with unique ids and four distinct gimmicks", () => {
    expect(UNIQUE_SCENARIOS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(UNIQUE_SCENARIOS.map((s) => s.gimmick)).size).toBe(4);
  });
  it("poise-only leaves damage alone", () => expect(hit("poise", "ARC").mult).toBe(1));

  describe("adaptive (Dark Knight)", () => {
    it("is neutral for a few repeats, then wears the counter in, never below 30%", () => {
      expect(hit("adaptive", "ARC", ["ARC", "ARC"]).mult).toBe(1);
      const six = Array(6).fill("ARC") as DamageElement[];
      expect(hit("adaptive", "ARC", six).mult).toBeCloseTo(0.3, 5);
      expect(hit("adaptive", "ARC", ["ARC", "ARC", "ARC", "ARC"]).mult).toBeLessThan(1);
    });
    it("switching element resets the streak", () => {
      expect(streakOf(["ARC", "ARC", "ARC", "ARC"], "CRYO")).toBe(1);
      expect(hit("adaptive", "CRYO", ["ARC", "ARC", "ARC", "ARC"]).mult).toBe(1);
    });
    it("a squad using three or more elements opens a bonus gap", () => {
      expect(hit("adaptive", "ARC", ["KINETIC", "THERMAL", "CRYO"]).mult).toBeCloseTo(1.3, 5);
    });
    it("keeps only the recent history", () => {
      let h: DamageElement[] = [];
      for (let i = 0; i < 20; i++) h = hit("adaptive", "ARC", h).history;
      expect(h.length).toBe(6);
    });
  });

  describe("attune (Hollow Saint)", () => {
    it("cycles every nine seconds through the four elements", () => {
      expect(attunedElement(0)).toBe(ATTUNE_ORDER[0]);
      expect(attunedElement(ATTUNE_SECONDS + 0.1)).toBe(ATTUNE_ORDER[1]);
      expect(attunedElement(ATTUNE_SECONDS * ATTUNE_ORDER.length)).toBe(ATTUNE_ORDER[0]);
    });
    it("rewards the attuned element and punishes the rest", () => {
      expect(hit("attune", "KINETIC", [], 1).mult).toBeGreaterThan(1);
      expect(hit("attune", "CRYO", [], 1).mult).toBeLessThan(0.5);
    });
  });

  describe("closing (Red Ronin)", () => {
    it("full damage up close, almost none at long range, smooth in between", () => {
      expect(hit("closing", "KINETIC", [], 0, CLOSE_RANGE).mult).toBeCloseTo(1.2, 5);
      expect(hit("closing", "KINETIC", [], 0, FAR_RANGE).mult).toBeCloseTo(0.12, 5);
      expect(hit("closing", "KINETIC", [], 0, 100).mult).toBeCloseTo(0.12, 5);
      const mid = hit("closing", "KINETIC", [], 0, (CLOSE_RANGE + FAR_RANGE) / 2).mult;
      expect(mid).toBeLessThan(1.2); expect(mid).toBeGreaterThan(0.12);
    });
  });
});
