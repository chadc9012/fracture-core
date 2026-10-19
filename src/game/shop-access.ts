import { REGIONAL_SHOPS, type RegionalShop } from "./regional-shops";

export type ShopAccessKind = "interior" | "window" | "table";
const WALK_INS = new Set(["nexus-armory", "nexus-plate", "nexus-calibration", "neon-dealer", "neon-mods", "neon-underground", "waste-garage", "solara-garage", "frost-research", "ember-alliance"]);
const WINDOWS = new Set(["thal-curator", "swamp-relics", "veridan-broker"]);
export const shopAccessKind = (id: string): ShopAccessKind => WALK_INS.has(id) ? "interior" : WINDOWS.has(id) ? "window" : "table";

/** Interior coordinates are local. No world shop may leak into another pocket room. */
export function accessibleShop(x: number, z: number, interior: { shopId?: string; origin: { x: number; z: number } } | null): RegionalShop | null {
  if (interior) {
    if (!interior.shopId || Math.hypot(x - interior.origin.x, z - interior.origin.z + 0.2) > 3.5) return null;
    return REGIONAL_SHOPS.find((s) => s.id === interior.shopId) ?? null;
  }
  let best: RegionalShop | null = null;
  let distance = 4;
  for (const shop of REGIONAL_SHOPS) {
    if (shopAccessKind(shop.id) === "interior") continue;
    const d = Math.hypot(x - shop.x, z - shop.z - 1.6);
    if (d < distance) { best = shop; distance = d; }
  }
  return best;
}
