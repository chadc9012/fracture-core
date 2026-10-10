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
export const hexToRgb = hex;
export const mixHex = (a: string, b: string, t: number) => { const A = hex(a), B = hex(b); return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); };
/** perceived brightness 0..1 */
export const luma = (c: string) => { const [r, g, b] = hex(c); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
/** raise a colour to at least `min` brightness without changing its hue much */
export const lift = (c: string, min: number) => { const l = luma(c); return l >= min ? c : mixHex(c, "#c8ced8", Math.min(1, (min - l) / Math.max(0.05, 0.8 - l))); };

/** hex -> [h 0..360, s 0..1, l 0..1] */
export function toHsl(c: string): [number, number, number] {
  const [r, g, b] = hex(c).map((x) => x / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d < 1e-6) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, s, l];
}
export function fromHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}
/** brighten and saturate WITHOUT washing the hue out (the old `lift` blended toward grey, which turned every dark brown/violet armor colour grey).
 * Truly neutral colours (no hue to keep) fall back to `lift`. */
export function vivid(c: string, minL: number, minS: number): string {
  const [h, s, l] = toHsl(c);
  if (s < 0.03) return lift(c, minL);
  return fromHsl(h, Math.max(s, minS), Math.max(l, minL));
}

export type Paint = { color: string; /** 0 = matte cloth, 1 = polished plate */ plate: number };
export type Palette = Record<Region, Paint>;

/** Colour for every region. Worn set pieces take their set colour (blended a little with the operator's armor colour so the
 * two read as one kit); unworn slots keep the operator's own armor colour, lifted so plating is never near-black. */
export function buildPalette(opts: { armor: string | undefined; cloth?: string | undefined; look?: ArmorLook | undefined; bodyType?: BodyType | undefined; trim?: string | undefined }): Palette {
  const robot = opts.bodyType === "robot";
  const armor = vivid(opts.armor ?? "#6b6f76", 0.38, 0.34);
  const suit = robot ? "#8c97a6" : vivid(opts.cloth ?? "#2d333d", 0.16, 0.18);
  // two-tone kit: the operator's own trim colour picks out the helmet, shoulders, gauntlets and shins so the body is
  // not one flat plate colour; thighs stay close to the base plate and the boots are darker
  const trim = vivid(opts.trim ?? "#c9a24a", 0.5, 0.65);
  const TRIM_MIX: Partial<Record<Region, number>> = { helmet: 0.55, pauldron: 0.7, gauntlet: 0.6, shin: 0.45 };
  const plateFor = (slot: SetSlot, region: Region): Paint => {
    const worn = opts.look?.[slot];
    if (worn) return { color: vivid(mixHex(worn.color, armor, 0.22), 0.4, 0.25), plate: 1 };
    return { color: mixHex(armor, trim, TRIM_MIX[region] ?? 0), plate: 1 };
  };
  const out = {} as Palette;
  (Object.keys(REGION_SLOT) as Region[]).forEach((r) => {
    const slot = REGION_SLOT[r];
    out[r] = slot ? plateFor(slot, r) : r === "boot" ? { color: mixHex(suit, "#0b0d10", 0.45), plate: 0.4 } : { color: suit, plate: robot ? 1 : 0 };
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
