import { describe, expect, test } from "bun:test";
import { CLASS_CARDS, cardFor, cardStats } from "./weapon-class-cards";
import { frameDef } from "./weapon-classes";

describe("arsenal class cards", () => {
  test("six cards, each backed by a real frame with five bars in range", () => {
    expect(CLASS_CARDS).toHaveLength(6);
    for (const c of CLASS_CARDS) {
      const card = cardFor(c);
      expect(card.stats).toHaveLength(5);
      for (const s of card.stats) { expect(s.pct).toBeGreaterThanOrEqual(4); expect(s.pct).toBeLessThanOrEqual(100); }
      expect(card.mag).toBe(frameDef(c.frame).mag);
    }
  });
  test("the classes read like their class", () => {
    const stat = (id: string, label: string) => cardStats(frameDef(CLASS_CARDS.find((c) => c.id === id)!.frame)).find((x) => x.label === label)!.pct;
    expect(stat("sniper", "Damage")).toBeGreaterThan(stat("smg", "Damage"));
    expect(stat("sniper", "Range")).toBeGreaterThan(stat("shotgun", "Range"));
    expect(stat("smg", "Handling")).toBeGreaterThan(stat("sniper", "Handling"));
    expect(stat("smg", "Mag size")).toBeGreaterThan(stat("sniper", "Mag size"));
    expect(stat("heavy", "Damage")).toBeGreaterThan(stat("auto", "Damage"));
  });
});
