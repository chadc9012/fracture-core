/** The player's own waypoint: set from the atlas (a marker or any point on the map), shown on the HUD compass and
 * tracker with live distance and direction, and cleared on arrival. It is navigation presentation, like key bindings,
 * so it persists client-side (localStorage) rather than in the progression save; discovered landmarks and completed
 * activities already live in the save. */
import type { Marker, MarkerKind } from "./waypoints";

export type MapPin = { id: string; label: string; x: number; z: number; source: MarkerKind | "MAP" };
export const PIN_KEY = "world-fracture-waypoint";
/** within this many metres the waypoint counts as reached */
export const ARRIVE_RADIUS = 12;

let current: MapPin | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}
function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = storage()?.getItem(PIN_KEY);
    const v = raw ? (JSON.parse(raw) as MapPin) : null;
    current = v && Number.isFinite(v.x) && Number.isFinite(v.z) && typeof v.label === "string" ? v : null;
  } catch { current = null; }
}

export function getPin(): MapPin | null { load(); return current; }
export function setPin(pin: MapPin | null): void {
  load();
  current = pin;
  try { if (pin) storage()?.setItem(PIN_KEY, JSON.stringify(pin)); else storage()?.removeItem(PIN_KEY); } catch { /* private mode: keep it for this session */ }
  listeners.forEach((l) => l());
}
export function subscribePin(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

export const pinFromMarker = (m: Pick<Marker, "id" | "label" | "x" | "z" | "kind">): MapPin => ({ id: m.id, label: m.label, x: m.x, z: m.z, source: m.kind });
export const pinAt = (x: number, z: number): MapPin => ({ id: `map-${Math.round(x)}-${Math.round(z)}`, label: "Custom waypoint", x, z, source: "MAP" });
/** the pin as a live marker for the compass/tracker pipeline */
export const pinMarker = (pin: MapPin, regionId = ""): Marker => ({ id: "pin", kind: "WAYPOINT", label: pin.label, x: pin.x, z: pin.z, regionId });
export const reached = (pin: MapPin, x: number, z: number) => Math.hypot(pin.x - x, pin.z - z) <= ARRIVE_RADIUS;

/** test hook: forget the in-memory copy so the next read reloads from storage */
export function resetPinCache(): void { loaded = false; current = null; }
