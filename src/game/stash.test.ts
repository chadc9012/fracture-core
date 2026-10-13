import { describe, expect, test } from "bun:test";
import { craftStim, dismantle, grant, mergeStash, sellDuplicate, toVault, useStim, buffEffect } from "./stash";
import type { GearItem } from "./inventory";

const gun = (id: string): GearItem => ({ id, name: "Rifle", slot: "primary", power: 100, level: 2, element: "KINETIC", source: "drop" });
const base = (inv: GearItem[]) => ({ inventory: inv, materials: {} as Partial<Record<import("./inventory").MaterialId, number>>, equippedGear: { primary: "a" }, earnedRewards: [] as string[], fractureShards: 0, vaultIds: [] as string[] });

describe("stash", () => {
  test("stims never carry more than 3", () => {
    expect(grant(base([]), "healStim", 5).materials.healStim).toBe(3);
    expect(craftStim({ ...base([]), materials: { healStim: 3, dataChip: 9, energyToken: 9 } }, "healStim").materials.dataChip).toBe(9);
  });
  test("active buff stacks cap at 3", () => {
    let p = { ...base([]), materials: { armorStim: 3 } }; let b = {};
    for (let i = 0; i < 3; i++) { const r = useStim(p, b, "armorStim", 0)!; p = r.progression; b = r.buffs; }
    p = { ...p, materials: { armorStim: 1 } }; b = useStim(p, b, "armorStim", 0)!.buffs;
    expect(buffEffect(b, 1).resist).toBeCloseTo(0.3);
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
