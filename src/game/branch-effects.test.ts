import { describe, expect, test } from "bun:test";
import { ABILITY_CONFIGS } from "./combat-engine";
import { BRANCH_LABEL, branchTier, scaleConfig } from "./branch-effects";
import { activateLiveAbility, createLiveBuild, classBuild } from "./live-build";

const cfg = (id: string) => ABILITY_CONFIGS.find((a) => a.id === id)!;

describe("evolution branches in live combat", () => {
  test("branch ids map to Power / Control / Utility", () => {
    expect(branchTier("kinetic-slam", "fault-line")).toBe("POWER");
    expect(branchTier("kinetic-slam", "aftershock")).toBe("CONTROL");
    expect(branchTier("kinetic-slam", "safeguard")).toBe("UTILITY");
    expect(branchTier("kinetic-slam", undefined)).toBeNull();
    expect(branchTier("kinetic-slam", "nonsense")).toBeNull();
  });
  test("Power scales damage by 18%; Control stretches duration by 25%", () => {
    expect(scaleConfig(cfg("kinetic-slam"), "fault-line").effects[0]!.value).toBeCloseTo(60 * 1.18);
    expect(scaleConfig(cfg("bastion-shield"), "mirror-plate").effects[0]!.duration).toBeCloseTo(12.5);
    expect(scaleConfig(cfg("kinetic-slam"), "aftershock").effects[0]!.value).toBe(60);
  });
  test("multiplier effects scale their bonus, not the whole 1.25x", () => {
    expect(scaleConfig(cfg("recon-swarm"), "deep-scan").effects[0]!.value).toBeCloseTo(1 + 0.25 * 1.18);
  });
  test("Utility lowers energy cost 15%; unbranched costs full", () => {
    const plain = createLiveBuild(classBuild("TITAN"));
    activateLiveAbility(plain, "TACTICAL", "war");
    const util = createLiveBuild(classBuild("TITAN"), { "kinetic-slam": "safeguard" });
    activateLiveAbility(util, "TACTICAL", "war");
    expect(100 - plain.energy).toBeCloseTo(20);
    expect(100 - util.energy).toBeCloseTo(17);
  });
  test("Control stretches Siege Mode time; Power boosts it", () => {
    const control = createLiveBuild(classBuild("TITAN"), { "siege-mode": "suppressor" });
    activateLiveAbility(control, "PRIMARY", "war");
    expect(control.siegeTime).toBeCloseTo(10);
    const power = createLiveBuild(classBuild("TITAN"), { "siege-mode": "hold-fast" });
    activateLiveAbility(power, "PRIMARY", "war");
    expect(power.siegeBoost).toBeCloseTo(1.18);
  });
  test("effect text names the branch bonus", () => {
    const live = createLiveBuild(classBuild("HUNTER"), { "shadow-strike": "killing-edge" });
    activateLiveAbility(live, "ULTIMATE", "war");
    expect(live.effect).toContain(BRANCH_LABEL.POWER);
    expect(live.strikeBoost).toBeCloseTo(1.18);
  });
});
