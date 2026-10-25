// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it, mock } from "bun:test";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { mergeProgression } = await import("./cloud-save");
const { DEFAULT_PROGRESSION } = await import("./progression");

// Stage 165 milestone, run against the real merge the cloud sync uses: a Hunter earns XP on one device and a weapon on
// another; each merge must carry the change across without duplicating it, and operators stay independent.
const hunter = { ...DEFAULT_PROGRESSION, identityClass: "HUNTER" as const, pocketClass: "HUNTER" as const };
const weapon = { id: "hunter-rifle-1", name: "Test Rifle", slot: "WEAPON", rarity: "RARE", power: 120, mods: [], life: 1, level: 1 } as never;

describe("Windows ↔ Samsung hunter sync (merge level)", () => {
  it("xp earned on device A reaches device B", () => {
    const a = { ...hunter, xp: 500, completedMissions: ["test-mission"] };
    const b = mergeProgression(hunter, a, false); // B pulls the cloud copy
    expect(b.xp).toBe(500);
    expect(b.completedMissions).toEqual(["test-mission"]);
  });
  it("a weapon earned on B reaches A exactly once, however often it syncs", () => {
    const a = { ...hunter, xp: 500, completedMissions: ["test-mission"] };
    const b = { ...a, inventory: [...a.inventory, weapon] };
    let onA = mergeProgression(a, b, false);
    onA = mergeProgression(onA, b, false);
    onA = mergeProgression(onA, onA, true);
    expect(onA.inventory.filter((i) => i.id === "hunter-rifle-1")).toHaveLength(1);
    expect(onA.xp).toBe(500);
  });
  it("both devices earning offline loses nothing and duplicates nothing", () => {
    const base = { ...hunter, xp: 100 };
    const a = { ...base, completedMissions: ["m1"], earnedRewards: ["r-a"] };
    const b = { ...base, inventory: [...base.inventory, weapon], earnedRewards: ["r-b"] };
    const m = mergeProgression(a, b, true);
    expect(m.inventory.filter((i) => i.id === "hunter-rifle-1")).toHaveLength(1);
    expect(m.completedMissions).toContain("m1");
    expect([...m.earnedRewards].sort()).toEqual(["r-a", "r-b"]);
    expect(mergeProgression(m, m, true).inventory).toHaveLength(m.inventory.length);
  });
  it("Titan progress stays separate from the Hunter's", () => {
    const a = { ...hunter, xp: 900, operators: { ...hunter.operators, TITAN: { level: 4, xp: 77, nex: 0, fractureShards: 0, materials: {} } } };
    const m = mergeProgression(hunter, a, false);
    expect(m.xp).toBe(900);
    expect(m.operators.TITAN?.xp).toBe(77);
  });
});
