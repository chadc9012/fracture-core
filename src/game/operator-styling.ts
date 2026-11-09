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

/** One piece of a built hairstyle (hair-geometry.ts turns these into geometry on the fitted skull). Lengths in metres. */
export type HairPart =
  | { kind: "cap"; thick: number; sideThick?: number; phiMax?: number; shade?: number }
  | { kind: "fringe"; sweep: -1 | 0 | 1; lift?: number; up?: boolean }
  | { kind: "hanging"; count: number; length: number; jitter: number; radius: number; seed: number; curl?: boolean }
  | { kind: "tied"; count: number; radius: number; bun?: boolean }
  | { kind: "tail"; phi: number; theta: number; length: number; radius: number; sway?: number }
  | { kind: "bun"; phi: number; theta: number; r: number; flat?: number; braided?: boolean }
  | { kind: "crest"; height: number; width?: number }
  | { kind: "afro"; lift: number; jitter: number; extra?: number }
  | { kind: "curtain"; length: number; waves?: number; span?: number; side?: -1 | 1 }
  | { kind: "cornrows"; rows: number; hang?: number }
  | { kind: "crown" }
  | { kind: "tufts"; count: number; length: number; radius: number; seed: number; spiky?: boolean; curl?: boolean }
  | { kind: "sideBraid"; side: -1 | 1; length: number }
  /** short two-strand twists rooted on the top of the head only (down to `phiMax`), standing up then falling outward;
   * `tip` lightens (>1) or darkens the last third of each twist */
  | { kind: "twistTop"; count: number; length: number; radius: number; seed: number; phiMax: number; tip?: number };

export type HairDef = {
  id: string; label: string; blurb: string;
  /** "authored" keeps the head's own hair (old saves); "none" is bald; "built" is made from `parts` */
  kind: "authored" | "none" | "built";
  /** which body types list it in the forge (every style fits every human body; this is the board's own grouping) */
  bodies: readonly ("male" | "female")[];
  parts?: readonly HairPart[];
};

const M = ["male"] as const, F = ["female"] as const, MF = ["male", "female"] as const;
const built = (id: string, label: string, blurb: string, bodies: readonly ("male" | "female")[], ...parts: HairPart[]): HairDef => ({ id, label, blurb, kind: "built", bodies, parts });
const PI = Math.PI;

/** The hairstyle catalogue (owner's "Expanded Character Customization Pack" board, Nov 1: 24 male + 24 female, one entry
 * per style — a style on both lists is listed once with both bodies). Ids from the first pass are kept so saves still load. */
