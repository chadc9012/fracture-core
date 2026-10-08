import { classBuild } from "../live-build";
import type { PlayerProgression } from "../progression";
import type { PlayerCharacter } from "./deployCharacter";

/** Pure: the progression that results from confirming this character. Idempotent per deploymentId. */
export function applyCharacter(current: PlayerProgression, character: PlayerCharacter): PlayerProgression {
  if (current.character?.deploymentId === character.deploymentId) return current;
  return { ...current, character, identityClass: character.classId, activeBuild: classBuild(character.classId) };
}

