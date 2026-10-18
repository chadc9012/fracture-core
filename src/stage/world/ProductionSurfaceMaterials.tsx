// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { SURFACE_MATERIALS, createSurfaceMaps } from './productionSurfaceMaterials';
import type { BiomeId } from './productionWorldAssets';

/** Drop-in detailed surface for roads, terrain patches, rocks, and set dressing. */
export function ProductionSurfaceMaterial({ biome, seed = 17, color, roughness, metalness }: {
  biome: BiomeId; seed?: number; color?: string; roughness?: number; metalness?: number;
}) {
  const spec = SURFACE_MATERIALS[biome];
  const maps = useMemo(() => createSurfaceMaps(spec, seed), [spec, seed]);
  useEffect(() => () => { maps?.map.dispose(); maps?.bumpMap.dispose(); maps?.roughnessMap.dispose(); }, [maps]);
  return <meshStandardMaterial
    color={color ?? '#ffffff'} map={maps?.map} bumpMap={maps?.bumpMap} bumpScale={spec.bumpScale}
    roughness={roughness ?? spec.roughness} roughnessMap={maps?.roughnessMap} metalness={metalness ?? spec.metalness}
  />;
}

/** Reusable physically based material preset for existing geometry. */
export function createProductionSurfaceMaterial(biome: BiomeId, seed = 17): THREE.MeshStandardMaterial {
  const spec = SURFACE_MATERIALS[biome];
  const maps = createSurfaceMaps(spec, seed);
  return new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: spec.roughness, metalness: spec.metalness, bumpScale: spec.bumpScale, map: maps?.map, bumpMap: maps?.bumpMap, roughnessMap: maps?.roughnessMap });
}