export const HAIR_STYLES: readonly HairDef[] = [
  { id: "authored", label: "As modelled", blurb: "The face's own hair.", kind: "authored", bodies: MF },
  { id: "bald", label: "Bald", blurb: "Clean shaven scalp.", kind: "none", bodies: MF },
  // --- short
  built("buzz", "Buzz cut", "Clipped close all over.", MF, { kind: "cap", thick: 0.002, shade: 0.9 }),
  built("fade", "Fade", "Short on top, faded to the skin at the sides.", M, { kind: "cap", thick: 0.012, sideThick: 0.001 }),
  built("high-fade", "High fade", "Length on top, skin-faded high up the sides.", M, { kind: "cap", thick: 0.015, sideThick: 0, phiMax: 0.42 * PI }),
  built("crop", "Crew cut", "Short, neat, brushed forward.", M, { kind: "cap", thick: 0.012 }),
  built("ivy", "Ivy League", "A crew cut with the front swept to one side.", M, { kind: "cap", thick: 0.012 }, { kind: "fringe", sweep: 1, lift: 0.01 }),
  built("undercut", "Undercut", "Shaved sides, slicked top.", M, { kind: "cap", thick: 0.016, phiMax: 0.38 * PI }),
  built("pompadour", "Pompadour", "Volume swept up and back from the forehead.", M, { kind: "cap", thick: 0.014, sideThick: 0.006 }, { kind: "fringe", sweep: 0, lift: 0.03, up: true }),
  built("spiky", "Spiky", "Short and spiked up.", M, { kind: "cap", thick: 0.008 }, { kind: "tufts", count: 60, length: 0.035, radius: 0.004, seed: 5, spiky: true }),
  built("messy-medium", "Messy medium", "Mid-length, tousled.", M, { kind: "cap", thick: 0.018 }, { kind: "tufts", count: 50, length: 0.06, radius: 0.006, seed: 9 }),
  built("fringe", "Swept fringe", "Short with a fringe swept aside.", MF, { kind: "cap", thick: 0.012, phiMax: 0.56 * PI }, { kind: "fringe", sweep: -1 }),
  built("pixie", "Pixie cut", "Cropped short with a soft fringe.", F, { kind: "cap", thick: 0.01 }, { kind: "fringe", sweep: 1 }, { kind: "tufts", count: 20, length: 0.04, radius: 0.005, seed: 21 }),
  built("shaved-sides", "Shaved sides", "Long on top, shaved at the sides.", F, { kind: "cap", thick: 0.022, phiMax: 0.36 * PI }, { kind: "fringe", sweep: 1, lift: 0.015 }),
  built("short-curly", "Short curly", "Tight curls, cropped.", F, { kind: "cap", thick: 0.014 }, { kind: "tufts", count: 55, length: 0.03, radius: 0.0055, seed: 31, curl: true }),
  built("curly", "Curly", "Loose curls to the shoulders.", F, { kind: "cap", thick: 0.02 }, { kind: "hanging", count: 44, length: 0.2, jitter: 0.08, radius: 0.008, seed: 41, curl: true }),
  // --- locs, braids, twists
  built("dreads", "Dreadlocks", "Shoulder-length locs, loose.", MF, { kind: "cap", thick: 0.008 }, { kind: "hanging", count: 34, length: 0.24, jitter: 0.1, radius: 0.009, seed: 11 }),
  built("freeform-locs", "Freeform locs", "Thick, uneven locs.", M, { kind: "cap", thick: 0.01 }, { kind: "hanging", count: 26, length: 0.2, jitter: 0.16, radius: 0.012, seed: 13 }),
  built("dreads-tied", "Locs tied back", "Locs gathered at the back.", M, { kind: "cap", thick: 0.008 }, { kind: "tied", count: 30, radius: 0.0085 }),
  built("locs-bun", "Locs bun", "Locs gathered up into a bun.", F, { kind: "cap", thick: 0.008 }, { kind: "tied", count: 30, radius: 0.0085, bun: true }),
  // owner's operator sheet (Nov 8): short twists on top, sun-lightened at the ends, over a high skin fade
  built("twist-fade", "Twists & fade", "Twists springing from the top and falling outward, gold at the ends, over a taper fade.", M, { kind: "cap", thick: 0.0018, sideThick: 0.001, phiMax: 0.5 * PI, shade: 0.8 }, { kind: "cap", thick: 0.006, sideThick: 0, phiMax: 0.36 * PI }, { kind: "twistTop", count: 90, length: 0.085, radius: 0.006, seed: 83, phiMax: 0.34 * PI, tip: 5 }),
  built("twists", "Twists", "Fine two-strand twists.", M, { kind: "cap", thick: 0.006 }, { kind: "hanging", count: 60, length: 0.17, jitter: 0.09, radius: 0.0045, seed: 23 }),
  built("cornrows", "Cornrows", "Rows braided back along the scalp.", MF, { kind: "cap", thick: 0.001, shade: 0.85 }, { kind: "cornrows", rows: 7 }),
  built("braids", "Braids", "Rows along the scalp into short braids.", M, { kind: "cap", thick: 0.001, shade: 0.85 }, { kind: "cornrows", rows: 6, hang: 0.1 }),
  built("box-braids", "Box braids", "Long braids past the shoulders.", F, { kind: "cap", thick: 0.006 }, { kind: "hanging", count: 48, length: 0.3, jitter: 0.08, radius: 0.0062, seed: 37 }),
  built("braided-bun", "Braided bun", "Braids wound into a bun.", F, { kind: "cap", thick: 0.004 }, { kind: "cornrows", rows: 5 }, { kind: "bun", phi: 0.38 * PI, theta: PI, r: 0.038, braided: true }),
  built("side-braid", "Side braid", "One thick braid over the shoulder.", F, { kind: "cap", thick: 0.01 }, { kind: "sideBraid", side: 1, length: 0.3 }),
  built("braided-crown", "Braided crown", "A braid circling the head, hair loose below.", F, { kind: "cap", thick: 0.01 }, { kind: "crown" }, { kind: "curtain", length: 0.28, span: 1.4 }),
  // --- tails and buns
  built("ponytail-low", "Ponytail", "Tied at the nape.", F, { kind: "cap", thick: 0.01 }, { kind: "tail", phi: 0.62 * PI, theta: PI, length: 0.25, radius: 0.02 }),
  built("ponytail-high", "High ponytail", "Pulled up and tied high.", F, { kind: "cap", thick: 0.01 }, { kind: "tail", phi: 0.3 * PI, theta: PI, length: 0.27, radius: 0.022 }),
  built("twin-tails", "Twin tails", "Two tails, one each side.", F, { kind: "cap", thick: 0.01 }, { kind: "tail", phi: 0.5 * PI, theta: 0.62 * PI, length: 0.22, radius: 0.016, sway: 1 }, { kind: "tail", phi: 0.5 * PI, theta: -0.62 * PI, length: 0.22, radius: 0.016, sway: -1 }),
  built("bun", "Bun", "Gathered into a bun at the back.", F, { kind: "cap", thick: 0.01 }, { kind: "bun", phi: 0.38 * PI, theta: PI, r: 0.038, flat: 0.8 }),
  built("messy-bun", "Messy bun", "A loose bun with strands falling free.", F, { kind: "cap", thick: 0.012 }, { kind: "bun", phi: 0.34 * PI, theta: PI, r: 0.04, flat: 0.85 }, { kind: "tufts", count: 24, length: 0.07, radius: 0.004, seed: 51 }),
  built("half-up", "Half-up", "Top half tied back, the rest loose.", F, { kind: "cap", thick: 0.012 }, { kind: "bun", phi: 0.36 * PI, theta: PI, r: 0.028, flat: 0.8 }, { kind: "curtain", length: 0.3, span: 1.4 }),
  built("topknot", "Top knot", "Shaved sides, knot on top.", M, { kind: "cap", thick: 0.012, phiMax: 0.3 * PI }, { kind: "bun", phi: 0.03 * PI, theta: PI, r: 0.034 }),
  built("samurai-bun", "Samurai bun", "Pulled tight into a knot at the crown.", M, { kind: "cap", thick: 0.009 }, { kind: "bun", phi: 0.12 * PI, theta: PI, r: 0.03, flat: 1.2 }),
  built("man-bun", "Man bun", "Long hair tied into a bun at the back.", M, { kind: "cap", thick: 0.014 }, { kind: "bun", phi: 0.4 * PI, theta: PI, r: 0.036, flat: 0.85 }),
  // --- crests
  built("mohawk", "Mohawk", "Shaved sides, a crest down the middle.", MF, { kind: "crest", height: 0.065 }),
  built("faux-hawk", "Faux hawk", "Short sides, a low ridge down the middle.", M, { kind: "cap", thick: 0.005, sideThick: 0.002 }, { kind: "crest", height: 0.03, width: 0.03 }),
  // --- volume and length
  built("afro", "Afro", "Full, rounded natural.", MF, { kind: "afro", lift: 0.032, jitter: 0.004 }),
  built("wild-volume", "Wild volume", "Big, unruly and everywhere.", M, { kind: "afro", lift: 0.022, jitter: 0.012 }, { kind: "tufts", count: 40, length: 0.06, radius: 0.005, seed: 61 }),
  built("long", "Long straight", "Falls straight past the shoulders.", MF, { kind: "cap", thick: 0.012, phiMax: 0.58 * PI }, { kind: "curtain", length: 0.36, span: 1.45 }),
  built("long-wavy", "Long wavy", "Long with a loose wave.", MF, { kind: "cap", thick: 0.014, phiMax: 0.58 * PI }, { kind: "curtain", length: 0.34, waves: 1, span: 1.45 }),
  built("wavy", "Wavy", "Shoulder-length waves.", F, { kind: "cap", thick: 0.014, phiMax: 0.58 * PI }, { kind: "curtain", length: 0.24, waves: 1.4, span: 1.45 }),
  built("layered", "Layered", "Long, cut in layers.", M, { kind: "cap", thick: 0.014, phiMax: 0.58 * PI }, { kind: "curtain", length: 0.26, span: 1.4 }, { kind: "tufts", count: 30, length: 0.09, radius: 0.005, seed: 71 }),
  built("layered-bob", "Layered bob", "A bob to the jaw, layered.", F, { kind: "cap", thick: 0.014, phiMax: 0.58 * PI }, { kind: "curtain", length: 0.13, span: 1.5 }, { kind: "fringe", sweep: 1 }),
  built("asymmetrical", "Asymmetrical", "Long on one side, cropped on the other.", F, { kind: "cap", thick: 0.014, phiMax: 0.5 * PI }, { kind: "curtain", length: 0.16, span: 1.2, side: 1 }, { kind: "fringe", sweep: 1, lift: 0.012 }),
  built("mullet", "Mullet", "Short in front, long at the back.", M, { kind: "cap", thick: 0.012 }, { kind: "curtain", length: 0.2, span: 0.6 }),
];
/** the styles the forge lists for a body type */
export const hairStylesFor = (body: "male" | "female" | "robot"): HairDef[] => HAIR_STYLES.filter((h) => body !== "robot" && h.bodies.includes(body));

