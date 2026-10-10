/** Destiny-style drop-in transition for fast travel from the star map: charge (screen gathers light) -> warp (star streaks, the world swaps
 * underneath while fully covered) -> arrive (destination card, cover lifts). Pure timeline: it only says what the overlay should draw and
 * when the teleport may happen; it never moves the player or touches progression, so it can never grant or lose anything. */
export interface TransitPlan { charge: number; warp: number; arrive: number; /** seconds the world gets to settle after the swap before the cover lifts */ settle: number }
export const TRANSIT_PLAN: TransitPlan = { charge: 0.9, warp: 1.1, arrive: 1.0, settle: 0.8 };
/** Reduced motion: no streaks, one short fade in and out. */
export const TRANSIT_PLAN_REDUCED: TransitPlan = { charge: 0.25, warp: 0.2, arrive: 0.35, settle: 0.4 };

export const transitPlan = (reduced: boolean): TransitPlan => (reduced ? TRANSIT_PLAN_REDUCED : TRANSIT_PLAN);
/** Seconds from start until the world may be swapped (everything is covered). */
export const swapAt = (p: TransitPlan) => p.charge + p.warp * 0.5;
export const totalSeconds = (p: TransitPlan) => p.charge + p.warp + p.settle + p.arrive;

export type TransitPhase = "charge" | "warp" | "settle" | "arrive" | "done";
export interface TransitFrame {
  phase: TransitPhase;
  /** 0..1 opacity of the full-screen cover */
  cover: number;
  /** 0..1 intensity of the star streaks (0 under reduced motion) */
  streak: number;
  /** 0..1 white-hot flash at the swap */
  flash: number;
  /** 0..1 how visible the destination card is */
  card: number;
  /** true from the swap moment on */
  swapped: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t: number) => t * t * (3 - 2 * t);

export function transitFrame(elapsed: number, p: TransitPlan, reduced = false): TransitFrame {
  const t = Math.max(0, elapsed);
  const warpEnd = p.charge + p.warp, settleEnd = warpEnd + p.settle, end = settleEnd + p.arrive;
  const swap = swapAt(p);
  const swapped = t >= swap;
  if (t >= end) return { phase: "done", cover: 0, streak: 0, flash: 0, card: 0, swapped: true };
  let phase: TransitPhase, cover: number, streak: number;
  if (t < p.charge) { phase = "charge"; cover = ease(t / p.charge) * 0.85; streak = ease(t / p.charge) * 0.35; }
  else if (t < warpEnd) { phase = "warp"; const k = (t - p.charge) / p.warp; cover = 0.85 + 0.15 * ease(clamp01(k * 2)); streak = 0.35 + 0.65 * Math.sin(Math.min(1, k) * Math.PI); }
  else if (t < settleEnd) { phase = "settle"; cover = 1; streak = 0; }
  else { phase = "arrive"; cover = 1 - ease((t - settleEnd) / p.arrive); streak = 0; }
  // the cover must be total at the swap instant, whatever the plan
  if (t >= p.charge && t < settleEnd) cover = 1;
  const flash = clamp01(1 - Math.abs(t - swap) / 0.18) * (reduced ? 0 : 1);
  const card = t < p.charge * 0.6 ? 0 : t < settleEnd + p.arrive * 0.5 ? clamp01((t - p.charge * 0.6) / 0.4) : clamp01(1 - (t - settleEnd - p.arrive * 0.5) / (p.arrive * 0.5));
  return { phase, cover: clamp01(cover), streak: reduced ? 0 : clamp01(streak), flash, card, swapped };
}
