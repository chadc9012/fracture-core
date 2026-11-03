// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, test } from "bun:test";
import { mergeGodot } from "./cloud-save";

describe("mergeGodot", () => {
  test("each Godot file keeps the later copy; a file only one side has is carried", () => {
    const a = { profile: { updated: "2026-11-03T02:00:00Z", xp: 1 }, character: { updated: "2026-11-03T01:00:00Z", frame: "nyx" } };
    const b = { profile: { updated: "2026-11-03T03:00:00Z", xp: 2 }, inventory: { updated: "2026-11-03T00:00:00Z", items: [] } };
    const m = mergeGodot(a, b)!;
    expect(m.profile?.xp).toBe(2);
    expect(m.character?.frame).toBe("nyx");
    expect(m.inventory).toBeDefined();
    expect(mergeGodot(undefined, b)).toBe(b);
    expect(mergeGodot(a, undefined)).toBe(a);
  });
});
