// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { COMBAT_HUD_LEVEL, contextualAbilities, hudMode, hudVisibility, superJustReady, superMeter } from "./operator-presentation";
import type { AbilityHud } from "./ability-hud";

const ab = (slot: AbilityHud["slot"], over: Partial<AbilityHud> = {}): AbilityHud => ({ slot, key: "Q", id: slot, name: slot, state: "READY", ready: true, cooldown: 0, cooldownMax: 20, cost: 35, ...over });

describe("operator presentation", () => {
  it("boss beats combat beats exploration", () => {
    expect(hudMode(true, 1)).toBe("boss");
    expect(hudMode(false, COMBAT_HUD_LEVEL)).toBe("combat");
    expect(hudMode(false, 0.1)).toBe("exploration");
  });
  it("ability icons are never permanent; tracker hides in combat, boss bar only for bosses", () => {
    for (const m of ["exploration", "combat", "boss"] as const) expect(hudVisibility(m).abilityIcons).toBe(false);
    expect(hudVisibility("combat").missionTracker).toBe(false);
    expect(hudVisibility("exploration").missionTracker).toBe(true);
    expect(hudVisibility("boss").bossHealth).toBe(true);
    expect(hudVisibility("exploration").enemyIndicators).toBe(false);
  });
  it("only cooling or active Q/E abilities get a readout; the ultimate has its own meter", () => {
    const list = [ab("PRIMARY", { state: "COOLDOWN", ready: false, cooldown: 3 }), ab("TACTICAL"), ab("ULTIMATE", { state: "COOLDOWN", ready: false, cooldown: 5 })];
    expect(contextualAbilities(list).map((a) => a.slot)).toEqual(["PRIMARY"]);
    expect(contextualAbilities([ab("PRIMARY"), ab("TACTICAL", { state: "NO_ENERGY", ready: false })])).toEqual([]);
  });
  it("super charge is whichever of cooldown or energy holds it back, and ready only when R would fire", () => {
    const cooling = superMeter([ab("ULTIMATE", { state: "COOLDOWN", ready: false, cooldown: 10, cooldownMax: 20 })], 100)!;
    expect(cooling.charge).toBeCloseTo(0.5);
    expect(cooling.label).toBe("CHARGING");
    const dry = superMeter([ab("ULTIMATE", { state: "NO_ENERGY", ready: false, cost: 40 })], 10)!;
    expect(dry.charge).toBeCloseTo(0.25);
    const ready = superMeter([ab("ULTIMATE")], 100)!;
    expect(ready).toMatchObject({ charge: 1, ready: true, label: "SUPER READY" });
    expect(superMeter([ab("ULTIMATE", { state: "ACTIVE" })], 0)!.active).toBe(true);
    expect(superMeter([ab("PRIMARY")], 100)).toBeNull();
  });
  it("never shows a full meter that is not ready", () => {
    expect(superMeter([ab("ULTIMATE", { state: "COOLDOWN", ready: false, cooldown: 0.01, cooldownMax: 20, cost: 35 })], 100)!.charge).toBeLessThan(1);
  });
  it("pulses once on the render it becomes ready", () => {
    const c = superMeter([ab("ULTIMATE", { state: "COOLDOWN", ready: false, cooldown: 1 })], 100);
    const r = superMeter([ab("ULTIMATE")], 100);
    expect(superJustReady(c, r)).toBe(true);
    expect(superJustReady(r, r)).toBe(false);
    expect(superJustReady(null, r)).toBe(false);
  });
});
