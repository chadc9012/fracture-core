/** Operator-facing data helpers: the ability-id migration (old class-keyed abilities -> NYX / GOLIATH /
 * CIPHER ability lists) and the Female / Male / Robot body types. Pure and dependency-free so saves,
 * cloud merges and tests can all use it. */
import type { ActiveBuild } from "./ability-network";

/** Old ability id -> the new ability that now occupies the SAME slot of the same class, so a save
 * made before the roster rewrite keeps its unlocks and equipped build. */
export const LEGACY_ABILITY_IDS: Readonly<Record<string, string>> = {
  "fracture-shield": "siege-mode",
  "ground-breaker": "kinetic-slam",
  "reality-bulwark": "bastion-shield",
  "phase-dash": "phase-veil",
  "mark-target": "rift-dash",
  "time-split": "shadow-strike",
  "code-pulse": "recon-swarm",
  "reality-field": "disruption-pulse",
  "system-override": "rift-turret",
};

export const migrateAbilityId = (id: string): string => LEGACY_ABILITY_IDS[id] ?? id;

export function migrateAbilityIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map(migrateAbilityId))];
}

export function migrateBuild(build: ActiveBuild): ActiveBuild {
  return { ...build, slots: { PRIMARY: migrateAbilityId(build.slots.PRIMARY), TACTICAL: migrateAbilityId(build.slots.TACTICAL), ULTIMATE: migrateAbilityId(build.slots.ULTIMATE) } };
}

/** Branch picks are keyed by ability id and named for the old ability, so only the key moves; the pick
 * is dropped (reset to default) since the new abilities have their own branch names. */
export function migrateBranches(branches: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, pick] of Object.entries(branches)) if (!(id in LEGACY_ABILITY_IDS)) out[id] = pick;
  return out;
}

export type BodyType = "female" | "male" | "robot";
export const BODY_TYPES: readonly BodyType[] = ["female", "male", "robot"];
export const DEFAULT_BODY_TYPE: BodyType = "male";
export const isBodyType = (v: unknown): v is BodyType => v === "female" || v === "male" || v === "robot";
/** Old saves and sessions have no body type. */
export const bodyTypeOr = (v: unknown): BodyType => (isBodyType(v) ? v : DEFAULT_BODY_TYPE);

export type BodyProfile = {
  label: string; blurb: string;
  /** whole-figure scale */
  height: number;
  /** shoulder / chest width multiplier */
  shoulders: number;
  /** waist and hip width multiplier */
  waist: number;
  /** limb thickness multiplier */
  limb: number;
  /** robots get a segmented glowing frame instead of a cloth undersuit */
  segmented: boolean;
};
export const BODY_PROFILES: Readonly<Record<BodyType, BodyProfile>> = {
  female: { label: "Female", blurb: "Lean, agile frame.", height: 0.96, shoulders: 0.92, waist: 0.86, limb: 0.9, segmented: false },
  male: { label: "Male", blurb: "Broad, heavy frame.", height: 1, shoulders: 1.06, waist: 1, limb: 1.05, segmented: false },
  robot: { label: "Robot", blurb: "Segmented glowing chassis.", height: 1.04, shoulders: 1.0, waist: 0.92, limb: 1.1, segmented: true },
};
export const bodyProfile = (t: unknown): BodyProfile => BODY_PROFILES[bodyTypeOr(t)];

/** The body each operator is introduced with (the rookie armor concept sheet: Goliath and Cipher male, Nyx female); the player can switch to any body type. */
export const OPERATOR_START_BODY: Readonly<Record<"goliath" | "nyx" | "cipher", BodyType>> = { goliath: "male", nyx: "female", cipher: "male" };

/** Faces: a selectable face per body type, saved with the character (PlayerCharacter.face). Data and selection only: the
 * operator meshes are helmeted/hooded, so a face shows once head models with a bare-face variant are authored. */
export type FaceDef = { id: string; label: string; blurb: string };
export const FACES: Readonly<Record<BodyType, readonly FaceDef[]>> = {
  female: [
    { id: "f-veteran", label: "Veteran", blurb: "Weathered, steady eyes." }, { id: "f-scout", label: "Scout", blurb: "Sharp and watchful." },
    { id: "f-ember", label: "Ember", blurb: "Scarred brow, quick grin." }, { id: "f-calm", label: "Calm", blurb: "Composed and open." },
  ],
  male: [
    { id: "m-veteran", label: "Veteran", blurb: "Square jaw, hard stare." }, { id: "m-scout", label: "Scout", blurb: "Lean and alert." },
    { id: "m-ember", label: "Ember", blurb: "Old scar, short beard." }, { id: "m-calm", label: "Calm", blurb: "Even, thoughtful." },
  ],
  robot: [
    { id: "r-mono", label: "Mono-lens", blurb: "Single wide optic." }, { id: "r-twin", label: "Twin-lens", blurb: "Paired sensors." },
    { id: "r-slit", label: "Slit visor", blurb: "Narrow scanning band." }, { id: "r-mask", label: "Mask plate", blurb: "Blank faceplate." },
  ],
};
export const isFaceFor = (body: BodyType, id: unknown): id is string => typeof id === "string" && FACES[body].some((f) => f.id === id);
/** the face to use for a body type: the given one when it belongs to that body, otherwise that body's first face */
export const faceOr = (body: BodyType, id: unknown): string => (isFaceFor(body, id) ? id : FACES[body][0]!.id);

/** Life size (October 2026 scale pass): an operator stands 1.85 m (×0.96–1.04 by body type), so 2.5 m doors, 3.4–3.6 m storeys
 * and 1.5 m car roofs read at their real proportions. The player's body centre (Scene `s.y`) stays 1.6 m above the ground. */
export const OPERATOR_HEIGHT = 1.85;
/** Camera offsets from the body centre: first-person eye (1.7 m above the ground), third-person rise/distance/shoulder, and a
 * tighter boom indoors so the view stays under 3.6 m ceilings and inside 10 m rooms. */
export const OPERATOR_CAMERA = { eye: 0.1, rise: 0.75, distance: 3.8, shoulder: 0.65, indoorRise: 0.3, indoorDistance: 2.1 } as const;
