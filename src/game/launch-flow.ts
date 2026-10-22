import type { PlayerProgression } from "./progression";

/** Every operator save has its own opening mission and Director unlock. */
export function launchDestination(p: Pick<PlayerProgression, "character" | "completedMissions" | "tutorialComplete">): "creation" | "mission" | "director" {
  if (!p.character) return "creation";
  return p.completedMissions.includes("mission-01") || p.tutorialComplete ? "director" : "mission";
}
