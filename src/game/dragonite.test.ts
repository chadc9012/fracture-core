import { describe, expect, test } from "bun:test";
import { DEFAULT_PROGRESSION } from "./progression";
import { claimCovenant, dragoniteGear, isBonded } from "./dragon-covenant";
import { CHALLENGES, DRAGONITE, DRAGONITE_IDS, RESIST_CAP, UPGRADE_COST, appearanceStage, armorBonus, cappedResist, clearCount, createWyrm, dragoniteStats, recordVyrakClear, stepWyrm, summonWyrm, upgradeDragonite, upgradeLevel, wornCovenant, type Wyrm } from "./dragonite";

const fresh = () => ({ ...DEFAULT_PROGRESSION, earnedRewards: [] as string[], inventory: [], materials: {} });
const bonded = (cls: "TITAN" | "HUNTER" | "WARLOCK" = "HUNTER") => claimCovenant(fresh() as never, cls).progression;
const none = armorBonus([]);

describe("Dragonite upgrades", () => {
  test("need the bond on this Operator, cost Dragonite, and go four deep", () => {
    expect("error" in upgradeDragonite(fresh() as never, "HUNTER", "dragonfire")).toBe(true);
    let p = { ...bonded(), materials: { dragonite: 34 } } as never as ReturnType<typeof bonded>;
    for (let i = 0; i < 4; i++) { const r = upgradeDragonite(p, "HUNTER", "dragonfire"); if ("error" in r) throw new Error(r.error); p = r.progression; }
    expect(upgradeLevel(p, "HUNTER", "dragonfire")).toBe(4);
    expect(p.materials.dragonite).toBe(34 - UPGRADE_COST.reduce((a, b) => a + b, 0));
    expect("error" in upgradeDragonite(p, "HUNTER", "dragonfire")).toBe(true);
  });
  test("a bond on one Operator never upgrades or unlocks another", () => {
    const p = { ...bonded("HUNTER"), materials: { dragonite: 99 } };
    expect(isBonded(p, "TITAN")).toBe(false);
    expect("error" in upgradeDragonite(p, "TITAN", "dragonfire")).toBe(true);
    const r = upgradeDragonite(p, "HUNTER", "wyrmwing"); if ("error" in r) throw 0;
    expect(upgradeLevel(r.progression, "TITAN", "wyrmwing")).toBe(0);
  });
  test("each upgrade level improves the ability", () => {
    expect(dragoniteStats("dragonfire", 1, none)["range"]!).toBeGreaterThan(dragoniteStats("dragonfire", 0, none)["range"]!);
    expect(dragoniteStats("dragonfire", 2, none)["coneDeg"]!).toBeGreaterThan(dragoniteStats("dragonfire", 1, none)["coneDeg"]!);
    expect(dragoniteStats("dragonfire", 4, none)["eruption"]).toBe(1);
    expect(dragoniteStats("wyrmwing", 3, none)["airDashes"]).toBe(2);
    expect(dragoniteStats("wyrmcall", 2, none).cooldown).toBeLessThan(dragoniteStats("wyrmcall", 0, none).cooldown);
    expect(dragoniteStats("wyrmcall", 4, none)["finisher"]).toBe(1);
  });
});

describe("Covenant armor", () => {
  const pieces = (n: number) => (["helmet", "chest", "gauntlets", "legs", "classItem"] as const).slice(0, n);
  test("any piece helps on its own and the set is never required", () => {
    expect(armorBonus(["helmet"]).energyCost).toBe(0.1);
    expect(armorBonus(["legs"]).airControl).toBe(0.2);
    expect(armorBonus([]).potency).toBe(0);
  });
  test("2, 3 and 5 pieces add synergy: enhanced ability needs 3, aura needs all 5", () => {
    expect(armorBonus(pieces(2), "dragonfire").enhanced).toBeNull();
    expect(armorBonus(pieces(3), "dragonfire").enhanced).toBe("dragonfire");
    expect(armorBonus(pieces(4)).aura).toBe(false);
    expect(armorBonus(pieces(5)).aura).toBe(true);
    expect(armorBonus(pieces(5)).potency).toBeGreaterThan(armorBonus(pieces(2)).potency);
  });
  test("the five-piece bonus stays small, so mixed builds remain worth it", () => {
    const full = dragoniteStats("dragonfire", 4, armorBonus(pieces(5), "dragonfire"))["damage"]!, bare = dragoniteStats("dragonfire", 4, none)["damage"]!;
    expect(full / bare).toBeLessThan(1.35);
    const three = dragoniteStats("dragonfire", 4, armorBonus(pieces(3)))["damage"]!;
    expect(three / bare).toBeLessThan(1.1);
  });
  test("Dragonhide never takes resistance past the 50% cap, alone or on top of armor", () => {
    for (const lv of [0, 2, 4]) expect(dragoniteStats("dragonhide", lv, armorBonus(pieces(5), "dragonhide"))["resist"]!).toBeLessThanOrEqual(RESIST_CAP);
    expect(cappedResist(0.4, 0.3)).toBe(RESIST_CAP);
  });
  test("worn Covenant pieces are counted from equipped gear only", () => {
    const gear = dragoniteGear("HUNTER");
    expect(wornCovenant(gear, { helmet: gear[0]!.id, chest: gear[2]!.id })).toEqual(["helmet", "chest"]);
    expect(wornCovenant(gear, {})).toEqual([]);
  });
  test("appearance stage grows with clears", () => { expect([0, 1, 2, 3, 5, 6, 9].map(appearanceStage)).toEqual([1, 1, 1, 2, 2, 3, 3]); });
});

