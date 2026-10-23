/** Which clip an authored operator holds while standing still (OperatorModel.tsx).
 * The owner's Meshy combat-stance clips (NYX, GOLIATH) are merged into the authored GLBs as "combat"; GOLIATH also has a
 * chest-pound "taunt" used as the Character-screen showcase alternate. In the world the operator drops into the combat
 * stance while aiming and for COMBAT_STANCE_HOLD seconds after the last shot, otherwise the relaxed idle. Pure, tested. */
export const COMBAT_STANCE_HOLD = 5;

export function combatStance(aiming: boolean, now: number, combatUntil: number): boolean {
  return aiming || now < combatUntil;
}

/** the standing clip to play given which clips the model has: combat stance in combat (or when there is no idle), else idle */
export function standingClip(has: (name: string) => boolean, combat: boolean): "combat" | "idle" | null {
  if (combat && has("combat")) return "combat";
  if (has("idle")) return "idle";
  if (has("combat")) return "combat";
  return null;
}
