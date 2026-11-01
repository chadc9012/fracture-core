/**
 * Hair and skin markings for human operators (owner, November 2026: "add more hair styles to characters like dreadlocks,
 * bald, ponytail etc. and tattoos or markings, stretch marks, blade cuts").
 *
 * The authored heads (operators.ts FACES) each come with one hairstyle baked into their mesh and texture, so a chosen style
 * works in two parts, both in operator-head.ts:
 *  - the head's own hair is taken off: scalp texels are recoloured to skin (bald) or to the chosen hair colour, and any hair
 *    geometry that stands off the skull (Nyx's ponytail, Nomad's topknot) is clipped away
 *  - the new style is built as geometry (hair-geometry.ts) and bound to the head bone, so it follows every animation
 * Markings are painted in the head's skin shader from shapes in head space (no new textures), so they sit on any face at any
 * skin tone. Robots have neither: their plating and optics are their look.
 *
 * Pure data and rules, like operator-faces.ts: saves, tests and the Unreal port read the same ids.
 */
import type { Swatch } from "./operator-faces.ts";

export type HairDef = {
  id: string; label: string; blurb: string;
  /** "authored" keeps the head's own hair (old saves); "none" is bald; every other kind is built from geometry */
  kind: "authored" | "none" | "cap" | "buzz" | "undercut" | "dreads" | "dreads-tied" | "ponytail-high" | "ponytail-low" | "bun" | "topknot"
    | "mohawk" | "afro" | "cornrows" | "box-braids" | "twists" | "long" | "fringe";
};

const hair = (id: string, label: string, blurb: string, kind: HairDef["kind"]): HairDef => ({ id, label, blurb, kind });

/** In the order the creation grid shows them. */
export const HAIR_STYLES: readonly HairDef[] = [
  hair("authored", "As modelled", "The face's own hair.", "authored"),
  hair("bald", "Bald", "Clean shaven scalp.", "none"),
  hair("buzz", "Buzz cut", "Clipped close all over.", "buzz"),
  hair("crop", "Short crop", "Short, neat, brushed forward.", "cap"),
  hair("undercut", "Undercut", "Shaved sides, slicked top.", "undercut"),
  hair("fringe", "Swept fringe", "Short with a fringe swept aside.", "fringe"),
  hair("dreads", "Dreadlocks", "Shoulder-length locs, loose.", "dreads"),
  hair("dreads-tied", "Locs tied back", "Locs gathered at the back.", "dreads-tied"),
  hair("twists", "Twists", "Fine two-strand twists.", "twists"),
  hair("cornrows", "Cornrows", "Rows braided back along the scalp.", "cornrows"),
  hair("box-braids", "Box braids", "Long braids past the shoulders.", "box-braids"),
  hair("ponytail-high", "High ponytail", "Pulled up and tied high.", "ponytail-high"),
  hair("ponytail-low", "Low ponytail", "Tied at the nape.", "ponytail-low"),
  hair("bun", "Bun", "Gathered into a bun at the back.", "bun"),
  hair("topknot", "Topknot", "Shaved sides, knot on top.", "topknot"),
  hair("mohawk", "Mohawk", "Shaved sides, a crest down the middle.", "mohawk"),
  hair("afro", "Afro", "Full, rounded natural.", "afro"),
  hair("long", "Long loose", "Falls past the shoulders.", "long"),
];

/** "natural" keeps the authored hair's colour (and is the only choice that can, for "As modelled") */
export const HAIR_COLORS: readonly Swatch[] = [
  { id: "natural", label: "As modelled", hex: "" },
  { id: "black", label: "Black", hex: "#120f0e" },
  { id: "espresso", label: "Espresso", hex: "#2a1c14" },
  { id: "brown", label: "Brown", hex: "#4a3222" },
  { id: "chestnut", label: "Chestnut", hex: "#6e4528" },
  { id: "auburn", label: "Auburn", hex: "#7a3318" },
  { id: "blonde", label: "Blonde", hex: "#b48d4e" },
  { id: "platinum", label: "Platinum", hex: "#d9cfb8" },
  { id: "grey", label: "Grey", hex: "#8c8c8a" },
  { id: "white", label: "White", hex: "#e8e6df" },
  { id: "crimson", label: "Crimson", hex: "#8f1d2c" },
  { id: "violet", label: "Violet", hex: "#4b2a7a" },
  { id: "teal", label: "Teal", hex: "#1f6b6e" },
  { id: "neon", label: "Neon blue", hex: "#2a6cff" },
];

