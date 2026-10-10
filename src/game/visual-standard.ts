/**
 * WORLD FRACTURE shared visual standard — one physically based material vocabulary, one emissive budget and
 * one real-world scale table for every asset category (operators, enemies, civilians, merchants, weapons,
 * vehicles, buildings). Pure data + pure functions so it is testable without a renderer; components turn a
 * preset into a THREE material.
 */

export type SurfaceKind =
  | "paintedArmor" | "ceramic" | "bareMetal" | "carbonFiber" | "fabric" | "rubber"
  | "glass" | "polymer" | "stone" | "concrete" | "skin" | "energy";

export type SurfacePreset = { metalness: number; roughness: number; /** 0..1 cap on emissive intensity */ emissiveMax: number; /** world metres one texture repeat should cover */ texelScale: number };

/** Ranges follow measured PBR references: dielectrics stay at metalness 0, only bare metal goes high. */
export const SURFACES: Record<SurfaceKind, SurfacePreset> = {
  paintedArmor: { metalness: 0.15, roughness: 0.48, emissiveMax: 0, texelScale: 0.5 },
  ceramic:      { metalness: 0.0,  roughness: 0.36, emissiveMax: 0, texelScale: 0.5 },
  bareMetal:    { metalness: 0.9,  roughness: 0.34, emissiveMax: 0, texelScale: 0.5 },
  carbonFiber:  { metalness: 0.1,  roughness: 0.3,  emissiveMax: 0, texelScale: 0.25 },
  fabric:       { metalness: 0.0,  roughness: 0.9,  emissiveMax: 0, texelScale: 0.3 },
  rubber:       { metalness: 0.0,  roughness: 0.85, emissiveMax: 0, texelScale: 0.3 },
  glass:        { metalness: 0.0,  roughness: 0.06, emissiveMax: 0, texelScale: 1 },
  polymer:      { metalness: 0.0,  roughness: 0.58, emissiveMax: 0, texelScale: 0.5 },
  stone:        { metalness: 0.0,  roughness: 0.92, emissiveMax: 0, texelScale: 2 },
  concrete:     { metalness: 0.0,  roughness: 0.88, emissiveMax: 0, texelScale: 2 },
  skin:         { metalness: 0.0,  roughness: 0.62, emissiveMax: 0, texelScale: 0.2 },
  energy:       { metalness: 0.0,  roughness: 0.4,  emissiveMax: 1.4, texelScale: 0.5 },
};

/** Restrained glow: tech accents are trims, not light sources. Night allows a little more. */
export const EMISSIVE_BUDGET = { accentDay: 0.6, accentNight: 1.0, fractureEnergy: 1.4 } as const;

export function emissiveFor(kind: SurfaceKind, requested: number, night: boolean): number {
  const cap = Math.min(SURFACES[kind].emissiveMax || (night ? EMISSIVE_BUDGET.accentNight : EMISSIVE_BUDGET.accentDay), EMISSIVE_BUDGET.fractureEnergy);
  return Math.max(0, Math.min(requested, cap));
}

/** Clamp arbitrary authored values into a kind's believable band (±0.15 roughness, metal only for bareMetal). */
export function conform(kind: SurfaceKind, m: { metalness?: number; roughness?: number }): { metalness: number; roughness: number } {
  const p = SURFACES[kind];
  const metal = kind === "bareMetal" ? Math.max(0.7, Math.min(1, m.metalness ?? p.metalness)) : Math.min(0.2, m.metalness ?? p.metalness);
  const rough = Math.max(p.roughness - 0.15, Math.min(p.roughness + 0.15, m.roughness ?? p.roughness));
  return { metalness: metal, roughness: Math.max(0.02, Math.min(1, rough)) };
}

/** Real-world scale table, metres. Every model is normalised against these, never against each other. */
export const SCALE = {
  operator: 1.85, civilian: 1.72, merchant: 1.75, eliteEnemy: 2.1, heavyEnemy: 2.6,
  rifleLength: 0.95, sidearmLength: 0.26, bladeLength: 0.9,
  doorway: 2.2, storeyHeight: 3.2, laneWidth: 3.5,
  car: { length: 4.6, height: 1.55 }, truck: { length: 7.5, height: 3.1 },
} as const;

/** Scale factor that makes a model of `measuredHeight` stand at a reference height. */
export const fitScale = (measuredHeight: number, targetHeight: number) => targetHeight / Math.max(measuredHeight, 1e-3);

/** Region identity for enemies/civilians/merchants: base armor tint, cloth tint, accent glow colour and wear. */
export type RegionLook = { armor: string; cloth: string; accent: string; wear: number; primary: SurfaceKind };
export const REGION_LOOK: Record<string, RegionLook> = {
  nexus:      { armor: "#c9ced6", cloth: "#2a3442", accent: "#58e6ff", wear: 0.15, primary: "ceramic" },
  veridan:    { armor: "#5d6b45", cloth: "#3b3a2a", accent: "#b8f06a", wear: 0.45, primary: "paintedArmor" },
  frostspire: { armor: "#dfe7ee", cloth: "#46586b", accent: "#9fd8ff", wear: 0.3,  primary: "ceramic" },
  ember:      { armor: "#3a2a26", cloth: "#5a2a1c", accent: "#ff7a3a", wear: 0.7,  primary: "bareMetal" },
  wastelands: { armor: "#8a7656", cloth: "#6b5638", accent: "#ffc463", wear: 0.8,  primary: "paintedArmor" },
  solara:     { armor: "#e8dcc0", cloth: "#b49a6a", accent: "#ffe08a", wear: 0.35, primary: "ceramic" },
  swamps:     { armor: "#3e4a36", cloth: "#2d3326", accent: "#9cff8a", wear: 0.6,  primary: "polymer" },
};
export const regionLook = (region: string): RegionLook => REGION_LOOK[region] ?? REGION_LOOK.nexus!;

/** Wear roughens and de-saturates paint; returns adjusted roughness. */
export const wornRoughness = (kind: SurfaceKind, wear: number) => Math.min(1, SURFACES[kind].roughness + 0.25 * Math.max(0, Math.min(1, wear)));