/** "natural" keeps the authored hair's colour (and is the only choice that can, for "As modelled") */
export const HAIR_COLORS: readonly Swatch[] = [
  { id: "natural", label: "As modelled", hex: "" },
  { id: "black", label: "Black", hex: "#120f0e" },
  { id: "espresso", label: "Espresso", hex: "#2a1c14" },
  { id: "brown", label: "Brown", hex: "#4a3222" },
  { id: "ash", label: "Ash brown", hex: "#5a4d44" },
  { id: "chestnut", label: "Chestnut", hex: "#6e4528" },
  { id: "auburn", label: "Auburn", hex: "#7a3318" },
  { id: "copper", label: "Copper", hex: "#9c4a1e" },
  { id: "honey", label: "Honey", hex: "#a8762f" },
  { id: "blonde", label: "Blonde", hex: "#b48d4e" },
  { id: "platinum", label: "Platinum", hex: "#d9cfb8" },
  { id: "grey", label: "Grey", hex: "#8c8c8a" },
  { id: "white", label: "White", hex: "#e8e6df" },
  { id: "crimson", label: "Crimson", hex: "#8f1d2c" },
  { id: "orange", label: "Orange", hex: "#c85a14" },
  { id: "pink", label: "Pink", hex: "#d64c8a" },
  { id: "magenta", label: "Magenta", hex: "#9b1e86" },
  { id: "violet", label: "Violet", hex: "#4b2a7a" },
  { id: "neon", label: "Neon blue", hex: "#2a6cff" },
  { id: "teal", label: "Teal", hex: "#1f6b6e" },
  { id: "green", label: "Green", hex: "#2f7a3a" },
  { id: "silver", label: "Silver blue", hex: "#9fb3c8" },
];

