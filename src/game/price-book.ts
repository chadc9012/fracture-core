/** One place that reads every big-ticket price in the game (vehicles, aircraft, homes, deeds, penthouses and their upgrades) so the
 * whole economy can be audited and held to the same rules. Prices stay where they are authored; this only reads them.
 * Scale: 1 Nex ~ $100 (market-prices.ts). Rules the tests enforce (price-book.test.ts):
 *   - apartments, lofts and condos cost less than a penthouse; a penthouse, fully upgraded, costs less than an estate/villa
 *   - a penthouse's all-in price is at most 2.5-3x its base, so upgrades are a real choice, not a second purchase
 *   - the Skyline Casino penthouse costs more than the Aegis one, bought and fully upgraded
 *   - aircraft cost more than ground vehicles on average, and nothing outprices the exotic */
import { HOMES } from "./housing";
import { deeds } from "./residence-deeds";
import { FLEET } from "./fleet";
import { fleetNexPrice, USD_PER_NEX } from "./market-prices";
import { PENTHOUSES, maxedPrice } from "./penthouse-upgrades";

export type PriceRow = { category: "vehicle" | "aircraft" | "boat" | "home" | "deed" | "penthouse"; id: string; name: string; nex: number; /** all-in with every upgrade, where there are upgrades */ maxNex?: number };
const CAT = { LAND: "vehicle", HEAVY: "vehicle", AIR: "aircraft", AQUATIC: "boat" } as const;

export function priceBook(): PriceRow[] {
  const rows: PriceRow[] = [];
  for (const f of FLEET) rows.push({ category: CAT[f.category], id: f.id, name: f.name, nex: fleetNexPrice(f.id) });
  for (const h of HOMES) rows.push(h.id in PENTHOUSES
    ? { category: "penthouse", id: h.id, name: h.name, nex: h.price, maxNex: maxedPrice(h.id as keyof typeof PENTHOUSES) }
    : { category: "home", id: h.id, name: h.name, nex: h.price });
  for (const d of deeds()) rows.push({ category: "deed", id: d.id, name: `${d.name} (${d.city})`, nex: d.price });
  const sky = PENTHOUSES["skyline-penthouse"];
  rows.push({ category: "penthouse", id: sky.id, name: sky.name, nex: sky.base, maxNex: maxedPrice(sky.id) });
  return rows;
}
export const dollars = (nex: number) => nex * USD_PER_NEX;
