import { pruneCompleted } from "./missions/persistence";
import { supabase } from "@/integrations/supabase/client";
import { furtherTutorial } from "./onboarding";
import { migrateAbilityIds } from "./operators";
import { DEFAULT_PROGRESSION, normalizeProgression, type PlayerProgression } from "./progression";
import type { Json } from "@/integrations/supabase/types";

/** Local bookkeeping so we know which cloud revision this device last saw. */
const META_KEY = "world-fracture.cloud-meta.v1";
const BACKUP_KEY = "world-fracture.cloud-backup.v1";

type Meta = { deviceId: string; revision: number; updatedAt: string | null; userId: string | null };

function readMeta(): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? "null") as Meta | null;
    if (m?.deviceId) return m;
  } catch { /* fall through */ }
  const fresh: Meta = { deviceId: crypto.randomUUID(), revision: 0, updatedAt: null, userId: null };
  localStorage.setItem(META_KEY, JSON.stringify(fresh));
  return fresh;
}
const writeMeta = (m: Meta) => localStorage.setItem(META_KEY, JSON.stringify(m));

const union = <T,>(a: T[], b: T[]) => [...new Set([...a, ...b])];
function maxRecord<T>(a: Record<string, T>, b: Record<string, T>, pick: (x: T, y: T) => T) {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? pick(out[k] as T, v) : v;
  return out;
}

/**
 * Conflict recovery: progress is only ever gained, so we keep the union of unlocks and the
 * best of every counter. Choices (selected vehicle, garage, build) come from the newer copy.
 */
export function mergeProgression(local: PlayerProgression, cloud: PlayerProgression, localIsNewer: boolean): PlayerProgression {
  const newer = localIsNewer ? local : cloud;
  const ownedVehicles = union(local.ownedVehicles, cloud.ownedVehicles);
  const garage = newer.garageLoadout.filter((v) => ownedVehicles.includes(v));
  return {
    ...newer,
    completedMissions: union(local.completedMissions, cloud.completedMissions),
    unlockedAbilities: migrateAbilityIds(union(local.unlockedAbilities, cloud.unlockedAbilities)),
    earnedRewards: union(local.earnedRewards, cloud.earnedRewards),
    inventory: [...new Map([...cloud.inventory, ...local.inventory].map((item) => [item.id, item])).values()].map((item) => {
      const other = cloud.inventory.find((entry) => entry.id === item.id);
      const localItem = local.inventory.find((entry) => entry.id === item.id);
      const best = other && localItem ? (localItem.level >= other.level ? localItem : other) : item;
      return { ...best, favorite: Boolean(other?.favorite || localItem?.favorite) };
    }),
    equippedGear: newer.equippedGear,
    materials: maxRecord(local.materials, cloud.materials, Math.max),
    ownedVehicles,
    garageLoadout: garage.length ? garage : ownedVehicles.slice(-3),
    selectedVehicle: newer.selectedVehicle && ownedVehicles.includes(newer.selectedVehicle) ? newer.selectedVehicle : ownedVehicles.at(-1) ?? null,
    abilityMastery: maxRecord(local.abilityMastery, cloud.abilityMastery, (x, y) => (x.xp >= y.xp ? x : y)),
    dungeonClears: maxRecord(local.dungeonClears, cloud.dungeonClears, Math.max),
    tutorialComplete: local.tutorialComplete || cloud.tutorialComplete,
    introSeen: local.introSeen || cloud.introSeen || local.tutorialComplete || cloud.tutorialComplete,
    tutorialRun: local.tutorialComplete || cloud.tutorialComplete ? null : furtherTutorial(local.tutorialRun, cloud.tutorialRun),
    endingSeen: local.endingSeen || cloud.endingSeen,
    identityClass: newer.identityClass ?? local.identityClass ?? cloud.identityClass,
    // Quest engine: unlocks and corruption are only ever gained, so union/max them like everything else above;
    // the active quest and its live objective progress are a choice, so they come from the newer copy.
    unlockedWorlds: union(local.unlockedWorlds, cloud.unlockedWorlds),
    worldFlags: maxRecord(local.worldFlags as Record<string, boolean>, cloud.worldFlags as Record<string, boolean>, (a, b) => a || b),
    corruptionLevel: Math.max(local.corruptionLevel, cloud.corruptionLevel),
    activeQuestId: newer.activeQuestId,
    currentWorld: newer.currentWorld,
    missionRuns: maxRecord(local.missionRuns, cloud.missionRuns, (a, b) => (a.day > b.day ? a : b.day > a.day ? b : a.count >= b.count ? a : b)),
    // in-progress scripted missions are a choice (newer copy), but a mission the other copy finished is never reopened
    activeMissions: pruneCompleted(newer.activeMissions, union(local.completedMissions, cloud.completedMissions)),
    questObjectiveProgress: maxRecord(local.questObjectiveProgress, cloud.questObjectiveProgress, (a, b) => a.map((v, i) => Math.max(v, b[i] ?? 0))),
  };
}

