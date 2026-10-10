import { describe, expect, it } from "bun:test";
import { equippedPieces } from "./armor-pieces";
import type { GearItem } from "./inventory";

const item = (id: string, slot: GearItem["slot"], level = 1): GearItem => ({ id, name: id, slot, power: 90, level, element: "ARC", source: "t" });
const inv = [item("h", "helmet"), item("c", "chest"), item("g", "gauntlets"), item("l", "legs", 3)];

describe("modular armor", () => {
  it("each equipped slot attaches its own pieces", () => {
    const p = equippedPieces({ inventory: inv, equippedGear: { helmet: "h", chest: "c", gauntlets: "g", legs: "l" } }, "TITAN");
    expect(new Set(p.map((x) => x.slot))).toEqual(new Set(["helmet", "chest", "gauntlets", "legs"]));
    expect(p.some((x) => x.bone === "mixamorig:Head")).toBe(true);
    expect(p.filter((x) => x.slot === "gauntlets").map((x) => x.bone).sort()).toEqual(["mixamorig:LeftForeArm", "mixamorig:RightForeArm"]);
  });
  it("unequipping removes only that slot", () => {
    const p = equippedPieces({ inventory: inv, equippedGear: { chest: "c" } }, "HUNTER");
    expect(p.every((x) => x.slot === "chest")).toBe(true);
  });
  it("mismatched slot ids are ignored", () => {
    expect(equippedPieces({ inventory: inv, equippedGear: { helmet: "c" } }, "WARLOCK")).toEqual([]);
  });
  it("Goliath plate is bulkier than Nyx", () => {
    const w = (c: "TITAN" | "HUNTER") => equippedPieces({ inventory: inv, equippedGear: { chest: "c" } }, c)[0]!.parts[0]!.size[0];
    expect(w("TITAN")).toBeGreaterThan(w("HUNTER"));
  });
});
