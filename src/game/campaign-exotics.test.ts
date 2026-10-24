import { describe, expect, test } from "bun:test";
import { CAMPAIGN_EXOTIC, backfillCampaignExotics, campaignExotic } from "./weapon-loot";
import { WEAPON_CATALOG } from "./weapon-catalog";

describe("campaign exotics", () => {
  test("every mission/quest catalogue weapon is earned by exactly one story mission", () => {
    const earnable = WEAPON_CATALOG.filter((w) => w.via === "mission" || w.via === "quest").map((w) => w.name).sort();
    expect(Object.values(CAMPAIGN_EXOTIC).sort()).toEqual(earnable);
    for (const id of Object.keys(CAMPAIGN_EXOTIC)) expect(campaignExotic(id)?.rarity).toBe("EXOTIC");
  });
  test("granting is idempotent and backfills earlier clears", () => {
    const p = { inventory: [] as import("./inventory").GearItem[], completedMissions: ["awakening", "broken-signal"] };
    const once = backfillCampaignExotics(p);
    expect(once.inventory.map((g) => g.name).sort()).toEqual(["Eclipse SMG", "Soulpiercer"]);
    expect(backfillCampaignExotics(once)).toBe(once);
  });
  test("later missions pay stronger exotics", () => {
    expect(campaignExotic("system-core")!.power).toBeGreaterThan(campaignExotic("awakening")!.power);
  });
});
