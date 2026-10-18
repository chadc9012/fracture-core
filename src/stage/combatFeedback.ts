// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
export type ImpactClass = 'light' | 'heavy' | 'ability' | 'boss';
export type CombatFeedback = {
  impact: ImpactClass;
  hitPoint: [number, number, number];
  normal?: [number, number, number];
  intensity?: number;
};

/** Pure tuning table; wire these values into the game's existing pooled VFX/audio/haptics systems. */
export const COMBAT_FEEDBACK: Record<ImpactClass, {
  flashMs: number; particles: number; cameraImpulse: number; haptic: number; soundBus: string;
}> = {
  light:  { flashMs: 55,  particles: 4,  cameraImpulse: 0.015, haptic: 0.12, soundBus: 'weapon.impact.light' },
  heavy:  { flashMs: 105, particles: 12, cameraImpulse: 0.055, haptic: 0.42, soundBus: 'weapon.impact.heavy' },
  ability:{ flashMs: 145, particles: 22, cameraImpulse: 0.075, haptic: 0.55, soundBus: 'ability.impact' },
  boss:   { flashMs: 180, particles: 30, cameraImpulse: 0.09,  haptic: 0.72, soundBus: 'boss.impact' },
};

/** Avoid unbounded effect bursts when many projectiles hit during one frame. */
export function clampFeedbackIntensity(value = 1): number {
  return Math.max(0, Math.min(1.5, Number.isFinite(value) ? value : 1));
}