export type MarkingKind = "scar" | "tattoo" | "stretch" | "resonance" | "paint" | "freckle";
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
  mark("tattoo-fullface", "Tribal, both cheeks", "Bands sweeping both cheeks and temples.", "tattoo"),
  mark("tattoo-sidehead", "Side lines", "Lines from the right temple back over the ear (shows with short hair).", "tattoo"),
  mark("tattoo-jaw", "Jaw script", "A line of script along the left jaw.", "tattoo"),
  mark("paint-warstripes", "War stripes", "Three red stripes across each cheek.", "paint"),
  mark("paint-halfmask", "Eye band", "A dark band painted across the eyes.", "paint"),
  mark("paint-cheekbars", "Cheek bars", "Two pale bars under each eye.", "paint"),
  mark("freckles", "Freckles", "Freckles across the nose and cheeks.", "freckle"),
];
export const MAX_MARKINGS = 4;

/** Facial hair (the board's eight, male bodies first): painted in the head's skin shader in the hair colour. */
export type BeardDef = { id: string; label: string; blurb: string };
export const BEARDS: readonly BeardDef[] = [
  { id: "clean", label: "Clean shaven", blurb: "No facial hair." },
  { id: "stubble", label: "Stubble", blurb: "A few days' growth." },
  { id: "goatee", label: "Goatee", blurb: "Chin and around the mouth." },
  { id: "moustache", label: "Moustache", blurb: "Upper lip only." },
  { id: "full", label: "Full beard", blurb: "Jaw, chin, cheeks and lip." },
  { id: "chin-strap", label: "Chin strap", blurb: "A thin line along the jaw." },
  { id: "van-dyke", label: "Van Dyke", blurb: "Goatee and moustache, cheeks bare." },
  { id: "chops", label: "Mutton chops", blurb: "Sideburns down to the jaw, chin bare." },
];
export const beardOr = (id: unknown): string => (BEARDS.some((b) => b.id === id) ? (id as string) : "clean");

