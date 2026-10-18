// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import * as THREE from 'three';

export type BiomeId = 'verdant' | 'swamp' | 'desert' | 'frost' | 'ember' | 'wasteland' | 'neon';
export interface BiomePalette { low: string; mid: string; high: string; roughness: number; metalness: number; }
export const BIOME_PALETTES: Record<BiomeId, BiomePalette> = {
  verdant: { low: '#263b2b', mid: '#526947', high: '#9a9b68', roughness: 0.92, metalness: 0.02 },
  swamp: { low: '#182b27', mid: '#394b3c', high: '#69715a', roughness: 0.96, metalness: 0.01 },
  desert: { low: '#674a30', mid: '#b58a53', high: '#e3c58a', roughness: 0.88, metalness: 0.01 },
  frost: { low: '#526775', mid: '#b9d0d8', high: '#f0fbff', roughness: 0.48, metalness: 0.04 },
  ember: { low: '#302521', mid: '#665046', high: '#a56d48', roughness: 0.9, metalness: 0.03 },
  wasteland: { low: '#39352f', mid: '#777063', high: '#aaa08b', roughness: 0.94, metalness: 0.02 },
  neon: { low: '#171d28', mid: '#303944', high: '#59616c', roughness: 0.5, metalness: 0.18 },
};

export function hashNoise(x: number, z: number, seed = 1): number {
  const v = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
  return (v - Math.floor(v)) * 2 - 1;
}

export function sampleTerrainHeight(x: number, z: number, seed = 1, amplitude = 3): number {
  const broad = Math.sin(x * 0.055 + seed) * Math.cos(z * 0.047 - seed * 0.7) * 0.58;
  const detail = hashNoise(Math.round(x * 0.7), Math.round(z * 0.7), seed) * 0.16;
  return (broad + detail) * amplitude;
}

export function buildTerrainVertexColors(width: number, depth: number, segments: number, palette: BiomePalette, seed = 1): Float32Array {
  const geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const low = new THREE.Color(palette.low), mid = new THREE.Color(palette.mid), high = new THREE.Color(palette.high);
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    const height = sampleTerrainHeight(x, z, seed);
    positions.setY(i, height);
    const t = THREE.MathUtils.clamp((height + 2.2) / 4.4 + hashNoise(x * 0.3, z * 0.3, seed) * 0.12, 0, 1);
    const color = t < 0.52 ? low.clone().lerp(mid, t / 0.52) : mid.clone().lerp(high, (t - 0.52) / 0.48);
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
  }
  geometry.dispose();
  return colors;
}

export interface WaterParameters { color: string; opacity: number; roughness: number; waveAmplitude: number; waveSpeed: number; }
export function getWaterParameters(kind: 'ocean' | 'river' | 'lake' | 'waterfall' | 'underwater'): WaterParameters {
  const table: Record<typeof kind, WaterParameters> = {
    ocean: { color: '#12546b', opacity: 0.88, roughness: 0.18, waveAmplitude: 0.19, waveSpeed: 0.9 },
    river: { color: '#347f91', opacity: 0.78, roughness: 0.24, waveAmplitude: 0.07, waveSpeed: 1.5 },
    lake: { color: '#286477', opacity: 0.8, roughness: 0.13, waveAmplitude: 0.035, waveSpeed: 0.55 },
    waterfall: { color: '#b6e5f2', opacity: 0.72, roughness: 0.28, waveAmplitude: 0.12, waveSpeed: 2.4 },
    underwater: { color: '#0b465c', opacity: 0.94, roughness: 0.25, waveAmplitude: 0.02, waveSpeed: 0.3 },
  };
  return { ...table[kind] };
}

export function buildFracturePolyline(seed = 1, points = 24, length = 18): THREE.Vector3[] {
  const result: THREE.Vector3[] = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const x = (t - 0.5) * length;
    const z = hashNoise(i * 1.7, seed, seed) * 0.7;
    const y = 0.04 + Math.abs(hashNoise(i, seed * 0.37, seed)) * 0.16;
    result.push(new THREE.Vector3(x, y, z));
  }
  return result;
}
