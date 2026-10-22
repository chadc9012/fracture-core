/** Deterministic dungeon stage/life progression. The caller owns persistence,
 * network authority and grants rewards only via the existing simulation pipeline. */
import { DUNGEONS } from './dungeons.ts';
import type { DungeonLobby } from './dungeon-lobby.ts';
import { validateDungeonLaunch } from './dungeon-lobby.ts';

export type DungeonRun = Readonly<{
  lobbyId: string; dungeonId: string; memberIds: readonly string[];
  stageIndex: number; stageProgress: number; livesRemaining: number;
  completedStageIds: readonly string[]; status: 'ACTIVE' | 'WIPED' | 'CLEARED';
}>;
export type RunUpdate = Readonly<{ run: DungeonRun; error?: string; checkpoint?: string }>;

export function beginDungeonRun(lobby: DungeonLobby): DungeonRun | null {
  if (!validateDungeonLaunch(lobby)) return null;
  const dungeon = DUNGEONS.find(d => d.id === lobby.dungeonId);
  if (!dungeon || !dungeon.stages.length || !Number.isInteger(dungeon.maxLives) || dungeon.maxLives < 1) return null;
  return { lobbyId: lobby.id, dungeonId: dungeon.id, memberIds: lobby.members.map(m => m.id),
    stageIndex: 0, stageProgress: 0, livesRemaining: dungeon.maxLives,
    completedStageIds: [], status: 'ACTIVE' };
}

export function advanceDungeonObjective(run: DungeonRun, actorId: string, stageId: string, amount = 1): RunUpdate {
  if (run.status !== 'ACTIVE') return { run, error: 'Run is not active' };
  if (!run.memberIds.includes(actorId)) return { run, error: 'Actor is not in fireteam' };
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) return { run, error: 'Invalid progress amount' };
  const dungeon = DUNGEONS.find(d => d.id === run.dungeonId);
  const stage = dungeon?.stages[run.stageIndex];
  if (!stage || stage.id !== stageId || !Number.isInteger(stage.target) || stage.target < 1) return { run, error: 'Wrong stage' };
  const progress = Math.min(stage.target, run.stageProgress + amount);
  if (progress < stage.target) return { run: { ...run, stageProgress: progress } };
  const completedStageIds = [...run.completedStageIds, stage.id];
  const cleared = run.stageIndex + 1 === dungeon!.stages.length;
  return { run: { ...run, stageIndex: run.stageIndex + 1, stageProgress: 0, completedStageIds,
    status: cleared ? 'CLEARED' : 'ACTIVE' }, ...(stage.checkpoint ? { checkpoint: stage.id } : {}) };
}

export function recordDungeonDeath(run: DungeonRun, actorId: string): RunUpdate {
  if (run.status !== 'ACTIVE') return { run, error: 'Run is not active' };
  if (!run.memberIds.includes(actorId)) return { run, error: 'Actor is not in fireteam' };
  const livesRemaining = Math.max(0, run.livesRemaining - 1);
  return { run: { ...run, livesRemaining, status: livesRemaining === 0 ? 'WIPED' : 'ACTIVE' } };
}

/** Wipes restart the last completed checkpoint and never re-issue rewards. */
export function restartDungeonAtCheckpoint(run: DungeonRun): DungeonRun | null {
  if (run.status !== 'WIPED') return null;
  const dungeon = DUNGEONS.find(d => d.id === run.dungeonId);
  if (!dungeon) return null;
  let lastCheckpoint = -1; // findLastIndex is ES2023, past the build target
  dungeon.stages.forEach((s, i) => { if (s.checkpoint && run.completedStageIds.includes(s.id)) lastCheckpoint = i; });
  // Discard progress past the checkpoint: replayed stages must be earned again.
  // Keep only completed stages up to the last durable checkpoint.
  const completedStageIds = lastCheckpoint < 0 ? [] : dungeon.stages.slice(0, lastCheckpoint + 1)
    .filter(stage => run.completedStageIds.includes(stage.id)).map(stage => stage.id);
  return { ...run, stageIndex: lastCheckpoint + 1, stageProgress: 0, completedStageIds,
    livesRemaining: dungeon.maxLives, status: 'ACTIVE' };
}

/** Validate a persisted dungeon run before restoring it. Corrupt saves must never
 * skip objectives, refill lives, or claim a dungeon clear. */
export function validateDungeonRunSnapshot(value: unknown): value is DungeonRun {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const run = value as Partial<DungeonRun>;
  const dungeon = DUNGEONS.find(d => d.id === run.dungeonId);
  if (!dungeon || typeof run.lobbyId !== 'string' || !run.lobbyId.trim()) return false;
  if (!Array.isArray(run.memberIds) || run.memberIds.length < 1 || run.memberIds.length > 3 ||
      run.memberIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(run.memberIds).size !== run.memberIds.length) return false;
  if (!Number.isInteger(run.stageIndex) || run.stageIndex! < 0 || run.stageIndex! > dungeon.stages.length ||
      !Number.isInteger(run.stageProgress) || run.stageProgress! < 0 ||
      !Number.isInteger(run.livesRemaining) || run.livesRemaining! < 0 || run.livesRemaining! > dungeon.maxLives) return false;
  if (!Array.isArray(run.completedStageIds) || run.completedStageIds.length !== run.stageIndex ||
      run.completedStageIds.some((id, i) => id !== dungeon.stages[i]?.id)) return false;
  if (!['ACTIVE', 'WIPED', 'CLEARED'].includes(run.status ?? '')) return false;
  if (run.status === 'CLEARED') return run.stageIndex === dungeon.stages.length && run.stageProgress === 0;
  if (run.stageIndex === dungeon.stages.length) return false;
  if (run.stageProgress! >= (dungeon.stages[run.stageIndex!]?.target ?? 0)) return false;
  if (run.status === 'WIPED') return run.livesRemaining === 0;
  return run.livesRemaining! > 0;
}

/** Creates an independent copy, avoiding accidental mutation of save records. */
export function restoreDungeonRun(value: unknown): DungeonRun | null {
  if (!validateDungeonRunSnapshot(value)) return null;
  return { ...value, memberIds: [...value.memberIds], completedStageIds: [...value.completedStageIds] };
}
