/** Automatic quality step-down. Resolution is lowered first (adaptive dpr); once it is at its floor and the frame rate is still
 * poor, the effective tier drops one level. It never goes up on its own and never changes the saved setting. */
import type { RenderTier } from "./performance";

const ORDER: RenderTier[] = ["LOW", "MEDIUM", "HIGH", "ULTRA"];
export const DPR_FLOOR = 0.75;
export const MIN_STEP_SECONDS = 8;
/** The automatic cap never goes below MEDIUM: LOW strips the forest (procedural blobs, 60% foliage), which cost the player
 * their trees for little frame time. Players can still choose LOW themselves in Settings. */
export const AUTO_FLOOR: RenderTier = "MEDIUM";
export const stepDownTier = (t: RenderTier): RenderTier => ORDER[Math.max(ORDER.indexOf(AUTO_FLOOR), ORDER.indexOf(t) - 1)]!;
/** the tier actually used: the lower of what the player chose and the automatic cap */
export const effectiveTier = (chosen: RenderTier, cap: RenderTier | null): RenderTier => (cap && ORDER.indexOf(cap) < ORDER.indexOf(chosen) ? cap : chosen);
/** decide on a performance decline: returns the new cap, or null when nothing should change yet */
export function onDecline(args: { dpr: number; chosen: RenderTier; cap: RenderTier | null; secondsSinceLastStep: number }): RenderTier | null {
  if (args.dpr > DPR_FLOOR || args.secondsSinceLastStep < MIN_STEP_SECONDS) return null;
  const current = effectiveTier(args.chosen, args.cap);
  const next = stepDownTier(current);
  return next === current ? null : next;
}
