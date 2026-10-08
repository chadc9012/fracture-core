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
