/** Where a new character's story starts (owner, Nov 1: the Nexus City Residences opening is the start of the story, and
 * combat is taught during the escape, not in a separate calibration). A new character wakes in Apartment 1204 as an ordinary
 * civilian: the residences' own first morning and reality-fracture evacuation (residence-life.ts, ResidencePanels) play out;
 * getting out of the doors plays the opening cinematic and then the Breach (breach.ts), the street fight where the Operator's
 * powers wake. Finishing it records Mission 01 and the onboarding as done, so the Verdant Forest field calibration is no
 * longer mandatory (it stays for saves already part-way through it). Pure; the only state is in earnedRewards (`evac:done`,
 * `opening:breach`, or `opening:skipped`), which every save merge keeps, so a reload part-way resumes the right phase. */
import type { PlayerProgression } from "./progression";
import { EVAC_DONE } from "./residence-life";
import { BREACH_DONE } from "./breach";
import { exitPosition, interiorById } from "./interiors";

export const OPENING_SKIPPED = "opening:skipped";
export const OPENING_FLOOR = "nexus-res-1204";
/** beside the bed in 12-04 (local metres; story-start.test.ts checks it is reachable on foot) */
export const WAKE_AT = { x: -5.4, z: -1.4 } as const;

type Save = Pick<PlayerProgression, "earnedRewards" | "tutorialComplete" | "tutorialRun" | "completedMissions">;
/** the whole opening is over: the Breach was won, or the prologue was skipped */
export const openingOver = (p: Pick<PlayerProgression, "earnedRewards">) => p.earnedRewards.includes(BREACH_DONE) || p.earnedRewards.includes(OPENING_SKIPPED);
/** a save still in the opening: nothing past the first calibration step was played and no mission is done (saves already
 * into the field calibration or any mission are never sent back) */
const inOpening = (p: Save) => !openingOver(p) && !p.tutorialComplete && p.completedMissions.length === 0 && (!p.tutorialRun || p.tutorialRun.step === "MATERIALIZE");
/** which part of the opening a save is in: the residences (wake up, morning, evacuation), the Breach (out on the street), or none */
export function openingPhase(p: Save): "residences" | "breach" | null {
  if (!inOpening(p)) return null;
  return p.earnedRewards.includes(EVAC_DONE) ? "breach" : "residences";
}
export const startsInResidences = (p: Save): boolean => openingPhase(p) === "residences";
export const skipOpening = <P extends Pick<PlayerProgression, "earnedRewards">>(p: P): P => (openingOver(p) ? p : { ...p, earnedRewards: [...p.earnedRewards, OPENING_SKIPPED] });

/** out on the street in front of the Residences' doors: exactly where walking out of the lobby puts you (interiors.ts
 * exitPosition), so it is clear of the door and of the tower (play-test: a point 6 m out along the hub radius was inside the
 * tower's footprint and the collision pushed you straight back through the door into the lobby) */
export function streetOutside(): { x: number; z: number; yaw: number } {
  const lobby = interiorById("nexus-apartment")!, at = exitPosition(lobby.doorPos, lobby.doorPos);
  return { x: at.x, z: at.z, yaw: 0 };
}
/** the opening is finished (the Breach won, or skipped): it counts as Mission 01 and the onboarding, so the forest
 * calibration never starts. `reward` is the mission payout (progression's rewardMission) applied once. */
export function finishOpening<P extends Save>(p: P, reward: (p: P) => P, how: "breach" | "skipped"): P {
  const tag = how === "breach" ? BREACH_DONE : OPENING_SKIPPED;
  const tagged = p.earnedRewards.includes(tag) ? p : { ...p, earnedRewards: [...p.earnedRewards, tag] };
  const paid = p.completedMissions.includes("mission-01") ? tagged : reward(tagged);
  return { ...paid, tutorialComplete: true, tutorialRun: null };
}
