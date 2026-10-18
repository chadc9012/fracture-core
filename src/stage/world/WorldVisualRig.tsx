// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildSceneVisualSettings, createVisualTransitionState, transitionVisualSettings } from './worldVisualPresentation';
import type { QualityTier, WeatherId, WorldRegionId } from './worldVisualRuntime';

export interface WorldVisualRigProps {
  regionId: WorldRegionId;
  weather?: WeatherId;
  timeOfDay?: number;
  fractureIntensity?: number;
  quality?: QualityTier;
  /** World-space location for the violet Fracture light. */
  fracturePosition?: [number, number, number];
  /** Turn off the included weather particles if the game already owns a particle system. */
  particles?: boolean;
  particleCount?: number;
}

function createParticlePositions(count: number, seed: number): Float32Array {
  const positions = new Float32Array(count * 3);
  let value = seed >>> 0;
  const random = () => { value = (1664525 * value + 1013904223) >>> 0; return value / 4294967296; };
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (random() - 0.5) * 70;
    positions[i * 3 + 1] = random() * 28;
    positions[i * 3 + 2] = (random() - 0.5) * 70;
  }
  return positions;
}

function WeatherParticles({ kind, opacity, wind, count }: { kind: 'rain' | 'snow' | 'ash' | 'sand'; opacity: number; wind: number; count: number }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => createParticlePositions(Math.max(0, Math.floor(count)), kind === 'rain' ? 11 : kind === 'snow' ? 23 : kind === 'ash' ? 37 : 53), [count, kind]);
  const material = useMemo(() => new THREE.PointsMaterial({
    color: kind === 'snow' ? '#eaf6ff' : kind === 'ash' ? '#6e625a' : kind === 'sand' ? '#d9b47a' : '#b9d9ff',
    size: kind === 'rain' ? 0.065 : kind === 'snow' ? 0.11 : 0.09,
    transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  }), [kind]);
  useFrame((_, delta) => {
    if (!points.current) return;
    material.opacity = THREE.MathUtils.damp(material.opacity, THREE.MathUtils.clamp(opacity, 0, 1), 5, delta);
    const attr = points.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = attr.array as Float32Array;
    const fall = (kind === 'rain' ? 25 : kind === 'snow' ? 2.3 : kind === 'ash' ? 1.2 : 5) * Math.min(delta, 0.05);
    for (let i = 0; i < array.length; i += 3) {
      array[i] += wind * Math.min(delta, 0.05) * (kind === 'snow' ? 0.8 : 2.4);
      array[i + 1] -= fall;
      if (array[i + 1] < -1) { array[i + 1] = 27; array[i] = ((array[i] + 35) % 70) - 35; }
      if (array[i] > 35) array[i] = -35;
    }
    attr.needsUpdate = true;
  });
  return <points ref={points} material={material} frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
  </points>;
}

/**
 * R3F scene adapter for Stage 10 visual profiles. Mount once inside the Canvas.
 * The game should continue to own its world geometry, authored VFX and post-processing.
 */
export function WorldVisualRig({
  regionId, weather = 'clear', timeOfDay = 12, fractureIntensity = 0, quality = 'balanced',
  fracturePosition = [0, 4, 0], particles = true, particleCount,
}: WorldVisualRigProps) {
  const { scene, gl } = useThree();
  const ambient = useRef<THREE.AmbientLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const fracture = useRef<THREE.PointLight>(null);
  const transition = useRef(createVisualTransitionState());
  const particleLimit = particleCount ?? (quality === 'low' ? 90 : quality === 'balanced' ? 180 : quality === 'high' ? 320 : 460);
  const fog = useMemo(() => new THREE.FogExp2('#101522', 0.018), []);
  const lights = useMemo(() => ({ ambientColor: new THREE.Color('#c4d8ff'), keyColor: new THREE.Color('#fff0dc') }), []);

  useFrame((_, delta) => {
    const target = buildSceneVisualSettings({ regionId, weather, timeOfDay, fractureIntensity, quality, deltaSeconds: delta });
    const visual = transitionVisualSettings(transition.current, target, delta);
    if (!(scene.fog instanceof THREE.FogExp2)) scene.fog = fog;
    const activeFog = scene.fog as THREE.FogExp2;
    activeFog.color.lerp(new THREE.Color(target.fog.color), 1 - Math.exp(-2.8 * Math.min(delta, 0.1)));
    activeFog.density = THREE.MathUtils.damp(activeFog.density, visual.fog.density, 2.8, Math.min(delta, 0.1));
    if (ambient.current) ambient.current.intensity = visual.ambient.intensity;
    if (key.current) key.current.intensity = visual.keyLight.intensity;
    if (fracture.current) fracture.current.intensity = visual.fractureLight.intensity;
    gl.toneMappingExposure = visual.exposure;
  });

  const base = buildSceneVisualSettings({ regionId, weather, timeOfDay, fractureIntensity, quality, deltaSeconds: 1 / 60 });
  return <>
    <ambientLight ref={ambient} color={lights.ambientColor} intensity={base.ambient.intensity} />
    <directionalLight ref={key} color={lights.keyColor} intensity={base.keyLight.intensity} position={base.keyLight.position} castShadow={quality !== 'low'} />
    <pointLight ref={fracture} color={base.fractureLight.color} intensity={base.fractureLight.intensity} distance={base.fractureLight.distance} position={fracturePosition} decay={2} />
    {particles && <group>
      <WeatherParticles kind="rain" opacity={base.particleOpacity.rain} wind={base.wind} count={particleLimit} />
      <WeatherParticles kind="snow" opacity={base.particleOpacity.snow} wind={base.wind} count={Math.floor(particleLimit * 0.7)} />
      <WeatherParticles kind="ash" opacity={base.particleOpacity.ash} wind={base.wind} count={Math.floor(particleLimit * 0.55)} />
      <WeatherParticles kind="sand" opacity={base.particleOpacity.sand} wind={base.wind} count={Math.floor(particleLimit * 0.7)} />
    </group>}
  </>;
}
