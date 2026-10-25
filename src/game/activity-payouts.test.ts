import { describe, expect, test } from "bun:test";
import { PAYOUTS, BOSS_RANK, RAID_IDS, claimBossBounty, payInto, payoutFor, payoutClassOfDungeon } from "./activity-payouts";
import { claimDungeonClear } from "./dungeon-claims";
import { claimHollowStarClear } from "./hollow-star-raid";
import { HOLLOW_STAR_ID } from "./hollow-star-data";
import { DUNGEONS } from "./dungeons";
import { DEFAULT_PROGRESSION } from "./progression";
import { nexBalance } from "./nex";

const T = Date.UTC(2026, 9, 25, 12), DAY = 86_400_000;
const fresh = () => structuredClone(DEFAULT_PROGRESSION);
const plain = DUNGEONS.find((d) => !RAID_IDS.includes(d.id) && d.id !== "fuel-king")!;

describe("payout tiers", () => {
  test("raids pay best, dungeons and bosses pay well, on first clears and on repeats", () => {
    expect(PAYOUTS.raid.first).toBeGreaterThan(PAYOUTS.dungeon.first * 4);
    expect(PAYOUTS.raid.repeat).toBeGreaterThan(PAYOUTS.dungeon.repeat * 4);
    expect(PAYOUTS.dungeon.first).toBeGreaterThan(PAYOUTS.boss.first);
    for (const c of Object.values(PAYOUTS)) expect(c.first).toBeGreaterThan(c.repeat);
    expect(PAYOUTS.boss.repeat).toBeGreaterThanOrEqual(300);
  });
  test("the raid is the hollow-star run and the rest are dungeons", () => {
    expect(RAID_IDS).toContain(HOLLOW_STAR_ID);
    expect(payoutClassOfDungeon(HOLLOW_STAR_ID)).toBe("raid");
    expect(payoutClassOfDungeon(plain.id)).toBe("dungeon");
  });
  test("later campaign bosses pay more", () => {
    const ranks = ["dark-knight", "rime-alpha", "drowned-monarch", "hollow-saint", "vyrak"].map((id) => BOSS_RANK[id]!);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });
});
describe("boss bounty", () => {
  test("first kill pays in full, the same day pays nothing more, the next day pays the repeat rate", () => {
    const a = claimBossBounty(fresh(), "dark-knight", T);
    expect(a.paid).toBe(PAYOUTS.boss.first); expect(a.first).toBe(true);
    expect(claimBossBounty(a.progression, "dark-knight", T + 1000).paid).toBe(0);
    const b = claimBossBounty(a.progression, "dark-knight", T + DAY);
    expect(b.paid).toBe(PAYOUTS.boss.repeat); expect(b.first).toBe(false);
    expect(nexBalance(b.progression.nexLedger)).toBe(PAYOUTS.boss.first + PAYOUTS.boss.repeat);
  });
  test("each boss is its own target and a ranked boss pays its multiple", () => {
    const a = claimBossBounty(fresh(), "vyrak", T);
    expect(a.paid).toBe(PAYOUTS.boss.first * 2);
    expect(claimBossBounty(a.progression, "dark-knight", T).paid).toBe(PAYOUTS.boss.first);
    expect(claimBossBounty(fresh(), "some-unranked-boss", T).paid).toBe(PAYOUTS.boss.first);
  });
});
describe("dungeon and raid clears", () => {
  test("a dungeon clear pays its Nex once a day and the first clear pays most", () => {
    const a = claimDungeonClear(fresh(), plain.id, plain.signature.name, T);
    expect(nexBalance(a.nexLedger)).toBe(PAYOUTS.dungeon.first);
    expect(nexBalance(claimDungeonClear(a, plain.id, plain.signature.name, T + 5000).nexLedger)).toBe(PAYOUTS.dungeon.first); // same day: no second payout
    const b = claimDungeonClear(a, plain.id, plain.signature.name, T + DAY);
    expect(nexBalance(b.nexLedger)).toBe(PAYOUTS.dungeon.first + PAYOUTS.dungeon.repeat);
  });
  test("the raid pays the raid rate, the challenge variant half again, and never both a dungeon and a raid payout", () => {
    const std = claimHollowStarClear(fresh(), "STANDARD", [], T);
    expect(nexBalance(std.nexLedger)).toBe(PAYOUTS.raid.first);
    const hard = claimHollowStarClear(fresh(), "CHALLENGE", [], T);
    expect(nexBalance(hard.nexLedger)).toBe(Math.round(PAYOUTS.raid.first * 1.5));
    expect(Object.keys(std.nexLedger).filter((k) => k.startsWith("payout:dungeon:")).length).toBe(0);
    expect(nexBalance(claimHollowStarClear(std, "STANDARD", [], T + 1000).nexLedger)).toBe(PAYOUTS.raid.first);
    expect(nexBalance(claimHollowStarClear(std, "CHALLENGE", [], T + DAY).nexLedger)).toBe(PAYOUTS.raid.first + Math.round(PAYOUTS.raid.repeat * 1.5));
  });
  test("payouts are ledger entries, so a cloud merge (ledger union) cannot double-pay", () => {
    const a = payInto(fresh(), "raid", HOLLOW_STAR_ID, T).progression;
    const merged = { ...a.nexLedger, ...a.nexLedger };
    expect(nexBalance(merged)).toBe(PAYOUTS.raid.first);
    expect(payoutFor(a.nexLedger, "raid", HOLLOW_STAR_ID, T)).toBeNull();
  });
});
