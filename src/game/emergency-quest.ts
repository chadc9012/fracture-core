/**
 * Emergency Quest world events (Shangri-La Frontier-inspired "EQ" raids): a rare, countdown-
 * warned world-boss spawn that pulls in whoever's nearby. Deterministic countdown state machine
 * so sim.ts can step it every frame like everything else in the pipeline; sim.ts itself calls
 * summonBoss() the instant this flips to ACTIVE and completeEmergencyQuest() the instant that
 * tagged boss dies (see Machine.eq in sim.ts), so this module stays data-only and testable.
 */

import { encounterFor, ENCOUNTERS } from "./encounters";

export type EmergencyQuestState = "DORMANT" | "WARNING" | "ACTIVE" | "COMPLETE" | "FAILED";

export type EmergencyQuest = {
  state: EmergencyQuestState;
  regionId: string;
  bossName: string;
  x: number;
  z: number;
  /** seconds remaining in the current state */
  timer: number;
};

const EQ_REGIONS = ENCOUNTERS.filter((e) => e.boss).map((e) => e.regionId);

const MIN_INTERVAL = 5 * 60;
const MAX_INTERVAL = 9 * 60;
const WARNING_SECONDS = 40;
const ACTIVE_LIMIT_SECONDS = 210;
const RESULT_DISPLAY_SECONDS = 10;

function randomInterval(): number {
  return MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
}

export const EMERGENCY_QUEST_INIT: EmergencyQuest = { state: "DORMANT", regionId: "", bossName: "", x: 0, z: 0, timer: randomInterval() };

/** Advances the Emergency Quest clock by dt seconds. `regionPoint` resolves a regionId to a
 * live world-space spawn point — sim.ts already knows world.ts's REGIONS, this module stays
 * data-only so it doesn't need to import the full region list itself. */
export function stepEmergencyQuest(eq: EmergencyQuest, dt: number, regionPoint: (regionId: string) => { x: number; z: number } | null): EmergencyQuest {
  const timer = eq.timer - dt;
  switch (eq.state) {
    case "DORMANT": {
      if (timer > 0) return { ...eq, timer };
      const regionId = EQ_REGIONS[Math.floor(Math.random() * EQ_REGIONS.length)];
      const boss = regionId ? encounterFor(regionId)?.boss : undefined;
      const point = regionId ? regionPoint(regionId) : null;
      if (!regionId || !boss || !point) return { ...eq, timer: randomInterval() };
      return { state: "WARNING", regionId, bossName: boss.name, x: point.x, z: point.z, timer: WARNING_SECONDS };
    }
    case "WARNING":
      return timer > 0 ? { ...eq, timer } : { ...eq, state: "ACTIVE", timer: ACTIVE_LIMIT_SECONDS };
    case "ACTIVE":
      return timer > 0 ? { ...eq, timer } : { ...eq, state: "FAILED", timer: RESULT_DISPLAY_SECONDS };
    case "COMPLETE":
    case "FAILED":
      return timer > 0 ? { ...eq, timer } : { ...EMERGENCY_QUEST_INIT, timer: randomInterval() };
  }
}

/** Called by sim.ts's defeatMachine() the instant the tagged Emergency Quest boss dies. */
export function completeEmergencyQuest(eq: EmergencyQuest): EmergencyQuest {
  return eq.state === "ACTIVE" ? { ...eq, state: "COMPLETE", timer: RESULT_DISPLAY_SECONDS } : eq;
}
