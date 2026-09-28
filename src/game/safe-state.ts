/** Safe-state guard rails — soft failures instead of hard crashes. A single bad frame (NaN drift
 * from an edge-case calc, a null ref during a scene transition) or a bad save (full/blocked
 * localStorage) should never take the whole game down. This module catches those, repairs what it
 * can, logs without flooding the console, and escalates to a hard rollback only after a genuine
 * run of failures — one freak error is not the same thing as a permanently broken loop. */

export type PlayerLikeState = { x: number; z: number; yaw: number; hp?: number };

const SAFE_SPAWN = { x: 0, z: 0, yaw: 0 };

export function isValidPlayerState(s: PlayerLikeState): boolean {
  return Number.isFinite(s.x) && Number.isFinite(s.z) && Number.isFinite(s.yaw) && (s.hp === undefined || Number.isFinite(s.hp));
}

/** Repairs only the fields that went bad — a NaN position resets to a safe origin, but a fine
 * position with a momentarily bad hp reading isn't also teleported for no reason. */
export function sanitizePlayerState<T extends PlayerLikeState>(s: T): T {
  return {
    ...s,
    x: Number.isFinite(s.x) ? s.x : SAFE_SPAWN.x,
    z: Number.isFinite(s.z) ? s.z : SAFE_SPAWN.z,
    yaw: Number.isFinite(s.yaw) ? s.yaw : SAFE_SPAWN.yaw,
    hp: s.hp === undefined ? s.hp : Number.isFinite(s.hp) ? s.hp : 100,
  } as T;
}

let consecutiveFrameFailures = 0;
let lastLoggedAt = 0;
const ESCALATE_AFTER = 90; // ~1.5s of straight failures at 60fps — a real broken loop, not one bad frame

/** Call from a frame-loop catch block. Logs at most once a second so a repeating error can't flood
 * the console, and calls `onEscalate` once the failure run crosses the threshold so the caller can
 * roll the player back to a known-good state instead of leaving the loop wedged. */
export function softFrameFailure(err: unknown, onEscalate?: () => void): void {
  consecutiveFrameFailures++;
  const now = Date.now();
  if (now - lastLoggedAt > 1000) {
    lastLoggedAt = now;
    console.warn("[world-fracture] recovered from a frame error, continuing:", err);
  }
  if (consecutiveFrameFailures >= ESCALATE_AFTER) {
    consecutiveFrameFailures = 0;
    onEscalate?.();
  }
}

/** Call at the end of a successful frame so an old, unrelated failure from minutes ago can't
 * silently count toward today's escalation threshold. */
export function resetFrameFailureCount(): void {
  consecutiveFrameFailures = 0;
}

/** Soft-fails a localStorage read/write instead of throwing into the caller — private-browsing
 * Safari, a full quota, or a disabled storage API should degrade to "progress isn't saved this
 * session" rather than crash whatever triggered the save. */
export function safeStorageWrite(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[world-fracture] could not persist "${key}" — continuing without saving this update:`, err);
    return false;
  }
}

export function safeStorageRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    console.warn(`[world-fracture] could not read "${key}" from storage:`, err);
    return null;
  }
}
