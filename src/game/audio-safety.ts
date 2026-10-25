/** Shared signal headroom; channel settings retain their independent mute controls. */
export const AUDIO_SAFETY = { effectsGain: 0.58, attackSeconds: 0.003, reverbGain: 0.14, maxDrive: 1.6 } as const;
export function unitVolume(value: number): number { return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; }
export function envelopeAttack(duration: number): number { return Math.min(AUDIO_SAFETY.attackSeconds, Math.max(0.0001, duration * 0.25)); }