export type MarkingKind = "scar" | "tattoo" | "stretch" | "resonance";
export type MarkingDef = { id: string; label: string; blurb: string; kind: MarkingKind };
const mark = (id: string, label: string, blurb: string, kind: MarkingKind): MarkingDef => ({ id, label, blurb, kind });

/** Up to MAX_MARKINGS can be worn at once; each is a shape in head space (operator-skin-shader.ts). */
export const MARKINGS: readonly MarkingDef[] = [
  mark("scar-cheek", "Blade cut, cheek", "A long cut across the left cheek.", "scar"),
  mark("scar-eye", "Blade cut, eye", "A slash down through the right brow and eye.", "scar"),
  mark("scar-brow", "Brow nick", "A short cut through the left brow.", "scar"),
  mark("scar-jaw", "Jaw slash", "A cut along the right jawline.", "scar"),
  mark("scar-lip", "Split lip", "A healed split through the lip.", "scar"),
  mark("scar-neck", "Neck cut", "A slash across the side of the neck.", "scar"),
  mark("scar-nose", "Nose bridge", "A cut across the bridge of the nose.", "scar"),
  mark("tattoo-tribal", "Tribal, cheek", "Bands sweeping the left cheek and temple.", "tattoo"),
  mark("tattoo-temple", "Temple lines", "Three thin lines down the right temple.", "tattoo"),
  mark("tattoo-tears", "Under-eye marks", "Dots beneath the left eye.", "tattoo"),
  mark("tattoo-collar", "Neck band", "A solid band around the neck.", "tattoo"),
  mark("tattoo-neck", "Neck script", "Lines of script up the left side of the neck.", "tattoo"),
  mark("tattoo-chin", "Chin bars", "Vertical bars down the chin.", "tattoo"),
  mark("tattoo-forehead", "Brow band", "A thin band across the forehead.", "tattoo"),
  mark("stretch-neck", "Stretch marks, neck", "Fine pale streaks down the sides of the neck and shoulders.", "stretch"),
  mark("stretch-jaw", "Stretch marks, jaw", "Pale streaks under the jaw.", "stretch"),
  mark("burn-cheek", "Burn, cheek", "A healed burn over the right cheek.", "scar"),
  mark("resonance-temple", "Resonance trace", "A faint glowing circuit on the left temple — a stable Resonant's mark.", "resonance"),
  mark("resonance-neck", "Sync line", "A thin glowing line down the neck.", "resonance"),
];
export const MAX_MARKINGS = 4;

export const DEFAULT_STYLE = { hair: "authored", hairColor: "natural" } as const;

export const hairDef = (id: unknown): HairDef => HAIR_STYLES.find((h) => h.id === id) ?? HAIR_STYLES[0]!;
export const hairOr = (id: unknown): string => hairDef(id).id;
export const hairColorOr = (id: unknown): string => (HAIR_COLORS.some((c) => c.id === id) ? (id as string) : DEFAULT_STYLE.hairColor);
export const hairColorHex = (id: unknown): string => HAIR_COLORS.find((c) => c.id === hairColorOr(id))!.hex;
export const markingDef = (id: string): MarkingDef | undefined => MARKINGS.find((m) => m.id === id);
/** keeps known ids, drops duplicates and unknowns, caps at MAX_MARKINGS (old saves carry none) */
export const markingsOr = (ids: unknown): string[] => {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const id of ids) if (typeof id === "string" && markingDef(id) && !out.includes(id)) { out.push(id); if (out.length >= MAX_MARKINGS) break; }
  return out;
};
/** adds or removes a marking; a fifth is refused (the list stays as it was) */
export const toggleMarking = (ids: readonly string[], id: string): string[] => {
  if (!markingDef(id)) return [...ids];
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  return ids.length >= MAX_MARKINGS ? [...ids] : [...ids, id];
};

/** A built hairstyle needs a colour: "natural" on anything but the authored hair means the default black. */
export const effectiveHairHex = (hair: unknown, hairColor: unknown): string => {
  const h = hairDef(hair);
  const hex = hairColorHex(hairColor);
  if (h.kind === "authored" || h.kind === "none") return hex;
  return hex || HAIR_COLORS[1]!.hex;
};

/** What the head shader and hair builder need, resolved from a (possibly old or partial) character. */
export type StyleLook = { hair: HairDef; hairHex: string; marks: MarkingDef[] };
export const styleLook = (choice: { hair?: unknown; hairColor?: unknown; marks?: unknown }): StyleLook => ({
  hair: hairDef(choice.hair),
  hairHex: effectiveHairHex(choice.hair, choice.hairColor),
  marks: markingsOr(choice.marks).map((id) => markingDef(id)!),
});
