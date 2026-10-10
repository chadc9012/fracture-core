/* Paint plan for the authored operator models. The GLBs ship geometry and a Mixamo skeleton but NO materials or
 * textures, so without a plan the whole body is one flat colour (read as grey/black). This module decides, purely,
 * which armor slot each bone belongs to and what colour each body region gets, from the worn set pieces
 * (armor-look.ts) or the starter armor colour. OperatorModel.tsx turns it into vertex colours by skin weights. */
import type { ArmorLook } from "./armor-look";
import type { SetSlot } from "./armor-sets";
import type { BodyType } from "./operators";

export type Region = "helmet" | "chest" | "pauldron" | "gauntlet" | "thigh" | "shin" | "boot" | "suit" | "gear";

/** which armor slot a region's plating belongs to (null = bare under-suit) */
export const REGION_SLOT: Readonly<Record<Region, SetSlot | null>> = {
  helmet: "helmet", chest: "chest", pauldron: "chest", gauntlet: "gauntlets", thigh: "legs", shin: "legs", boot: null, suit: null, gear: "classItem",
};

/** Mixamo bone name → body region. Unknown extra bones (the Meshy rigs add `Bone_0xx` for capes and gear) are class-item gear. */
export function boneRegion(name: string): Region {
  const n = name.replace(/^mixamorig:?/i, "").toLowerCase();
  if (n === "head" || n === "headtop_end" || n === "headfront") return "helmet";
  if (n === "neck" || n === "hips") return "suit";
  if (n.startsWith("spine")) return "chest";
  if (n.endsWith("shoulder")) return "pauldron";
  if (/(left|right)arm$/.test(n)) return "suit";
  if (n.endsWith("forearm") || n.includes("hand")) return "gauntlet";
  if (n.endsWith("upleg") || /(left|right)leg$/.test(n)) return n.endsWith("upleg") ? "thigh" : "shin";
  if (n.includes("foot") || n.includes("toe")) return "boot";
  return "gear";
}

const hex = (c: string): [number, number, number] => { const v = c.replace("#", ""); const f = v.length === 3 ? v.split("").map((x) => x + x).join("") : v; return [parseInt(f.slice(0, 2), 16) || 0, parseInt(f.slice(2, 4), 16) || 0, parseInt(f.slice(4, 6), 16) || 0]; };
const toHex = (c: [number, number, number]) => "#" + c.map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0")).join("");
export const mixHex = (a: string, b: string, t: number) => { const A = hex(a), B = hex(b); return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); };
/** perceived brightness 0..1 */
export const luma = (c: string) => { const [r, g, b] = hex(c); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
/** raise a colour to at least `min` brightness without changing its hue much */
export const lift = (c: string, min: number) => { const l = luma(c); return l >= min ? c : mixHex(c, "#c8ced8", Math.min(1, (min - l) / Math.max(0.05, 0.8 - l))); };

export type Paint = { color: string; /** 0 = matte cloth, 1 = polished plate */ plate: number };
export type Palette = Record<Region, Paint>;

/** Colour for every region. Worn set pieces take their set colour (blended a little with the operator's armor colour so the
 * two read as one kit); unworn slots keep the operator's own armor colour, lifted so plating is never near-black. */
export function buildPalette(opts: { armor: string | undefined; cloth?: string | undefined; look?: ArmorLook | undefined; bodyType?: BodyType | undefined }): Palette {
  const robot = opts.bodyType === "robot";
  const armor = lift(opts.armor ?? "#6b6f76", 0.3);
  const suit = robot ? "#8c97a6" : lift(opts.cloth ?? "#2d333d", 0.14);
  const plateFor = (slot: SetSlot): Paint => {
    const worn = opts.look?.[slot];
    return { color: worn ? lift(mixHex(worn.color, armor, 0.22), 0.34) : armor, plate: 1 };
  };
  const out = {} as Palette;
  (Object.keys(REGION_SLOT) as Region[]).forEach((r) => {
    const slot = REGION_SLOT[r];
    out[r] = slot ? plateFor(slot) : r === "boot" ? { color: mixHex(suit, "#0b0d10", 0.55), plate: 0.4 } : { color: suit, plate: robot ? 1 : 0 };
  });
  return out;
}

/** Fraction of each region a vertex belongs to, from its skin influences (bone names, joint indices, weights). */
export function regionWeights(boneNames: readonly string[], joints: ArrayLike<number>, weights: ArrayLike<number>): Partial<Record<Region, number>> {
  const out: Partial<Record<Region, number>> = {};
  let total = 0;
  for (let i = 0; i < joints.length; i++) {
    const w = weights[i] ?? 0;
    if (w <= 0) continue;
    const name = boneNames[joints[i]!];
    if (!name) continue;
    const r = boneRegion(name);
    out[r] = (out[r] ?? 0) + w;
    total += w;
  }
  if (total <= 0) return { suit: 1 };
  for (const k of Object.keys(out) as Region[]) out[k] = out[k]! / total;
  return out;
}