describe("repeat clears and challenges", () => {
  test("first clear bonds that Operator only; the same run id never pays twice", () => {
    const a = recordVyrakClear(fresh() as never, "TITAN", "run-1");
    expect(a.firstBond).toBe(true); expect(isBonded(a.progression, "TITAN")).toBe(true); expect(isBonded(a.progression, "HUNTER")).toBe(false);
    const again = recordVyrakClear(a.progression, "TITAN", "run-1");
    expect(again.gained).toEqual([]); expect(again.progression).toBe(a.progression);
  });
  test("later clears pay Dragonite, and every second one an extra Covenant piece", () => {
    let p = recordVyrakClear(fresh() as never, "WARLOCK", "r1").progression;
    const before = p.materials.dragonite ?? 0;
    p = recordVyrakClear(p, "WARLOCK", "r2").progression;
    expect((p.materials.dragonite ?? 0) - before).toBe(3);
    const inv = p.inventory.length;
    p = recordVyrakClear(p, "WARLOCK", "r3").progression;
    expect(p.inventory.length).toBe(inv);
    p = recordVyrakClear(p, "WARLOCK", "r4").progression;
    expect(p.inventory.length).toBe(inv + 1);
    expect(clearCount(p, "WARLOCK")).toBe(4);
  });
  test("each challenge pays its ornament once per Operator", () => {
    const a = recordVyrakClear(fresh() as never, "HUNTER", "r1", ["unbroken-covenant"]);
    expect(a.gained.join()).toContain(CHALLENGES["unbroken-covenant"].ornament);
    const b = recordVyrakClear(a.progression, "HUNTER", "r2", ["unbroken-covenant", "dragons-patience"]);
    expect(b.gained.join()).not.toContain("Unbroken Crest");
    expect(b.gained.join()).toContain("Patient Scale");
    const other = recordVyrakClear(fresh() as never, "TITAN", "r1", ["unbroken-covenant"]);
    expect(other.gained.join()).toContain("Unbroken Crest");
  });
  test("no Operator, no reward", () => expect(recordVyrakClear(fresh() as never, null, "r").gained).toEqual([]));
});

describe("Wyrmcall ally", () => {
  const stats = dragoniteStats("wyrmcall", 3, none);
  const run = (w: Wyrm, seconds: number, targets = [{ id: 1, dist: 12, boss: false, windingUp: false }]) => {
    const actions: string[] = [];
    for (let t = 0; t < seconds; t += 0.1) { const a = stepWyrm(w, 0.1, targets, stats); if (a) actions.push(a.kind); }
    return actions;
  };
  test("cannot be summoned twice, or while recovering", () => {
    const w = createWyrm();
    expect(summonWyrm(w, stats)).toBe(true); expect(summonWyrm(w, stats)).toBe(false);
  });
  test("approaches, assesses, strafes then breathes, and leaves when time is up", () => {
    const w = createWyrm(); summonWyrm(w, stats);
    const acts = run(w, 40);
    expect(acts[0]).toBe("strafe"); expect(acts).toContain("breath");
    expect(w.finished).toBe(true);
    expect(w.state === "RECOVERY" || w.state === "BONDED").toBe(true);
  });
  test("interrupts an enemy that is winding up an attack", () => {
    const w = createWyrm(); summonWyrm(w, stats);
    const acts = run(w, 6, [{ id: 7, dist: 8, boss: false, windingUp: true }]);
    expect(acts).toContain("interrupt");
  });
  test("a boss draws the attack, and the finisher comes last", () => {
    const fin = dragoniteStats("wyrmcall", 4, none);
    const w = createWyrm(); summonWyrm(w, fin);
    const acts: string[] = [];
    for (let t = 0; t < 40; t += 0.1) { const a = stepWyrm(w, 0.1, [{ id: 1, dist: 5, boss: false, windingUp: false }, { id: 2, dist: 30, boss: true, windingUp: false }], fin); if (a) { acts.push(a.kind); expect(a.target).toBe(2); } }
    expect(acts[acts.length - 1]).toBe("finisher");
  });
  test("recovery lasts the cooldown, after which it can be called again", () => {
    const w = createWyrm(); summonWyrm(w, stats); run(w, 40);
    expect(summonWyrm(w, stats)).toBe(false);
    for (let t = 0; t < stats.cooldown + 1; t += 1) stepWyrm(w, 1, [], stats);
    expect(summonWyrm(w, stats)).toBe(true);
  });
  test("all four abilities exist with real numbers", () => { for (const id of DRAGONITE_IDS) { const s = dragoniteStats(id, 0, none); expect(s.cooldown).toBeGreaterThan(0); expect(DRAGONITE[id].upgrades.length).toBe(4); } });
});
