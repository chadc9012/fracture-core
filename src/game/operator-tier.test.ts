// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { BODY_TIERS, TIER_BODIES, bodyTierFor, tierBodyFor, wornArmorPower } from "./operator-tier";

const gear = (powers: number[]) => {
  const slots = ["helmet", "gauntlets", "chest", "legs", "classItem"] as const;
  const inventory = powers.map((power, i) => ({ id: `a${i}`, slot: slots[i]!, power }));
  return { inventory, equippedGear: Object.fromEntries(inventory.map((it) => [it.slot, it.id])) };
};

describe("operator body tiers", () => {
  test("the tier follows the average worn armor power, and empty slots pull it down", () => {
    expect(bodyTierFor(undefined)).toBe("ROOKIE");
    expect(bodyTierFor(gear([90, 90, 90, 90, 90]))).toBe("ROOKIE");
    expect(bodyTierFor(gear([150, 150, 150, 150, 150]))).toBe("VETERAN");
    expect(bodyTierFor(gear([240, 240, 240, 240, 240]))).toBe("ELITE");
    expect(bodyTierFor(gear([340, 340]))).toBe("ROOKIE"); // two great pieces are not a set
    expect(wornArmorPower(gear([100, 200]))).toBe(60);
  });
  test("every class has all three tier bodies", () => {
    for (const cls of ["TITAN", "HUNTER", "WARLOCK"] as const) for (const t of BODY_TIERS) expect(TIER_BODIES[cls][t]).toBeDefined();
    expect(tierBodyFor("WARLOCK", gear([160, 160, 160, 160, 160])).body.url).toContain("cipher-veteran");
  });
  test("one piece never flips the whole body", () => {
    expect(bodyTierFor(gear([340, 90, 90, 90, 90]))).toBe("ROOKIE");
  });
  test("a tier without an authored body falls back down; every listed body exists", () => {
    expect(tierBodyFor("TITAN", gear([300, 300, 300, 300, 300])).tier).toBe("ELITE");
    for (const cls of ["TITAN", "HUNTER", "WARLOCK"] as const) {
      expect(TIER_BODIES[cls].ROOKIE).toBeDefined();
      expect(TIER_BODIES[cls].ROOKIE!.url).toMatch(/-authored\.glb$/);
      const veteranGear = gear([160, 160, 160, 160, 160]);
      const got = tierBodyFor(cls, veteranGear);
      expect(BODY_TIERS.indexOf(got.tier)).toBeLessThanOrEqual(BODY_TIERS.indexOf("VETERAN"));
      for (const t of BODY_TIERS) { const b = TIER_BODIES[cls][t]; if (b) expect(existsSync(`public${b.url}`)).toBe(true); }
    }
  });
});
