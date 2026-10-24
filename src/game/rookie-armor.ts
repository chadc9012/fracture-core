/** Rookie armor (Stage 47): every Operator starts in their own Common-tier rookie set, from the concept sheet
 * docs/reference/rookie-armor-sets.jpg ("Initial gear // three operators // built for survival").
 *
 *   GOLIATH  Rookie Bulwark   built to endure      Standard / Desert / Snow
 *   NYX      Rookie Shadow    light, fast, lethal  Standard / Urban / Forest
 *   CIPHER   Rookie Arcanist  knowledge fuels power Standard / Desert / Void
 *
 * The rookie set is the look the Operator wears wherever no higher-tier set piece is equipped. It is appearance
 * only: no stats, no change to class abilities, and the existing regional / collection sets stay progression
 * equipment that replaces it piece by piece (armor-look.ts). A colour variation is the save's appearance colours
 * (armor plate, undersuit, accent, trim), so picking one simply rewrites those four channels; the callsign is kept.
 * The variant in use is whichever matches the save's colours, so nothing new is stored. Pure data + helpers. */
import type { AppearanceDefinition, OperatorId } from "./loadout";
import { OPERATORS } from "./loadout";
import type { ClassId } from "./loadout";

export type RookieVariant = { id: string; name: string; armor: string; cloth: string; visor: string; trim: string };
export type RookieSet = {
  operator: OperatorId; name: string; tier: "COMMON"; tagline: string; description: string;
  /** what the set is made of, top to bottom (the sheet's call-outs) */
  pieces: readonly string[];
  /** the optional head piece the sheet shows (helmet for Goliath, hood for Nyx and Cipher) */
  headPiece: "helmet" | "hood";
  variants: readonly RookieVariant[];
};

/** Colours sampled from the concept sheet: plate, undersuit, accent line, trim. */
export const ROOKIE_SETS: Readonly<Record<OperatorId, RookieSet>> = {
  goliath: {
    operator: "goliath", name: "Rookie Bulwark", tier: "COMMON", tagline: "Built to endure.",
    description: "Rugged, reliable and field-ready. Goliath's rookie armor is designed for survival in hostile environments.",
    pieces: ["Hard-shell helmet (optional)", "Layered shoulder plates", "Plate carrier with load belt", "Armored gauntlets", "Reinforced knee and shin guards"],
    headPiece: "helmet",
    variants: [
      { id: "standard", name: "Standard", armor: "#5b5e63", cloth: "#1b1d20", visor: "#ff8a2a", trim: "#2b2d31" },
      { id: "desert", name: "Desert", armor: "#a8916b", cloth: "#4a3d2c", visor: "#ffb357", trim: "#6b5a40" },
      { id: "snow", name: "Snow", armor: "#d6dbe0", cloth: "#7b838c", visor: "#9fd8ff", trim: "#aab4bd" },
    ],
  },
  nyx: {
    operator: "nyx", name: "Rookie Shadow", tier: "COMMON", tagline: "Light. Fast. Lethal.",
    description: "Agile and adaptable. Nyx's rookie armor gives the mobility and flexibility for recon, infiltration and rapid response.",
    pieces: ["Hood and face mask (optional)", "Red field scarf", "Light chest plate", "Wrapped forearm guards", "Strapped thigh rig and knee pads"],
    headPiece: "hood",
    variants: [
      { id: "standard", name: "Standard", armor: "#2a2a2f", cloth: "#121215", visor: "#d81f2e", trim: "#c9c9cc" },
      { id: "urban", name: "Urban", armor: "#34404f", cloth: "#161b22", visor: "#3d7bff", trim: "#8a97a6" },
      { id: "forest", name: "Forest", armor: "#3b4a30", cloth: "#1a2215", visor: "#7ccf4a", trim: "#6b7a52" },
    ],
  },
  cipher: {
    operator: "cipher", name: "Rookie Arcanist", tier: "COMMON", tagline: "Knowledge fuels power.",
    description: "Versatile and resourceful. Cipher's rookie armor balances protection with advanced tech integration.",
    pieces: ["Hood and mask (optional)", "Long field coat", "Tech harness with data pouches", "Plated gauntlets", "Armored boots"],
    headPiece: "hood",
    variants: [
      { id: "standard", name: "Standard", armor: "#d4d4cf", cloth: "#1a1c22", visor: "#2f7dff", trim: "#8a8d93" },
      { id: "desert", name: "Desert", armor: "#c4ad84", cloth: "#3a3024", visor: "#e0b060", trim: "#8a7656" },
      { id: "void", name: "Void", armor: "#3a2a5c", cloth: "#120d1c", visor: "#a060ff", trim: "#5c3a8a" },
    ],
  },
};

export const rookieSetFor = (operator: OperatorId): RookieSet => ROOKIE_SETS[operator];
export const operatorIdForClass = (classId: ClassId): OperatorId => OPERATORS.find((o) => o.classId === classId)?.id ?? "goliath";
export const rookieSetForClass = (classId: ClassId) => rookieSetFor(operatorIdForClass(classId));

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
/** the variant whose colours the appearance wears, or null when it has been customised away from every variant */
export function currentVariant(set: RookieSet, appearance: Pick<AppearanceDefinition, "armor" | "cloth" | "visor" | "trim">): RookieVariant | null {
  return set.variants.find((v) => same(v.armor, appearance.armor) && same(v.cloth, appearance.cloth) && same(v.visor, appearance.visor) && same(v.trim, appearance.trim)) ?? null;
}
/** the appearance with a variant's colours applied (callsign and anything else kept) */
export function applyVariant<A extends Pick<AppearanceDefinition, "armor" | "cloth" | "visor" | "trim">>(appearance: A, variant: RookieVariant): A {
  return { ...appearance, armor: variant.armor, cloth: variant.cloth, visor: variant.visor, trim: variant.trim };
}
/** a new Operator's starting colours: the rookie set's Standard variant */
export const rookieStartColors = (operator: OperatorId) => { const v = ROOKIE_SETS[operator].variants[0]!; return { armor: v.armor, cloth: v.cloth, visor: v.visor, trim: v.trim }; };
