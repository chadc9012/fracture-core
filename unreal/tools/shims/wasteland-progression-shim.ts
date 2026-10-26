/**
 * The payout stand-in for wasteland-activities.ts in the wasteland golden (gen-wasteland-golden.ts): rewardMission is already
 * golden-tested on its own (MissionRewardCoreTest), so here it only leaves a trace the C++ test's stub repeats exactly
 * (Tests/WastelandCoreTest.cpp WlReward): the claim rm:<id>:<now> and the materials added.
 */
import type { PlayerProgression } from "../../../src/game/progression";
export type { PlayerProgression } from "../../../src/game/progression";
export function rewardMission(p: PlayerProgression, missionId: string, materials: Partial<Record<string, number>>, now = 0): PlayerProgression {
  const m: Record<string, number> = { ...(p.materials as Record<string, number>) };
  for (const [k, v] of Object.entries(materials)) m[k] = (m[k] ?? 0) + (v ?? 0);
  return { ...p, materials: m as PlayerProgression["materials"], earnedRewards: [...p.earnedRewards, `rm:${missionId}:${now}`] };
}
