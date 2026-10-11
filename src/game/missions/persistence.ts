/** Save/restore for the scripted mission state machines (awakening, broken-signal, drowned-relay, blackout-protocol,
 * stitched-neon-core, descent-protocol, system-core). Only the machine's own small state is saved
 * (phase, target, hack/hold progress, flags, NOVA line); live world objects (drone waves, bosses) are
 * never saved. Combat phases resume by re-spawning their wave from the start, and boss phases by
 * re-summoning the boss at full health, because Scene spawns from the phase. Rewards are applied by
 * `applyMissionCompletion`, which is idempotent, so a reload can never pay a mission twice. */
import type { PlayerProgression } from "../progression";
import { rewardMission } from "../progression";
import type { MaterialId } from "../inventory";
import { gameTick, type QuestEvent } from "../quests";

export const MISSION_IDS = ["awakening", "broken-signal", "drowned-relay", "blackout-protocol", "stitched-neon-core", "descent-protocol", "system-core"] as const;
export type MissionId = (typeof MISSION_IDS)[number];

/** The superset of fields the six machines use; each machine rebuilds only its own. */
export type SavedMissionRun = { id: MissionId; state: string; target: { x: number; z: number } | null; hack: number; hold: number; wave2Done: boolean; nova: string; line: string; alert: string };
export type ActiveMissions = Partial<Record<MissionId, SavedMissionRun>>;

/** Phases that may be saved: everything between START and the end. IDLE is "not started". */
export const RESUMABLE_STATES: Record<MissionId, readonly string[]> = {
  "awakening": ["DROP", "PATROL", "ESCALATION", "LOOT", "CAPTURE", "HOLD", "EXTRACT", "COMPLETE"],
  "broken-signal": ["TRIGGERED", "DISCOVERY", "TRAVERSAL", "COMBAT_1", "HACKING", "COMBAT_2", "COMPLETE", "WORLD_UPDATE"],
  "drowned-relay": ["TRIGGERED", "WADING", "COMBAT_1", "PURGING", "BOSS", "COMPLETE", "WORLD_UPDATE"],
  "blackout-protocol": ["TRIGGERED", "INFILTRATION", "COMBAT_1", "HACKING", "COMBAT_2", "COMPLETE", "WORLD_UPDATE"],
  "stitched-neon-core": ["TRIGGERED", "DESCENT", "COMBAT_1", "STABILIZING", "BOSS", "COMPLETE", "WORLD_UPDATE"],
  "descent-protocol": ["TRIGGERED", "DIVE", "COMBAT_1", "TRACING", "COMPLETE", "WORLD_UPDATE"],
  "system-core": ["TRIGGERED", "DIVE", "COMBAT_1", "STABILIZING", "BOSS", "COMPLETE", "WORLD_UPDATE"],
};

/** Phases whose live enemies are not saved: on resume Scene spawns that wave/boss afresh. */
export const RESPAWNS_ON_RESUME: Record<MissionId, readonly string[]> = {
  "awakening": ["PATROL", "ESCALATION", "HOLD"],
  "broken-signal": ["COMBAT_1", "COMBAT_2"],
  "drowned-relay": ["COMBAT_1", "BOSS"],
  "blackout-protocol": ["COMBAT_1", "COMBAT_2"],
  "stitched-neon-core": ["COMBAT_1", "BOSS"],
  "descent-protocol": ["COMBAT_1"],
  "system-core": ["COMBAT_1", "BOSS"],
};

/** Per-mission completion: the materials paid and the quest event fired, exactly as GameCanvas used to inline. */
const COMPLETION: Record<MissionId, { materials: Partial<Record<MaterialId, number>>; event: QuestEvent }> = {
  "awakening": { materials: { dataShards: 2 }, event: { type: "MISSION_COMPLETE", missionId: "awakening" } },
  "broken-signal": { materials: { dataShards: 3 }, event: { type: "MISSION_COMPLETE", missionId: "broken-signal" } },
  "drowned-relay": { materials: { bioCatalyst: 2, dataShards: 2 }, event: { type: "MISSION_COMPLETE", missionId: "drowned-relay" } },
  "blackout-protocol": { materials: { microCircuits: 4 }, event: { type: "MISSION_COMPLETE", missionId: "blackout-protocol" } },
  "stitched-neon-core": { materials: { aegisCore: 1 }, event: { type: "MISSION_COMPLETE", missionId: "stitched-neon-core" } },
  "descent-protocol": { materials: { dataShards: 5 }, event: { type: "MISSION_COMPLETE", missionId: "descent-protocol" } },
  "system-core": { materials: { fractureCore: 1 }, event: { type: "BOSS_DEFEATED", encounterId: "system-core" } },
};

const without = (runs: ActiveMissions | undefined, id: MissionId): ActiveMissions => { const { [id]: _drop, ...rest } = runs ?? {}; return rest; };

/** Pays a mission once. A mission already in `completedMissions` is never rewarded, XP'd or ticked again;
 * its saved run is dropped either way. */