/** Accessories worn on the face and head (geometry on the Head bone, gear-geometry.ts). One accessory, one headgear. */
export type WearDef = { id: string; label: string; blurb: string };
export const ACCESSORIES: readonly WearDef[] = [
  { id: "none", label: "None", blurb: "" },
  { id: "glasses", label: "Glasses", blurb: "Thin dark frames, clear lenses." },
  { id: "shades", label: "Shades", blurb: "Dark wraparound lenses." },
  { id: "eyepiece", label: "Cyber eyepiece", blurb: "A glowing targeting lens over the right eye." },
  { id: "earpiece", label: "Earpiece", blurb: "A comms bead in the left ear." },
];
export const HEADGEAR: readonly WearDef[] = [
  { id: "none", label: "None", blurb: "" },
  { id: "beanie", label: "Beanie", blurb: "A dark knit beanie." },
  { id: "beanie-red", label: "Red beanie", blurb: "A red knit beanie." },
  { id: "cap", label: "Cap", blurb: "A dark field cap with a brim." },
  { id: "bandana", label: "Bandana", blurb: "A bandana tied at the back." },
  { id: "headband", label: "Headband", blurb: "A band across the forehead." },
];
export const accessoryOr = (id: unknown): string => (ACCESSORIES.some((a) => a.id === id) ? (id as string) : "none");
export const headgearOr = (id: unknown): string => (HEADGEAR.some((a) => a.id === id) ? (id as string) : "none");

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
export type StyleLook = { hair: HairDef; hairHex: string; marks: MarkingDef[]; beard: string; accessory: string; headgear: string };
export const styleLook = (choice: { hair?: unknown; hairColor?: unknown; marks?: unknown; beard?: unknown; accessory?: unknown; headgear?: unknown }): StyleLook => ({
  hair: hairDef(choice.hair),
  hairHex: effectiveHairHex(choice.hair, choice.hairColor),
  marks: markingsOr(choice.marks).map((id) => markingDef(id)!),
  beard: beardOr(choice.beard), accessory: accessoryOr(choice.accessory), headgear: headgearOr(choice.headgear),
});
