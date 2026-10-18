// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import * as THREE from 'three';
import type { BiomeId } from './productionWorldAssets';

export interface SurfaceMaterialSpec {
  color: string;
  roughness: number;
  metalness: number;
  repeat: [number, number];
  bumpScale: number;
  grain: 'soil' | 'sand' | 'rock' | 'snow' | 'asphalt' | 'moss';
}

export const SURFACE_MATERIALS: Record<BiomeId, SurfaceMaterialSpec> = {
  verdant: { color: '#8d9a72', roughness: 0.94, metalness: 0.01, repeat: [18, 18], bumpScale: 0.16, grain: 'soil' },
  swamp: { color: '#64705a', roughness: 0.98, metalness: 0.01, repeat: [16, 16], bumpScale: 0.2, grain: 'moss' },
  desert: { color: '#d5ad70', roughness: 0.91, metalness: 0, repeat: [20, 20], bumpScale: 0.12, grain: 'sand' },
  frost: { color: '#d9e8ed', roughness: 0.42, metalness: 0.03, repeat: [16, 16], bumpScale: 0.08, grain: 'snow' },
  ember: { color: '#80685a', roughness: 0.93, metalness: 0.02, repeat: [14, 14], bumpScale: 0.23, grain: 'rock' },
  wasteland: { color: '#a49a84', roughness: 0.96, metalness: 0.02, repeat: [18, 18], bumpScale: 0.2, grain: 'rock' },
  neon: { color: '#737b88', roughness: 0.47, metalness: 0.22, repeat: [24, 24], bumpScale: 0.06, grain: 'asphalt' },
};

const GRAIN_COLORS: Record<SurfaceMaterialSpec['grain'], [number, number, number]> = {
  soil: [104, 91, 68], sand: [181, 143, 91], rock: [104, 101, 97], snow: [205, 222, 228], asphalt: [74, 82, 91], moss: [73, 89, 66],
};

/** Generates deterministic, tileable-style microtexture maps in-browser without external assets. */
export function createSurfaceMaps(spec: SurfaceMaterialSpec, seed = 17, resolution = 256): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } | null {
  if (typeof document === 'undefined') return null;
  const makeCanvas = () => { const canvas = document.createElement('canvas'); canvas.width = resolution; canvas.height = resolution; return canvas; };
  let state = seed >>> 0;
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
  const colorCanvas = makeCanvas(), bumpCanvas = makeCanvas(), roughCanvas = makeCanvas();
  const colorCtx = colorCanvas.getContext('2d'), bumpCtx = bumpCanvas.getContext('2d'), roughCtx = roughCanvas.getContext('2d');
  if (!colorCtx || !bumpCtx || !roughCtx) return null;
  const base = GRAIN_COLORS[spec.grain];
  const colorImage = colorCtx.createImageData(resolution, resolution);
  const bumpImage = bumpCtx.createImageData(resolution, resolution);
  const roughImage = roughCtx.createImageData(resolution, resolution);
  for (let i = 0; i < resolution * resolution; i++) {
    const noise = (random() - 0.5) * (spec.grain === 'asphalt' ? 48 : 34);
    const pore = random();
    for (let c = 0; c < 3; c++) colorImage.data[i * 4 + c] = Math.max(0, Math.min(255, base[c] + noise + (pore > 0.985 ? -26 : 0)));
    colorImage.data[i * 4 + 3] = 255;
    const height = Math.max(0, Math.min(255, 128 + noise * 2 + (pore > 0.97 ? 45 : -4)));
    bumpImage.data[i * 4] = bumpImage.data[i * 4 + 1] = bumpImage.data[i * 4 + 2] = height; bumpImage.data[i * 4 + 3] = 255;
    const rough = Math.max(0, Math.min(255, spec.roughness * 255 + (random() - 0.5) * 35));
    roughImage.data[i * 4] = roughImage.data[i * 4 + 1] = roughImage.data[i * 4 + 2] = rough; roughImage.data[i * 4 + 3] = 255;
  }
  colorCtx.putImageData(colorImage, 0, 0); bumpCtx.putImageData(bumpImage, 0, 0); roughCtx.putImageData(roughImage, 0, 0);
  const configure = (canvas: HTMLCanvasElement, color = false) => { const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(...spec.repeat); texture.anisotropy = 4; texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace; texture.needsUpdate = true; return texture; };
  return { map: configure(colorCanvas, true), bumpMap: configure(bumpCanvas), roughnessMap: configure(roughCanvas) };
}

export function surfaceMaterialProps(biome: BiomeId) {
  const { color, roughness, metalness, bumpScale } = SURFACE_MATERIALS[biome];
  return { color, roughness, metalness, bumpScale };
}
