// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getWaterProfile, type WaterKind } from './waterEnvironment';

const vertexShader = `
varying vec3 vWorldPosition;
varying vec3 vNormalWorld;
uniform float uTime;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uSpeed;
uniform vec2 uCurrent;
void main() {
  vec3 p = position;
  float t = uTime * uSpeed;
  float a = sin((p.x + uCurrent.x * t) * uFrequency + t);
  float b = cos((p.y + uCurrent.y * t) * uFrequency * 1.31 - t * 0.73);
  p.z += (a * 0.66 + b * 0.34) * uAmplitude;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorldPosition = world.xyz;
  vNormalWorld = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const fragmentShader = `
varying vec3 vWorldPosition;
varying vec3 vNormalWorld;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform float uOpacity;
uniform float uTime;
uniform float uFoam;
uniform float uCaustics;
uniform vec3 uCamera;
void main() {
  vec3 viewDir = normalize(uCamera - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(normalize(vNormalWorld), viewDir), 0.0), 3.0);
  float bands = sin(vWorldPosition.x * 0.42 + uTime * 1.7) * cos(vWorldPosition.z * 0.37 - uTime * 1.2);
  float caustic = smoothstep(0.58, 0.95, bands) * uCaustics;
  vec3 color = mix(uDeep, uShallow, clamp(0.25 + fresnel * 0.65 + caustic, 0.0, 1.0));
  float ripple = smoothstep(0.88, 1.0, sin(vWorldPosition.x * 0.75 + uTime) * cos(vWorldPosition.z * 0.68 - uTime * 0.8)) * uFoam;
  color = mix(color, vec3(0.78, 0.96, 0.98), ripple * 0.32);
  gl_FragColor = vec4(color, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export interface WaterEnvironmentProps {
  kind?: WaterKind;
  width?: number;
  depth?: number;
  segments?: number;
  position?: [number, number, number];
  /** Optional measured shore depth; this is metadata for integration, not inferred from terrain. */
  shorelineDepth?: number;
}

/** Opt-in shader-driven surface; mount inside the existing R3F Canvas. */
export function WaterEnvironment({ kind = 'ocean', width = 100, depth = 100, segments = 96, position = [0, 0.1, 0], shorelineDepth }: WaterEnvironmentProps) {
  const profile = useMemo(() => getWaterProfile(kind), [kind]);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uAmplitude: { value: profile.waveAmplitude }, uFrequency: { value: profile.waveFrequency }, uSpeed: { value: profile.waveSpeed },
    uCurrent: { value: new THREE.Vector2(profile.currentX, profile.currentZ) }, uShallow: { value: new THREE.Color(profile.colorShallow) }, uDeep: { value: new THREE.Color(profile.colorDeep) },
    uOpacity: { value: profile.opacity }, uFoam: { value: profile.foamStrength * (shorelineDepth === undefined ? 0.35 : THREE.MathUtils.clamp(1 - shorelineDepth / 2, 0, 1)) },
    uCaustics: { value: profile.causticStrength }, uCamera: { value: new THREE.Vector3() },
  }), [profile, shorelineDepth]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(width, depth, segments, segments), [width, depth, segments]);
  useFrame(({ clock, camera }) => { uniforms.uTime.value = clock.elapsedTime; uniforms.uCamera.value.copy(camera.position); });
  React.useEffect(() => () => { geometry.dispose(); }, [geometry]);
  return <mesh geometry={geometry} position={position} rotation={[-Math.PI / 2, 0, 0]}>
    <shaderMaterial vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide} />
  </mesh>;
}
