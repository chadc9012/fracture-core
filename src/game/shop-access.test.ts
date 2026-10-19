import { describe, expect, test } from "bun:test";
import { REGIONAL_SHOPS } from "./regional-shops";
import { accessibleShop, shopAccessKind } from "./shop-access";
import { DOOR_RADIUS, INTERIORS, SHOP_INTERIORS, atExitMarker, doorAt } from "./interiors";

describe("walk-in storefronts", () => {
  test("every walk-in shop has exactly one storefront interior", () => {
    const walkIns = REGIONAL_SHOPS.filter((s) => shopAccessKind(s.id) === "interior");
    expect(walkIns.length).toBeGreaterThan(0);
    for (const s of walkIns) expect(SHOP_INTERIORS.filter((i) => i.shopId === s.id).length).toBe(1);
  });
  test("walk-in shops trade only inside; street stalls only outside", () => {
    for (const s of REGIONAL_SHOPS) {
      const street = accessibleShop(s.x, s.z + 1.6, null);
      if (shopAccessKind(s.id) === "interior") expect(street?.id).not.toBe(s.id);
      else expect(street?.id).toBe(s.id);
    }
    for (const it of SHOP_INTERIORS) {
      expect(accessibleShop(it.origin.x, it.origin.z - 0.5, it)?.id).toBe(it.shopId!);
      // a pocket room never exposes some other shop
      expect(accessibleShop(it.origin.x, it.origin.z - 0.5, { origin: it.origin })).toBeNull();
    }
  });
  test("each storefront door enters its own room, and arriving does not drop you on the exit", () => {
    for (const it of SHOP_INTERIORS) {
      expect(doorAt(it.doorPos.x, it.doorPos.z)?.id).toBe(it.id);
      expect(atExitMarker(it, it.spawnOffset.x, it.spawnOffset.z)).toBe(false);
    }
  });
  test("no two doors overlap and no two pocket rooms share space", () => {
    for (let a = 0; a < INTERIORS.length; a++) for (let b = a + 1; b < INTERIORS.length; b++) {
      const A = INTERIORS[a]!, B = INTERIORS[b]!;
      expect(Math.hypot(A.doorPos.x - B.doorPos.x, A.doorPos.z - B.doorPos.z)).toBeGreaterThan(DOOR_RADIUS * 2);
      expect(Math.hypot(A.origin.x - B.origin.x, A.origin.z - B.origin.z)).toBeGreaterThan(20);
    }
  });
});
