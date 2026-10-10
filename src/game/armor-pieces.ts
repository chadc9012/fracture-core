/**
 * Modular operator armor (pure). Each equipped armor slot becomes separate pieces parented to Mixamo
 * bones of the GOLIATH / NYX / CIPHER rigs, so they follow every animation. Shapes are a clearly
 * labelled STARTER geometry set (procedural, not final art); each piece is independent so authored GLBs
 * can replace one shape id later without touching the equipment system. Stats stay in armor-attributes.
 * Units: metres on a 1.85 m operator; Y runs along the bone (Mixamo convention).
 */
import type { ClassId } from "./loadout";
import type { GearItem, GearSlot } from "./inventory";
import type { SurfaceKind } from "./visual-standard";

export type ArmorSlot = Extract<GearSlot, "helmet" | "chest" | "gauntlets" | "legs">;
export const ARMOR_SLOTS: readonly ArmorSlot[] = ["helmet", "chest", "gauntlets", "legs"];

export type Shape = "box" | "sphere" | "cylinder" | "cone" | "torus";
export type PiecePart = { shape: Shape; size: [number, number, number]; pos: [number, number, number]; rot?: [number, number, number]; surface: SurfaceKind; tone: "armor" | "trim" | "accent" };
export type ArmorPiece = { slot: ArmorSlot; bone: string; parts: PiecePart[] };

const B = "mixamorig:";
/** class silhouette: Goliath bulky plate, Nyx slim and low-profile, Cipher tall collars and long greaves */
export const CLASS_BULK: Record<ClassId, number> = { TITAN: 1.25, HUNTER: 0.88, WARLOCK: 1.0 };

/** 0..2 design variant from the item id, tier 1..3 from its upgrade level */
export const variantOf = (id: string) => id.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 3;
export const tierOf = (level: number) => (level >= 3 ? 3 : level >= 2 ? 2 : 1);

function sym(bone: string, part: (side: 1 | -1) => PiecePart[], slot: ArmorSlot): ArmorPiece[] {
  return ([1, -1] as const).map((s) => ({ slot, bone: `${B}${s === 1 ? "Left" : "Right"}${bone}`, parts: part(s) }));
}

