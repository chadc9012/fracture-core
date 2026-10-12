// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { atSupplyPoint, killRefund, restockAll, trickleRestock } from "./ammo";
import { WEAPONS, freshAmmo, type AmmoState } from "./weapons";
import { VAULT_GATE } from "./wasteland-activities";

const empty = (): AmmoState => { const a = freshAmmo(); for (const k of Object.keys(a) as (keyof AmmoState)[]) a[k] = { mag: 0, reserve: 0 }; return a; };

describe("ammo resupply", () => {
  it("respawn restocks every gun; the blade is untouched", () => {
    const a = restockAll(empty());
    expect(a.AUTO).toEqual({ mag: WEAPONS.AUTO.mag, reserve: WEAPONS.AUTO.reserve });
    expect(a.SWORD).toEqual({ mag: 0, reserve: 0 });
  });
  it("kills refund part of a magazine into the equipped weapon only, capped at the starting reserve, at least one round", () => {
    const a = killRefund(empty(), "AUTO", 2);
    expect(a.AUTO.reserve).toBe(2 * Math.ceil(WEAPONS.AUTO.mag * 0.35));
    expect(a.AUTO.mag).toBe(0);
    expect(a.PULSE.reserve).toBe(0);
    expect(killRefund(empty(), "ROCKET", 1).ROCKET.reserve).toBe(1);
    expect(killRefund(freshAmmo(), "AUTO", 50).AUTO.reserve).toBe(WEAPONS.AUTO.reserve);
    const full = freshAmmo();
    expect(killRefund(full, "AUTO", 1)).toBe(full);
    expect(killRefund(full, "SWORD", 3)).toBe(full);
  });
  it("safe ground fills empty reserves in about two seconds, including slow launchers", () => {
    let a = empty(); const carry = {};
    for (let i = 0; i < 125; i++) a = trickleRestock(a, 1 / 60, carry);
    expect(a.AUTO.reserve).toBe(WEAPONS.AUTO.reserve);
    expect(a.ROCKET.reserve).toBe(WEAPONS.ROCKET.reserve);
    expect(a.AUTO.mag).toBe(0); // you still reload
  });
  it("the vault gate is a supply point", () => {
    expect(atSupplyPoint(VAULT_GATE.x, VAULT_GATE.z)).toBe(true);
    expect(atSupplyPoint(VAULT_GATE.x + 50, VAULT_GATE.z)).toBe(false);
  });
});
