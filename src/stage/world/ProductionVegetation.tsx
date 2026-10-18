// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sampleTerrainHeight } from './productionWorldAssets';
import { canPlaceEcology, ecologyDensityMultiplier, type ExclusionZone } from './terrainEcology';

type Biome = 'verdant' | 'swamp' | 'frost' | 'ember' | 'wasteland' | 'desert';
type Props = { biome?: Biome; count?: number; rockCount?: number; groundCoverCount?: number; area?: number; seed?: number; treeScale?: number; position?: [number, number, number]; exclusionZones?: ExclusionZone[]; waterLevel?: number; maxSlopeDegrees?: number; };
type InstanceData = { matrix: THREE.Matrix4; color: THREE.Color };

const PALETTES: Record<Biome, { leaves: string[]; trunk: string; rock: string; ground: string[] }> = {
  verdant: { leaves: ['#315d37', '#467d43', '#6a934b'], trunk: '#57402b', rock: '#62675c', ground: ['#658746', '#819c50', '#496d3d'] },
  swamp: { leaves: ['#263f32', '#405b45', '#596b42'], trunk: '#40352b', rock: '#555b50', ground: ['#536b43', '#6a7842', '#354e36'] },
  frost: { leaves: ['#52757a', '#78949c', '#a7bdc1'], trunk: '#554b43', rock: '#87949a', ground: ['#b7c9c8', '#d3dddd', '#7e9a9c'] },
  ember: { leaves: ['#493b31', '#75402d', '#a6532e'], trunk: '#3c3029', rock: '#65544b', ground: ['#87503a', '#a16a43', '#5d4135'] },
  wasteland: { leaves: ['#575b43', '#73734b', '#8c8252'], trunk: '#504332', rock: '#79766d', ground: ['#8b825b', '#a19a70', '#6c704c'] },
  desert: { leaves: ['#69714a', '#89905a', '#a0a36a'], trunk: '#68523a', rock: '#b39b76', ground: ['#b9a06d', '#d1b982', '#9a895e'] },
};

function seeded(seed: number) { let s = seed >>> 0; return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; }; }
function makeInstances(count: number, area: number, seed: number, biome: Biome, kind: 'tree' | 'rock' | 'cover', treeScale: number, exclusionZones: ExclusionZone[], waterLevel: number | undefined, maxSlopeDegrees: number | undefined): InstanceData[] {
  const rand = seeded(seed + (kind === 'tree' ? 0 : kind === 'rock' ? 9137 : 19411));
  const out: InstanceData[] = []; const dummy = new THREE.Object3D(); const palette = PALETTES[biome];
  let attempts = 0;
  while (out.length < count && attempts < count * 12 + 24) {
    attempts++;
    const x = (rand() - 0.5) * area, z = (rand() - 0.5) * area;
    if (!canPlaceEcology(x, z, { biome, seed, exclusionZones, waterLevel, maxSlopeDegrees })) continue;
    const y = sampleTerrainHeight(x, z, seed, biome === 'desert' ? 1.3 : biome === 'ember' ? 4.5 : 3.1);
    let color: string;
    if (kind === 'tree') {
      const h = treeScale * (biome === 'frost' ? 4.2 : 3.4) * (0.68 + rand() * 0.78);
      dummy.position.set(x, y + h * 0.38, z); dummy.rotation.set((rand() - 0.5) * 0.08, rand() * Math.PI * 2, (rand() - 0.5) * 0.08);
      dummy.scale.set(treeScale * (0.62 + rand() * 0.55), h, treeScale * (0.62 + rand() * 0.55)); color = palette.leaves[Math.floor(rand() * palette.leaves.length)];
    } else if (kind === 'rock') {
      const scale = 0.35 + rand() * (biome === 'desert' ? 1.25 : 0.95);
      dummy.position.set(x, y + scale * 0.35, z); dummy.rotation.set(rand() * 0.8, rand() * Math.PI * 2, rand() * 0.7); dummy.scale.set(scale * (0.8 + rand() * 0.8), scale * (0.45 + rand() * 0.65), scale * (0.8 + rand() * 0.9)); color = palette.rock;
    } else {
      const scale = 0.25 + rand() * 0.55;
      dummy.position.set(x, y + scale * 0.18, z); dummy.rotation.set(0, rand() * Math.PI * 2, (rand() - 0.5) * 0.15); dummy.scale.set(scale * (0.7 + rand() * 0.8), scale * (0.8 + rand() * 1.6), scale * (0.7 + rand() * 0.8)); color = palette.ground[Math.floor(rand() * palette.ground.length)];
    }
    dummy.updateMatrix(); out.push({ matrix: dummy.matrix.clone(), color: new THREE.Color(color) });
  }
  return out;
}

