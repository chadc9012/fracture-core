// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { BACKPACKS, backpackFor, NO_BACKPACK } from "./backpacks";
import { createSim, throwBeacon } from "./sim";
import { createStratagemState, releaseStratagems, cooldownRemaining } from "./stratagems";

describe("backpacks", () => {
  it("has exactly one pack per class", () => {
    expect(BACKPACKS.map((p) => p.classId).sort()).toEqual(["HUNTER", "TITAN", "WARLOCK"]);
    expect(backpackFor("HUNTER").id).toBe("SLIPSTREAM_PACK");
  });
  it("Slipstream shortens cooldowns", () => {
    const base = createStratagemState(), fast = createStratagemState();
    base.armed = fast.armed = "ORBITAL_STRIKE";
    releaseStratagems(base, 0, 1);
    releaseStratagems(fast, 0, backpackFor("HUNTER").cooldownMult);
    expect(cooldownRemaining(fast, "ORBITAL_STRIKE", 0)).toBeLessThan(cooldownRemaining(base, "ORBITAL_STRIKE", 0));
  });
  it("Relay widens recon beacons only", () => {
    const sim = createSim();
    sim.backpack = backpackFor("WARLOCK");
    throwBeacon(sim, "RECON_PULSE", 0, 2, 0, 0, 0);
    throwBeacon(sim, "ORBITAL_STRIKE", 0, 2, 0, 0, 0);
    expect(sim.beacons[0]!.radius).toBeCloseTo(42);
    expect(sim.beacons[1]!.radius).toBe(9);
    expect(NO_BACKPACK.reconRadiusMult).toBe(1);
  });
});
