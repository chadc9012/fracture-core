import { describe, expect, test } from "bun:test";
import { WEAPON_CATALOG, catalogFrom, catalogWeek, nextCatalogReset, weeklyCatalogStock } from "./weapon-catalog";
import { rollWeaponLoot } from "./weapon-loot";
import { REGIONAL_SHOPS, shopOffers, buyOffer, today } from "./regional-shops";
import { DEFAULT_PROGRESSION } from "./progression";

describe("named weapon catalogue", () => {
  test("every entry is unique, has a rarity, a source and a manifest tier matching its rarity", () => {
    expect(new Set(WEAPON_CATALOG.map((w) => w.id)).size).toBe(WEAPON_CATALOG.length);
    expect(WEAPON_CATALOG.length).toBeGreaterThanOrEqual(40);
    for (const w of WEAPON_CATALOG) expect({ common: "T1", uncommon: "T2", rare: "T3", epic: "T4", exotic: "T5" }[w.rarity]).toBe(w.tier);
    expect(catalogFrom("shop").every((w) => w.rarity === "common")).toBe(true);
  });
  test("the weekly stock is stable within a week, changes the next, and resets on Monday 00:00 UTC", () => {
    const mon = Date.UTC(2026, 9, 19); // a Monday
    const a = weeklyCatalogStock("nexus-armory", mon), b = weeklyCatalogStock("nexus-armory", mon + 6 * 86_400_000);
    expect(a.map((w) => w.id)).toEqual(b.map((w) => w.id));
    expect(new Set(a.map((w) => w.id)).size).toBe(a.length);
    expect(nextCatalogReset(mon)).toBe(mon + 7 * 86_400_000);
    expect(catalogWeek(mon - 1)).toBe(catalogWeek(mon) - 1);
    const weeks = new Set(Array.from({ length: 6 }, (_, i) => weeklyCatalogStock("nexus-armory", mon + i * 7 * 86_400_000).map((w) => w.id).join()));
    expect(weeks.size).toBeGreaterThan(1);
  });
  test("weapon shops sell this week's catalogue weapons and buying one adds it to the inventory", () => {
    const shop = REGIONAL_SHOPS.find((s) => s.id === "nexus-armory")!;
    const weekly = shopOffers(shop, today()).filter((o) => o.detail.startsWith("WEEKLY"));
    expect(weekly.length).toBeGreaterThan(0);
    const p = { ...structuredClone(DEFAULT_PROGRESSION), level: 20, materials: { scrapMetal: 9999 } };
    const r = buyOffer(p, shop, weekly[0]!);
    if ("error" in r) throw new Error(r.error);
    expect(r.progression.inventory.some((g) => g.name === weekly[0]!.name)).toBe(true);
  });
  test("rare catalogue weapons can drop from enemies, epic ones only from bosses", () => {
    const names = (src: "enemy-regular" | "enemy-boss") => { const n = new Set<string>(); for (let i = 0; i < 4000; i++) { const g = rollWeaponLoot(src, `z${i}`, (i % 7) / 1000, `${i}`); if (g) n.add(g.name); } return n; };
    const enemy = names("enemy-regular"), boss = names("enemy-boss");
    expect(catalogFrom("loot").some((w) => enemy.has(w.name))).toBe(true);
    expect(catalogFrom("boss").some((w) => enemy.has(w.name))).toBe(false);
    expect(catalogFrom("boss").some((w) => boss.has(w.name))).toBe(true);
  });
});
