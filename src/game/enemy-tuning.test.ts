// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { ENEMY_TUNING, aggroRadius, clampAggroMult, trooperSpeed, windupFor } from "./enemy-tuning";
import { ENCOUNTERS, factionOf } from "./encounters";

describe("enemy pressure", () => {
  it("troopers notice you closer than before, and adaptation can never push it past the cap", () => {
    expect(aggroRadius(0, false, 1, 1)).toBeLessThan(55);
    expect(aggroRadius(1, true, 1, 1)).toBeLessThan(95); // was 208 m for an elite at night
    expect(aggroRadius(0, false, 1.25, 1.6)).toBe(ENEMY_TUNING.aggroBase * ENEMY_TUNING.aggroMultMax);
    expect(clampAggroMult(0.1, 0.1)).toBe(ENEMY_TUNING.aggroMultMin);
  });
  it("troopers jog rather than sprint, and regulars telegraph ranged shots longest", () => {
    expect(trooperSpeed(1, true)).toBeLessThan(10);
    expect(windupFor({ boss: false, elite: false })).toBeGreaterThan(windupFor({ boss: false, elite: true }));
    expect(windupFor({ boss: false, elite: true })).toBeGreaterThan(windupFor({ boss: true, elite: true }));
  });
});

describe("factions follow the faction sheet", () => {
  it("Wastelands = Raiders, Nexus = Overclocked, Frostspire = Vanguard, Swamps = Aberrations, bosses included", () => {
    const sheet = { wastelands: "RAIDER", nexus: "OVERCLOCKED", frostspire: "VANGUARD", swamps: "ABERRATION" } as const;
    for (const [region, kind] of Object.entries(sheet)) {
      const e = ENCOUNTERS.find((x) => x.regionId === region)!;
      expect(e.troops.every((t) => t.kind === kind)).toBe(true);
      expect(factionOf(region)).toBe(kind);
    }
  });
});
