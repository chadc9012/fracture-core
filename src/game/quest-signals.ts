/** Turns the live HUD snapshot into quest-engine events. Pure, so the exact events the game emits
 * can be replayed in tests. This is the single bridge between gameplay and `gameTick`. */
import type { QuestEvent } from "./quests";
import type { LockdownTier } from "./stealth";

export type QuestHud = { regionId: string; heatLevel: number; nexusLockdownTier: LockdownTier; hackProgress: number; diving: boolean; kills: number; hp: number };
export type QuestSignals = { region: string; heatLevel: number; lockdownTier: LockdownTier; hackDone: boolean; /** null until the first snapshot sets the baseline */ kills: number | null };
export const NEW_QUEST_SIGNALS: QuestSignals = { region: "", heatLevel: 1, lockdownTier: "MONITORING", hackDone: false, kills: null };

/** Longest slice of play one snapshot may account for, so a stalled tab or a long pause never banks survive time. */
export const MAX_SURVIVE_DT = 0.5;
const MAX_KILLS_PER_SNAPSHOT = 20;

/** `dt` is the real time (s) since the previous snapshot. */
export function questEventsFromHud(prev: QuestSignals, hud: QuestHud, dt: number): { events: QuestEvent[]; next: QuestSignals } {
  const events: QuestEvent[] = [];
  const next: QuestSignals = { ...prev };
  const slice = Math.max(0, Math.min(MAX_SURVIVE_DT, Number.isFinite(dt) ? dt : 0));

  if (hud.regionId && hud.regionId !== prev.region) { next.region = hud.regionId; events.push({ type: "ENTER_WORLD", world: hud.regionId }); }
  if (hud.heatLevel > prev.heatLevel) { next.heatLevel = hud.heatLevel; events.push({ type: "HEAT_LEVEL", level: hud.heatLevel }); }
  if (hud.nexusLockdownTier !== prev.lockdownTier) { next.lockdownTier = hud.nexusLockdownTier; events.push({ type: "LOCKDOWN_TIER", tier: hud.nexusLockdownTier }); }
  if (hud.hackProgress >= 100 && !prev.hackDone) { next.hackDone = true; events.push({ type: "HACK_COMPLETE" }); }
  else if (hud.hackProgress < 50) next.hackDone = false;

  // kills: one event per machine the player actually defeated, credited to the region they are fighting in
  if (prev.kills === null || hud.kills < prev.kills) next.kills = hud.kills; // first snapshot or counter reset: re-baseline, credit nothing
  else if (hud.kills > prev.kills) {
    next.kills = hud.kills;
    for (let i = 0; i < Math.min(MAX_KILLS_PER_SNAPSHOT, hud.kills - prev.kills); i++) events.push({ type: "KILL", world: hud.regionId });
  }

  // survive time: only while alive, in the region the player is standing in
  if (hud.hp > 0 && slice > 0) {
    events.push({ type: "SURVIVED", world: hud.regionId, seconds: slice });
    if (hud.diving) events.push({ type: "SURVIVED", world: "thalassia-dive", seconds: slice });
  }
  return { events, next };
}
