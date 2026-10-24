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
};

/** Stage 46 (cinematic pass): the world reference photographs (docs/reference/world-photos) are rich and saturated — lush greens,
 * burning sunsets, deep blue nights — so the base grade now keeps colour (it used to mute every region to 0.7–0.84) and leans on
 * contrast, a gentle teal/amber split and a light vignette for the filmic read instead of desaturation and heavy grain. */
const GRIT: Grade = { saturation: 1.02, contrast: 1.1, exposure: 1.0, shadowTint: "#1f3440", highlightTint: "#ffdcb4", split: 0.12, crush: 0.03, grain: 0.018, vignette: 0.22 };

export const REGION_GRADE: Record<string, Partial<Grade>> = {
  // lush forest: the richest greens on the map, warm sunlight
  veridan: { saturation: 1.14, contrast: 1.1, shadowTint: "#173326", highlightTint: "#ffe2a0", split: 0.13 },
  swamps: { saturation: 0.95, contrast: 1.1, shadowTint: "#26301c", highlightTint: "#d9e0a0", split: 0.16 },
  // sunset desert of rust and gold
  wastelands: { saturation: 1.04, contrast: 1.14, shadowTint: "#2e2522", highlightTint: "#ffc282", split: 0.16 },
  solara: { saturation: 1.06, contrast: 1.08, exposure: 1.02, shadowTint: "#33302c", highlightTint: "#fff0c8", split: 0.1 },
  // volcanic: hot oranges against bruised shadows
  ember: { saturation: 1.1, contrast: 1.18, exposure: 0.97, shadowTint: "#2a1418", highlightTint: "#ffa070", split: 0.2, crush: 0.045 },
  frostspire: { saturation: 1.0, contrast: 1.1, shadowTint: "#1a2e4c", highlightTint: "#eaf4ff", split: 0.14 },
  nexus: { saturation: 1.06, contrast: 1.12, shadowTint: "#1c2c40", highlightTint: "#ffe6c8", split: 0.12 },
  // Neon City: cyberpunk — the richest colour, hard contrast, violet shadows, cyan highlights, darker overall so the neon pops
  neon: { saturation: 1.18, contrast: 1.22, exposure: 0.94, shadowTint: "#2a1050", highlightTint: "#5fe6ff", split: 0.24, crush: 0.05, grain: 0.02, vignette: 0.34 },
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
  const hue = g.saturation > 1.15 ? -8 : 0; // only the Neon City grade is this rich
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
