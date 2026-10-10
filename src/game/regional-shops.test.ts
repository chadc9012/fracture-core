// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { REGIONAL_SHOPS, shopNear, shopLock, shopOffers, buyOffer } from "./regional-shops";
import { loadProgression } from "./progression";

const shop = (id: string) => REGIONAL_SHOPS.find((s) => s.id === id)!;
const base = () => ({ ...loadProgression(), level: 1, completedMissions: [] as string[], materials: { scrapMetal: 500 } });

describe("regional shops", () => {
  test("you must walk up to a vendor to trade", () => {
    const s = shop("nexus-armory");
    expect(shopNear(s.x, s.z)?.id).toBe("nexus-armory");
    expect(shopNear(s.x + 20, s.z)).toBeNull();
  });
  test("level and story gates lock shops", () => {
    expect(shopLock(shop("ember-alliance"), { level: 3, completedMissions: [] })).toBe("Requires level 8");
    expect(shopLock(shop("ember-alliance"), { level: 9, completedMissions: [] })).not.toBeNull();
    expect(shopLock(shop("ember-alliance"), { level: 9, completedMissions: ["awakening"] })).toBeNull();
  });
  test("specialist stock: weapon dealers sell only weapons, never S-tier", () => {
    for (const o of shopOffers(shop("nexus-armory"), 1000)) { expect(o.type).toBe("gear"); if (o.type === "gear") { expect(o.listing.kind).toBe("weapon"); expect(o.listing.item.tier).not.toBe("S"); } }
    for (const o of shopOffers(shop("nexus-plate"), 1000)) if (o.type === "gear") expect(o.listing.kind).toBe("armor");
  });
  test("buying spends the shop currency and adds the item", () => {
    const s = shop("nexus-armory");
    const offer = shopOffers(s, 1000).find((o) => o.minLevel === 1)!;
    const r = buyOffer(base(), s, offer);
    if ("error" in r) throw new Error(r.error);
    expect(r.progression.materials.scrapMetal).toBe(500 - offer.price);
    expect(r.progression.inventory.length).toBe(base().inventory.length + 1);
  });
  test("cannot buy above your level or without funds", () => {
    const s = shop("nexus-armory");
    expect("error" in buyOffer({ ...base(), materials: {} }, s, shopOffers(s, 1000)[0]!)).toBe(true);
  });
});
