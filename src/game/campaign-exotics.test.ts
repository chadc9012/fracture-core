import { describe, expect, test } from "bun:test";
import { CAMPAIGN_EXOTIC, QUEST_WEAPON, backfillCampaignExotics, campaignExotic } from "./weapon-loot";
import { QUESTS } from "./quests";
import { STORM_ISLAND_QUESTS } from "./storm-islands";
import { stormMissionId } from "./storm-quests";
import { WEAPON_CATALOG } from "./weapon-catalog";

describe("campaign exotics", () => {
  test("every mission/quest catalogue weapon is earned by exactly one story mission, Fracture Descent chapter or Storm mission", () => {
    const earnable = WEAPON_CATALOG.filter((w) => w.via === "mission" || w.via === "quest").map((w) => w.name).sort();
    expect([...Object.values(CAMPAIGN_EXOTIC), ...Object.values(QUEST_WEAPON)].sort()).toEqual(earnable);
    for (const id of Object.keys(CAMPAIGN_EXOTIC)) expect(campaignExotic(id)?.rarity).toBe("EXOTIC");
    const sources = new Set([...Object.keys(QUESTS), ...STORM_ISLAND_QUESTS.map((q) => stormMissionId(q.id))]);
    for (const id of Object.keys(QUEST_WEAPON)) { expect(sources.has(id)).toBe(true); expect(campaignExotic(id)).not.toBeNull(); }
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
