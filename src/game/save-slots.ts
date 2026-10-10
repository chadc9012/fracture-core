import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { DEFAULT_PROGRESSION, normalizeProgression, type PlayerProgression } from "./progression";
import { pushSave } from "./cloud-save";

/** Multiple save slots on top of the single live cloud save: the active slot is what player_saves
 * holds and syncs; inactive slots are parked copies. Switching replaces (never merges). */
export const SLOT_COUNT = 3;
const ACTIVE_KEY = "world-fracture.active-slot";
const LOCAL_SLOTS_KEY = "world-fracture.slots";

export type SlotSummary = { slot: number; label: string; empty: boolean; updatedAt: string | null; summary: string; active: boolean };

export const activeSlot = () => {
  if (typeof window === "undefined") return 1;
  const n = Number(localStorage.getItem(ACTIVE_KEY));
  return n >= 1 && n <= SLOT_COUNT ? n : 1;
};

export const describe = (p: PlayerProgression) =>
  `${p.identityClass ?? "No class"} · Lv ${p.level} · ${p.completedMissions.length} missions`;

type Stored = { label: string; data: unknown; updated_at: string };
const readLocal = (): Record<number, Stored> => { try { return JSON.parse(localStorage.getItem(LOCAL_SLOTS_KEY) ?? "{}"); } catch { return {}; } };

async function readSlots(userId: string | null): Promise<Record<number, Stored>> {
  if (!userId) return readLocal();
  const { data, error } = await supabase.from("player_save_slots").select("slot, label, data, updated_at").eq("user_id", userId);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.slot, { label: r.label, data: r.data, updated_at: r.updated_at }]));
}

async function writeSlot(userId: string | null, slot: number, label: string, p: PlayerProgression) {
  const updated_at = new Date().toISOString();
  if (!userId) { const all = readLocal(); all[slot] = { label, data: p, updated_at }; localStorage.setItem(LOCAL_SLOTS_KEY, JSON.stringify(all)); return; }
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
  const from = activeSlot();
  if (target === from) return current;
  const stored = await readSlots(userId);
  await writeSlot(userId, from, stored[from]?.label || `Slot ${from}`, current);
  const next = stored[target] ? normalizeProgression(stored[target]!.data) : DEFAULT_PROGRESSION;
  if (userId) await pushSave(userId, next);
  localStorage.setItem(ACTIVE_KEY, String(target));
  return next;
}

export async function renameSlot(userId: string | null, slot: number, label: string, current: PlayerProgression) {
  const stored = await readSlots(userId);
  const data = slot === activeSlot() ? current : stored[slot] ? normalizeProgression(stored[slot]!.data) : DEFAULT_PROGRESSION;
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