const same = (a: PlayerProgression, b: PlayerProgression) => JSON.stringify(a) === JSON.stringify(b);

export type SyncResult = { progression: PlayerProgression; status: "synced" | "merged" | "uploaded" | "downloaded"; revision: number };

/** Pull on sign-in: first cloud save uploads, otherwise merge and keep a backup of the local copy. */
export async function pullAndMerge(userId: string, local: PlayerProgression, localUpdatedAt: string | null): Promise<SyncResult> {
  const meta = readMeta();
  const { data, error } = await supabase.from("player_saves").select("data, revision, updated_at").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) {
    const revision = await pushSave(userId, local);
    return { progression: local, status: "uploaded", revision };
  }
  const cloud = normalizeProgression(data.data);
  const pristineLocal = same(local, DEFAULT_PROGRESSION) || meta.userId !== userId && meta.userId !== null;
  if (pristineLocal) {
    writeMeta({ ...meta, revision: data.revision, updatedAt: data.updated_at, userId });
    return { progression: cloud, status: "downloaded", revision: data.revision };
  }
  if (same(local, cloud)) {
    writeMeta({ ...meta, revision: data.revision, updatedAt: data.updated_at, userId });
    return { progression: cloud, status: "synced", revision: data.revision };
  }
  localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), local, cloud }));
  const localIsNewer = !!localUpdatedAt && localUpdatedAt > data.updated_at;
  const merged = mergeProgression(local, cloud, localIsNewer);
  writeMeta({ ...meta, revision: data.revision, userId });
  const revision = await pushSave(userId, merged);
  return { progression: merged, status: "merged", revision };
}

/**
 * Optimistic write: only succeeds if the cloud is still at the revision we last saw.
 * If another device saved first, fetch theirs, merge, and retry.
 */
export async function pushSave(userId: string, progression: PlayerProgression, attempt = 0): Promise<number> {
  const meta = readMeta();
  const payload = { data: progression as unknown as Json, save_version: progression.version, device_id: meta.deviceId, updated_at: new Date().toISOString() };
  if (meta.revision === 0 || meta.userId !== userId) {
    const { data, error } = await supabase.from("player_saves").insert({ user_id: userId, revision: 1, ...payload }).select("revision, updated_at").maybeSingle();
    if (!error && data) { writeMeta({ ...meta, revision: data.revision, updatedAt: data.updated_at, userId }); return data.revision; }
    if (error && error.code !== "23505") throw error;
  } else {
    const next = meta.revision + 1;
    const { data, error } = await supabase.from("player_saves").update({ ...payload, revision: next }).eq("user_id", userId).eq("revision", meta.revision).select("revision, updated_at").maybeSingle();
    if (error) throw error;
    if (data) { writeMeta({ ...meta, revision: data.revision, updatedAt: data.updated_at, userId }); return data.revision; }
  }
  // conflict: someone else wrote first
  if (attempt > 2) throw new Error("Save conflict could not be resolved");
  const { data: remote, error } = await supabase.from("player_saves").select("data, revision, updated_at").eq("user_id", userId).single();
  if (error) throw error;
  writeMeta({ ...meta, revision: remote.revision, userId });
  const merged = mergeProgression(progression, normalizeProgression(remote.data), true);
  onRemoteMerge?.(merged);
  return pushSave(userId, merged, attempt + 1);
}

let onRemoteMerge: ((p: PlayerProgression) => void) | null = null;
export const setRemoteMergeHandler = (fn: ((p: PlayerProgression) => void) | null) => { onRemoteMerge = fn; };

export function restoreBackup(): PlayerProgression | null {
  try {
    const b = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? "null") as { local: unknown } | null;
    return b ? normalizeProgression(b.local) : null;
  } catch { return null; }
}
export const hasBackup = () => typeof window !== "undefined" && !!localStorage.getItem(BACKUP_KEY);
export const localSavedAt = () => (typeof window === "undefined" ? null : localStorage.getItem("world-fracture.progression.savedAt"));

export type RestorePoint = { id: string; revision: number; created_at: string; device_id: string; summary: string };

const summarize = (p: PlayerProgression) => `${p.completedMissions.length} missions · ${p.ownedVehicles.length} vehicles · garage ${p.garageLoadout.length}`;

/** Earlier cloud versions, captured automatically by the backend whenever the save changes. */
export async function listRestorePoints(userId: string): Promise<RestorePoint[]> {
  const { data, error } = await supabase.from("player_save_snapshots").select("id, revision, created_at, device_id, data").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, revision: r.revision, created_at: r.created_at, device_id: r.device_id, summary: summarize(normalizeProgression(r.data)) }));
}

/** Restore replaces (not merges) — the current version is itself kept as a restore point by the next save. */
export async function loadRestorePoint(id: string): Promise<PlayerProgression> {
  const { data, error } = await supabase.from("player_save_snapshots").select("data").eq("id", id).single();
  if (error) throw error;
  return normalizeProgression(data.data);
}
