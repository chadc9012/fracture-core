import { describe, expect, test } from "bun:test";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "./progression";
import { infuseGear } from "./inventory";
import { mergeEvolution, ruins, canEvolve, evolveWeapon, discoverNearby, isDiscovered, isEvolved, registerEvolutionHit, freshCharge, burstTargets, evolutionDamageMult, EVOLVE_POWER_BONUS, EVOLVE_MIN_LEVEL, EVOLVE_CATALYSTS, EVOLVE_ELEMENT_AMOUNT, ABILITY_RULES, claimKey, ruinById } from "./weapon-evolution";
import { distanceToRoad, LANE_HALF_WIDTH } from "./lanes";

const ruin = ruins()[0]!;
function ready(level = EVOLVE_MIN_LEVEL): PlayerProgression {
  const p = DEFAULT_PROGRESSION;
  return {
    ...p,
    inventory: p.inventory.map((g) => (g.id === "vanguard-mk4" ? { ...g, level } : g)),
    materials: { ...p.materials, forgeCatalyst: EVOLVE_CATALYSTS, [ruin.material]: EVOLVE_ELEMENT_AMOUNT },
  };
}

describe("ruin sites", () => {
  test("five distinct, deterministic, off-road sites", () => {
    expect(ruins().length).toBe(5);
    expect(new Set(ruins().map((r) => r.id)).size).toBe(5);
    expect(new Set(ruins().map((r) => r.ability)).size).toBe(5);
    for (const r of ruins()) {
      expect(Number.isFinite(r.x + r.z)).toBe(true);
      expect(distanceToRoad(r.x, r.z)).toBeGreaterThan(LANE_HALF_WIDTH);
    }
  });
});

describe("evolving", () => {
  test("pays the bonus, element and ability exactly once and spends the cost", () => {
    const next = evolveWeapon(ready(), ruin.id, "vanguard-mk4");
    const before = ready().inventory.find((g) => g.id === "vanguard-mk4")!;
    const w = next.inventory.find((g) => g.id === "vanguard-mk4")!;
    expect(w.power).toBe(before.power + EVOLVE_POWER_BONUS);
    expect(w.element).toBe(ruin.element);
    expect(w.evolution).toEqual({ ruinId: ruin.id, ability: ruin.ability });
    expect(next.materials.forgeCatalyst).toBe(0);
    expect(next.materials[ruin.material]).toBe(0);
    expect(isEvolved(next, ruin.id)).toBe(true);
    expect(next.earnedRewards).toContain(claimKey(ruin.id));
  });
  test("a ruin cannot be claimed twice, even for another weapon", () => {
    const once = evolveWeapon(ready(), ruin.id, "vanguard-mk4");
    const topped = { ...once, materials: { ...once.materials, forgeCatalyst: 9, [ruin.material]: 99 }, inventory: once.inventory.map((g) => (g.id === "scrap-slugger" ? { ...g, level: 9 } : g)) };
    expect(evolveWeapon(topped, ruin.id, "scrap-slugger")).toBe(topped);
  });
  test("a weapon cannot evolve twice", () => {
    const once = evolveWeapon(ready(), ruin.id, "vanguard-mk4");
    const other = ruins()[1]!;
    const topped = { ...once, materials: { ...once.materials, forgeCatalyst: 9, [other.material]: 99 } };
    expect(canEvolve(topped, other, "vanguard-mk4").ok).toBe(false);
    expect(evolveWeapon(topped, other.id, "vanguard-mk4")).toBe(topped);
  });
  test("refuses low level, missing cost, armor and unknown ids without changing anything", () => {
    const low = ready(EVOLVE_MIN_LEVEL - 1);
    expect(evolveWeapon(low, ruin.id, "vanguard-mk4")).toBe(low);
    const poor = { ...ready(), materials: { ...ready().materials, forgeCatalyst: EVOLVE_CATALYSTS - 1 } };
    expect(evolveWeapon(poor, ruin.id, "vanguard-mk4")).toBe(poor);
    const noMat = { ...ready(), materials: { ...ready().materials, [ruin.material]: 0 } };
    expect(evolveWeapon(noMat, ruin.id, "vanguard-mk4")).toBe(noMat);
    expect(evolveWeapon(ready(), ruin.id, "field-chest")).toEqual(ready());
    expect(evolveWeapon(ready(), "nope", "vanguard-mk4")).toEqual(ready());
  });
  test("an evolved weapon's element cannot be infused away", () => {
    const next = evolveWeapon(ready(), ruin.id, "vanguard-mk4");
    const rich = { ...next, materials: { ...next.materials, cryoCrystal: 9, thermalShards: 9, bioCatalyst: 9, microCircuits: 9 } };
    expect(infuseGear(rich, "vanguard-mk4", ruin.element === "CRYO" ? "THERMAL" : "CRYO")).toBe(rich);
  });
});

describe("discovery and merge", () => {
  test("discovery is recorded once and only near the ruin", () => {
    expect(discoverNearby(DEFAULT_PROGRESSION, ruin.x + 500, ruin.z)).toBe(DEFAULT_PROGRESSION);
    const seen = discoverNearby(DEFAULT_PROGRESSION, ruin.x, ruin.z);
    expect(isDiscovered(seen, ruin.id)).toBe(true);
    expect(discoverNearby(seen, ruin.x, ruin.z)).toBe(seen);
  });
  test("merge keeps an evolution from either copy and never double-pays power", () => {
    const evolved = evolveWeapon(ready(), ruin.id, "vanguard-mk4").inventory.find((g) => g.id === "vanguard-mk4")!;
    const higher = { ...ready().inventory.find((g) => g.id === "vanguard-mk4")!, level: 8, power: 200 };
    const merged = mergeEvolution(higher, evolved, higher);
    expect(merged.evolution).toEqual(evolved.evolution);
    expect(merged.power).toBe(200 + EVOLVE_POWER_BONUS);
    expect(mergeEvolution(evolved, evolved, higher)).toBe(evolved);
  });
});

describe("combat rules", () => {
  test("a burst fires on every Nth hit and resets", () => {
    let c = freshCharge(); const n = ABILITY_RULES.STORM_ARC.everyHits; let bursts = 0;
    for (let i = 0; i < n * 3; i++) { const r = registerEvolutionHit(c, "STORM_ARC"); c = r.charge; if (r.burst) bursts++; }
    expect(bursts).toBe(3);
  });
  test("burst targets are nearest-first, in range, capped and exclude the origin", () => {
    const others = [{ x: 3, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }, { x: 99, z: 0 }, { x: 0, z: 0 }];
    const t = burstTargets({ x: 0, z: 0 }, others, "STORM_ARC");
    expect(t).toEqual([{ x: 1, z: 0 }, { x: 2, z: 0 }]);
  });
  test("Rime Shatter only boosts chilled targets; others are 1x", () => {
    expect(evolutionDamageMult("RIME_SHATTER", true)).toBeGreaterThan(1);
    expect(evolutionDamageMult("RIME_SHATTER", false)).toBe(1);
    expect(evolutionDamageMult("STORM_ARC", true)).toBe(1);
  });
  test("every ruin's ability exists and the ruin is findable", () => {
    for (const r of ruins()) { expect(ABILITY_RULES[r.ability]).toBeDefined(); expect(ruinById(r.id)).toBe(r); }
  });
});
