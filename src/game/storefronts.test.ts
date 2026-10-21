import { describe, expect, test } from "bun:test";
import { REGIONAL_SHOPS } from "./regional-shops";
import { shopAccessKind } from "./shop-access";
import { STOREFRONT, shopWalls, storefrontWalls, windowWall } from "./storefronts";
import { clearWalls, collideWalls, setWalls } from "./walls";
import { SHOP_INTERIORS } from "./interiors";

const BASE = 10;

describe("storefront street presence", () => {
  test("every shop is exactly one of: walk-in building, window facade, open-air table", () => {
    for (const s of REGIONAL_SHOPS) {
      const kind = shopAccessKind(s.id);
      const walls = shopWalls(s, BASE);
      if (kind === "interior") expect(walls).toHaveLength(5);
      else if (kind === "window") expect(walls).toHaveLength(1);
      else expect(walls).toHaveLength(0);
    }
  });

  test("a walk-in shop's door gap lines up with its interior door marker, and the walls block everywhere else", () => {
    for (const s of REGIONAL_SHOPS.filter((x) => shopAccessKind(x.id) === "interior")) {
      const door = SHOP_INTERIORS.find((i) => i.shopId === s.id)!;
      // the marker stands just outside the front wall, centred on the door gap
      expect(door.doorPos.x).toBeCloseTo(s.x, 5);
      expect(door.doorPos.z).toBeCloseTo(s.z + STOREFRONT.frontZ + 1, 5);
      setWalls(`t-${s.id}`, storefrontWalls(s, BASE));
      // walking through the door centre is free; walking into the front wall beside it is not
      const through = { x: s.x, z: s.z + STOREFRONT.frontZ };
      expect(collideWalls(through, 0.4, BASE + 0.5)).toBe(false);
      const intoWall = { x: s.x - STOREFRONT.w / 2 + 0.5, z: s.z + STOREFRONT.frontZ };
      expect(collideWalls(intoWall, 0.4, BASE + 0.5)).toBe(true);
      clearWalls(`t-${s.id}`);
    }
  });

  test("a window shop's facade is solid across the trading counter", () => {
    for (const s of REGIONAL_SHOPS.filter((x) => shopAccessKind(x.id) === "window")) {
      setWalls(`t-${s.id}`, [windowWall(s, BASE)]);
      const body = { x: s.x, z: s.z };
      expect(collideWalls(body, 0.4, BASE + 0.5)).toBe(true);
      clearWalls(`t-${s.id}`);
    }
  });

  test("no storefront wall overlaps another shop's door marker", () => {
    for (const a of REGIONAL_SHOPS) {
      if (shopAccessKind(a.id) === "table") continue;
      setWalls(`t-${a.id}`, shopWalls(a, BASE));
    }
    for (const it of SHOP_INTERIORS) {
      const body = { x: it.doorPos.x, z: it.doorPos.z };
      expect(collideWalls(body, 0.4, BASE + 0.5)).toBe(false);
    }
    clearWalls();
  });
});