export function piecesFor(slot: ArmorSlot, item: GearItem, classId: ClassId): ArmorPiece[] {
  const k = CLASS_BULK[classId] ?? 1, v = variantOf(item.id), t = tierOf(item.level);
  switch (slot) {
    case "helmet": {
      const parts: PiecePart[] = [
        { shape: "sphere", size: [0.135 * k, 0.15, 0.15 * k], pos: [0, 0.1, 0], surface: "paintedArmor", tone: "armor" },
        { shape: "box", size: [0.2 * k, 0.05, 0.03], pos: [0, 0.09, 0.13 * k], surface: "glass", tone: "accent" },
      ];
      if (v === 1 || t >= 2) parts.push({ shape: "box", size: [0.025, 0.06, 0.26 * k], pos: [0, 0.24, 0], surface: "bareMetal", tone: "trim" });
      if (v === 2) parts.push({ shape: "cylinder", size: [0.008, 0.18, 0.008], pos: [0.11 * k, 0.24, -0.04], surface: "bareMetal", tone: "trim" });
      if (t >= 3) parts.push({ shape: "cone", size: [0.05, 0.12, 0.05], pos: [0, 0.3, -0.05], rot: [-0.5, 0, 0], surface: "paintedArmor", tone: "armor" });
      if (classId === "HUNTER") parts.push({ shape: "cone", size: [0.17, 0.2, 0.17], pos: [0, 0.1, -0.05], rot: [0.3, 0, 0], surface: "fabric", tone: "trim" });
      return [{ slot, bone: `${B}Head`, parts }];
    }
    case "chest": {
      const torso: PiecePart[] = [
        { shape: "box", size: [0.34 * k, 0.26, 0.06 * k], pos: [0, 0.02, 0.12 * k], rot: [-0.08, 0, 0], surface: "paintedArmor", tone: "armor" },
        { shape: "box", size: [0.32 * k, 0.24, 0.05], pos: [0, 0.02, -0.12 * k], surface: "paintedArmor", tone: "armor" },
        { shape: "box", size: [0.08, 0.02, 0.01], pos: [0, 0.1, 0.155 * k], surface: "energy", tone: "accent" },
      ];
      if (classId === "WARLOCK" || v === 2) torso.push({ shape: "torus", size: [0.12 * k, 0.03, 0.03], pos: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0], surface: "bareMetal", tone: "trim" });
      if (t >= 2) torso.push({ shape: "box", size: [0.22 * k, 0.03, 0.02], pos: [0, -0.08, 0.15 * k], surface: "bareMetal", tone: "trim" });
      const pauldron = (s: 1 | -1): PiecePart[] => [
        { shape: "sphere", size: [0.1 * k * (v === 0 ? 1.15 : 1), 0.07, 0.11 * k], pos: [0, 0.05, 0], surface: "paintedArmor", tone: "armor" },
        ...(t >= 3 ? [{ shape: "cone", size: [0.03, 0.09, 0.03], pos: [0, 0.06, 0], rot: [0, 0, s * -1.2], surface: "bareMetal", tone: "trim" } as PiecePart] : []),
      ];
      return [{ slot, bone: `${B}Spine2`, parts: torso }, ...sym("Arm", pauldron, slot)];
    }
    case "gauntlets":
      return sym("ForeArm", () => [
        { shape: "cylinder", size: [0.055 * k, 0.2, 0.05 * k], pos: [0, 0.14, 0], surface: classId === "HUNTER" ? "carbonFiber" : "paintedArmor", tone: "armor" },
        { shape: "box", size: [0.04, 0.12, 0.012], pos: [0, 0.14, 0.05 * k], surface: "energy", tone: "accent" },
        ...(t >= 2 || v === 1 ? [{ shape: "box", size: [0.09 * k, 0.04, 0.09 * k], pos: [0, 0.25, 0], surface: "bareMetal", tone: "trim" } as PiecePart] : []),
      ], slot);
    case "legs": {
      const len = classId === "WARLOCK" ? 1.15 : 1;
      return [
        ...sym("UpLeg", () => [{ shape: "box", size: [0.13 * k, 0.24 * len, 0.06], pos: [0, 0.2, 0.07 * k], surface: "paintedArmor", tone: "armor" }], slot),
        ...sym("Leg", () => [
          { shape: "box", size: [0.1 * k, 0.26 * len, 0.05], pos: [0, 0.2, 0.06 * k], surface: "paintedArmor", tone: "armor" },
          { shape: "sphere", size: [0.065 * k, 0.055, 0.05], pos: [0, 0.02, 0.07 * k], surface: "bareMetal", tone: "trim" },
          ...(t >= 3 || v === 2 ? [{ shape: "cone", size: [0.025, 0.07, 0.025], pos: [0, 0.02, 0.12 * k], rot: [Math.PI / 2, 0, 0], surface: "bareMetal", tone: "trim" } as PiecePart] : []),
        ], slot),
      ];
    }
  }
}

/** The single source for "what armor geometry is worn": only equipped, existing items produce pieces. */
export function equippedPieces(gear: { inventory: GearItem[]; equippedGear: Partial<Record<GearSlot, string>> } | undefined, classId: ClassId): ArmorPiece[] {
  if (!gear) return [];
  return ARMOR_SLOTS.flatMap((slot) => {
    const item = gear.inventory.find((g) => g.id === gear.equippedGear[slot] && g.slot === slot);
    return item ? piecesFor(slot, item, classId) : [];
  });
}

/** stable key so the model only rebuilds pieces when what's worn actually changes */
export const piecesKey = (gear: Parameters<typeof equippedPieces>[0], classId: ClassId) =>
  classId + ARMOR_SLOTS.map((s) => { const id = gear?.equippedGear[s]; const it = gear?.inventory.find((g) => g.id === id); return `${s}:${id ?? "-"}:${it?.level ?? 0}`; }).join("|");
