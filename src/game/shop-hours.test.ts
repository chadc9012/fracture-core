// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, describe, expect, it } from "bun:test";
import { isOpenAt, setShopClockHour, shopClosedReason, shopHours, shopHoursLabel } from "./shop-hours";
import { REGIONAL_SHOPS, shopLock } from "./regional-shops";

afterEach(() => setShopClockHour(null));
const p = { level: 99, completedMissions: ["system-core", "stitched-neon-core", "awakening", "side-vault"] };

describe("shop hours", () => {
  it("city shops close for the small hours, black markets open only at night, outposts never close", () => {
    const armory = REGIONAL_SHOPS.find((s) => s.id === "nexus-armory")!;
    expect(isOpenAt(shopHours(armory), 12)).toBe(true);
    expect(isOpenAt(shopHours(armory), 3)).toBe(false);
    expect(isOpenAt(shopHours(armory), 0.5)).toBe(true);
    const bm = REGIONAL_SHOPS.find((s) => s.kind === "blackmarket" && s.id.startsWith("neon-"))!;
    expect(isOpenAt(shopHours(bm), 12)).toBe(false);
    expect(isOpenAt(shopHours(bm), 22)).toBe(true);
    expect(isOpenAt(shopHours(bm), 2)).toBe(true);
    const outpost = REGIONAL_SHOPS.find((s) => s.id === "waste-garage")!;
    expect(shopHours(outpost)).toBeNull();
    expect(isOpenAt(shopHours(outpost), 3)).toBe(true);
  });
  it("is always open until a clock is set, so tests and menus never get locked out", () => {
    for (const s of REGIONAL_SHOPS) expect(shopClosedReason(s, null)).toBeNull();
    const armory = REGIONAL_SHOPS.find((s) => s.id === "nexus-armory")!;
    expect(shopLock(armory, p)).toBeNull();
  });
  it("shopLock reports the closed hours once the world clock says so", () => {
    const armory = REGIONAL_SHOPS.find((s) => s.id === "nexus-armory")!;
    setShopClockHour(3);
    expect(shopLock(armory, p)).toBe("Closed · opens 05:00");
    setShopClockHour(9);
    expect(shopLock(armory, p)).toBeNull();
  });
  it("labels hours for the shop window", () => {
    expect(shopHoursLabel({ open: 5, close: 25 })).toBe("05:00–01:00");
    expect(shopHoursLabel(null)).toBe("Always open");
  });
});
