/** Where Continue / Resume puts you (owner, Nov 2: "why am I loading into the forest for the first mission"). The world is
 * unmounted on the map and title screens, and the player always mounted at Scene's SPAWN in the Verdant Forest — the old
 * calibration start — so every Resume, and every app start, dropped a save that had finished the Nexus City opening back in
 * the forest, with Awakening starting there. Now: the last place you stood on foot outdoors (remembered per profile and
 * character), else the street outside the Nexus City Residences, where the story starts. Saves still in the old forest
 * calibration keep the forest. Pure apart from the small storage helpers. */
import { profileKey } from "./save-profile";
import { WORLD_RADIUS } from "./world";

export type Spot = { x: number; z: number };
type Save = { tutorialComplete: boolean; tutorialRun: unknown; completedMissions: readonly string[]; character?: { deploymentId?: string } | null };

const KEY = "wf.resume-spot.v1";
/** a sane outdoor position: finite and inside the walkable world (the Fracture Gate descents and pocket rooms sit outside it) */
export const validSpot = (s: unknown): s is Spot => {
  const o = s as Spot | null;
  return !!o && Number.isFinite(o.x) && Number.isFinite(o.z) && Math.hypot(o.x, o.z) < WORLD_RADIUS;
};
/** a save still part-way through the original Verdant Forest calibration resumes there (its steps are anchored to the forest) */
export const inForestCalibration = (p: Save) => !p.tutorialComplete && !!p.tutorialRun && !p.completedMissions.includes("mission-01");

/** where to put the player on a fresh Resume: null keeps the default (forest) spawn */
export function resumeSpot(p: Save, remembered: Spot | null, home: Spot): Spot | null {
  if (inForestCalibration(p)) return null;
  return remembered && validSpot(remembered) ? remembered : home;
}

const keyFor = (p: Save) => profileKey(`${KEY}.${p.character?.deploymentId ?? "none"}`);
export function loadSpot(p: Save): Spot | null {
  try { const raw = localStorage.getItem(keyFor(p)); if (!raw) return null; const s = JSON.parse(raw) as unknown; return validSpot(s) ? { x: s.x, z: s.z } : null; } catch { return null; }
}
export function saveSpot(p: Save, s: Spot) {
  if (!validSpot(s)) return;
  try { localStorage.setItem(keyFor(p), JSON.stringify({ x: Math.round(s.x * 10) / 10, z: Math.round(s.z * 10) / 10 })); } catch { /* storage full or blocked: Resume falls back to the Residences */ }
}
