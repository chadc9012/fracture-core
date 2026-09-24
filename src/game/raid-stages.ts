export type EncounterStageType = "SYNC_TRAVERSAL" | "BOSS_FIGHT";
export type EncounterStatus = "READY" | "ACTIVE" | "COMPLETE" | "WIPED";

export type EncounterStage = {
  id: string;
  name: string;
  type: EncounterStageType;
  objective: string;
  target: number;
  checkpoint: boolean;
  hazardLabel?: string;
};

export type EncounterDefinition = {
  id: string;
  name: string;
  activity: "DUNGEON" | "RAID";
  privateInstance: boolean;
  squad: { min: number; max: number };
  duration: string;
  maxLives: number;
  stages: readonly EncounterStage[];
};

export type EncounterRun = {
  status: EncounterStatus;
  stageIndex: number;
  progress: number;
  lives: number;
  hazard: number;
  message: string;
};

export function createEncounterRun(definition: EncounterDefinition): EncounterRun {
  return { status: "READY", stageIndex: 0, progress: 0, lives: definition.maxLives, hazard: 0, message: "Fireteam synchronized." };
}

export function advanceEncounter(definition: EncounterDefinition, run: EncounterRun): EncounterRun {
  if (run.status === "COMPLETE" || run.status === "WIPED") return run;
  const stage = definition.stages[run.stageIndex];
  if (!stage) return { ...run, status: "COMPLETE", message: "Encounter complete." };
  const nextProgress = Math.min(stage.target, run.progress + 1);
  const hazardGain = stage.type === "SYNC_TRAVERSAL" ? 13 : 8;
  const nextHazard = Math.min(100, run.hazard + hazardGain);
  if (nextProgress < stage.target) {
    return { ...run, status: "ACTIVE", progress: nextProgress, hazard: nextHazard, message: `${stage.objective} · ${nextProgress}/${stage.target}` };
  }
  const nextStage = run.stageIndex + 1;
  if (nextStage >= definition.stages.length) {
    return { ...run, status: "COMPLETE", progress: nextProgress, hazard: nextHazard, message: "Final threat neutralized. Signature cache secured." };
  }
  return { ...run, status: "ACTIVE", stageIndex: nextStage, progress: 0, hazard: Math.max(0, nextHazard - 35), message: `Checkpoint secured · ${definition.stages[nextStage]?.name ?? "Next stage"}` };
}

export function loseEncounterLife(definition: EncounterDefinition, run: EncounterRun): EncounterRun {
  if (run.status === "COMPLETE" || run.status === "WIPED") return run;
  const lives = Math.max(0, run.lives - 1);
  return { ...run, lives, status: lives === 0 ? "WIPED" : "ACTIVE", message: lives === 0 ? "Shared lives depleted. Fireteam lost." : `Resonant recovered · ${lives} shared lives remain.` };
}