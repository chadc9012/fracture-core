import type { AppearanceDefinition, ClassId, OperatorId, SubclassId } from "../loadout";
import type { BodyType } from "../operators";
import { isBodyType, isFaceFor } from "../operators";

/** Everything the Identity Forge decides, in one saveable shape. */
export type PlayerCharacter = {
  /** unique per deploy attempt; saving the same id twice is a no-op (idempotency key) */
  deploymentId: string;
  operatorId: OperatorId;
  classId: ClassId;
  subclassId: SubclassId;
  bodyType: BodyType;
  /** chosen face (operators.ts FACES); absent on older saves */
  face?: string;
  /** skin tone (humans) or plating colour (robots): operator-faces.ts swatch id; absent on older saves */
  skin?: string;
  /** a robot's optics colour (operator-faces.ts ROBOT_OPTICS id) */
  eyes?: string;
  displayName: string;
  appearance: Pick<AppearanceDefinition, "armor" | "cloth" | "visor" | "trim" | "callsign">;
  loadout: { weaponOrder: readonly string[] };
};

export type DeploymentServices = {
  /** must resolve only once the character is durably saved; throw to abort */
  saveCharacter: (character: PlayerCharacter) => Promise<void>;
  launchMission: (missionId: string) => Promise<void>;
};

export const FIRST_MISSION_ID = "mission-01";

export function validateCharacter(character: PlayerCharacter): string | null {
  if (!character.displayName.trim()) return "Enter a callsign before deployment.";
  if (!character.operatorId || !character.classId) return "Complete your operator selection first.";
  if (!isBodyType(character.bodyType)) return "Choose a body type first.";
  if (character.face !== undefined && !isFaceFor(character.bodyType, character.face)) return "Choose a face that matches your body type.";
  return null;
}

/** Validate -> save -> launch. A failed save never launches the mission. */
export async function deployCharacter(character: PlayerCharacter, services: DeploymentServices): Promise<void> {
  const problem = validateCharacter(character);
  if (problem) throw new Error(problem);
  await services.saveCharacter(character);
  await services.launchMission(FIRST_MISSION_ID);
}

/** Single-flight guard: while a deployment is running, further calls are ignored (return null), so
 * double-clicks or Enter-key repeats can't start the mission twice. Reusable after a failure. */
export function createDeployGuard() {
  let busy = false;
  return {
    get busy() { return busy; },
    async run<T>(fn: () => Promise<T>): Promise<T | null> {
      if (busy) return null;
      busy = true;
      try { return await fn(); } finally { busy = false; }
    },
  };
}

let counter = 0;
export const newDeploymentId = () => `dep-${Date.now().toString(36)}-${(counter++).toString(36)}`;