export function applyMissionCompletion(p: PlayerProgression, id: MissionId): PlayerProgression {
  if (p.completedMissions.includes(id)) return p.activeMissions?.[id] ? { ...p, activeMissions: without(p.activeMissions, id) } : p;
  const c = COMPLETION[id];
  const paid = gameTick(rewardMission(p, id, c.materials), c.event);
  return { ...paid, activeMissions: without(paid.activeMissions, id) };
}

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.slice(0, max) : "");
const pct = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0);
const coord = (v: unknown): { x: number; z: number } | null => {
  const t = v as { x?: unknown; z?: unknown } | null;
  return t && typeof t === "object" && typeof t.x === "number" && typeof t.z === "number" && Number.isFinite(t.x) && Number.isFinite(t.z) && Math.abs(t.x) < 1e5 && Math.abs(t.z) < 1e5 ? { x: t.x, z: t.z } : null;
};

/** Validates saved data of any shape (legacy saves have none): unknown ids, unknown phases, wrong
 * types and junk are dropped; numbers are clamped. Never throws. */
export function sanitizeActiveMissions(raw: unknown): ActiveMissions {
  const out: ActiveMissions = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const id of MISSION_IDS) {
    const r = (raw as Record<string, unknown>)[id] as { id?: unknown; state?: unknown; target?: unknown; hack?: unknown; hold?: unknown; wave2Done?: unknown; nova?: unknown; line?: unknown; alert?: unknown } | undefined;
    if (!r || typeof r !== "object" || r.id !== id || typeof r.state !== "string" || !RESUMABLE_STATES[id].includes(r.state)) continue;
    out[id] = { id, state: r.state, target: coord(r.target), hack: pct(r.hack), hold: pct(r.hold), wave2Done: r.wave2Done === true, nova: str(r.nova), line: str(r.line), alert: str(r.alert) };
  }
  return out;
}

const PREREQUISITE: Record<MissionId, MissionId | null> = { "awakening": null, "broken-signal": "awakening", "drowned-relay": "broken-signal", "blackout-protocol": "broken-signal", "stitched-neon-core": "blackout-protocol", "descent-protocol": "stitched-neon-core", "system-core": "descent-protocol" };

/** Is it safe to resume this mission in the current save? Rejects completed missions, an unfinished
 * tutorial, a missing prerequisite mission, and System Core outside its own quest (`fd-18`). */
export function canResume(id: MissionId, p: Pick<PlayerProgression, "completedMissions" | "tutorialComplete" | "activeQuestId">): boolean {
  if (p.completedMissions.includes(id)) return false;
  if (!p.tutorialComplete && !p.completedMissions.includes("mission-01")) return false;
  const pre = PREREQUISITE[id];
  if (pre && !p.completedMissions.includes(pre)) return false;
  if (id === "system-core" && p.activeQuestId !== "fd-18") return false;
  return true;
}

/** The saved run to restore for `id`, or null when none is saved or resuming would be unsafe (the
 * normal start trigger then begins the mission fresh — the documented recovery path). */
export function savedRunFor(id: MissionId, p: PlayerProgression): SavedMissionRun | null {
  const run = sanitizeActiveMissions(p.activeMissions)[id];
  return run && canResume(id, p) ? run : null;
}

/** Rebuilds a machine's own run shape (each machine has a slightly different one) from a saved run. */
export function restoreMission<R extends { id: string }>(id: MissionId, p: PlayerProgression): R | null {
  const s = savedRunFor(id, p);
  if (!s) return null;
  const run = id === "awakening"
    ? { id, state: s.state, target: s.target, hold: s.hold, line: s.line, alert: s.alert }
    : id === "broken-signal" || id === "blackout-protocol"
      ? { id, state: s.state, target: s.target, hack: s.hack, wave2Done: s.wave2Done, nova: s.nova }
      : { id, state: s.state, target: s.target, hack: s.hack, nova: s.nova };
  return run as unknown as R;
}

type AnyRun = { id: string; state: string; target?: { x: number; z: number } | null; hack?: number; hold?: number; wave2Done?: boolean; nova?: string; line?: string; alert?: string };

/** Records (or clears) a machine's run in the save. Returns `p` itself when nothing changed, so it is safe to call often. */
export function withMissionRun(p: PlayerProgression, id: MissionId, run: AnyRun | null): PlayerProgression {
  const saved = run && run.state !== "IDLE" && RESUMABLE_STATES[id].includes(run.state) && !p.completedMissions.includes(id)
    ? sanitizeActiveMissions({ [id]: { id, state: run.state, target: run.target ?? null, hack: run.hack ?? 0, hold: run.hold ?? 0, wave2Done: run.wave2Done ?? false, nova: run.nova ?? "", line: run.line ?? "", alert: run.alert ?? "" } })[id] ?? null
    : null;
  const current = p.activeMissions?.[id] ?? null;
  if (JSON.stringify(saved) === JSON.stringify(current)) return p;
  return { ...p, activeMissions: saved ? { ...(p.activeMissions ?? {}), [id]: saved } : without(p.activeMissions, id) };
}

/** Drops saved runs for missions that are already complete (used when merging saves). */
export function pruneCompleted(runs: unknown, completed: readonly string[]): ActiveMissions {
  const clean = sanitizeActiveMissions(runs);
  for (const id of MISSION_IDS) if (completed.includes(id)) delete clean[id];
  return clean;
}
