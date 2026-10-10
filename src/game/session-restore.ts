/** Pure rules that turn a saved profile into the live operator session, and that keep Continue, cloud
 * merges and re-deploys from replaying first-time onboarding. GameCanvas owns the React state; every
 * decision lives here so it can be tested without rendering. */
import { classById, subclassById, type AppearanceDefinition, type ClassId, type SubclassId } from "./loadout";
import { forgeInitial } from "./deployment/forgeState";
import type { BodyType } from "./operators";
import { FIRST_TUTORIAL, type TutorialState } from "./onboarding";
import { MISSION_IDS, restoreMission, type MissionId } from "./missions/persistence";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "./progression";

export type OperatorSession = { cls: ClassId; subclass: SubclassId; appearance: AppearanceDefinition; bodyType: BodyType };

/** The single derivation of "who am I playing" from a save: the confirmed character wins, else the class the save
 * identifies with, else the Goliath default. Never throws; partial or corrupt data falls back per field. */
export function sessionFromProgression(p: Pick<PlayerProgression, "character" | "identityClass">): OperatorSession {
  const f = forgeInitial(p.character ?? (p.identityClass ? { classId: p.identityClass } : null));
  return { cls: f.classId, subclass: f.subclassId, appearance: f.appearance, bodyType: f.bodyType };
}

export const sameSession = (a: OperatorSession, b: OperatorSession) =>
  a.cls === b.cls && a.subclass === b.subclass && a.bodyType === b.bodyType
  && a.appearance.armor === b.appearance.armor && a.appearance.cloth === b.appearance.cloth
  && a.appearance.visor === b.appearance.visor && a.appearance.trim === b.appearance.trim && a.appearance.callsign === b.appearance.callsign;

/** HUD fields that identify the operator (the HUD must show the same character the world renders). */
export function hudIdentity(s: OperatorSession) {
  return {
    playerClass: s.cls,
    subclassName: subclassById(s.subclass).name,
    callsign: s.appearance.callsign,
    abilities: classById(s.cls).abilities.map((a) => ({ slot: a.slot, name: a.name, ready: true })),
  };
}

/** The cinematic plays once per save, only for a player who has not finished onboarding. */
export const shouldPlayIntro = (p: Pick<PlayerProgression, "introSeen" | "tutorialComplete" | "completedMissions">) =>
  !p.introSeen && !p.tutorialComplete && p.completedMissions.length === 0;

export const withIntroSeen = <T extends { introSeen: boolean }>(p: T): T => (p.introSeen ? p : { ...p, introSeen: true });

/** Tutorial to run when entering the world: none once complete, otherwise the saved checkpoint (never restarted from step one). */
export function tutorialForEntry(p: Pick<PlayerProgression, "tutorialComplete" | "tutorialRun">): TutorialState | null {
  if (p.tutorialComplete) return null;
  return p.tutorialRun ?? FIRST_TUTORIAL;
}

/** Saves the tutorial checkpoint. Returns `p` itself when unchanged; VICTORY and completion clear it. */
export function withTutorialRun(p: PlayerProgression, tutorial: TutorialState | null): PlayerProgression {
  const next = p.tutorialComplete || !tutorial || tutorial.step === "VICTORY" ? null : tutorial;
  return JSON.stringify(next) === JSON.stringify(p.tutorialRun) ? p : { ...p, tutorialRun: next };
}

/** The first-mission HUD entry, only while Mission 01 is still open for this save (never re-added for a finished one). */
export function firstMissionHud(p: Pick<PlayerProgression, "completedMissions">) {
  if (p.completedMissions.includes("mission-01")) return [];
  return [{
    id: "mission-01", name: "Mission 01 — First Resonance", kind: "FIRST_RESONANCE" as const, regionId: "veridan", intensity: "LOW" as const, state: "ACTIVE" as const,
    objectives: [
      { type: "SURVIVE" as const, label: "Stabilize after insertion (s)", amount: 20, progress: 0, done: false },
      { type: "KILL" as const, label: "Clear the forest patrol", amount: 2, progress: 0, done: false },
    ],
    reward: 500, age: 0, stage: 0,
  }];
}

export type MissionRuns = Partial<Record<MissionId, { id: string } | null>>;

/** After a cloud merge: a machine that is already running locally keeps its live run (never reset newer local progress);
 * an idle machine adopts the merged save's resumable run. Completed missions never reopen (restoreMission refuses them). */
export function reconcileRuns(live: MissionRuns, merged: PlayerProgression): Record<MissionId, { id: string } | null> {
  const out = {} as Record<MissionId, { id: string } | null>;
  for (const id of MISSION_IDS) out[id] = live[id] && !merged.completedMissions.includes(id) ? live[id]! : restoreMission<{ id: string }>(id, merged);
  return out;
}

/** After a cloud merge the live tutorial is kept unless the merged save proves it finished elsewhere (VICTORY screen is never torn down). */
export function reconcileTutorial(live: TutorialState | null, merged: Pick<PlayerProgression, "tutorialComplete">): TutorialState | null {
  if (live && merged.tutorialComplete && live.step !== "VICTORY") return null;
  return live;
}

/** New Game: a genuinely fresh profile (fresh object, nothing carried over). */
export const freshProgression = (): PlayerProgression => structuredClone(DEFAULT_PROGRESSION);

/** Which New Game path applies: a save is never erased — it is parked in a free slot, and with no free slot New Game is refused. */
export function newGamePlan(hasSave: boolean, freeSlot: number | null): "fresh" | "park" | "blocked" {
  if (!hasSave) return "fresh";
  return freeSlot ? "park" : "blocked";
}
