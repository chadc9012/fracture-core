/**
 * Character creation's look choices, Destiny-style (owner, October 2026: "let users pick the character's face like Destiny").
 * Pure data and rules; StartMenu.tsx offers them, OperatorModel.tsx draws them.
 *
 *  - Body: each class's rookie armour has a real female, male and robot body (scripts/build-operator-variants.py), all headless
 *  - Face: a head of that body type (operators.ts FACES), skinned onto the body's Head bone at load
 *  - Skin tone (humans): retints the head's skin, keeping the texture's shading (`skin` on the character)
 *  - Plating and optics (robots): the robot head's plate colour and its glowing optics (`skin` / `eyes` on the character)
 *
 * Armour colour is not a creation choice (shaders recolour gear in the world). Veteran and Elite armour bodies wear their own
 * helmets and heads, so a face shows on rookie armour, as a helmet hides it in Destiny.
 */
import type { ClassId } from "./loadout";
import { FACES, faceOr, type BodyType, type FaceDef } from "./operators";

export type Swatch = { id: string; label: string; hex: string };

/** "natural" keeps the head as authored */
export const SKIN_TONES: readonly Swatch[] = [
  { id: "natural", label: "As modelled", hex: "" },
  { id: "porcelain", label: "Porcelain", hex: "#f1d3c2" },
  { id: "fair", label: "Fair", hex: "#e2b79c" },
  { id: "olive", label: "Olive", hex: "#c39a72" },
  { id: "tan", label: "Tan", hex: "#a8764f" },
  { id: "bronze", label: "Bronze", hex: "#8a5a3a" },
  { id: "brown", label: "Brown", hex: "#6b4129" },
  { id: "deep", label: "Deep", hex: "#43271a" },
  { id: "ash", label: "Ashen", hex: "#9aa3a8" },
  { id: "dusk", label: "Dusk", hex: "#8f86b5" },
];
export const ROBOT_PLATING: readonly Swatch[] = [
  { id: "steel", label: "Steel", hex: "#8b929c" },
  { id: "graphite", label: "Graphite", hex: "#3c4047" },
  { id: "ivory", label: "Ivory", hex: "#d9d4c7" },
  { id: "bronze", label: "Bronze", hex: "#9a6a3c" },
  { id: "crimson", label: "Crimson", hex: "#8e2a2a" },
  { id: "teal", label: "Teal", hex: "#2f6f72" },
  { id: "cobalt", label: "Cobalt", hex: "#2f4d8f" },
  { id: "gold", label: "Gold", hex: "#c9a24a" },
];
export const ROBOT_OPTICS: readonly Swatch[] = [
  { id: "cyan", label: "Cyan", hex: "#41e6ff" },
  { id: "amber", label: "Amber", hex: "#ffb02e" },
  { id: "red", label: "Red", hex: "#ff3344" },
  { id: "green", label: "Green", hex: "#59ff7a" },
  { id: "violet", label: "Violet", hex: "#b46bff" },
  { id: "white", label: "White", hex: "#f2f6ff" },
];

/** the face each class starts with on each body (its own head on its authored body) */
export const DEFAULT_FACE: Readonly<Record<ClassId, Record<BodyType, string>>> = {
  TITAN: { male: "m-goliath", female: "f-shade", robot: "r-slit" },
  HUNTER: { female: "f-nyx", male: "m-veteran", robot: "r-twin" },
  WARLOCK: { male: "m-cipher", female: "f-nyx", robot: "r-mono" },
};
/** keep `face` when it belongs to `body`, else that class's default face for the body */
export const faceFor = (classId: ClassId, body: BodyType, face: unknown): string => {
  const d = DEFAULT_FACE[classId][body];
  return FACES[body].some((f) => f.id === face) ? (face as string) : faceOr(body, d);
};
export const faceDef = (body: BodyType, face: unknown): FaceDef => FACES[body].find((f) => f.id === face) ?? FACES[body][0]!;

const SWATCH_DEFAULT = { skin: "natural", plating: "steel", optics: "cyan" } as const;
const lists = { skin: SKIN_TONES, plating: ROBOT_PLATING, optics: ROBOT_OPTICS };
/** a valid swatch id for a list (old saves carry none) */
export const swatchOr = (kind: keyof typeof lists, id: unknown): string => (lists[kind].some((s) => s.id === id) ? (id as string) : SWATCH_DEFAULT[kind]);
/** the first colour field (`skin`) is a skin tone for humans and the plating for robots; `eyes` is a robot's optics */
export const toneKind = (body: BodyType): "skin" | "plating" => (body === "robot" ? "plating" : "skin");
export const swatchHex = (kind: keyof typeof lists, id: unknown): string => lists[kind].find((s) => s.id === swatchOr(kind, id))!.hex;

/** the headless rookie body for a class and body type */
const CLASS_FILE: Record<ClassId, string> = { TITAN: "goliath", HUNTER: "nyx", WARLOCK: "cipher" };
export const rookieBodyUrl = (classId: ClassId, body: BodyType): string => `/models/operators/bodies/${CLASS_FILE[classId]}-${body}.glb`;

/** what OperatorModel needs to draw a chosen look on a rookie body */
export type FaceLook = { headUrl: string; skinLum: number; skin: string; plating: string; optics: string };
export function faceLook(classId: ClassId, body: BodyType, choice: { face?: unknown; skin?: unknown; eyes?: unknown }): FaceLook {
  const f = faceDef(body, faceFor(classId, body, choice.face));
  const robot = body === "robot";
  return {
    headUrl: f.url, skinLum: f.skinLum ?? 0.2,
    skin: robot ? "" : swatchHex("skin", choice.skin),
    plating: robot ? swatchHex("plating", choice.skin) : "",
    optics: robot ? swatchHex("optics", choice.eyes) : "",
  };
}
