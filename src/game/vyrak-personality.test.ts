import { describe, expect, test } from "bun:test";
import { LINES, MIN_GAP, createPersonality, furyBonus, maybeIdle, moodFor, react, stepMood } from "./vyrak-personality";

describe("Vyrak personality", () => {
  test("every trigger has lines and every line id is unique", () => {
    const ids = Object.values(LINES).flatMap((m) => Object.values(m).flatMap((ls) => ls!.map((l) => l.id)));
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of Object.keys(LINES)) expect(Object.values(LINES[t as keyof typeof LINES]).flat().length).toBeGreaterThan(0);
  });
  test("being hurt builds rage until he is furious, then it cools off", () => {
    const s = createPersonality();
    for (let i = 0; i < 5; i++) react(s, "hurt", 100 + i * 30, 0);
    expect(moodFor(s)).toBe("furious");
    expect(furyBonus(s)).toBeGreaterThan(0); expect(furyBonus(s)).toBeLessThanOrEqual(0.15);
    for (let i = 0; i < 4000; i++) stepMood(s, 0.1);
    expect(moodFor(s)).toBe("calm"); expect(furyBonus(s)).toBe(0);
  });
  test("he does not chatter: gaps are enforced, but boss kills and low health always get through", () => {
    const s = createPersonality();
    expect(react(s, "kill", 100, 0)).not.toBeNull();
    expect(react(s, "kill", 100 + MIN_GAP - 1, 0)).toBeNull();
    expect(react(s, "lowHp", 101, 0)).not.toBeNull();
    expect(react(s, "bossKill", 102, 0)?.text.length).toBeGreaterThan(5);
  });
  test("a kill streak turns into a boast and farming makes him bored", () => {
    const s = createPersonality();
    let said: string | undefined;
    for (let i = 0; i < 4; i++) said = react(s, "kill", 200 + i * 2, 0)?.id ?? said;
    expect(said?.startsWith("ks-")).toBe(true);
    const f = createPersonality();
    expect(react(f, "farmed", 10, 0)?.id.startsWith("fm-")).toBe(true);
  });
  test("lines rotate instead of repeating immediately and idle remarks need a long silence", () => {
    const s = createPersonality();
    const a = react(s, "danger", 100, 0), b = react(s, "danger", 200, 0);
    expect(a && b && a.id !== b.id).toBe(true);
    expect(maybeIdle(createPersonality(), 10)).toBeNull();
    expect(maybeIdle(createPersonality(), 500, 0)).not.toBeNull();
  });
});
