// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { boneRegion, buildPalette, lift, luma, mixHex, regionWeights, REGION_SLOT, toHsl, vivid, type Region } from "./operator-paint";
import { armorLook } from "./armor-look";

describe("operator paint", () => {
  test("Mixamo bones map to armor regions", () => {
    const cases: [string, Region][] = [["mixamorig:Head", "helmet"], ["headfront", "helmet"], ["mixamorig:Spine2", "chest"], ["mixamorig:LeftShoulder", "pauldron"], ["mixamorig:LeftArm", "suit"],
      ["mixamorig:RightForeArm", "gauntlet"], ["mixamorig:LeftHandIndex3", "gauntlet"], ["mixamorig:LeftUpLeg", "thigh"], ["mixamorig:RightLeg", "shin"], ["mixamorig:LeftToeBase", "boot"], ["mixamorig:Hips", "suit"], ["Bone_030", "gear"]];
    for (const [bone, region] of cases) expect(boneRegion(bone)).toBe(region);
  });
  test("every skeleton bone of all three operators resolves to a region that has a colour", () => {
    const pal = buildPalette({ armor: "#6b6f76" });
    for (const r of Object.keys(REGION_SLOT) as Region[]) expect(pal[r].color).toMatch(/^#[0-9a-f]{6}$/);
  });
  test("plating is never near-black, even from a very dark armor colour", () => {
    const pal = buildPalette({ armor: "#050505" });
    for (const r of ["helmet", "chest", "gauntlet", "thigh", "shin"] as Region[]) expect(luma(pal[r].color)).toBeGreaterThan(0.25);
    expect(luma(buildPalette({ armor: undefined, cloth: "#000000" }).suit.color)).toBeGreaterThan(0.1);
  });
  test("worn set pieces take their set colour; unworn slots keep the operator's armor colour", () => {
    const look = { helmet: { motif: "horns", color: "#6fd06a" } } as const;
    const pal = buildPalette({ armor: "#8a4a30", look });
    expect(pal.helmet.color).not.toBe(pal.chest.color);
    // helmet leans green (set colour), chest stays the armor colour
    const [, g] = [0, parseInt(pal.helmet.color.slice(3, 5), 16)]; const [, g2] = [0, parseInt(pal.chest.color.slice(3, 5), 16)];
    expect(g).toBeGreaterThan(g2);
  });
  test("armorLook from a real equipped set feeds the palette", () => {
    const look = armorLook({ inventory: [{ id: "a", setId: "cinder-vanguard" } as never], equippedGear: { chest: "a" } as never });
    const pal = buildPalette({ armor: "#6b6f76", look });
    expect(pal.chest.color).not.toBe(pal.helmet.color);
    expect(pal.pauldron.color).toBe(pal.chest.color); // shoulders belong to the chest piece
  });
  test("robots get a bright metal under-chassis", () => {
    expect(luma(buildPalette({ armor: "#6b6f76", bodyType: "robot" }).suit.color)).toBeGreaterThan(0.45);
  });
  test("skin weights become normalised region fractions", () => {
    const names = ["mixamorig:Head", "mixamorig:Spine2", "mixamorig:Neck"];
    const w = regionWeights(names, [0, 1, 2, 0], [0.5, 0.25, 0.25, 0]);
    expect(w.helmet).toBeCloseTo(0.5); expect(w.chest).toBeCloseTo(0.25); expect(w.suit).toBeCloseTo(0.25);
    expect(regionWeights(names, [9], [1])).toEqual({ suit: 1 }); // unknown joint → bare suit, never NaN
    expect(regionWeights(names, [], [])).toEqual({ suit: 1 });
  });
  test("colour helpers", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(lift("#000000", 0.3)).not.toBe("#000000");
    expect(lift("#ffffff", 0.3)).toBe("#ffffff");
  });
});

describe("operators are coloured, not grey", () => {
  const DEFAULTS = { goliath: { armor: "#4a4036", cloth: "#1c1815", visor: "#ff7a1a" }, nyx: { armor: "#2a2230", cloth: "#0e0b12", visor: "#ff2bd6" }, cipher: { armor: "#3d3a5c", cloth: "#121018", visor: "#ffc864" } };
  test("each default operator's plating keeps a visible hue and the visor colour picks out helmet, shoulders and gauntlets", () => {
    const chestHues: number[] = [];
    for (const a of Object.values(DEFAULTS)) {
      const pal = buildPalette({ armor: a.armor, cloth: a.cloth, trim: a.visor });
      const [h, s, l] = toHsl(pal.chest.color);
      expect(s).toBeGreaterThan(0.25);
      expect(l).toBeGreaterThan(0.35);
      chestHues.push(h);
      for (const r of ["helmet", "pauldron", "gauntlet"] as Region[]) expect(pal[r].color).not.toBe(pal.chest.color);
      expect(toHsl(pal.pauldron.color)[1]).toBeGreaterThan(0.3);
    }
    expect(new Set(chestHues.map((h) => Math.round(h / 20))).size).toBe(3); // three distinct armour hues
  });
  test("vivid keeps the hue of what it brightens", () => {
    expect(Math.abs(toHsl(vivid("#4a4036", 0.4, 0.3))[0] - toHsl("#4a4036")[0])).toBeLessThan(6);
  });
});
