/** Visual style and timing for class-ability casts (magic, spells, strikes). Pure: AbilityFx only draws what a real CAST event says
 * happened (position, radius, duration); it never applies an effect, spends energy or changes an enemy. */
import type { EffectKind } from "./combat-engine";

export type FxShape = "ring" | "dome" | "pillar" | "burst";
export type FxStyle = { color: string; core: string; shapes: readonly FxShape[]; /** how long the flourish lasts, seconds (capped by the real effect) */ seconds: number };

const STYLES: Record<EffectKind | "NONE", FxStyle> = {
  BLOCK: { color: "#58d8ff", core: "#d6f6ff", shapes: ["dome", "ring"], seconds: 0.9 },
  DAMAGE: { color: "#ff9a3a", core: "#fff0cf", shapes: ["burst", "ring"], seconds: 0.7 },
  DASH: { color: "#9aa8ff", core: "#eef0ff", shapes: ["ring", "pillar"], seconds: 0.55 },
  MARK: { color: "#ff4d6d", core: "#ffe0e6", shapes: ["ring", "pillar"], seconds: 0.9 },
  SILENCE: { color: "#b07cff", core: "#f0e4ff", shapes: ["dome", "ring"], seconds: 0.9 },
  FIELD: { color: "#5dffb0", core: "#d9ffee", shapes: ["ring", "dome"], seconds: 1.1 },
  DOME: { color: "#58d8ff", core: "#d6f6ff", shapes: ["dome", "ring"], seconds: 1.1 },
  COOLDOWN_SHIFT: { color: "#ffd35a", core: "#fff6d6", shapes: ["ring", "pillar"], seconds: 0.8 },
  SIEGE: { color: "#ff7a3a", core: "#ffe7cf", shapes: ["ring", "burst"], seconds: 0.9 },
  VEIL: { color: "#8f7cff", core: "#e6e0ff", shapes: ["dome", "pillar"], seconds: 1 },
  STRIKE: { color: "#ff5a4a", core: "#ffe1db", shapes: ["pillar", "burst", "ring"], seconds: 0.8 },
  TURRET: { color: "#6bd0ff", core: "#dff5ff", shapes: ["ring", "pillar"], seconds: 0.7 },
  NONE: { color: "#8ff0ff", core: "#ffffff", shapes: ["ring"], seconds: 0.6 },
};
export const fxStyle = (effect: EffectKind | "NONE"): FxStyle => STYLES[effect] ?? STYLES.NONE;

export type FxFrame = { active: boolean; /** 0..1 of the flourish */ t: number; ringScale: number; domeScale: number; pillarHeight: number; opacity: number };
const OFF: FxFrame = { active: false, t: 1, ringScale: 0, domeScale: 0, pillarHeight: 0, opacity: 0 };

/** One frame of a cast flourish. `radius` is the REAL effect radius (clamped for readability). Reduced motion: no growth, short fade. */
export function fxFrame(age: number, style: FxStyle, radius: number, reducedMotion = false): FxFrame {
  const len = reducedMotion ? 0.35 : style.seconds;
  if (!(age >= 0) || age >= len) return OFF;
  const t = age / len;
  const r = Math.min(14, Math.max(1.2, radius));
  const out = 1 - Math.pow(1 - t, 3); // fast start, soft landing
  const grow = reducedMotion ? 1 : out;
  return { active: true, t, ringScale: r * (0.25 + 0.75 * grow), domeScale: r * (0.2 + 0.8 * grow), pillarHeight: reducedMotion ? 0 : 3 + 12 * out, opacity: (1 - t) * (1 - t) * 0.9 + 0.05 };
}
