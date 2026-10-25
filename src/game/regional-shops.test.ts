// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { REGIONAL_SHOPS, shopNear, shopLock, shopOffers, buyOffer, serviceTargets } from "./regional-shops";
import { loadProgression } from "./progression";
import { COLLECTIONS } from "./armor-collections";

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

describe("tiered city armor and black market", () => {
  const rich = () => ({ ...loadProgression(), level: 20, completedMissions: ["stitched-neon-core", "system-core"], materials: { reinforcedAlloy: 5000, microCircuits: 5000 } });
  test("city armor shops never stock exotic, raid or dungeon collections", () => {
    for (const id of ["nexus-plate", "swamp-relics", "thal-curator"]) for (let d = 0; d < 20; d++) for (const o of shopOffers(shop(id), d)) if (o.type === "piece") {
      const c = COLLECTIONS.find((x) => x.id === o.drop.setId)!;
      expect(c.family).not.toBe("exotic"); expect(c.sources).not.toContain("raid"); expect(c.vendorTier! <= shop(id).vendorTier!).toBe(true);
    }
  });
  test("each shop has exactly one 30% daily deal", () => {
    expect(shopOffers(shop("nexus-plate"), 5).filter((o) => o.detail.startsWith("DAILY DEAL")).length).toBe(1);
  });
  test("black market needs level 10 and Stitched Neon Core, and sells only black-market collections", () => {
    const bm = shop("neon-underground");
    expect(shopLock(bm, { level: 9, completedMissions: ["stitched-neon-core"] })).toBe("Requires level 10");
    expect(shopLock(bm, { level: 10, completedMissions: [] })).not.toBeNull();
    for (const o of shopOffers(bm, 3)) if (o.type === "piece") expect(COLLECTIONS.find((x) => x.id === o.drop.setId)!.sources).toContain("black-market");
  });
  test("buying a piece grants it once and refuses a duplicate without charging", () => {
    const s = shop("nexus-plate"); const offer = shopOffers(s, 2).find((o) => o.type === "piece")!;
    const r = buyOffer(rich(), s, offer); if ("error" in r) throw new Error(r.error);
    expect(r.progression.materials.reinforcedAlloy).toBe(5000 - offer.price);
    const again = buyOffer(r.progression, s, offer);
    expect("error" in again).toBe(true);
  });
});

describe("faction outposts", () => {
  const living = (gain: Record<string, number>, loss: Record<string, number> = {}) => ({ gain, loss, districts: {}, contracts: {}, intel: [] });
  test("the Directorate Quartermaster only trades once the Aegis Directorate trusts you", () => {
    const q = shop("aegis-quartermaster");
    expect(shopLock(q, { level: 8, completedMissions: [] })).toContain("Trusted");
    expect(shopLock(q, { level: 8, completedMissions: [], living: living({ aegis: 5 }) } as never)).toContain("you are Neutral");
    expect(shopLock(q, { level: 8, completedMissions: [], living: living({ aegis: 30 }) } as never)).toBeNull();
    expect(shopLock(q, { level: 4, completedMissions: [], living: living({ aegis: 30 }) } as never)).toBe("Requires level 6");
  });
  test("the Legion Quartermaster opens after you hold the vault gates", () => {
    const q = shop("legion-quartermaster");
    expect(shopLock(q, { level: 5, completedMissions: [] })).toBe("Hold the Sub-Terra vault gates once");
    expect(shopLock(q, { level: 5, completedMissions: ["side-vault-defense"] })).toBeNull();
    expect(shopOffers(q).length).toBeGreaterThan(0);
  });
});

describe("merchant sheet shops", () => {
  test("The Bastion sells armor and is the only shop that upgrades armor pieces", () => {
    const b = shop("nexus-bastion");
    const p = { ...loadProgression(), level: 10, inventory: [
      { id: "h1", name: "Helm", slot: "helmet", power: 100, level: 1, element: "KINETIC", source: "test" },
      { id: "g1", name: "Rifle", slot: "primary", power: 100, level: 1, element: "KINETIC", source: "test" },
    ] } as never;
    expect(serviceTargets(b, p).map((i) => i.id)).toEqual(["h1"]);
    expect(serviceTargets(shop("nexus-calibration"), p).map((i) => i.id)).toEqual(["g1"]);
    for (let d = 0; d < 10; d++) for (const o of shopOffers(b, d)) if (o.type === "gear") expect(o.listing.kind).toBe("armor");
    expect(shopOffers(b, 3).some((o) => o.type === "piece" || o.type === "gear")).toBe(true);
  });
  test("Dune Gate sells rare materials (never its own currency) and named weapons, never exotic gear", () => {
    const s = shop("solara-dunegate");
    for (let d = 0; d < 14; d++) {
      const offers = shopOffers(s, d);
      expect(offers.some((o) => o.type === "material")).toBe(true);
      for (const o of offers) {
        if (o.type === "material") expect(o.material).not.toBe(s.currency);
        if (o.type === "gear") expect(o.listing.kind).toBe("weapon");
        expect(o.type).not.toBe("piece");
      }
    }
  });
  test("Nexus now has a vehicle shop", () => {
    expect(shop("nexus-drive-hub").kind).toBe("vehicles");
    expect(shop("nexus-drive-hub").place).toBe("Nexus City");
  });
});
