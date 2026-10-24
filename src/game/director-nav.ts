/** Director navigation (Stage 39): Planet → Destination (regional map) → Area (street view) → Activity detail, as a stack,
 * so Back always returns to the previous map with its selection intact. Pure; the screens hold one `DirectorNav` in state.
 * The selection made on each screen is remembered by screen key, so returning to a screen restores what was picked. */
import type { DestinationId } from "./destination-map";

export type DirectorScreen =
  | { level: "planet" }
  | { level: "destination"; id: DestinationId }
  /** street view: one district/area of a destination (locations.ts area id) */
  | { level: "area"; id: string; destinationId: DestinationId }
  /** a single activity's detail card (map-activities id), opened from a destination or area */
  | { level: "activity"; id: string; destinationId: DestinationId };

export type DirectorNav = { stack: readonly DirectorScreen[]; picks: Readonly<Record<string, string>> };

export const NEW_DIRECTOR_NAV: DirectorNav = { stack: [{ level: "planet" }], picks: {} };

export const screenKey = (s: DirectorScreen) => (s.level === "planet" ? "planet" : `${s.level}:${s.id}`);
export const current = (n: DirectorNav): DirectorScreen => n.stack[n.stack.length - 1]!;

/** open a deeper screen; opening the screen already on top does nothing, and re-opening one already in the history
 * returns to it (no loops of the same map in the history) */
export function push(n: DirectorNav, s: DirectorScreen): DirectorNav {
  const key = screenKey(s), at = n.stack.findIndex((x) => screenKey(x) === key);
  if (at >= 0) return { ...n, stack: n.stack.slice(0, at + 1) };
  return { ...n, stack: [...n.stack, s] };
}
/** Back: one screen up; the planet is the bottom and stays */
export const pop = (n: DirectorNav): DirectorNav => (n.stack.length > 1 ? { ...n, stack: n.stack.slice(0, -1) } : n);
/** jump to a screen in the breadcrumb (index into the stack) */
export const popTo = (n: DirectorNav, index: number): DirectorNav => ({ ...n, stack: n.stack.slice(0, Math.max(1, Math.min(n.stack.length, index + 1))) });
/** remember the selection on a screen (destination picked on the planet, activity picked on a map...) */
export const remember = (n: DirectorNav, screen: DirectorScreen, pick: string | null): DirectorNav => {
  const k = screenKey(screen), picks = { ...n.picks };
  if (pick === null) delete picks[k]; else picks[k] = pick;
  return { ...n, picks };
};
export const recall = (n: DirectorNav, screen: DirectorScreen): string | null => n.picks[screenKey(screen)] ?? null;

/** Director tab cycling: Q/E on the keyboard, L1/R1 (standard-mapping buttons 4/5) on a pad. Edge-triggered. */
export type TabIntent = "prev" | "next";
export function tabKeyIntent(code: string): TabIntent | null {
  return code === "KeyQ" ? "prev" : code === "KeyE" ? "next" : null;
}
export function padTabIntent(prev: readonly boolean[], now: readonly boolean[]): TabIntent | null {
  if (now[4] && !prev[4]) return "prev";
  if (now[5] && !prev[5]) return "next";
  return null;
}
export const cycle = <T,>(list: readonly T[], at: T, dir: TabIntent): T => {
  const i = Math.max(0, list.indexOf(at));
  return list[(i + (dir === "next" ? 1 : list.length - 1)) % list.length]!;
};
