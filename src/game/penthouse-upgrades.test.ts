import { describe, expect, test } from "bun:test";
import { PENTHOUSES, buyPenthouseUpgrade, isMaxed, maxedPrice, ownedUpgrades, spentOn, upgradesTotal, ownsPenthouse } from "./penthouse-upgrades";
import { buyPenthouseNex, PENTHOUSE_PRICE } from "./casino-property";
import { buyHome } from "./housing";
import { DEFAULT_PROGRESSION } from "./progression";
import { nexBalance } from "./nex";

const rich = () => ({ ...DEFAULT_PROGRESSION, nexLedger: { seed: 500_000 } });
const must = <T>(r: T | { error: string }): T => { if (r && typeof r === "object" && "error" in r) throw new Error((r as { error: string }).error); return r as T; };

describe("penthouse prices ($1 = 0.01 Nex)", () => {
  test("Skyline Casino penthouse: $3.5M to buy, $10M fully upgraded", () => {
    expect(PENTHOUSE_PRICE * 100).toBe(3_500_000);
    expect(maxedPrice("skyline-penthouse") * 100).toBe(10_000_000);
  });
  test("Aegis Spire penthouse: $1.5M to buy, $4M fully upgraded", () => {
    expect(PENTHOUSES["aegis-penthouse"].base * 100).toBe(1_500_000);
    expect(maxedPrice("aegis-penthouse") * 100).toBe(4_000_000);
  });
  test("upgrade ids are unique and every price is a positive whole number", () => {
    for (const pent of Object.values(PENTHOUSES)) { expect(new Set(pent.upgrades.map((u) => u.id)).size).toBe(pent.upgrades.length); for (const u of pent.upgrades) expect(Number.isInteger(u.price) && u.price > 0).toBe(true); }
  });
});
describe("buying upgrades", () => {
  test("needs the penthouse first, then charges each upgrade once", () => {
    let p = rich();
    expect("error" in buyPenthouseUpgrade(p, "skyline-penthouse", "bar")).toBe(true);
    p = must(buyPenthouseNex(p)).progression;
    p = must(buyPenthouseUpgrade(p, "skyline-penthouse", "bar")).progression;
    expect(nexBalance(p.nexLedger)).toBe(500_000 - PENTHOUSE_PRICE - 7_000);
    expect("error" in buyPenthouseUpgrade(p, "skyline-penthouse", "bar")).toBe(true);
    expect(nexBalance(p.nexLedger)).toBe(500_000 - PENTHOUSE_PRICE - 7_000);
  });
  test("refuses short of Nex and leaves the ledger alone", () => {
    const p = must(buyPenthouseNex({ ...DEFAULT_PROGRESSION, nexLedger: { seed: PENTHOUSE_PRICE + 100 } })).progression;
    const r = buyPenthouseUpgrade(p, "skyline-penthouse", "cinema");
    expect("error" in r && r.error).toContain("Needs 12,000 Nex");
    expect(ownedUpgrades(p.nexLedger, "skyline-penthouse").length).toBe(0);
  });
  test("fully upgrading each penthouse costs exactly its all-in price", () => {
    let s = must(buyPenthouseNex(rich())).progression;
    for (const u of PENTHOUSES["skyline-penthouse"].upgrades) s = must(buyPenthouseUpgrade(s, "skyline-penthouse", u.id)).progression;
    expect(isMaxed(s.nexLedger, "skyline-penthouse")).toBe(true);
    expect(500_000 - nexBalance(s.nexLedger)).toBe(maxedPrice("skyline-penthouse"));
    expect(spentOn(s, "skyline-penthouse")).toBe(100_000);
    let a = must(buyHome(rich(), "aegis-penthouse")).progression;
    expect(ownsPenthouse(a, "aegis-penthouse")).toBe(true);
    for (const u of PENTHOUSES["aegis-penthouse"].upgrades) a = must(buyPenthouseUpgrade(a, "aegis-penthouse", u.id)).progression;
    expect(500_000 - nexBalance(a.nexLedger)).toBe(40_000);
    expect(upgradesTotal("aegis-penthouse")).toBe(25_000);
  });
});
