import { describe, expect, test } from "bun:test";
import { BOOTS, bootStats, buyBoots } from "./skate-boots";

describe("skate boots", () => {
  test("buying spends shards once", () => {
    const r = buyBoots({ earnedRewards: [], fractureShards: 100 }, "street");
    expect(r.ok && r.fractureShards).toBe(60);
    if (!r.ok) throw new Error();
    expect(buyBoots({ earnedRewards: r.earnedRewards, fractureShards: 60 }, "street")).toEqual({ ok: false, reason: "OWNED" });
  });
  test("cannot buy without enough shards", () => {
    expect(buyBoots({ earnedRewards: [], fractureShards: 10 }, "rocket")).toEqual({ ok: false, reason: "FUNDS" });
  });
  test("unowned equipped boots give no bonus", () => {
    expect(bootStats([], "rocket").boost).toBe(1);
    expect(bootStats(["boots:rocket"], "rocket").boost).toBe(BOOTS.rocket.boost);
  });
});
