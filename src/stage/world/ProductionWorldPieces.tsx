// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BIOME_PALETTES, buildFracturePolyline, buildTerrainVertexColors, getWaterParameters, sampleTerrainHeight } from './productionWorldAssets';
import type { BiomeId } from './productionWorldAssets';

export function BiomeTerrain({ biome = 'verdant', size = 180, segments = 128, seed = 1, position = [0, 0, 0] as [number, number, number] }: { biome?: BiomeId; size?: number; segments?: number; seed?: number; position?: [number, number, number] }) {
  const palette = BIOME_PALETTES[biome];
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, segments, segments); g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const colors = buildTerrainVertexColors(size, size, segments, palette, seed);
    for (let i = 0; i < p.count; i++) p.setY(i, sampleTerrainHeight(p.getX(i), p.getZ(i), seed, biome === 'desert' ? 1.3 : biome === 'ember' ? 4.5 : 3.1));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.computeVertexNormals(); return g;
  }, [size, segments, seed, biome, palette]);
  return <mesh geometry={geometry} position={position} receiveShadow>
    <meshStandardMaterial vertexColors roughness={palette.roughness} metalness={palette.metalness} flatShading={false} />
  </mesh>;
}

export function InstancedForest({ count = 280, area = 90, seed = 4, treeScale = 1, biome = 'verdant' }: { count?: number; area?: number; seed?: number; treeScale?: number; biome?: 'verdant' | 'swamp' | 'frost' }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    let state = seed >>> 0; const rand = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
    const dummy = new THREE.Object3D(); const matrices: THREE.Matrix4[] = [];
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * area, z = (rand() - 0.5) * area;
      const height = treeScale * (biome === 'frost' ? 2.8 : 2.2) * (0.72 + rand() * 0.8);
      dummy.position.set(x, sampleTerrainHeight(x, z, seed), z); dummy.rotation.y = rand() * Math.PI * 2;
      dummy.scale.set(treeScale * (0.7 + rand() * 0.6), height, treeScale * (0.7 + rand() * 0.6)); dummy.updateMatrix(); matrices.push(dummy.matrix.clone());
    }
    return matrices;
  }, [count, area, seed, treeScale, biome]);
  React.useEffect(() => { if (mesh.current) data.forEach((m, i) => mesh.current!.setMatrixAt(i, m)); if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true; }, [data]);
  const leaf = biome === 'swamp' ? '#405b45' : biome === 'frost' ? '#78949c' : '#3e7146';
  return <instancedMesh ref={mesh} args={[undefined, undefined, count]} castShadow receiveShadow>
    <coneGeometry args={[0.72, 1.9, 7]} />
    <meshStandardMaterial color={leaf} roughness={0.86} />
  </instancedMesh>;
}

export function AnimatedWater({ kind = 'lake', width = 60, depth = 60, position = [0, 0.1, 0] as [number, number, number] }: { kind?: 'ocean' | 'river' | 'lake' | 'waterfall' | 'underwater'; width?: number; depth?: number; position?: [number, number, number] }) {
  const mesh = useRef<THREE.Mesh>(null); const params = getWaterParameters(kind);
  const geometry = useMemo(() => new THREE.PlaneGeometry(width, depth, 48, 48), [width, depth]);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const g = mesh.current.geometry as THREE.BufferGeometry; const p = g.getAttribute('position') as THREE.BufferAttribute; const t = clock.elapsedTime * params.waveSpeed;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 0.12 + t) * Math.cos(y * 0.09 - t * 0.7) * params.waveAmplitude); }
    p.needsUpdate = true; g.computeVertexNormals();
  });
  return <mesh ref={mesh} geometry={geometry} position={position} rotation={[-Math.PI / 2, 0, 0]}>
    <meshPhysicalMaterial color={params.color} transparent opacity={params.opacity} roughness={params.roughness} metalness={0.12} clearcoat={0.75} clearcoatRoughness={0.12} side={THREE.DoubleSide} />
  </mesh>;
}

export function FractureSeam({ seed = 2, length = 18, intensity = 1, position = [0, 0.05, 0] as [number, number, number] }: { seed?: number; length?: number; intensity?: number; position?: [number, number, number] }) {
  const line = useRef<THREE.Line>(null);
  const points = useMemo(() => buildFracturePolyline(seed, 32, length), [seed, length]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  useFrame(({ clock }) => { if (line.current) { const material = line.current.material as THREE.LineBasicMaterial; material.opacity = THREE.MathUtils.clamp(intensity * (0.78 + Math.sin(clock.elapsedTime * 3.2) * 0.16), 0, 1); } });
  return <group position={position}>
    <line ref={line} geometry={geometry}><lineBasicMaterial color="#b35cff" transparent opacity={intensity} linewidth={2} /></line>
    <pointLight color="#8f38ff" intensity={Math.max(0, intensity) * 1.8} distance={length * 0.8} decay={2} />
  </group>;
}
