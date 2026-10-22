import { REGIONAL_SHOPS, shopOffers, type RegionalShop, type ShopOffer } from "./regional-shops";

export type PriceCompare = { cheapest: { shopName: string; place: string; price: number } | null; delta: number | null };

/** Same item (by name, same currency) stocked today at other shops — the cheapest one and how this price compares. */
export function comparePrice(shop: RegionalShop, offer: ShopOffer, day?: number): PriceCompare {
  let best: PriceCompare["cheapest"] = null;
  for (const other of REGIONAL_SHOPS) {
    if (other.id === shop.id || other.currency !== shop.currency) continue;
    const match = shopOffers(other, day).find((o) => o.name === offer.name);
    if (match && (!best || match.price < best.price)) best = { shopName: other.name, place: other.place, price: match.price };
  }
  return { cheapest: best, delta: best ? offer.price - best.price : null };
}

export type OfferSort = "default" | "price-asc" | "price-desc";
export function sortOffers(offers: ShopOffer[], sort: OfferSort, funds?: number, affordableOnly = false): ShopOffer[] {
  const list = affordableOnly && funds !== undefined ? offers.filter((o) => o.price <= funds) : [...offers];
  if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
  return list;
}
