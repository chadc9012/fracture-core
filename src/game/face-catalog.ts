/**
 * Named faces (owner's "Expanded Character Customization Pack" board, Nov 1: 20 male and 20 female): each is a starting look
 * built from what the game has — one of the cut heads (operators.ts FACES), a sculpt (face-morphs.ts), a skin tone
 * (operator-faces.ts), and where the board shows them, markings, facial hair, hair and accessories (operator-styling.ts).
 * Picking one in the forge sets all of that; every part can then be changed. Pure data.
 */
import type { FaceMorphs } from "./face-morphs";

export type NamedFace = {
  id: string; label: string; blurb: string;
  head: string; morphs: FaceMorphs; skin: string;
  marks?: readonly string[]; beard?: string; hair?: string; hairColor?: string; accessory?: string;
};
const f = (id: string, label: string, blurb: string, head: string, skin: string, morphs: FaceMorphs, extra: Partial<NamedFace> = {}): NamedFace => ({ id, label, blurb, head, skin, morphs, ...extra });

export const MALE_FACES: readonly NamedFace[] = [
  f("m-veteran", "Veteran", "Hard stare, a nick through the brow.", "m-veteran", "natural", {}, { marks: ["scar-brow"], beard: "stubble" }),
  f("m-scarred", "Scarred", "Cut across the eye and the cheek.", "m-veteran", "natural", { jaw: 0.4 }, { marks: ["scar-eye", "scar-cheek"], beard: "stubble" }),
  f("m-rugged", "Rugged", "Square-jawed, weather-beaten.", "m-goliath", "tan", { width: 0.5, jaw: 0.8, brow: 0.5 }, { beard: "stubble" }),
  f("m-elite", "Elite", "Clean lines, a tall forehead.", "m-goliath", "fair", { forehead: 0.6, jaw: -0.3, nose: 0.2 }),
  f("m-youthful", "Youthful", "Soft features, unlined.", "m-goliath", "porcelain", { cheeks: -0.5, jaw: -0.5, chin: -0.3, lips: 0.3 }, { hair: "messy-medium" }),
  f("m-bearded", "Bearded", "A full dark beard.", "m-nomad", "olive", { jaw: 0.3 }, { beard: "full", hair: "crop" }),
  f("m-weathered", "Weathered", "Lined and lean.", "m-sage", "natural", { width: -0.3, cheeks: 0.6, chin: 0.4 }, { beard: "stubble" }),
  f("m-battleworn", "Battleworn", "Burned and cut, still standing.", "m-sage", "natural", { jaw: 0.4 }, { marks: ["burn-cheek", "scar-jaw", "scar-nose"], beard: "stubble" }),
  f("m-stern", "Stern", "Heavy brow, shaved head.", "m-cipher", "deep", { brow: 0.8, jaw: 0.6, width: 0.3 }, { hair: "bald" }),
  f("m-rebel", "Rebel", "Sharp features, hair in his eyes.", "m-goliath", "fair", { width: -0.5, cheeks: 0.7, chin: 0.2 }, { hair: "fringe", hairColor: "black" }),
  f("m-braided", "Braided", "Rows braided back.", "m-cipher", "brown", {}, { hair: "braids", beard: "goatee" }),
  f("m-dreadlocked", "Dreadlocked", "Shoulder-length locs.", "m-cipher", "deep", { noseWidth: 0.3 }, { hair: "dreads", beard: "stubble" }),
  f("m-cheekbone", "High cheekbone", "Sharp cheekbones, narrow jaw.", "m-goliath", "olive", { cheeks: 1, width: -0.5, jaw: -0.4 }),
  f("m-east-asian", "East Asian", "Broader face, lower brow, finer nose.", "m-goliath", "fair", { width: 0.35, eyes: 0.3, nose: -0.4, noseWidth: 0.1, brow: -0.5, cheeks: 0.3 }, { hair: "crop", hairColor: "black" }),
  f("m-south-asian", "South Asian", "Warm skin, a strong straight nose.", "m-cipher", "bronze", { nose: 0.3, lips: 0.2, brow: 0.2 }, { hair: "crop", hairColor: "black", beard: "stubble" }),
  f("m-middle-eastern", "Middle Eastern", "Olive skin, a full beard and strong nose.", "m-veteran", "olive", { nose: 0.4, brow: 0.3 }, { hair: "crop", hairColor: "black", beard: "full" }),
  f("m-freckled", "Freckled", "Fair and freckled.", "m-goliath", "porcelain", { cheeks: -0.3, jaw: -0.3 }, { marks: ["freckles"], hair: "messy-medium", hairColor: "copper" }),
  f("m-shaved-tattooed", "Shaved & tattooed", "Shaved head, ink up the temple.", "m-goliath", "natural", { brow: 0.3 }, { hair: "bald", marks: ["tattoo-sidehead", "tattoo-tribal"] }),
  f("m-older", "Older", "Grey at the temples, lines at the eyes.", "m-sage", "natural", { cheeks: 0.4, chin: 0.2 }, { hair: "crop", hairColor: "grey", beard: "stubble" }),
  f("m-distinguished", "Distinguished", "White hair and a silver beard.", "m-sage", "fair", { forehead: 0.4, nose: 0.2 }, { hair: "crop", hairColor: "white", beard: "full" }),
  // owner's operator sheet (Nov 8/9): his own head (operators.ts m-ronin: goatee and cheek cuts painted in) and his twists
  f("m-ronin", "Ronin", "His own face: goatee, a cut across the cheek.", "m-ronin", "natural", {}, { hair: "twist-fade", hairColor: "espresso" }),
];

