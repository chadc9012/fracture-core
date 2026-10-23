/** The game's colour grade: gritty and grounded in the wilds (muted colour, firm contrast, teal shadows and warm
 * highlights, a little grain), wet cyberpunk in Neon City (deep violet shadows, cyan-magenta highlights, punchier colour).
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
};

const GRIT: Grade = { saturation: 0.8, contrast: 1.12, exposure: 0.98, shadowTint: "#20343d", highlightTint: "#ffd9b0", split: 0.14, crush: 0.035, grain: 0.035, vignette: 0.32 };

export const REGION_GRADE: Record<string, Partial<Grade>> = {
  veridan: { saturation: 0.84, shadowTint: "#1a3328", highlightTint: "#ffe2a8" },
  swamps: { saturation: 0.7, contrast: 1.1, shadowTint: "#26301c", highlightTint: "#d9e0a0", split: 0.18 },
  wastelands: { saturation: 0.72, contrast: 1.16, shadowTint: "#2e2a26", highlightTint: "#ffc98a", split: 0.18 },
  solara: { saturation: 0.76, contrast: 1.1, exposure: 1, shadowTint: "#3a2e24", highlightTint: "#fff0c8" },
  ember: { saturation: 0.82, contrast: 1.2, exposure: 0.95, shadowTint: "#2a1414", highlightTint: "#ffa070", split: 0.2, crush: 0.05 },
  frostspire: { saturation: 0.7, contrast: 1.1, shadowTint: "#1e3048", highlightTint: "#eaf4ff", split: 0.12 },
  nexus: { saturation: 0.82, contrast: 1.12, shadowTint: "#1c2c3a", highlightTint: "#f4ecdc", split: 0.12 },
  // Neon City: cyberpunk — rich colour, hard contrast, violet shadows, cyan highlights, darker overall so the neon pops
  neon: { saturation: 1.12, contrast: 1.22, exposure: 0.92, shadowTint: "#2a1050", highlightTint: "#5fe6ff", split: 0.24, crush: 0.06, grain: 0.03, vignette: 0.42 },
};

/** the grade for a region at a night factor (0 day .. 1 night): nights get firmer and a touch cooler */
export function gradeFor(regionId: string | undefined, night = 0, underwater = false): Grade {
  const g: Grade = { ...GRIT, ...(regionId ? REGION_GRADE[regionId] : undefined) };
  const n = Math.max(0, Math.min(1, night));
  g.contrast += 0.05 * n;
  g.vignette = Math.min(0.6, g.vignette + 0.1 * n);
  if (underwater) { g.saturation *= 0.85; g.split = Math.max(g.split, 0.2); g.shadowTint = "#0c2a33"; g.highlightTint = "#9fe8e0"; }
  return g;
}

/** LOW/MEDIUM: the same look as a CSS filter on the canvas (GPU-composited, no extra WebGL pass). CSS has no split
 * toning, so warmth comes from a little sepia and Neon's cool cast from a hue shift. */
export function cssGrade(g: Grade): string {
  const warm = hexWarmth(g.highlightTint) - hexWarmth(g.shadowTint);
  const sepia = Math.max(0, Math.min(0.25, warm * g.split * 0.9));
  const hue = g.saturation > 1 ? -8 : 0;
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
