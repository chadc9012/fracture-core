/** Pure rules for the boot sequence and the main-menu save check. No React, no storage access
 * beyond the tiny session-flag helpers, so the timeline and save rules stay testable. */
import type { PlayerProgression } from "./progression";

export type BootStage = "black" | "reveal" | "title" | "nova" | "done";
export type BootFrame = { stage: BootStage; /** 0..1 fade of the world image */ reveal: number; /** 0..1 title opacity */ title: number; /** index into NOVA_BOOT_LINES, or -1 */ line: number; done: boolean };

/** Restrained, honest subtitles: scripted text, not a conversation. */
export const NOVA_BOOT_LINES = ["Fracture signal acquired.", "Resonant signature pending. Awaiting operator."] as const;

const T = { black: 800, reveal: 3200, title: 6000, nova: 9800 } as const;
const R = { title: 0, nova: 1200, done: 4600 } as const;
export const BOOT_TOTAL_MS = T.nova;
export const BOOT_TOTAL_REDUCED_MS = R.done;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Timeline for the opening. Reduced motion skips the fade-in/out choreography: everything is
 * simply there, the subtitle appears, and the sequence ends sooner. */
export function bootFrame(elapsedMs: number, reduced: boolean): BootFrame {
  const t = Math.max(0, elapsedMs);
  if (reduced) {
    if (t >= R.done) return { stage: "done", reveal: 1, title: 1, line: -1, done: true };
    return { stage: t >= R.nova ? "nova" : "title", reveal: 1, title: 1, line: t >= R.nova ? 0 : -1, done: false };
  }
  if (t >= T.nova) return { stage: "done", reveal: 1, title: 1, line: -1, done: true };
  const reveal = clamp01((t - T.black) / (T.reveal - T.black));
  const title = clamp01((t - T.reveal) / 1200);
  if (t < T.black) return { stage: "black", reveal: 0, title: 0, line: -1, done: false };
  if (t < T.reveal) return { stage: "reveal", reveal, title: 0, line: -1, done: false };
  if (t < T.title) return { stage: "title", reveal: 1, title, line: -1, done: false };
  const span = (T.nova - T.title) / NOVA_BOOT_LINES.length;
  return { stage: "nova", reveal: 1, title: 1, line: Math.min(NOVA_BOOT_LINES.length - 1, Math.floor((t - T.title) / span)), done: false };
}

const BOOT_FLAG = "world-fracture-boot-seen";
/** Session-scoped on purpose: the opening plays once per visit, never when returning to the menu. */
export function bootSeen(storage: Pick<Storage, "getItem"> | null = safeSession()): boolean {
  try { return storage?.getItem(BOOT_FLAG) === "1"; } catch { return false; }
}
export function markBootSeen(storage: Pick<Storage, "setItem"> | null = safeSession()) {
  try { storage?.setItem(BOOT_FLAG, "1"); } catch { /* storage may be blocked; the opening just replays */ }
}
function safeSession(): Storage | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
}

export type SaveSummary = { hasSave: boolean; classId: "TITAN" | "HUNTER" | "WARLOCK" | null; level: number; missions: number; name: string | null };

/** A save is "real" when the player created a character, finished a mission or earned any level.
 * `DEFAULT_PROGRESSION` (what a missing or corrupt save normalises to) is never a save. */
export function evaluateSave(p: PlayerProgression | null | undefined, sessionPlayed = false): SaveSummary {
  if (!p) return { hasSave: sessionPlayed, classId: null, level: 1, missions: 0, name: null };
  const missions = Array.isArray(p.completedMissions) ? p.completedMissions.length : 0;
  const name = typeof p.character?.displayName === "string" && p.character.displayName.trim() ? p.character.displayName.trim() : null;
  const level = typeof p.level === "number" && p.level > 0 ? p.level : 1;
  const hasSave = sessionPlayed || missions > 0 || p.character != null || p.identityClass != null || level > 1;
  return { hasSave, classId: p.identityClass ?? null, level, missions, name };
}
