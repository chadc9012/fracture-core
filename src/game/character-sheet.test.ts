import { describe, expect, test } from "bun:test";
import { characterSheet, collections, equipItem, equipOptions, itemTooltip, powerLevel, tierOf, triumphs } from "./character-sheet";
import { DEFAULT_PROGRESSION } from "./progression";
import { makeSetPiece } from "./armor-sets";
import type { GearItem } from "./inventory";

const gun = (id: string, slot: GearItem["slot"], power: number): GearItem => ({ id, name: id, slot, power, level: 1, element: "KINETIC", source: "test" });

test("power level averages equipped weapons and armor only, never the vault", () => {
  const p = { ...DEFAULT_PROGRESSION, inventory: [gun("a", "primary", 100), gun("b", "secondary", 120), gun("vault", "primary", 900)], equippedGear: { primary: "a", secondary: "b" } };
  expect(powerLevel(p)).toBe(110);
  expect(characterSheet(p).weapons[0]!.item!.id).toBe("a");
});

test("equipItem only takes owned items into their own slot", () => {
  const p = { ...DEFAULT_PROGRESSION, inventory: [gun("a", "primary", 100), gun("b", "primary", 130), gun("h", "heavy", 90)], equippedGear: { primary: "a" } };
  expect(equipItem(p, "primary", "b").equippedGear.primary).toBe("b");
  expect(equipItem(p, "primary", "h")).toBe(p);
  expect(equipItem(p, "primary", "nope")).toBe(p);
  expect(equipOptions(p, "primary").map((i) => i.id)).toEqual(["b", "a"]);
});

test("tooltips: set armor is legendary with attribute bars; weapons show impact", () => {
  const piece = makeSetPiece("verdant-warden", "chest")!;
  expect(tierOf(piece)).toBe("LEGENDARY");
  const t = itemTooltip(piece);
  expect(t.stats.map((s) => s.label)).toEqual(["Mobility", "Defense", "Intellect"]);
  expect(t.perks.some((x) => x.includes("set"))).toBe(true);
  expect(itemTooltip(gun("g", "primary", 140)).stats[0]!.label).toBe("Impact");
});

test("collections and triumphs read the save and score only completed triumphs", () => {
  const c = collections(DEFAULT_PROGRESSION);
  expect(c.find((x) => x.id === "armor")!.total).toBeGreaterThan(0);
  const t = triumphs(DEFAULT_PROGRESSION);
  expect(t.list.length).toBeGreaterThan(3);
  expect(t.score).toBe(0);
  const done = triumphs({ ...DEFAULT_PROGRESSION, ownedVehicles: ["a", "b", "c"] as never });
  expect(done.score).toBe(15);
});

import { sheetIfEquipped as _ifEquipped } from "./character-sheet";
describe("sheetIfEquipped", () => {
  test("previews power and attributes for a swap without changing the save, and is null for unknown items", () => {
    const base = { inventory: [{ id: "a", name: "A", slot: "helmet" as const, power: 60, level: 1, element: "KINETIC" as const, source: "t" }, { id: "b", name: "B", slot: "helmet" as const, power: 120, level: 1, element: "KINETIC" as const, source: "t" }], equippedGear: { helmet: "a" } };
    const after = _ifEquipped(base, "b")!;
    expect(after.power).toBe(120);
    expect(base.equippedGear.helmet).toBe("a");
    expect(_ifEquipped(base, "zzz")).toBeNull();
  });
});

import { updateAppearance as _upd } from "./character-sheet";
describe("updateAppearance", () => {
  const ch = { deploymentId: "d", operatorId: "nyx" as const, classId: "HUNTER" as const, subclassId: "SHADOW_HUNTER" as const, bodyType: "female" as const, displayName: "NYX", appearance: { armor: "#2a2230", cloth: "#0e0b12", visor: "#ff2bd6", trim: "#1a0f22", callsign: "NYX-13" }, loadout: { weaponOrder: [] } };
  test("saves valid colours and a cleaned callsign on the character; rejects junk; no character = no change", () => {
    const p = { character: ch };
    const n = _upd(p, { armor: "#C8CDD2", visor: "red", callsign: "  shadow fox seventeen  " });
    expect(n.character!.appearance.armor).toBe("#c8cdd2");
    expect(n.character!.appearance.visor).toBe("#ff2bd6");
    expect(n.character!.appearance.callsign).toBe("SHADOW FOX SEVEN");
    expect(_upd(p, { visor: "#ff2bd6" })).toBe(p);
    const none = { character: null };
    expect(_upd(none, { armor: "#ffffff" })).toBe(none);
  });
});
