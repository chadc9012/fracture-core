// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
export type WaterKind = 'ocean' | 'river' | 'lake' | 'waterfall' | 'underwater';
export interface WaterProfile {
  colorShallow: string;
  colorDeep: string;
  opacity: number;
  roughness: number;
  waveAmplitude: number;
  waveFrequency: number;
  waveSpeed: number;
  currentX: number;
  currentZ: number;
  foamStrength: number;
  causticStrength: number;
  fogDensity: number;
}

const PROFILES: Record<WaterKind, WaterProfile> = {
  ocean: { colorShallow: '#3a9da5', colorDeep: '#062b4b', opacity: 0.94, roughness: 0.18, waveAmplitude: 0.22, waveFrequency: 0.09, waveSpeed: 0.85, currentX: 0.22, currentZ: 0.08, foamStrength: 0.62, causticStrength: 0.25, fogDensity: 0.012 },
  river: { colorShallow: '#75c8c5', colorDeep: '#164e68', opacity: 0.9, roughness: 0.23, waveAmplitude: 0.075, waveFrequency: 0.17, waveSpeed: 1.6, currentX: 0.78, currentZ: 0.14, foamStrength: 0.45, causticStrength: 0.18, fogDensity: 0.018 },
  lake: { colorShallow: '#6ab6bb', colorDeep: '#17465e', opacity: 0.91, roughness: 0.14, waveAmplitude: 0.035, waveFrequency: 0.12, waveSpeed: 0.48, currentX: 0.02, currentZ: 0.01, foamStrength: 0.22, causticStrength: 0.28, fogDensity: 0.014 },
  waterfall: { colorShallow: '#c3f1f5', colorDeep: '#4b9da9', opacity: 0.86, roughness: 0.27, waveAmplitude: 0.13, waveFrequency: 0.24, waveSpeed: 2.35, currentX: 0.05, currentZ: 0.92, foamStrength: 0.94, causticStrength: 0.12, fogDensity: 0.035 },
  underwater: { colorShallow: '#147c8a', colorDeep: '#031a3b', opacity: 0.98, roughness: 0.24, waveAmplitude: 0.018, waveFrequency: 0.08, waveSpeed: 0.25, currentX: 0.11, currentZ: 0.04, foamStrength: 0.08, causticStrength: 0.72, fogDensity: 0.055 },
};

export function getWaterProfile(kind: WaterKind): WaterProfile { return { ...PROFILES[kind] }; }

/** Two crossed waves with a small directional current; deterministic for stable tests and replay. */
export function sampleWaterHeight(x: number, z: number, time: number, profile: WaterProfile): number {
  const t = time * profile.waveSpeed;
  const a = Math.sin((x + profile.currentX * t) * profile.waveFrequency + t);
  const b = Math.cos((z + profile.currentZ * t) * profile.waveFrequency * 1.31 - t * 0.73);
  return (a * 0.66 + b * 0.34) * profile.waveAmplitude;
}

export function sampleWaterCurrent(profile: WaterProfile): { x: number; z: number; speed: number } {
  const speed = Math.hypot(profile.currentX, profile.currentZ);
  return speed < 1e-8 ? { x: 0, z: 0, speed: 0 } : { x: profile.currentX / speed, z: profile.currentZ / speed, speed };
}

/** Approximate shore foam weight from water depth in world units. Needs actual terrain/water depth at integration. */
export function shorelineFoamWeight(depth: number, foamStrength: number, bandWidth = 1.8): number {
  if (![depth, foamStrength, bandWidth].every(Number.isFinite) || bandWidth <= 0 || depth < 0) return 0;
  const t = Math.max(0, Math.min(1, depth / bandWidth));
  return Math.max(0, Math.min(1, (1 - t) * foamStrength));
}

export function underwaterVisibility(distance: number, fogDensity: number): number {
  if (!Number.isFinite(distance) || !Number.isFinite(fogDensity) || distance < 0 || fogDensity < 0) return 0;
  return Math.exp(-distance * fogDensity);
}
