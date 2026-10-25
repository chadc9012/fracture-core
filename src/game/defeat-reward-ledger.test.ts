import { describe, expect, test } from "bun:test";
import { settleDefeatReward, type RewardLedger } from "./defeat-reward-ledger";

const empty = (): RewardLedger => ({ claimedDefeats: [], xp: 0, materials: {} });

describe("defeat reward ledger", () => {
  test("awards XP and materials once per stable defeat ID", () => {
    const reward = { defeatId: "zone1:enemy42:spawn7", xp: 25, materials: { scrapMetal: 2 } };
    const first = settleDefeatReward(empty(), reward);
    expect(first.granted).toBe(true);
    expect(first.ledger.xp).toBe(25);
    expect(first.ledger.materials["scrapMetal"]).toBe(2);
    const second = settleDefeatReward(first.ledger, reward);
    expect(second.granted).toBe(false);
    expect(second.ledger).toBe(first.ledger);
  });
  test("reloaded serialized ledger still rejects a repeated kill", () => {
    const reward = { defeatId: "boss:vyrak:instance9", xp: 100 };
    const saved = JSON.parse(JSON.stringify(settleDefeatReward(empty(), reward).ledger)) as RewardLedger;
    expect(settleDefeatReward(saved, reward).granted).toBe(false);
  });
  test("invalid negative or non-finite payouts never change the ledger", () => {
    const original = empty();
    for (const reward of [
      { defeatId: "", xp: 10 },
      { defeatId: "bad", xp: -1 },
      { defeatId: "nan", xp: NaN },
      { defeatId: "negative-material", xp: 1, materials: { scrapMetal: -1 } },
    ]) {
      expect(settleDefeatReward(original, reward).ledger).toBe(original);
    }
  });
});