export const FEMALE_FACES: readonly NamedFace[] = [
  f("f-classic", "Classic", "Even features, steady eyes.", "f-nyx", "natural", {}),
  f("f-scarred", "Scarred", "A cut across the cheek.", "f-shade", "natural", { cheeks: 0.3 }, { marks: ["scar-cheek"] }),
  f("f-athletic", "Athletic", "Lean, high cheekbones.", "f-nyx", "tan", { cheeks: 0.6, width: -0.2, jaw: 0.2 }, { hair: "ponytail-high" }),
  f("f-elite", "Elite", "Fine jaw, tall forehead.", "f-shade", "fair", { forehead: 0.5, jaw: -0.4, nose: 0.1 }),
  f("f-youthful", "Youthful", "Soft and round.", "f-nyx", "porcelain", { cheeks: -0.5, chin: -0.3, lips: 0.4 }, { hair: "long" }),
  f("f-freckled", "Freckled", "Fair and freckled.", "f-nyx", "porcelain", { cheeks: -0.2 }, { marks: ["freckles"], hair: "wavy", hairColor: "copper" }),
  f("f-battleworn", "Battleworn", "Burned and cut.", "f-shade", "natural", { jaw: 0.3 }, { marks: ["burn-cheek", "scar-brow", "scar-neck"] }),
  f("f-rebel", "Rebel", "Cropped, dyed, a hard look.", "f-shade", "fair", { cheeks: 0.5, width: -0.3 }, { hair: "pixie", hairColor: "crimson", marks: ["tattoo-tears"] }),
  f("f-elegant", "Elegant", "Full lips, a long neck.", "f-nyx", "fair", { forehead: 0.3, lips: 0.5, jaw: -0.4, cheeks: 0.3 }, { hair: "bun" }),
  f("f-fierce", "Fierce", "Sharp, inked, unblinking.", "f-shade", "olive", { cheeks: 0.8, width: -0.4, brow: 0.3 }, { marks: ["tattoo-tribal"], hair: "undercut" }),
  f("f-east-asian", "East Asian", "Broader face, lower brow, finer nose.", "f-nyx", "fair", { width: 0.3, eyes: 0.3, nose: -0.4, brow: -0.5, cheeks: 0.3 }, { hair: "long", hairColor: "black" }),
  f("f-south-asian", "South Asian", "Warm skin, a straight nose.", "f-nyx", "bronze", { nose: 0.25, lips: 0.2, brow: 0.1 }, { hair: "side-braid", hairColor: "black" }),
  f("f-middle-eastern", "Middle Eastern", "Olive skin, strong brows.", "f-shade", "olive", { brow: 0.3, nose: 0.3, lips: 0.2 }, { hair: "wavy", hairColor: "espresso" }),
  f("f-afro-caribbean", "Afro-Caribbean", "Deep skin, broad nose, full lips.", "f-nyx", "deep", { noseWidth: 0.6, lips: 0.5, cheeks: 0.3 }, { hair: "afro", hairColor: "black" }),
  f("f-latina", "Latina", "Bronze skin, full lips.", "f-shade", "bronze", { lips: 0.4, cheeks: 0.3 }, { hair: "long-wavy", hairColor: "espresso" }),
  f("f-warrior-paint", "Warrior paint", "Red stripes across the cheeks.", "f-nyx", "tan", { cheeks: 0.4 }, { marks: ["paint-warstripes"], hair: "braided-crown" }),
  f("f-cyber", "Cyber augmented", "A targeting lens and a Resonance trace.", "f-shade", "natural", { width: -0.2 }, { marks: ["resonance-temple"], accessory: "eyepiece", hair: "shaved-sides", hairColor: "neon" }),
  f("f-tattooed", "Tattooed", "Ink from the neck to the temple.", "f-nyx", "natural", { cheeks: 0.3 }, { marks: ["tattoo-neck", "tattoo-temple", "tattoo-collar"], hair: "cornrows" }),
  f("f-older", "Older", "Grey hair, lined and lean.", "f-shade", "ash", { cheeks: 0.5, chin: 0.3, lips: -0.3 }, { hair: "bun", hairColor: "grey" }),
  f("f-distinguished", "Distinguished", "Silver hair swept back.", "f-nyx", "fair", { forehead: 0.4, jaw: -0.2, cheeks: 0.4 }, { hair: "half-up", hairColor: "silver" }),
];

export const facesFor = (body: "male" | "female" | "robot"): readonly NamedFace[] => (body === "male" ? MALE_FACES : body === "female" ? FEMALE_FACES : []);
export const namedFace = (body: "male" | "female" | "robot", id: unknown): NamedFace | undefined => facesFor(body).find((x) => x.id === id);
