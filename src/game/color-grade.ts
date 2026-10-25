/** The game's colour grade: cinematic in the wilds (rich colour, firm contrast, teal shadows and warm highlights, a
 * little grain), wet cyberpunk in Neon City (deep violet shadows, cyan-magenta highlights, punchier colour).
 *
 * Pure: GritGrade.tsx turns it into a post-processing pass on HIGH/ULTRA, and `cssGrade` into a canvas CSS filter on
 * LOW/MEDIUM (which have no post stack). Scene-side atmosphere (atmosphere.ts) still owns fog, sky and light tints;
 * this is the camera's look on top of them. */
import { neonPlateauWeight } from "./terrain";
import { regionAt } from "./world";

export type Grade = {
  /** 1 = untouched, <1 muted */
  saturation: number;
  /** 1 = untouched, >1 firmer */
  contrast: number;
  /** multiplier on the final image */
  exposure: number;
  /** split-tone colours and how strongly they tint the darks / brights (0..1) */
  shadowTint: string;
  highlightTint: string;
  split: number;
  /** pulls the blacks down (0..0.1): the "crushed" look that stops darks reading as grey plastic */
  crush: number;
  /** film grain 0..0.1 (post tiers only) */
  grain: number;
  /** vignette darkness 0..1 */
  vignette: number;
  /** CSS fallback hue shift in degrees (Neon City only) */
  hue?: number;
};

/** Owner direction (Oct 25, superseding the Oct 24 "gritty, held-back colour" call): "make everything look like these" — three
 * in-game target frames (docs/reference/target-*.png): Nexus at night, Neon at night, the wilds by day. Rich, saturated, cinematic
 * colour: blue-teal shadows and golden highlights by day, deep blue shadows and warm sodium highlights at night, firm contrast
 * without crushing the streets to black. Neon City keeps the strongest cyberpunk grade. */
const CINE: Grade = { saturation: 1.18, contrast: 1.13, exposure: 1.02, shadowTint: "#1d3550", highlightTint: "#ffcf8a", split: 0.22, crush: 0.02, grain: 0.015, vignette: 0.26 };

export const REGION_GRADE: Record<string, Partial<Grade>> = {
  // forest: lush greens under a gold sun
  veridan: { saturation: 1.2, shadowTint: "#173a3a", highlightTint: "#ffe0a0" },
  swamps: { saturation: 1.02, contrast: 1.1, shadowTint: "#1e3328", highlightTint: "#e6e8a8", split: 0.2 },
  // frame 3: warm dusty gold, deep blue sky
  wastelands: { saturation: 1.16, contrast: 1.15, shadowTint: "#20304a", highlightTint: "#ffc274", split: 0.24 },
  solara: { saturation: 1.18, contrast: 1.12, exposure: 1.03, shadowTint: "#243a58", highlightTint: "#ffe2a6" },
  ember: { saturation: 1.16, contrast: 1.18, exposure: 0.98, shadowTint: "#2a1620", highlightTint: "#ff9a5a", split: 0.24, crush: 0.03 },
  frostspire: { saturation: 1.06, contrast: 1.1, shadowTint: "#1a3666", highlightTint: "#eef6ff", split: 0.16 },
  // frame 1: Nexus at night, deep blue shadows, warm street lamps, cyan and violet signs
  nexus: { saturation: 1.2, contrast: 1.14, shadowTint: "#162a58", highlightTint: "#ffc88c", split: 0.24 },
  // Neon City: the richest grade, violet shadows and cyan highlights. Contrast stays moderate so the streets don't crush to black.
  neon: { saturation: 1.3, contrast: 1.1, exposure: 1.03, shadowTint: "#2a1258", highlightTint: "#5fe6ff", split: 0.26, crush: 0.015, grain: 0.015, vignette: 0.32, hue: -8 },
};

/** the grade for a region at a night factor (0 day .. 1 night): nights get firmer and a touch cooler */
export function gradeFor(regionId: string | undefined, night = 0, underwater = false): Grade {
  const g: Grade = { ...CINE, ...(regionId ? REGION_GRADE[regionId] : undefined) };
  const n = Math.max(0, Math.min(1, night));
  // night: shadows sink to deep blue, highlights take the warm sodium of the street lamps (frames 1 and 2)
  if (regionId !== "neon" && n > 0) { g.shadowTint = mixHex(g.shadowTint, "#121f4c", n * 0.7); g.highlightTint = mixHex(g.highlightTint, "#ffb270", n * 0.5); g.saturation += 0.05 * n; }
  g.contrast += 0.02 * n;
  g.vignette = Math.min(0.6, g.vignette + 0.1 * n);
  if (underwater) { g.saturation *= 0.85; g.split = Math.max(g.split, 0.2); g.shadowTint = "#0c2a33"; g.highlightTint = "#9fe8e0"; }
  return g;
}

/** LOW/MEDIUM: the same look as a CSS filter on the canvas (GPU-composited, no extra WebGL pass). CSS has no split
 * toning, so warmth comes from a little sepia and Neon's cool cast from a hue shift. */
export function cssGrade(g: Grade): string {
  const warm = hexWarmth(g.highlightTint) - hexWarmth(g.shadowTint);
  const sepia = Math.max(0, Math.min(0.25, warm * g.split * 0.9));
  const hue = g.hue ?? 0;
  return `saturate(${g.saturation.toFixed(3)}) contrast(${g.contrast.toFixed(3)}) brightness(${(g.exposure - g.crush * 0.6).toFixed(3)}) sepia(${sepia.toFixed(3)})${hue ? ` hue-rotate(${hue}deg)` : ""}`;
}

/** red-minus-blue of a hex colour, -1..1: how warm a tint is */
export function hexWarmth(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  return r - b;
}

/** which grade applies at a world position: Neon City's plateau, else the region you are in */
export function gradeRegionAt(x: number, z: number): string | undefined {
  if (neonPlateauWeight(x, z) > 0.3) return "neon";
  return regionAt(x, z)?.id;
}

/** blend two hex colours (t 0..1) */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) + ((((pb >> sh) & 255) - ((pa >> sh) & 255)) * t));
  return "#" + [16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, "0")).join("");
}
