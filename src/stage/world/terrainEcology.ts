// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import { sampleTerrainHeight } from './productionWorldAssets';

export type EcologyBiome = 'verdant' | 'swamp' | 'desert' | 'frost' | 'ember' | 'wasteland' | 'neon';
export type ExclusionZone =
  | { kind: 'circle'; x: number; z: number; radius: number; reason?: 'road' | 'water' | 'building' | 'gameplay' }
  | { kind: 'rect'; minX: number; maxX: number; minZ: number; maxZ: number; reason?: 'road' | 'water' | 'building' | 'gameplay' };

export interface EcologyRules {
  biome: EcologyBiome;
  seed?: number;
  terrainAmplitude?: number;
  maxSlopeDegrees?: number;
  waterLevel?: number;
  waterMargin?: number;
  roadMargin?: number;
  exclusionZones?: ExclusionZone[];
  /** When true, the system only excludes water/roads/buildings and doesn't slope-gate. */
  allowSteepPlacement?: boolean;
}

const DEFAULT_SLOPE: Record<EcologyBiome, number> = {
  verdant: 38, swamp: 18, desert: 42, frost: 52, ember: 48, wasteland: 40, neon: 55,
};

function insideZone(x: number, z: number, zone: ExclusionZone, margin = 0): boolean {
  if (zone.kind === 'circle') return Math.hypot(x - zone.x, z - zone.z) < zone.radius + margin;
  return x >= zone.minX - margin && x <= zone.maxX + margin && z >= zone.minZ - margin && z <= zone.maxZ + margin;
}

export function sampleTerrainSlopeDegrees(x: number, z: number, seed = 1, amplitude = 3, sampleStep = 0.75): number {
  const left = sampleTerrainHeight(x - sampleStep, z, seed, amplitude);
  const right = sampleTerrainHeight(x + sampleStep, z, seed, amplitude);
  const back = sampleTerrainHeight(x, z - sampleStep, seed, amplitude);
  const front = sampleTerrainHeight(x, z + sampleStep, seed, amplitude);
  const dx = (right - left) / (2 * sampleStep);
  const dz = (front - back) / (2 * sampleStep);
  return Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI;
}

/** Shared ecological gate for trees, rocks, grass, props and future foliage scatter. */
export function canPlaceEcology(x: number, z: number, rules: EcologyRules): boolean {
  const seed = rules.seed ?? 1;
  const amplitude = rules.terrainAmplitude ?? (rules.biome === 'desert' ? 1.3 : rules.biome === 'ember' ? 4.5 : 3.1);
  const y = sampleTerrainHeight(x, z, seed, amplitude);
  const waterLevel = rules.waterLevel ?? -Infinity;
  if (y < waterLevel + (rules.waterMargin ?? 0.6)) return false;
  const zones = rules.exclusionZones ?? [];
  for (const zone of zones) {
    const margin = zone.reason === 'road' ? (rules.roadMargin ?? 2.5) : zone.reason === 'water' ? (rules.waterMargin ?? 0.6) : 0;
    if (insideZone(x, z, zone, margin)) return false;
  }
  if (!rules.allowSteepPlacement) {
    const slope = sampleTerrainSlopeDegrees(x, z, seed, amplitude);
    if (slope > (rules.maxSlopeDegrees ?? DEFAULT_SLOPE[rules.biome])) return false;
  }
  return true;
}

export function ecologyDensityMultiplier(biome: EcologyBiome, kind: 'tree' | 'rock' | 'cover'): number {
  const table: Record<EcologyBiome, Record<typeof kind, number>> = {
    verdant: { tree: 1, rock: 0.72, cover: 1.25 }, swamp: { tree: 0.78, rock: 0.58, cover: 1.1 },
    desert: { tree: 0.16, rock: 1.2, cover: 0.22 }, frost: { tree: 0.62, rock: 1, cover: 0.45 },
    ember: { tree: 0.34, rock: 1.12, cover: 0.38 }, wasteland: { tree: 0.28, rock: 1.15, cover: 0.3 },
    neon: { tree: 0.08, rock: 0.42, cover: 0.12 },
  };
  return table[biome][kind];
}
