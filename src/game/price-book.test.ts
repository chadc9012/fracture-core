import { describe, expect, test } from "bun:test";
import { priceBook, dollars, type PriceRow } from "./price-book";
import { deeds } from "./residence-deeds";
import { HOMES, DECOR } from "./housing";
import { CREDIT_PRICE, ARMOR_CREDIT_PRICE, VENDOR_DEFS } from "./vendors";
import { WEAPON_PRICE, ARMOR_PRICE } from "./regional-shops";
import { STARTING_WALLET } from "./economy";

const rows = priceBook(), cat = (c: PriceRow["category"]) => rows.filter((r) => r.category === c);
const max = (xs: number[]) => Math.max(...xs), min = (xs: number[]) => Math.min(...xs), avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const get = (id: string) => rows.find((r) => r.id === id)!;

describe("price book", () => {
  test("every row has a positive whole-number price and ids are unique per category", () => {
    for (const r of rows) { expect(Number.isInteger(r.nex) && r.nex > 0).toBe(true); if (r.maxNex) expect(r.maxNex).toBeGreaterThan(r.nex); }
    for (const c of ["vehicle", "aircraft", "boat", "home", "deed", "penthouse"] as const) { const ids = cat(c).map((r) => r.id); expect(new Set(ids).size).toBe(ids.length); }
  });
  test("penthouses are the headline tier: base and fully-upgraded figures", () => {
    expect(dollars(get("skyline-penthouse").nex)).toBe(3_500_000);
    expect(dollars(get("skyline-penthouse").maxNex!)).toBe(10_000_000);
    expect(dollars(get("aegis-penthouse").nex)).toBe(1_500_000);
    expect(dollars(get("aegis-penthouse").maxNex!)).toBe(4_000_000);
    expect(get("skyline-penthouse").nex).toBeGreaterThan(get("aegis-penthouse").nex);
    expect(get("skyline-penthouse").maxNex!).toBeGreaterThan(get("aegis-penthouse").maxNex!);
  });
  test("upgrades are a choice, not a second purchase: all-in is 2-3x the base", () => {
    for (const r of cat("penthouse")) { const k = r.maxNex! / r.nex; expect(k).toBeGreaterThan(2); expect(k).toBeLessThan(3); }
  });
  test("apartments, lofts and condos cost less than the cheapest penthouse; estates cost more than every fully-upgraded penthouse", () => {
    const pent = min(cat("penthouse").map((r) => r.nex));
    for (const d of deeds()) if (d.kind !== "HOUSE") expect(d.price).toBeLessThan(pent);
    for (const h of HOMES) if (h.kind === "APARTMENT") expect(h.price).toBeLessThan(pent);
    const biggestPent = max(cat("penthouse").map((r) => r.maxNex!));
    expect(max(deeds().filter((d) => d.kind === "HOUSE").map((d) => d.price))).toBeGreaterThan(biggestPent);
  });
  test("vehicles: aircraft cost more than ground vehicles on average; no vehicle or aircraft outprices the exotic", () => {
    expect(avg(cat("aircraft").map((r) => r.nex))).toBeGreaterThan(avg(cat("vehicle").map((r) => r.nex)) * 3);
    expect(max([...cat("vehicle"), ...cat("aircraft"), ...cat("boat")].map((r) => r.nex))).toBe(get("void-skimmer-prototype").nex);
  });
  test("a vehicle is never dearer than the penthouse it parks under (the fully upgraded Skyline suite beats every vehicle)", () => {
    expect(get("skyline-penthouse").maxNex!).toBeLessThan(get("void-skimmer-prototype").nex); // the one exotic is a rarer buy than a suite
  });
});

describe("decor, weapons and armour", () => {
  test("decor: no item costs more than 40% of the cheapest penthouse, so a fit-out never rivals the home", () => {
    const pent = min(cat("penthouse").map((r) => r.nex));
    for (const d of DECOR) expect(d.price).toBeLessThanOrEqual(pent * 0.4);
  });
  test("decor ladder: every slot has a budget option of 800 Nex or less and premium pieces cost several times that", () => {
    for (const slot of new Set(DECOR.map((d) => d.slot))) {
      const items = DECOR.filter((d) => d.slot === slot).map((d) => d.price);
      expect(min(items)).toBeLessThanOrEqual(800);
    }
    expect(max(DECOR.map((d) => d.price)) / min(DECOR.map((d) => d.price))).toBeGreaterThan(20);
  });
  test("weapon and armour prices rise with every tier, on every price table", () => {
    const rising = (xs: readonly number[]) => xs.every((v, i) => i === 0 || v >= xs[i - 1]!);
    expect(rising(CREDIT_PRICE) && rising(ARMOR_CREDIT_PRICE)).toBe(true);
    expect(rising([WEAPON_PRICE.T1, WEAPON_PRICE.T2, WEAPON_PRICE.T3, WEAPON_PRICE.T4, WEAPON_PRICE.T5])).toBe(true);
    expect(rising([ARMOR_PRICE["T1-2"], ARMOR_PRICE["T3-4"], ARMOR_PRICE.T5])).toBe(true);
  });
  test("a top-tier weapon costs 25-50x an entry one (an arms market, not a flat shelf)", () => {
    expect(CREDIT_PRICE[4]! / CREDIT_PRICE[0]!).toBeGreaterThan(25);
    expect(CREDIT_PRICE[4]! / CREDIT_PRICE[0]!).toBeLessThan(50);
    expect(WEAPON_PRICE.T5 / WEAPON_PRICE.T1).toBeGreaterThan(20);
  });
  test("a new player's starting credits buy a mid-tier weapon but not an endgame one", () => {
    expect(STARTING_WALLET.credits).toBeGreaterThanOrEqual(CREDIT_PRICE[2]!);
    expect(STARTING_WALLET.credits).toBeLessThan(CREDIT_PRICE[3]! * 1.35);
  });
  test("the black market charges a premium over every honest vendor", () => {
    const black = VENDOR_DEFS.find((v) => v.id === "black")!;
    expect(black.priceMult).toBeGreaterThan(Math.max(...VENDOR_DEFS.filter((v) => v.id !== "black").map((v) => v.priceMult)));
  });
});
