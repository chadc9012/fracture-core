import { describe, expect, test } from "bun:test";
import { buyPenthouseNex, ownsPenthouseNex, PENTHOUSE_PRICE, publishPenthouse, penthouseLive, subscribePenthouse } from "./casino-property";
import { nexBalance } from "./nex";

const rich = { nexLedger: { seed: 40000 } }, poor = { nexLedger: { seed: 100 } };
describe("penthouse purchase through the real Nex ledger", () => {
  test("charges once and records ownership", () => {
    const r = buyPenthouseNex(rich);
    if ("error" in r) throw new Error(r.error);
    expect(nexBalance(r.progression.nexLedger)).toBe(40000 - PENTHOUSE_PRICE);
    expect(ownsPenthouseNex(r.progression.nexLedger)).toBe(true);
    expect("error" in buyPenthouseNex(r.progression)).toBe(true);
    expect(nexBalance(r.progression.nexLedger)).toBe(40000 - PENTHOUSE_PRICE);
  });
  test("refuses without the Nex and leaves the ledger alone", () => {
    const r = buyPenthouseNex(poor);
    expect("error" in r && r.error).toContain("Needs");
    expect(ownsPenthouseNex(poor.nexLedger)).toBe(false);
  });
  test("the live host notifies the scene and can be withdrawn", () => {
    let n = 0; const off = subscribePenthouse(() => n++);
    publishPenthouse({ owned: false, balance: 5, buy: () => ({ ok: false, reason: "no" }) });
    expect(penthouseLive()?.balance).toBe(5);
    publishPenthouse(null); off();
    expect(n).toBe(2); expect(penthouseLive()).toBeNull();
  });
});
