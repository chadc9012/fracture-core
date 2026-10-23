import { describe, expect, test } from "bun:test";
import { COMBAT_STANCE_HOLD, combatStance, standingClip } from "./combat-stance";

describe("combat stance", () => {
  test("aiming or a recent shot holds the stance", () => {
    expect(combatStance(true, 10, 0)).toBe(true);
    expect(combatStance(false, 10, 10 + COMBAT_STANCE_HOLD)).toBe(true);
    expect(combatStance(false, 20, 15)).toBe(false);
  });
  test("clip choice prefers combat in combat, idle otherwise, never nothing when one exists", () => {
    const both = (n: string) => n === "idle" || n === "combat";
    expect(standingClip(both, true)).toBe("combat");
    expect(standingClip(both, false)).toBe("idle");
    expect(standingClip((n) => n === "combat", false)).toBe("combat");
    expect(standingClip((n) => n === "idle", true)).toBe("idle");
    expect(standingClip(() => false, true)).toBeNull();
  });
});
