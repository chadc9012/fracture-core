import type { PlayerProgression } from "./progression";

/** The starter vehicle is a saved unlock: it is owned when one has been selected, never a per-session flag. */
export const hasVehicle = (p: Pick<PlayerProgression, "selectedVehicle">): boolean => Boolean(p.selectedVehicle);

/** Broken Signal starts once the player is free-roaming, owns a vehicle and has finished Awakening. */
export function brokenSignalReady(a: { phase: string; tutorialActive: boolean; progression: Pick<PlayerProgression, "selectedVehicle" | "completedMissions">; missionRunning: boolean }): boolean {
  return a.phase === "world" && !a.tutorialActive && hasVehicle(a.progression)
    && a.progression.completedMissions.includes("awakening") && !a.progression.completedMissions.includes("broken-signal") && !a.missionRunning;
}
