import { describe, expect, test } from "bun:test";
import { craftStim, dismantle, grant, mergeStash, sellDuplicate, toVault, useStim, buffEffect, visibleConsumables, type Buffs } from "./stash";
import type { GearItem } from "./inventory";

const gun = (id: string): GearItem => ({ id, name: "Rifle", slot: "primary", power: 100, level: 2, element: "KINETIC", source: "drop" });
const base = (inv: GearItem[]) => ({ inventory: inv, materials: {} as Partial<Record<import("./inventory").MaterialId, number>>, equippedGear: { primary: "a" }, earnedRewards: [] as string[], fractureShards: 0, vaultIds: [] as string[] });

describe("stash", () => {
  test("stims never carry more than 3", () => {
    expect(grant(base([]), "healStim", 5).materials.healStim).toBe(3);
    expect(craftStim({ ...base([]), materials: { healStim: 3, dataChip: 9, energyToken: 9 } }, "healStim").materials.dataChip).toBe(9);
  });
  test("active buff stacks cap at 3", () => {
    let p = { ...base([]), materials: { armorStim: 3 } }; let b: Buffs = {};
    for (let i = 0; i < 3; i++) { const r = useStim(p, b, "armorStim", 0); if (!r) throw new Error("Expected valid stack"); p = r.progression; b = r.buffs; }
    p = { ...p, materials: { armorStim: 1 } };
    expect(useStim(p, b, "armorStim", 0)).toBeNull();
    expect(p.materials.armorStim).toBe(1);
    expect(buffEffect(b, 1).resist).toBeCloseTo(0.3);
  });
  test("Ruin Surge gives 15% per stack and expires at 45 seconds", () => {
    const result = useStim({ ...base([]), materials: { ruinStone: 1 } }, {}, "ruinStone", 0);
    if (!result) throw new Error("Expected Ruin Stone use");
    expect(result.progression.materials.ruinStone).toBe(0);
    expect(buffEffect(result.buffs, 44999).damageMult).toBe(1.15);
    expect(buffEffect(result.buffs, 45000).damageMult).toBe(1);
  });
  test("healing stacks grant 5 HP/s each and expire after 30 seconds", () => {
    expect(buffEffect({ healStim: { stacks: 3, until: 30000 } }, 29999).regen).toBe(15);
    expect(buffEffect({ healStim: { stacks: 3, until: 30000 } }, 30000).regen).toBe(0);
  });
  test("only duplicates sell; equipped never", () => {
    expect(sellDuplicate(base([gun("a"), gun("b")]), "b").fractureShards).toBeGreaterThan(0);
    expect(sellDuplicate(base([gun("a"), gun("b")]), "a").fractureShards).toBe(0);
    expect(sellDuplicate(base([gun("a"), { ...gun("c"), name: "Other" }]), "c").fractureShards).toBe(0);
  });
  test("dismantle gives parts and merge never restores it", () => {
    const p = dismantle(base([gun("a"), gun("b")]), "b");
    expect(p.materials.gearParts).toBe(4);
    expect(mergeStash([gun("a"), gun("b")], p.earnedRewards, []).inventory.map((g) => g.id)).toEqual(["a"]);
  });
  test("equipped gear cannot go in the vault", () => {
    expect(toVault(base([gun("a")]), "a").vaultIds).toEqual([]);
    expect(toVault(base([gun("a"), gun("b")]), "b").vaultIds).toEqual(["b"]);
  });
});

describe("consumable HUD visibility", () => {
  test("a player with no Ruin Stone only sees the two stims", () => {
    expect(visibleConsumables({}, {}, 0)).toEqual(["healStim", "armorStim"]);
    expect(visibleConsumables({ ruinStone: 0 }, {}, 0)).toEqual(["healStim", "armorStim"]);
  });
  test("owning one adds it", () => {
    expect(visibleConsumables({ ruinStone: 1 }, {}, 0)).toEqual(["healStim", "armorStim", "ruinStone"]);
  });
  test("it stays while its boost runs after the last one is spent, and goes when the boost ends", () => {
    const buffs: Buffs = { ruinStone: { stacks: 1, until: 5000 } };
    expect(visibleConsumables({ ruinStone: 0 }, buffs, 4999)).toContain("ruinStone");
    expect(visibleConsumables({ ruinStone: 0 }, buffs, 5000)).not.toContain("ruinStone");
  });
  test("an expired boost on a stim does not hide the stim", () => {
    expect(visibleConsumables({}, { healStim: { stacks: 2, until: 1 } }, 99)).toContain("healStim");
  });
});
