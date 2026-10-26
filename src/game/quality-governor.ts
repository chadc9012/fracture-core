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
export function onDecline(args: { dpr: number; chosen: RenderTier; cap: RenderTier | null; secondsSinceLastStep: number; floor?: number }): RenderTier | null {
  if (args.dpr > (args.floor ?? DPR_FLOOR) || args.secondsSinceLastStep < MIN_STEP_SECONDS) return null;
  const current = effectiveTier(args.chosen, args.cap);
  const next = stepDownTier(current);
  return next === current ? null : next;
}

/* ---------------- frame pacing (owner, Oct 26 2026: "frame rates are jumpy" on the Galaxy S22 Ultra) ----------------
 * A phone that can't hold 60 swung between ~40 and ~55 fps, and the adaptive resolution flip-flopped with it (each change
 * reallocates every render target: a visible hitch, and at its 0.75 floor the picture went blocky). A steady 30 fps with a
 * fixed, sharper resolution reads smoother than an uneven 45. Pure; tested in quality-governor.test.ts. */
export type FrameRate = 30 | 60 | "max";
/** the default frame cap: 30 on phones and tablets (touch screens), uncapped elsewhere */
export const defaultFrameRate = (touch: boolean): FrameRate => (touch ? 30 : "max");
/** the frame interval for a cap, ms (null: render every display refresh) */
export const frameInterval = (rate: FrameRate): number | null => (rate === "max" ? null : 1000 / rate);
/** phones never drop below a resolution that keeps edges clean (the 0.75 floor is for desktops) */
export const dprFloor = (touch: boolean) => (touch ? 1.25 : DPR_FLOOR);
/** the resolution a phone starts at under the 30 fps cap. R3F's dpr is absolute (pixels per CSS pixel), and a flagship phone
 * screen is ~3.5: at 1.0 the picture was stretched 3.5x and looked blocky (owner phone shots, Oct 26). 2.0 is about 1.3 MP. */
export const PHONE_DPR = 2;
/** the highest tier a phone runs: HIGH and ULTRA could not hold on the owner's Galaxy S22 Ultra, and the automatic step-down from
 * them mid-play remounted the world (a visible hitch every time). */
export const PHONE_MAX_TIER: RenderTier = "MEDIUM";
/** the tier used on a touch screen: never above PHONE_MAX_TIER */
export const phoneTier = (t: RenderTier, touch: boolean): RenderTier => (touch && ORDER.indexOf(t) > ORDER.indexOf(PHONE_MAX_TIER) ? PHONE_MAX_TIER : t);
/** fps bounds for the performance monitor: a decline only when the cap itself can't be held, an incline only near it */
export function monitorBounds(rate: FrameRate): [number, number] {
  return rate === "max" ? [45, 58] : [rate * 0.82, rate * 0.97];
}
/** one step down in resolution on a decline, never past the floor */
export const dprDown = (d: number, touch: boolean) => Math.max(dprFloor(touch), Math.round((d - 0.25) * 100) / 100);
/** on an incline: desktops step back up; phones hold their resolution (stepping up and down again was the hitching) */
export const dprUp = (d: number, touch: boolean, max = 2) => (touch ? d : Math.min(max, d + 0.25));
