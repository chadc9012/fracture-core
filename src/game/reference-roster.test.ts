import { expect, test } from "bun:test";
import { ENEMY_GROUPS, REFERENCE_MERCHANTS, WILDLIFE_BY_REGION, groupsInRegion, merchantsInRegion } from "./reference-roster";
import { POPULATION_REGIONS, REGION_FACTION, SHOPKEEPERS } from "./population";
import { REGIONAL_SHOPS } from "./regional-shops";

test("every region has at least one enemy group, and the two safe cities have only Nexus Forces", () => {
  for (const r of POPULATION_REGIONS) expect(groupsInRegion(r).length).toBeGreaterThan(0);
  for (const r of ["nexus", "neon"] as const) expect(groupsInRegion(r).map((g) => g.id)).toEqual(["nexus-forces"]);
});
test("placements agree with the factions the game already spawns", () => {
  for (const g of ENEMY_GROUPS) if (g.existingFaction) for (const r of POPULATION_REGIONS) if (REGION_FACTION[r] === g.existingFaction) expect(g.regions).toContain(r);
});
test("merchants stand in real regions and at real shops, each shop keeper being that merchant", () => {
  for (const m of REFERENCE_MERCHANTS) {
    expect(POPULATION_REGIONS).toContain(m.region);
    if (m.shopId) {
      expect(REGIONAL_SHOPS.some((s) => s.id === m.shopId)).toBe(true);
      expect(SHOPKEEPERS.find((k) => k.shopId === m.shopId)?.name).toBe(m.name);
      expect(SHOPKEEPERS.find((k) => k.shopId === m.shopId)?.region).toBe(m.region);
    }
  }
  expect(merchantsInRegion("nexus").length).toBe(4);
  expect(REFERENCE_MERCHANTS.filter((m) => !m.shopId)).toEqual([]); // every sheet merchant now keeps a shop
});
test("wildlife names only appear in regions that list the wildlife group", () => {
  const wild = ENEMY_GROUPS.find((g) => g.id === "wildlife")!;
  for (const r of Object.keys(WILDLIFE_BY_REGION) as (keyof typeof WILDLIFE_BY_REGION)[]) expect(wild.regions).toContain(r);
});
