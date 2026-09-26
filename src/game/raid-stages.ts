export type EncounterStageType = "SYNC_TRAVERSAL" | "COMBAT" | "PUZZLE_COMBAT" | "TRAVERSAL_COMBAT" | "BOSS_FIGHT";
export type EncounterStatus = "READY" | "ACTIVE" | "COMPLETE" | "WIPED";

export type EncounterStage = {
  id: string;
  name: string;
  type: EncounterStageType;
  objective: string;
  target: number;
  checkpoint: boolean;
  hazardLabel?: string;
  room?: string;
  enemies?: readonly string[];
  triggers?: readonly string[];
  routes?: readonly { id: string; name: string; tradeoff: string }[];
  bossPhases?: readonly { name: string; threshold: number; mechanic: string; counter: string }[];
  reward?: string;
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
  selectedRoute?: string;
  bossPhase: number;
  livesUsed: number;
  stagePerformance: { name: string; objectives: number; hazard: number }[];
  damage: number;
  support: number;
};

export function createEncounterRun(definition: EncounterDefinition): EncounterRun {
  return { status: "READY", stageIndex: 0, progress: 0, lives: definition.maxLives, hazard: 0, message: "Fireteam synchronized.", bossPhase: 0, livesUsed: 0, stagePerformance: [], damage: 0, support: 0 };
}

export function advanceEncounter(definition: EncounterDefinition, run: EncounterRun): EncounterRun {
  if (run.status === "COMPLETE" || run.status === "WIPED") return run;
  const stage = definition.stages[run.stageIndex];
  if (!stage) return { ...run, status: "COMPLETE", message: "Encounter complete." };
  const nextProgress = Math.min(stage.target, run.progress + 1);
  const hazardGain: Record<EncounterStageType, number> = { SYNC_TRAVERSAL: 11, COMBAT: 8, PUZZLE_COMBAT: 14, TRAVERSAL_COMBAT: 12, BOSS_FIGHT: 9 };
  const nextHazard = Math.min(100, run.hazard + hazardGain[stage.type]);
  const contributions = { damage: run.damage + (stage.type === "BOSS_FIGHT" || stage.type === "COMBAT" ? 140 : 45), support: run.support + (stage.type === "PUZZLE_COMBAT" || stage.type === "SYNC_TRAVERSAL" ? 85 : 25) };
  if (nextHazard >= 100) return { ...run, hazard: 100, status: "WIPED", message: "Sand entombment reached critical pressure. Fireteam lost." };
  if (nextProgress < stage.target) {
    const bossPhase = stage.bossPhases ? Math.min(stage.bossPhases.length - 1, Math.floor((nextProgress / stage.target) * stage.bossPhases.length)) : 0;
    const phase = stage.bossPhases?.[bossPhase];
    return { ...run, ...contributions, status: "ACTIVE", progress: nextProgress, hazard: nextHazard, bossPhase, message: phase ? `${phase.name} · ${phase.mechanic}` : `${stage.objective} · ${nextProgress}/${stage.target}` };
  }
  const nextStage = run.stageIndex + 1;
  const stagePerformance = [...run.stagePerformance, { name: stage.name, objectives: stage.target, hazard: nextHazard }];
  if (nextStage >= definition.stages.length) {
    return { ...run, ...contributions, stagePerformance, status: "COMPLETE", progress: nextProgress, hazard: nextHazard, message: "Final threat neutralized. Signature cache secured." };
  }
  return { ...run, ...contributions, stagePerformance, status: "ACTIVE", stageIndex: nextStage, progress: 0, bossPhase: 0, selectedRoute: undefined, hazard: Math.max(0, nextHazard - (stage.checkpoint ? 35 : 18)), message: `Checkpoint secured · ${definition.stages[nextStage]?.name ?? "Next stage"}` };
}

export function chooseEncounterRoute(run: EncounterRun, routeId: string): EncounterRun {
  return { ...run, selectedRoute: routeId, hazard: Math.max(0, run.hazard - 6), message: `Route locked: ${routeId.replaceAll("-", " ")}. Fireteam path synchronized.` };
}

export function loseEncounterLife(definition: EncounterDefinition, run: EncounterRun): EncounterRun {
  if (run.status === "COMPLETE" || run.status === "WIPED") return run;
  const lives = Math.max(0, run.lives - 1);
  return { ...run, lives, livesUsed: run.livesUsed + 1, status: lives === 0 ? "WIPED" : "ACTIVE", message: lives === 0 ? "Shared lives depleted. Fireteam lost." : `Resonant recovered · ${lives} shared lives remain.` };
}