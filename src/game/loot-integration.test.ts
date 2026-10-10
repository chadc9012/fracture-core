import { describe, expect, test } from "bun:test";
import { DEFAULT_PROGRESSION, rewardMission, type PlayerProgression } from "./progression";
import { claimDrops, upgradeGear, MATERIALS, type GearItem } from "./inventory";
import { upgradeGate } from "./upgrade-gates";
import { completionWeapon, grantCompletionWeapon, grantDungeonFirstClear, rollWeaponLoot, WEAPON_DROP_CHANCE } from "./weapon-loot";
import { evaluateGear } from "./gear-evaluation";
import { playerPowerScore } from "./balance";

const base = (): PlayerProgression => ({ ...DEFAULT_PROGRESSION, inventory: [...DEFAULT_PROGRESSION.inventory], materials: { ...DEFAULT_PROGRESSION.materials } });
const gun = (level: number): GearItem => ({ id: "g1", name: "Test Gun", slot: "primary", power: 95, level, element: "KINETIC", source: "test" });
const armor = (level: number): GearItem => ({ id: "a1", name: "Test Helm", slot: "helmet", power: 95, level, element: "KINETIC", source: "test" });
const withItem = (p: PlayerProgression, it: GearItem, mats: PlayerProgression["materials"]): PlayerProgression => ({ ...p, inventory: [...p.inventory, it], materials: mats });

describe("upgrade gates", () => {
  test("early levels are free of gates; weapons gate at 3, armor at 4", () => {
    expect(upgradeGate(gun(2))).toBeNull();
    expect(upgradeGate(gun(3))?.material).toBe("forgeCatalyst");
    expect(upgradeGate(armor(3))).toBeNull();
    expect(upgradeGate(armor(4))?.material).toBe("tuningCore");
  });
  test("both materials exist in MATERIALS", () => {
    expect(MATERIALS.forgeCatalyst.name).toBeTruthy();
    expect(MATERIALS.tuningCore.name).toBeTruthy();
  });
  test("a gated upgrade without the gate material changes nothing", () => {
    const p = withItem(base(), gun(3), { scrapMetal: 99 });
    expect(upgradeGear(p, "g1")).toBe(p);
  });
  test("a gated upgrade without the base cost changes nothing and keeps the gate material", () => {
    const p = withItem(base(), gun(3), { forgeCatalyst: 1, scrapMetal: 0 });
    const r = upgradeGear(p, "g1");
    expect(r).toBe(p);
    expect(r.materials.forgeCatalyst).toBe(1);
  });
  test("a successful gated upgrade deducts base cost and gate exactly once", () => {
    const p = withItem(base(), gun(3), { forgeCatalyst: 2, scrapMetal: 10 });
    const r = upgradeGear(p, "g1");
    expect(r.materials.scrapMetal).toBe(10 - 3 * 2);
    expect(r.materials.forgeCatalyst).toBe(1);
    const item = r.inventory.find((i) => i.id === "g1")!;
    expect(item.level).toBe(4);
    expect(item.power).toBe(110);
  });
  test("ungated upgrade is unchanged from before (no gate material touched)", () => {
    const p = withItem(base(), gun(1), { scrapMetal: 10, forgeCatalyst: 1 });
    const r = upgradeGear(p, "g1");
    expect(r.materials.forgeCatalyst).toBe(1);
    expect(r.materials.scrapMetal).toBe(8);
  });
  test("armor gate needs tuningCore, not forgeCatalyst", () => {
    const p = withItem(base(), armor(4), { reinforcedAlloy: 20, forgeCatalyst: 5 });
    expect(upgradeGear(p, "a1")).toBe(p);
    const ok = upgradeGear({ ...p, materials: { ...p.materials, tuningCore: 1 } }, "a1");
    expect(ok.materials.tuningCore).toBe(0);
  });
});

