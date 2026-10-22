import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { DEFAULT_PROGRESSION, normalizeProgression, type PlayerProgression } from "./progression";
import { pushSave } from "./cloud-save";
import { isTestProfile, profileKey } from "./save-profile";

/** Multiple save slots on top of the single live cloud save: the active slot is what player_saves
 * holds and syncs; inactive slots are parked copies. Switching replaces (never merges). */
export const SLOT_COUNT = 3;
// save-profile.ts: the test profile keeps its own slots and never touches the cloud
const ACTIVE_KEY = profileKey("world-fracture.active-slot");
const LOCAL_SLOTS_KEY = profileKey("world-fracture.slots");
const cloudUser = (userId: string | null) => (isTestProfile() ? null : userId);

/** Validate untrusted slot IDs before any cloud write or local persistence mutation. */
export function assertValidSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 1 || slot > SLOT_COUNT) {
    throw new RangeError(`Invalid save slot ${String(slot)}; expected 1–${SLOT_COUNT}`);
  }
}

export type SlotSummary = { slot: number; label: string; empty: boolean; updatedAt: string | null; summary: string; active: boolean };

/** Storage may throw in privacy mode or when the browser blocks site data. */
function storageRead(key: string): string | null {
  try { return typeof localStorage === "undefined" ? null : localStorage.getItem(key); }
  catch { return null; }
}

function storageWrite(key: string, value: string): void {
  if (typeof localStorage === "undefined") throw new Error("Save storage is unavailable");
  try { localStorage.setItem(key, value); }
  catch { throw new Error("Unable to save game: browser storage is unavailable or full"); }
}

export const activeSlot = () => {
  const raw = storageRead(ACTIVE_KEY);
  if (raw === null || raw.trim() === "") return 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT ? n : 1;
};

export const describe = (p: PlayerProgression) =>
  `${p.identityClass ?? "No class"} · Lv ${p.level} · ${p.completedMissions.length} missions`;

type Stored = { label: string; data: unknown; updated_at: string };

/** Validate both browser and cloud records using the same boundary. */
export function parseStoredSlotRecord(value: unknown): Stored | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as { label?: unknown; data?: unknown; updated_at?: unknown };
  if (typeof row.label !== "string" || typeof row.updated_at !== "string") return null;
  if (!row.data || typeof row.data !== "object" || Array.isArray(row.data)) return null;
  // A malformed timestamp should never be surfaced as a valid save date.
  if (!Number.isFinite(Date.parse(row.updated_at))) return null;
  // Reject implausible future timestamps caused by corrupted storage or clock errors.
  if (Date.parse(row.updated_at) > Date.now() + 24 * 60 * 60 * 1000) return null;
  return { label: row.label.slice(0, 32), updated_at: row.updated_at, data: row.data };
}
/** Treat browser storage as untrusted: malformed or non-object JSON must not crash slot operations. */
export function parseLocalSlots(raw: string | null): Record<number, Stored> {
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<number, Stored> = {};
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      const entry = (parsed as Record<string, unknown>)[String(slot)];
      const record = parseStoredSlotRecord(entry);
      if (record) result[slot] = record;
    }
    return result;
  } catch { return {}; }
}
const readLocal = (): Record<number, Stored> => parseLocalSlots(storageRead(LOCAL_SLOTS_KEY));

async function readSlots(user: string | null): Promise<Record<number, Stored>> {
  const userId = cloudUser(user);
  if (!userId) return readLocal();
  const { data, error } = await supabase.from("player_save_slots").select("slot, label, data, updated_at").eq("user_id", userId);
  if (error) throw error;
  const slots: Record<number, Stored> = {};
  for (const row of data ?? []) {
    if (!Number.isInteger(row.slot) || row.slot < 1 || row.slot > SLOT_COUNT) continue;
    const record = parseStoredSlotRecord(row);
    if (record) slots[row.slot] = record;
  }
  return slots;
}

async function writeSlot(user: string | null, slot: number, label: string, p: PlayerProgression) {
  assertValidSlot(slot);
  const userId = cloudUser(user);
  const updated_at = new Date().toISOString();
  if (!userId) { const all = readLocal(); all[slot] = { label, data: p, updated_at }; storageWrite(LOCAL_SLOTS_KEY, JSON.stringify(all)); return; }
  const { error } = await supabase.from("player_save_slots").upsert({ user_id: userId, slot, label, data: p as unknown as Json, updated_at });
  if (error) throw error;
}

export async function listSlots(userId: string | null, current: PlayerProgression): Promise<SlotSummary[]> {
  const stored = await readSlots(userId);
  const act = activeSlot();
  return Array.from({ length: SLOT_COUNT }, (_, i) => {
    const slot = i + 1, row = stored[slot];
    if (slot === act) return { slot, label: row?.label || `Slot ${slot}`, empty: false, updatedAt: new Date().toISOString(), summary: describe(current), active: true };
    if (!row) return { slot, label: `Slot ${slot}`, empty: true, updatedAt: null, summary: "Empty — starts a new game", active: false };
    return { slot, label: row.label || `Slot ${slot}`, empty: false, updatedAt: row.updated_at, summary: describe(normalizeProgression(row.data)), active: false };
  });
}

/** Parks the current game in its slot, then loads the target slot as the live save. */
export async function switchSlot(userId: string | null, current: PlayerProgression, target: number): Promise<PlayerProgression> {
  assertValidSlot(target);
  const from = activeSlot();
  if (target === from) return current;
  const stored = await readSlots(userId);
  await writeSlot(userId, from, stored[from]?.label || `Slot ${from}`, current);
  const next = stored[target] ? normalizeProgression(stored[target]!.data) : structuredClone(DEFAULT_PROGRESSION);
  if (cloudUser(userId)) await pushSave(userId!, next);
  storageWrite(ACTIVE_KEY, String(target));
  return next;
}

export async function renameSlot(userId: string | null, slot: number, label: string, current: PlayerProgression) {
  assertValidSlot(slot);
  const stored = await readSlots(userId);
  const data = slot === activeSlot() ? current : stored[slot] ? normalizeProgression(stored[slot]!.data) : structuredClone(DEFAULT_PROGRESSION);
  await writeSlot(userId, slot, label.slice(0, 32), data);
}

export type NewGameResult = { status: "started"; progression: PlayerProgression; slot: number } | { status: "no-free-slot" };

/** New Game with an existing save: the current game is parked in its own slot and a free slot becomes the live save,
 * starting from a fresh profile. Nothing is erased; if all slots are taken it refuses (the player frees one in Saves). */
export async function beginNewGame(userId: string | null, current: PlayerProgression): Promise<NewGameResult> {
  const stored = await readSlots(userId);
  const act = activeSlot();
  const free = Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).find((slot) => slot !== act && !stored[slot]);
  if (!free) return { status: "no-free-slot" };
  const progression = await switchSlot(userId, current, free);
  return { status: "started", progression: structuredClone(progression), slot: free };
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Which slot New Game would use, without changing anything (for the confirmation text). */
export async function freeSlotForNewGame(userId: string | null): Promise<number | null> {
  const stored = await readSlots(userId);
  const act = activeSlot();
  return Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).find((slot) => slot !== act && !stored[slot]) ?? null;
}