function InstanceLayer({ data, geometry, roughness = 0.88, metalness = 0 }: { data: InstanceData[]; geometry: THREE.BufferGeometry; roughness?: number; metalness?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => { const mesh = ref.current; if (!mesh) return; data.forEach((item, i) => { mesh.setMatrixAt(i, item.matrix); mesh.setColorAt(i, item.color); }); mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }, [data]);
  if (!data.length) return null;
  return <instancedMesh ref={ref} args={[geometry, undefined, data.length]} castShadow receiveShadow><meshStandardMaterial color="white" roughness={roughness} metalness={metalness} /></instancedMesh>;
}

/** Instanced, deterministic vegetation and rock dressing. Host terrain should use the same seed and height function. */
export function ProductionVegetation({ biome = 'verdant', count = 220, rockCount = 95, groundCoverCount = 700, area = 100, seed = 17, treeScale = 1, position = [0, 0, 0], exclusionZones = [], waterLevel, maxSlopeDegrees }: Props) {
  const density = { tree: ecologyDensityMultiplier(biome, 'tree'), rock: ecologyDensityMultiplier(biome, 'rock'), cover: ecologyDensityMultiplier(biome, 'cover') };
  const trees = useMemo(() => makeInstances(Math.max(0, Math.round(count * density.tree)), area, seed, biome, 'tree', treeScale, exclusionZones, waterLevel, maxSlopeDegrees), [count, area, seed, biome, treeScale, exclusionZones, waterLevel, maxSlopeDegrees]);
  const rocks = useMemo(() => makeInstances(Math.max(0, Math.round(rockCount * density.rock)), area, seed, biome, 'rock', treeScale, exclusionZones, waterLevel, maxSlopeDegrees), [rockCount, area, seed, biome, treeScale, exclusionZones, waterLevel, maxSlopeDegrees]);
  const cover = useMemo(() => makeInstances(Math.max(0, Math.round(groundCoverCount * density.cover)), area, seed, biome, 'cover', treeScale, exclusionZones, waterLevel, maxSlopeDegrees), [groundCoverCount, area, seed, biome, treeScale, exclusionZones, waterLevel, maxSlopeDegrees]);
  const geo = useMemo(() => ({ trunk: new THREE.CylinderGeometry(0.16, 0.28, 1, 7, 1), canopy: new THREE.ConeGeometry(0.82, 1.45, 9, 2), rock: new THREE.DodecahedronGeometry(1, 1), cover: new THREE.ConeGeometry(0.13, 0.55, 5, 1) }), []);
  useEffect(() => () => { Object.values(geo).forEach(g => g.dispose()); }, [geo]);
  const trunkData = useMemo(() => trees.map(t => ({ matrix: t.matrix.clone().multiply(new THREE.Matrix4().makeScale(0.25, 0.38, 0.25)), color: new THREE.Color(PALETTES[biome].trunk) })), [trees, biome]);
  // Three canopy tiers use identical instance transforms with small offsets; no per-frame work is required.
  const canopyData = useMemo(() => trees.map(t => ({ matrix: t.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.18, 0)), color: t.color })), [trees]);
  const upperCanopy = useMemo(() => trees.map(t => ({ matrix: t.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.43, 0)).multiply(new THREE.Matrix4().makeScale(0.72, 0.72, 0.72)), color: t.color.clone().multiplyScalar(1.12) })), [trees]);
  return <group position={position}>
    <InstanceLayer data={trunkData} geometry={geo.trunk} />
    <InstanceLayer data={canopyData} geometry={geo.canopy} />
    <InstanceLayer data={upperCanopy} geometry={geo.canopy} />
    <InstanceLayer data={rocks} geometry={geo.rock} roughness={0.96} />
    <InstanceLayer data={cover} geometry={geo.cover} roughness={0.94} />
  </group>;
}

export const PRODUCTION_VEGETATION_BIOMES = Object.freeze(Object.keys(PALETTES));