describe("first-clear rewards", () => {
  test("a main mission first clear pays forgeCatalyst and one weapon; the repeat pays neither", () => {
    const p1 = rewardMission(base(), "mission-02", {}, 0);
    expect(p1.materials.forgeCatalyst).toBe(1);
    const w = p1.inventory.filter((i) => i.id.startsWith("reward-weapon:mission:mission-02"));
    expect(w).toHaveLength(1);
    const p2 = rewardMission(p1, "mission-02", {}, 1000);
    expect(p2.materials.forgeCatalyst).toBe(1);
    expect(p2.inventory.filter((i) => i.id.startsWith("reward-weapon:")).length).toBe(1);
  });
  test("a side contract pays tuningCore but no weapon", () => {
    const p = rewardMission(base(), "side-breaker", {}, 0);
    expect(p.materials.tuningCore).toBe(1);
    expect(p.inventory.some((i) => i.id.startsWith("reward-weapon:"))).toBe(false);
  });
  test("the tutorial (mission-01) pays no special material or weapon", () => {
    const p = rewardMission(base(), "mission-01", {}, 0);
    expect(p.materials.forgeCatalyst ?? 0).toBe(0);
    expect(p.inventory.some((i) => i.id.startsWith("reward-weapon:"))).toBe(false);
  });
  test("dungeon first clear pays once", () => {
    const p1 = grantDungeonFirstClear(base(), "d1");
    expect(p1.materials.forgeCatalyst).toBe(1);
    expect(p1.inventory.some((i) => i.id === "reward-weapon:dungeon:d1")).toBe(true);
    const p2 = grantDungeonFirstClear({ ...p1, dungeonClears: { d1: 1 } }, "d1");
    expect(p2).toEqual({ ...p1, dungeonClears: { d1: 1 } });
  });
  test("granting the same completion weapon twice never duplicates it", () => {
    const once = grantCompletionWeapon(base(), "mission", "x");
    expect(grantCompletionWeapon(once, "mission", "x").inventory).toHaveLength(once.inventory.length);
  });
});

describe("weapon drops and power honesty", () => {
  test("drop chance gates by rank and the item is a real GearItem inside the power bands", () => {
    expect(rollWeaponLoot("enemy-regular", "z", 0.5, "s")).toBeNull();
    const w = rollWeaponLoot("enemy-boss", "z", WEAPON_DROP_CHANCE["enemy-boss"] - 0.01, "s")!;
    expect([80, 95, 110, 125]).toContain(w.power);
    expect(["primary", "secondary", "heavy"]).toContain(w.slot);
  });
  test("claimDrops creates a real inventory item once per drop id", () => {
    const item = rollWeaponLoot("enemy-elite", "z", 0.01, "u1")!;
    const drops = [{ id: 1, material: "scrapMetal" as const, amount: 1, enemy: "e", weaponDrop: item }];
    const p1 = claimDrops(base(), drops);
    expect(p1.inventory.filter((i) => i.id === item.id)).toHaveLength(1);
    expect(claimDrops(p1, drops).inventory.filter((i) => i.id === item.id)).toHaveLength(1);
  });
  test("an unequipped drop does not change power score or equipped gear", () => {
    const p = base();
    const item = completionWeapon("mission", "m");
    const after = grantCompletionWeapon(p, "mission", "m");
    expect(playerPowerScore(after)).toBe(playerPowerScore(p));
    expect(after.equippedGear).toEqual(p.equippedGear);
    expect(item.power).toBeLessThanOrEqual(125);
  });
  test("rating compares against the worn item only; inventory items never raise the equipped power", () => {
    const p = base();
    const wornId = p.equippedGear["primary"]!;
    const worn = p.inventory.find((g) => g.id === wornId)!;
    const better: GearItem = { ...worn, id: "better", power: worn.power + 30 };
    const ev = evaluateGear({ ...p, inventory: [...p.inventory, better] }, better);
    expect(ev.verdict).toBe("UPGRADE");
    expect(ev.powerDelta).toBe(30);
    expect(evaluateGear(p, worn).verdict).toBe("EQUIPPED");
    expect(playerPowerScore({ ...p, inventory: [...p.inventory, better] })).toBe(playerPowerScore(p));
  });
});
