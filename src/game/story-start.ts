/** Where a new character's story starts (owner, Nov 1: the Nexus City Residences opening as the start of the story). A new
 * character wakes in Apartment 1204 instead of the forest: the residences' own first morning and reality-fracture evacuation
 * (residence-life.ts, ResidencePanels) play out, and getting out of the building hands over to the opening cinematic ("The
 * night the world changed") and the Verdant Forest field calibration. GameCanvas holds the tutorial and Awakening back until
 * then. Pure; the only state is in earnedRewards (the evacuation's `evac:done`, or `opening:skipped`), which every save merge
 * keeps, so a reload part-way puts you back in the apartment. */
import type { PlayerProgression } from "./progression";
import { EVAC_DONE } from "./residence-life";

export const OPENING_SKIPPED = "opening:skipped";
export const OPENING_FLOOR = "nexus-res-1204";
/** beside the bed in 12-04 (local metres; story-start.test.ts checks it is reachable on foot) */
export const WAKE_AT = { x: -5.4, z: -1.4 } as const;

type Save = Pick<PlayerProgression, "earnedRewards" | "tutorialComplete" | "tutorialRun" | "completedMissions">;
/** the opening is over: you got out of the building, or skipped it */
export const openingOver = (p: Pick<PlayerProgression, "earnedRewards">) => p.earnedRewards.includes(EVAC_DONE) || p.earnedRewards.includes(OPENING_SKIPPED);
/** a character that starts in the residences: the opening is not over and nothing past the first calibration step was played
 * (saves already into the field calibration or any mission are never sent back to the apartment) */
export function startsInResidences(p: Save): boolean {
  if (openingOver(p) || p.tutorialComplete || p.completedMissions.length > 0) return false;
  return !p.tutorialRun || p.tutorialRun.step === "MATERIALIZE";
}
export const skipOpening = <P extends Pick<PlayerProgression, "earnedRewards">>(p: P): P => (openingOver(p) ? p : { ...p, earnedRewards: [...p.earnedRewards, OPENING_SKIPPED] });
