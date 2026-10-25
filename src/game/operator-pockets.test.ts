import { describe, expect, test } from "bun:test";
import { DEFAULT_PROGRESSION, normalizeProgression, rewardMission, type PlayerProgression } from "./progression";
import { grantXP } from "./xp";
import { nexBalance, spendNex } from "./nex";
import { NEX_OFFSET_KEY, livePocket, mergePockets, operatorPocket, switchOperator } from "./operator-pockets";
import { mergeProgression } from "./cloud-save";
import { buyHome, ownsHome } from "./housing";

const earn = (p: PlayerProgression, key: string, nex: number): PlayerProgression => ({ ...p, nexLedger: { ...p.nexLedger, [key]: nex } });

describe("operator pockets", () => {
  test("each operator levels on their own", () => {
    let p = grantXP(DEFAULT_PROGRESSION, "BOSS_KILL").progression; // Titan: 1000 XP
    expect(p.level).toBe(2);
    p = switchOperator(p, "HUNTER");
    expect(p.level).toBe(1);
    expect(p.xp).toBe(0);
    p = grantXP(p, "MISSION").progression; // Hunter: 1200 XP
    const hunter = { level: p.level, xp: p.xp };
    p = switchOperator(p, "TITAN");
    expect(p.level).toBe(2);
    expect(p.xp).toBe(600);
    expect(operatorPocket(p, "HUNTER").level).toBe(hunter.level);
    expect(operatorPocket(p, "WARLOCK").level).toBe(1);
  });

  test("Nex, shards and materials are per operator; ownership stays shared", () => {
    let p: PlayerProgression = { ...earn(DEFAULT_PROGRESSION, "payout:test", 5000), fractureShards: 400, materials: { scrapMetal: 50, dragonite: 3 } };
    p = switchOperator(p, "WARLOCK");
    expect(nexBalance(p.nexLedger)).toBe(0);
    expect(p.fractureShards).toBe(120);
    expect(p.materials).toEqual({});
    expect("payout:test" in p.nexLedger).toBe(true); // the claim is still recorded
    p = earn(p, "payout:warlock", 900);
    expect(nexBalance(p.nexLedger)).toBe(900);
    p = switchOperator(p, "TITAN");
    expect(nexBalance(p.nexLedger)).toBe(5000);
    expect(p.materials).toEqual({ scrapMetal: 50, dragonite: 3 });
    expect(p.fractureShards).toBe(400);
    expect(operatorPocket(p, "WARLOCK").nex).toBe(900);
  });

  test("a purchase spends the buyer's money only, and every operator owns it", () => {
    let p = earn(DEFAULT_PROGRESSION, "payout:big", 2_000_000);
    const homeId = "grid-loft";
    const bought = buyHome(p, homeId);
    if ("error" in bought) throw new Error(bought.error);
    p = bought.progression as PlayerProgression;
    const titanLeft = nexBalance(p.nexLedger);
    p = switchOperator(p, "HUNTER");
    expect(ownsHome(p, homeId)).toBe(true);
    expect(nexBalance(p.nexLedger)).toBe(0);
    expect(spendNex(p.nexLedger, "x", 1)).toBeNull();
    p = switchOperator(p, "TITAN");
    expect(nexBalance(p.nexLedger)).toBe(titanLeft);
  });

  test("mission rewards go to the operator being played", () => {
    let p = switchOperator(DEFAULT_PROGRESSION, "HUNTER");
    p = rewardMission(p, "mission-02", { scrapMetal: 40 }, Date.UTC(2026, 0, 5));
    const hunter = livePocket(p);
    p = switchOperator(p, "TITAN");
    expect(p.level).toBe(1);
    expect(p.materials.scrapMetal ?? 0).toBe(0);
    expect(operatorPocket(p, "HUNTER")).toEqual(hunter);
  });

  test("switching to the same operator, or to none, changes nothing", () => {
    expect(switchOperator(DEFAULT_PROGRESSION, "TITAN")).toBe(DEFAULT_PROGRESSION);
    expect(switchOperator(DEFAULT_PROGRESSION, null)).toBe(DEFAULT_PROGRESSION);
  });

  test("the offset entry is dropped when it isn't needed", () => {
    let p = earn(DEFAULT_PROGRESSION, "a", 100);
    p = switchOperator(p, "HUNTER");
    expect(p.nexLedger[NEX_OFFSET_KEY]).toBe(-100);
    p = switchOperator(p, "TITAN");
    expect(NEX_OFFSET_KEY in p.nexLedger).toBe(false);
  });

  test("an old save: the played operator keeps everything, the others start fresh", () => {
    const old = { ...DEFAULT_PROGRESSION, identityClass: "WARLOCK", level: 9, xp: 120, fractureShards: 777, materials: { fuel: 12 }, nexLedger: { "payout:x": 3000 } } as Record<string, unknown>;
    delete old["pocketClass"]; delete old["operators"];
    let p = normalizeProgression(old);
    expect(p.pocketClass).toBe("WARLOCK");
    expect(p.level).toBe(9);
    expect(nexBalance(p.nexLedger)).toBe(3000);
    p = switchOperator(p, "TITAN");
    expect(livePocket(p)).toEqual({ level: 1, xp: 0, nex: 0, fractureShards: 120, materials: {} });
    p = switchOperator(p, "WARLOCK");
    expect(livePocket(p)).toEqual({ level: 9, xp: 120, nex: 3000, fractureShards: 777, materials: { fuel: 12 } });
  });

  test("pockets survive a save round trip", () => {
    let p = grantXP(DEFAULT_PROGRESSION, "BOSS_KILL").progression;
    p = switchOperator(earn(p, "a", 50), "HUNTER");
    const back = normalizeProgression(JSON.parse(JSON.stringify(p)));
    expect(back.pocketClass).toBe("HUNTER");
    expect(back.operators.TITAN).toEqual(p.operators.TITAN);
    expect(livePocket(switchOperator(back, "TITAN"))).toEqual(livePocket(switchOperator(p, "TITAN")));
  });

  test("cloud merge keeps each operator's further copy", () => {
    // local: Titan played up to level 3; cloud (older): Hunter was played to level 4
    const local = grantXP(grantXP(DEFAULT_PROGRESSION, "BOSS_KILL").progression, "BOSS_KILL").progression;
    const cloud = grantXP(grantXP(switchOperator(DEFAULT_PROGRESSION, "HUNTER"), "BOSS_KILL").progression, "BOSS_KILL", { scale: 2.5 }).progression;
    const merged = mergeProgression(local, cloud, true);
    expect(merged.pocketClass).toBe("TITAN");
    expect(merged.level).toBe(local.level);
    expect(operatorPocket(merged, "HUNTER").level).toBe(cloud.level);
    expect(mergePockets(local, cloud).WARLOCK.level).toBe(1);
  });
});
