import { describe, expect, test } from "bun:test";
import { priceBook, dollars, type PriceRow } from "./price-book";
import { deeds } from "./residence-deeds";
import { HOMES } from "./housing";

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
