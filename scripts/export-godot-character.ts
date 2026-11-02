/**
 * Exports the character-creation catalogue for the Godot project (godot-world-fracture/scripts/character/): the bodies, the cut
 * heads, the 40 named faces, the sculpt sliders, skin tones, robot plating and optics, every hairstyle's parts, hair colours,
 * beards, markings (with their head-space shapes), accessories and headgear. The web game stays the source of truth; the JSON is
 * small, so it is committed (godot-world-fracture/data/character.json) and re-run whenever the web catalogue changes.
 *
 *   bun scripts/export-godot-character.ts
 */
import { writeFileSync } from "node:fs";
import { MALE_FACES, FEMALE_FACES } from "../src/game/face-catalog";
import { MORPHS } from "../src/game/face-morphs";
import { SKIN_TONES, ROBOT_PLATING, ROBOT_OPTICS, DEFAULT_FACE } from "../src/game/operator-faces";
import { FACES } from "../src/game/operators";
import { HAIR_STYLES, HAIR_COLORS, MARKINGS, MAX_MARKINGS, BEARDS, ACCESSORIES, HEADGEAR } from "../src/game/operator-styling";
import { MARKING_SHAPES, SKULL } from "../src/game/operator-skin-shader";

const out = {
  frames: [
    { id: "goliath", label: "Titan frame", class: "TITAN", blurb: "Heavy shoulders, broad build." },
    { id: "nyx", label: "Hunter frame", class: "HUNTER", blurb: "Lean and quick." },
    { id: "cipher", label: "Warlock frame", class: "WARLOCK", blurb: "Long coat, light armour." },
  ],
  bodies: ["male", "female", "robot"],
  heads: Object.fromEntries(Object.entries(FACES).map(([b, list]) => [b, list.map((f) => ({ id: f.id, label: f.label, blurb: f.blurb, skinLum: f.skinLum ?? 0 }))])),
  defaultFace: DEFAULT_FACE,
  faces: { male: MALE_FACES, female: FEMALE_FACES },
  morphs: MORPHS,
  skin: SKIN_TONES, plating: ROBOT_PLATING, optics: ROBOT_OPTICS,
  hair: HAIR_STYLES, hairColors: HAIR_COLORS,
  beards: BEARDS, markings: MARKINGS, maxMarkings: MAX_MARKINGS, markingShapes: MARKING_SHAPES, skull: SKULL,
  accessories: ACCESSORIES, headgear: HEADGEAR,
};
writeFileSync("godot-world-fracture/data/character.json", JSON.stringify(out));
console.log("wrote godot-world-fracture/data/character.json");
