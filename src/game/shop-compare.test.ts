import { describe, expect, it } from "bun:test";
import { sortOffers, comparePrice } from "./shop-compare";
import { REGIONAL_SHOPS, shopOffers, type ShopOffer } from "./regional-shops";

const mk = (key: string, price: number) => ({ key, type: "material", name: key, detail: "", price, minLevel: 1, material: "scrapMetal", amount: 1 }) as ShopOffer;

describe("shop compare", () => {
  it("sorts by price and filters affordable", () => {
    const list = [mk("a", 50), mk("b", 10), mk("c", 30)];
    expect(sortOffers(list, "price-asc").map((o) => o.price)).toEqual([10, 30, 50]);
    expect(sortOffers(list, "price-desc", 40, true).map((o) => o.price)).toEqual([30, 10]);
  });
  it("never compares a shop against itself", () => {
    const shop = REGIONAL_SHOPS[0]!;
    const offer = shopOffers(shop, 100)[0];
    if (!offer) return;
    expect(comparePrice(shop, offer, 100).cheapest?.shopName).not.toBe(shop.name);
  });
});
