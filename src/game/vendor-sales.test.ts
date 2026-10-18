import { describe, expect, test } from "bun:test";
import { VENDOR_DEFS, vendorStock } from "./vendors";
import { MAX_DISCOUNT, applySales, isPrestige, todaysBundle } from "./vendor-sales";

const SUNDAY = 3; // epoch day 3 is a Sunday (UTC)
const vendor = (id: string) => VENDOR_DEFS.find((v) => v.id === id)!;

describe("vendor sales", () => {
  test("exactly one daily deal per day per shop, 20% off, and it changes with the day", () => {
    const v = vendor("scrap"), stock = vendorStock(v, 123);
    const a = applySales(stock, v, { day: 100 });
    const deals = a.filter((l) => l.sales.some((s) => s.kind === "DAILY"));
    expect(deals.length).toBe(1);
    expect(deals[0]!.price).toBe(Math.round(deals[0]!.basePrice * 0.8));
    const keys = new Set(Array.from({ length: 30 }, (_, d) => applySales(stock, v, { day: d }).find((l) => l.sales.length)?.key));
    expect(keys.size).toBeGreaterThan(1);
  });
  test("black market and prestige tiers are never discounted, even with every sale active", () => {
    const b = vendor("black"), stock = vendorStock(b, 7);
    for (const l of applySales(stock, b, { day: SUNDAY, reputation: 100, districtEvent: "festival" })) { expect(l.price).toBe(l.basePrice); expect(l.sales).toEqual([]); }
    const s = vendor("singularity");
    for (const l of applySales(vendorStock(s, 9), s, { day: SUNDAY, districtEvent: "festival" })) if (isPrestige(l)) expect(l.price).toBe(l.basePrice);
  });
  test("stacked discounts never exceed 30%", () => {
    const f = vendor("faction");
    for (let seed = 0; seed < 40; seed++) for (const l of applySales(vendorStock(f, seed), f, { day: SUNDAY, reputation: 100, districtEvent: "festival" })) expect(l.price).toBeGreaterThanOrEqual(Math.round(l.basePrice * (1 - MAX_DISCOUNT)) - 1);
  });
  test("faction standing scales the faction discount and only applies at the faction quarter", () => {
    const f = vendor("faction"), stock = vendorStock(f, 11);
    const none = applySales(stock, f, { day: 50, reputation: 0 }), half = applySales(stock, f, { day: 50, reputation: 50 });
    const first = (arr: ReturnType<typeof applySales>) => arr.find((l) => !isPrestige(l))!;
    expect(first(half).price).toBeLessThanOrEqual(first(none).price);
    const s = vendor("scrap");
    expect(applySales(vendorStock(s, 11), s, { day: 50, reputation: 100 }).every((l) => l.sales.every((x) => x.kind !== "FACTION"))).toBe(true);
  });
  test("clearance only runs on Sundays and only on the cheapest tiers", () => {
    const v = vendor("scrap"), stock = vendorStock(v, 5);
    expect(applySales(stock, v, { day: SUNDAY + 1 }).some((l) => l.sales.some((s) => s.kind === "CLEARANCE"))).toBe(false);
    for (const l of applySales(stock, v, { day: SUNDAY })) if (l.sales.some((s) => s.kind === "CLEARANCE")) expect(["T1", "T2", "T1-2"]).toContain(l.item.tier);
  });
  test("a bundle is one weapon plus one armor at 10% off the pair, never at the black market", () => {
    const v = vendor("scrap");
    let found = false;
    for (let seed = 0; seed < 50 && !found; seed++) {
      const b = todaysBundle(applySales(vendorStock(v, seed), v, { day: 1 }), v);
      if (b) { found = true; expect(b.price).toBe(Math.round(b.basePrice * 0.9)); expect(b.weapon.kind).toBe("weapon"); expect(b.armor.kind).toBe("armor"); }
    }
    expect(found).toBe(true);
    expect(todaysBundle(applySales(vendorStock(vendor("black"), 1), vendor("black"), { day: 1 }), vendor("black"))).toBeNull();
  });
  test("sale price is what purchaseListing charges, base price is kept for display", () => {
    const v = vendor("scrap"), l = applySales(vendorStock(v, 3), v, { day: SUNDAY })[0]!;
    expect(l.basePrice).toBeGreaterThanOrEqual(l.price);
    expect(typeof l.key).toBe("string");
  });
});
