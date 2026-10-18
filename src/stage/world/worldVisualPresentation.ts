// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import { buildVisualFrame, getVisualRegion, type QualityTier, type VisualFrame, type VisualFrameInput, type WorldRegionId, type WeatherId } from './worldVisualRuntime';

export interface SceneVisualSettings {
  fog: { color: string; density: number };
  ambient: { intensity: number };
  keyLight: { intensity: number; color: string; position: [number, number, number] };
  fractureLight: { intensity: number; color: string; distance: number };
  exposure: number;
  saturation: number;
  wetness: number;
  wind: number;
  particleOpacity: { rain: number; snow: number; ash: number; sand: number };
  quality: VisualFrame['quality'];
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const hex = (rgb: { r: number; g: number; b: number }) => {
  const channel = (n: number) => Math.round(clamp(n, 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
};

/** Converts the pure visual frame into renderer-ready settings without importing Three.js. */
export function toSceneVisualSettings(frame: VisualFrame): SceneVisualSettings {
  return {
    fog: { color: hex(frame.fogColor), density: frame.fogDensity },
    ambient: { intensity: frame.ambientIntensity },
    keyLight: { intensity: frame.keyLightIntensity, color: '#fff0dc', position: [-80, 140, 65] },
    fractureLight: { intensity: frame.fractureGlow, color: '#9b4dff', distance: 36 },
    exposure: frame.exposure,
    saturation: frame.saturation,
    wetness: frame.wetness,
    wind: frame.wind,
    particleOpacity: { rain: frame.rainOpacity, snow: frame.snowOpacity, ash: frame.ashOpacity, sand: frame.sandOpacity },
    quality: frame.quality,
  };
}

export function buildSceneVisualSettings(input: VisualFrameInput): SceneVisualSettings {
  return toSceneVisualSettings(buildVisualFrame(input));
}

export interface VisualTransitionState { current: SceneVisualSettings | null }
export function createVisualTransitionState(): VisualTransitionState { return { current: null }; }

/** Exponential smoothing; stable across frame rates and safe for large frame gaps. */
export function transitionVisualSettings(state: VisualTransitionState, target: SceneVisualSettings, deltaSeconds: number, speed = 2.8): SceneVisualSettings {
  const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.1);
  const alpha = 1 - Math.exp(-Math.max(0, speed) * dt);
  const previous = state.current;
  if (!previous) {
    state.current = target;
    return target;
  }
  const mix = (a: number, b: number) => a + (b - a) * alpha;
  const parseHex = (value: string) => ({ r: parseInt(value.slice(1, 3), 16) / 255, g: parseInt(value.slice(3, 5), 16) / 255, b: parseInt(value.slice(5, 7), 16) / 255 });
  const oldFog = parseHex(previous.fog.color), newFog = parseHex(target.fog.color);
  const next: SceneVisualSettings = {
    ...target,
    fog: { color: hex({ r: mix(oldFog.r, newFog.r), g: mix(oldFog.g, newFog.g), b: mix(oldFog.b, newFog.b) }), density: mix(previous.fog.density, target.fog.density) },
    ambient: { intensity: mix(previous.ambient.intensity, target.ambient.intensity) },
    keyLight: { ...target.keyLight, intensity: mix(previous.keyLight.intensity, target.keyLight.intensity) },
    fractureLight: { ...target.fractureLight, intensity: mix(previous.fractureLight.intensity, target.fractureLight.intensity) },
    exposure: mix(previous.exposure, target.exposure),
    saturation: mix(previous.saturation, target.saturation),
    wetness: mix(previous.wetness, target.wetness),
    wind: mix(previous.wind, target.wind),
    particleOpacity: {
      rain: mix(previous.particleOpacity.rain, target.particleOpacity.rain),
      snow: mix(previous.particleOpacity.snow, target.particleOpacity.snow),
      ash: mix(previous.particleOpacity.ash, target.particleOpacity.ash),
      sand: mix(previous.particleOpacity.sand, target.particleOpacity.sand),
    },
  };
  state.current = next;
  return next;
}

export function makeVisualInput(regionId: WorldRegionId, weather: WeatherId, timeOfDay: number, fractureIntensity: number, quality: QualityTier, deltaSeconds: number): VisualFrameInput {
  return { regionId, weather, timeOfDay, fractureIntensity, quality, deltaSeconds };
}

export function getRegionVisualTags(regionId: WorldRegionId): string[] {
  return [...getVisualRegion(regionId).materialTags];
}
