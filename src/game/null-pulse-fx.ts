/** Pure timing/shape rules for the Null Disruption pulse effect (drawn by NullPulseFx.tsx). The effect is driven ONLY by
 * sim.nullPulse (set when the perk really fires) and uses the real stun radius, so what the player sees is the area that
 * was actually stunned. It shows a shockwave; it never implies a shield was removed (the game has no enemy shields). */
export type PulseFxTier = "LOW" | "MEDIUM" | "HIGH" | "ULTRA";
export const PULSE_FX_SECONDS = 0.9;
export const PULSE_FX_REDUCED_SECONDS = 0.45;

export type PulseFrame = { active: boolean; ringScale: number; ringOpacity: number; domeOpacity: number };
const OFF: PulseFrame = { active: false, ringScale: 0, ringOpacity: 0, domeOpacity: 0 };

/** @param age seconds since the pulse fired. Ring scale is a fraction of the real pulse radius (1 = full radius). */
export function pulseFrame(age: number, opts: { reducedMotion: boolean; tier: PulseFxTier }): PulseFrame {
  const dur = opts.reducedMotion ? PULSE_FX_REDUCED_SECONDS : PULSE_FX_SECONDS;
  if (!(age >= 0) || age >= dur) return OFF;
  const k = age / dur;
  const fade = 1 - k;
  return {
    active: true,
    // reduced motion: no expansion, the full-radius ring just fades (a brief flash of the affected area)
    ringScale: opts.reducedMotion ? 1 : 1 - Math.pow(1 - k, 3),
    ringOpacity: 0.85 * fade,
    // the soft dome is the costly layer: skipped on LOW and under reduced motion
    domeOpacity: opts.reducedMotion || opts.tier === "LOW" ? 0 : 0.22 * fade * fade,
  };
}
