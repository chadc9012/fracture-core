import { describe, expect, test } from "bun:test";
import { FLAWLESS_PAY_BONUS, HUB_DUNGEON_REGION, gearChance, gearKey, gearRoll, payDescent, rankPayMult, rollDungeonGear } from "./dungeon-rewards";
import { claimDescentClear, startDescent } from "./descent-run";
import { SIGNATURE_DUNGEONS, gatesForDay } from "./fracture-gates";
import { PAYOUTS } from "./activity-payouts";
import { claimDungeonClear } from "./dungeon-claims";
import { setPieceId } from "./armor-sets";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "./progression";

const T = Date.UTC(2026, 10, 3, 12), WEEK = 7 * 86400000;
const fresh = () => ({ ...DEFAULT_PROGRESSION, pocketClass: "TITAN" as const });
const nex = (p: { nexLedger: Record<string, number> }) => Object.values(p.nexLedger).reduce((n, v) => n + v, 0);

describe("dungeon rewards", () => {
  test("rank scales the bounty from F 0.7 to S 1.6, a flawless clear adds 25%", () => {
    expect(rankPayMult("F")).toBeCloseTo(0.7);
    expect(rankPayMult("D")).toBeCloseTo(1);
    expect(rankPayMult("S")).toBeCloseTo(1.6);
    const plain = payDescent(fresh(), "rootbound-labyrinth", "C", false, T).paid;
    const flawless = payDescent(fresh(), "rootbound-labyrinth", "C", true, T).paid;
    expect(plain).toBe(Math.round(PAYOUTS.dungeon.first * rankPayMult("C")));
    expect(flawless).toBe(Math.round(PAYOUTS.dungeon.first * rankPayMult("C") * FLAWLESS_PAY_BONUS));
  });
  test("a descent bounty is first-clear then the daily repeat, once a day", () => {
    const a = payDescent(fresh(), "rootbound-labyrinth", "D", false, T);
    expect(a.paid).toBe(PAYOUTS.dungeon.first);
    expect(payDescent(a.progression, "rootbound-labyrinth", "D", false, T).paid).toBe(0);
    expect(payDescent(a.progression, "rootbound-labyrinth", "D", false, T + 86400000).paid).toBe(PAYOUTS.dungeon.repeat);
  });
  test("gear chance rises with rank and a flawless clear, capped", () => {
    expect(gearChance("F")).toBeCloseTo(0.4);
    expect(gearChance("S")).toBeCloseTo(0.7);
    expect(gearChance("S", true)).toBeCloseTo(0.9);
    expect(gearChance("F", true)).toBeGreaterThan(gearChance("F"));
  });
  test("the weekly roll happens once per dungeon per week and is deterministic", () => {
    const a = rollDungeonGear(fresh(), "rootbound-labyrinth", "veridan", "S", true, T);
    expect(a.progression.earnedRewards).toContain(gearKey("rootbound-labyrinth", T, "TITAN"));
    const again = rollDungeonGear(a.progression, "rootbound-labyrinth", "veridan", "S", true, T);
    expect(again.item).toBeNull();
    expect(again.progression).toBe(a.progression);
    expect(rollDungeonGear(fresh(), "rootbound-labyrinth", "veridan", "S", true, T).item?.id).toBe(a.item?.id);
    expect(gearRoll("TITAN", "x", T)).toBe(gearRoll("TITAN", "x", T));
  });
  test("a drop is a piece of the region's set, a duplicate levels it, a new week rolls again", () => {
    let p: PlayerProgression = fresh();
    let drops = 0;
    for (let w = 0; w < 40; w++) {
      const r = rollDungeonGear(p, "rootbound-labyrinth", "veridan", "S", true, T + w * WEEK);
      p = r.progression;
      if (r.item) { drops++; expect(r.item.setId).toBe("verdant-warden"); expect(r.item.id).toBe(setPieceId("verdant-warden", r.item.slot as never)); }
    }
    expect(drops).toBeGreaterThan(20); // 90% a week over 40 weeks
    expect(p.inventory.some((g) => g.setId === "verdant-warden" && g.level > 1)).toBe(true);
  });
  test("no armor set in the region means no roll", () => {
    const r = rollDungeonGear(fresh(), "x", null, "S", true, T);
    expect(r.item).toBeNull();
    expect(r.progression).toBe(r.progression);
    expect(rollDungeonGear(fresh(), "x", "nowhere", "S", true, T).progression.earnedRewards.length).toBe(0);
  });
  test("every signature dungeon with a gate region has a set to drop", () => {
    for (const d of SIGNATURE_DUNGEONS) if (d.regionId) expect(rollDungeonGear(fresh(), d.id, d.regionId, "D", false, T).progression.earnedRewards.length).toBe(1);
  });
  test("a cleared descent pays Nex, the seals and the weekly roll in one claim", () => {
    const gate = gatesForDay(T)[0]!;
    const run = { ...startDescent(gate, T, 1), status: "CLEARED" as const, deaths: 0 };
    const r = claimDescentClear(fresh(), run, T);
    expect(r.nex).toBeGreaterThan(0);
    expect(nex(r.progression)).toBeGreaterThanOrEqual(r.nex);
    expect(r.seals).toContain("FLAWLESS");
    expect(claimDescentClear(r.progression, run, T).nex).toBe(0); // the day's clear is recorded
  });
  test("hub dungeons roll the weekly drop through the regular claim", () => {
    for (const [id, region] of Object.entries(HUB_DUNGEON_REGION)) {
      const p = claimDungeonClear(fresh(), id, "sig", T);
      expect(p.earnedRewards).toContain(gearKey(id, T, "TITAN"));
      expect(region.length).toBeGreaterThan(0);
    }
  });
});
