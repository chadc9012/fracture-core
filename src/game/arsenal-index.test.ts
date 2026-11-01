import { describe, expect, test } from "bun:test";
import { baseWeaponRows, weaponIndex, weaponVault } from "./arsenal-index";
import { fromVault, toVault } from "./stash";
import { DEFAULT_PROGRESSION } from "./progression";
import type { GearItem } from "./inventory";

const gear = (id: string, slot: GearItem["slot"], power: number): GearItem => ({ id, name: id, slot, power, level: 1, element: "KINETIC", source: "test" });

describe("arsenal index and vault", () => {
  const base = { ...DEFAULT_PROGRESSION, inventory: [gear("a", "primary", 100), gear("b", "primary", 200), gear("c", "heavy", 50), gear("h", "helmet", 999), gear("s", "secondary", 80)], vaultIds: [], equippedGear: {} };
  test("the index holds every carried weapon, no armor, strongest first inside a slot", () => {
    expect(weaponIndex(base).map((g) => g.id)).toEqual(["b", "a", "s", "c"]);
    expect(weaponVault(base)).toEqual([]);
  });
  test("a weapon is in the index or the vault, never both", () => {
    const stored = toVault(base, "a");
    expect(weaponVault(stored).map((g) => g.id)).toEqual(["a"]);
    expect(weaponIndex(stored).map((g) => g.id)).toEqual(["b", "s", "c"]);
    expect(weaponIndex(fromVault(stored, "a")).map((g) => g.id)).toEqual(["b", "a", "s", "c"]);
  });
  test("an equipped weapon cannot be stored", () => {
    const eq = { ...base, equippedGear: { primary: "a" } };
    expect(toVault(eq, "a")).toBe(eq);
  });
  test("the index lists every built-in weapon and marks the ones in the active loadout", () => {
    const rows = baseWeaponRows(base);
    expect(rows.map((r) => r.id)).toEqual(["AUTO", "PULSE", "HEAVY", "SWORD", "SIDEARM", "SHOTGUN", "ROCKET", "CINDER", "FROSTBITE", "VITRIOL"]);
    const cls = base.identityClass ?? "TITAN", a = base.arsenal[cls];
    expect(rows.filter((r) => r.slotted).map((r) => r.id).sort()).toEqual([...(a.loadouts[a.active]!.slots)].sort());
  });
});
