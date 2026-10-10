import type { ClassId } from "./loadout";

export type TutorialStep = "MATERIALIZE" | "MOVEMENT" | "ABILITY" | "CONTACT" | "REINFORCE" | "CHAMBER" | "POWER" | "SENTINEL" | "VICTORY";
export type TutorialEvent = "READY" | "GATE" | "JUMP" | "ABILITY" | "KILL" | "MASTERY" | "CHAMBER" | "CHAIN" | "BOSS";
export type TutorialState = { step: TutorialStep; gates: number; jumped: boolean; kills: number; chained: number; abilities: number; bossHits: number };
export const FIRST_TUTORIAL: TutorialState = { step: "MATERIALIZE", gates: 0, jumped: false, kills: 0, chained: 0, abilities: 0, bossHits: 0 };

export function tutorialText(step: TutorialStep, classId: ClassId) {
  const action = classId === "TITAN" ? "Activate Siege Mode with Q" : classId === "HUNTER" ? "Phase Veil with Q" : "Deploy Recon Swarm with Q";
  return {
    MATERIALIZE: ["01 · MATERIALIZATION", "Your armor is taking shape. Identity locked. Adaptive systems calibrating."],
    MOVEMENT: ["02 · MOVEMENT TRIAL", "Move through the three signal gates (WASD), then jump (C)."],
    ABILITY: ["03 · FIRST ABILITY", action],
    CONTACT: ["04 · FIRST CONTACT", "Clear two training drones. Aim and fire with Space."],
    REINFORCE: ["05 · ADAPTIVE LEARNING", `Repeat your ${classId === "TITAN" ? "shield timing" : classId === "HUNTER" ? "dash" : "system pulse"} to secure a mastery signal.`],
    CHAMBER: ["06 · IDENTITY CHAMBER", classId === "TITAN" ? "Hold the breach: block, then break the wave with E." : classId === "HUNTER" ? "Cross the lane with Q and mark the target with E." : "Disrupt the defense with Q, then rewrite the node with E."],
    POWER: ["07 · POWER MOMENT", "Chain two different abilities (Q / E / R) to overload the target."],
    SENTINEL: ["08 · ADAPTIVE SENTINEL", "Break the Sentinel. Watch its telegraphed counter; use your class ability to expose it."],
    VICTORY: ["IDENTITY STABILIZED", "First victory secured. Ability pathways and Nexus operations are now available."],
  }[step];
}

export function advanceTutorial(state: TutorialState, event: TutorialEvent): TutorialState {
  if (state.step === "MATERIALIZE" && event === "READY") return { ...state, step: "MOVEMENT" };
  if (state.step === "MOVEMENT") {
    if (event === "GATE") return { ...state, gates: Math.min(3, state.gates + 1), step: state.gates >= 2 && state.jumped ? "ABILITY" : "MOVEMENT" };
    if (event === "JUMP") return { ...state, jumped: true, step: state.gates >= 3 ? "ABILITY" : "MOVEMENT" };
  }
  if (state.step === "ABILITY" && event === "ABILITY") return { ...state, step: "CONTACT", abilities: 1 };
  if (state.step === "CONTACT" && event === "KILL") return { ...state, kills: state.kills + 1, step: state.kills >= 1 ? "REINFORCE" : "CONTACT" };
  if (state.step === "REINFORCE" && event === "MASTERY") return { ...state, step: "CHAMBER", abilities: state.abilities + 1 };
  if (state.step === "CHAMBER" && event === "CHAMBER") return { ...state, step: "POWER" };
  if (state.step === "POWER" && event === "CHAIN") return { ...state, chained: state.chained + 1, step: state.chained >= 1 ? "SENTINEL" : "POWER" };
  if (state.step === "SENTINEL" && event === "BOSS") return { ...state, step: "VICTORY" };
  return state;
}

export const TUTORIAL_ORDER: readonly TutorialStep[] = ["MATERIALIZE", "MOVEMENT", "ABILITY", "CONTACT", "REINFORCE", "CHAMBER", "POWER", "SENTINEL", "VICTORY"];

/** Validates a saved tutorial checkpoint. VICTORY is never a checkpoint (it completes the tutorial); junk becomes null. */
export function sanitizeTutorial(raw: unknown): TutorialState | null {
  const r = raw as Partial<TutorialState> | null | undefined;
  if (!r || typeof r !== "object" || !TUTORIAL_ORDER.includes(r.step as TutorialStep) || r.step === "VICTORY") return null;
  const n = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
  return { step: r.step as TutorialStep, gates: n(r.gates, 3), jumped: r.jumped === true, kills: n(r.kills, 2), chained: n(r.chained, 2), abilities: n(r.abilities, 2), bossHits: n(r.bossHits, 99) };
}

/** The checkpoint that is further along (progress is only gained, so merging two saves keeps the better one). */
export function furtherTutorial(a: TutorialState | null, b: TutorialState | null): TutorialState | null {
  if (!a || !b) return a ?? b;
  return TUTORIAL_ORDER.indexOf(b.step) > TUTORIAL_ORDER.indexOf(a.step) ? b : a;
}
