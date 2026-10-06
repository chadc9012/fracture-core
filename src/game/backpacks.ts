import type { ClassId } from "./loadout";

/**
 * Class backpacks — each Operator's pack modifies how stratagem call-ins behave for them, so the
 * three classes use the same codes differently (Helldivers backpack idea, kept to the existing
 * three Operators). Pure data + lookups: sim.ts reads `sim.backpack`, Scene sets it from the class,
 * Operator.tsx draws the matching pack on the character's back.
 */
export type BackpackId = "BASTION_PACK" | "SLIPSTREAM_PACK" | "RELAY_PACK";

export type BackpackDef = {
  id: BackpackId;
  classId: ClassId;
  name: string;
  tagline: string;
  /** multiplies every stratagem cooldown (lower is faster) */
  cooldownMult: number;
  /** multiplies orbital-strike damage dealt to the wearer (friendly fire) */
  friendlyFireMult: number;
  /** multiplies hull repaired by a Supply Drop */
  supplyHealMult: number;
  /** multiplies a Recon Pulse's radius */
  reconRadiusMult: number;
  /** Recon Pulse damage-taken multiplier on marked machines */
  reconVuln: number;
};

const NEUTRAL = { cooldownMult: 1, friendlyFireMult: 1, supplyHealMult: 1, reconRadiusMult: 1, reconVuln: 1.3 };

export const BACKPACKS: readonly BackpackDef[] = [
  { id: "BASTION_PACK", classId: "TITAN", name: "Bastion Pack", tagline: "Plated armor reservoir: orbital friendly fire does 70% less, Supply Drops repair 50% more.", ...NEUTRAL, friendlyFireMult: 0.3, supplyHealMult: 1.5 },
  { id: "SLIPSTREAM_PACK", classId: "HUNTER", name: "Slipstream Pack", tagline: "Capacitor fins recharge call-ins 30% faster.", ...NEUTRAL, cooldownMult: 0.7 },
  { id: "RELAY_PACK", classId: "WARLOCK", name: "Relay Pack", tagline: "Signal array: Recon Pulses reach 40% farther and mark enemies for bigger damage.", ...NEUTRAL, reconRadiusMult: 1.4, reconVuln: 1.45 },
] as const;

/** What a player with no pack gets — every multiplier at 1. */
export const NO_BACKPACK: BackpackDef = { id: "BASTION_PACK", classId: "TITAN", name: "No pack", tagline: "", ...NEUTRAL };

export function backpackFor(classId: ClassId): BackpackDef {
  return BACKPACKS.find((pack) => pack.classId === classId) ?? NO_BACKPACK;
}
