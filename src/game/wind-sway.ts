import * as THREE from "three";
import { windStrength } from "./wind";

/**
 * Wind sway — foliage bends in the vertex shader (no per-frame JS per instance): each instance gets
 * its own phase from its world position, and bend grows with height up the mesh. Strength follows the
 * live weather wind (weather-cycle.ts windX/windZ), so storms thrash the canopy and fog hangs still.
 */
/** foliage closer than this to the camera dissolves (metres) */
export const NEAR_FADE = 2.6;

export const windUniforms = {
  uWindTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(1, 0) },
  uWindStrength: { value: 0.3 },
};

/** Scene calls this each frame with the live weather wind. */
export function updateWind(dt: number, windX: number, windZ: number) {
  windUniforms.uWindTime.value += dt;
  const speed = Math.hypot(windX, windZ);
  windUniforms.uWindStrength.value = windStrength(speed);
  if (speed > 0.01) windUniforms.uWindDir.value.set(windX / speed, windZ / speed);
}

/**
 * Returns an `onBeforeCompile` for a foliage material. `amount` is the bend at the top of the mesh
 * in local units at full strength; the geometry's own height range decides where bending starts.
 */
export function windSway(geometry: THREE.BufferGeometry, amount: number) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const base = -box.min.y;
  const span = Math.max(0.001, box.max.y - box.min.y);
  return (shader: { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader?: string }) => {
    Object.assign(shader.uniforms, windUniforms, { uWindBase: { value: base }, uWindSpan: { value: span }, uWindAmount: { value: amount } });
    // near-camera dissolve: leaves, fronds and bushes within NEAR_FADE metres of the camera break up in a screen-door pattern, so a
    // third-person camera pushed into a tree or a fern shows the operator instead of a wall of leaf
    if (shader.fragmentShader) shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
varying float vWfCamDist;`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
if (vWfCamDist < ${NEAR_FADE.toFixed(2)}) {
  // fully gone inside the inner radius (a sparse grid of surviving pixels used to hang in front of the lens), then an
  // interleaved-gradient-noise dissolve out to NEAR_FADE: no regular screen-door grid, and it stays stable per pixel
  if (vWfCamDist < ${(NEAR_FADE * 0.4).toFixed(2)}) discard;
  float ign = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
  if (ign >= smoothstep(${(NEAR_FADE * 0.4).toFixed(2)}, ${NEAR_FADE.toFixed(2)}, vWfCamDist)) discard;
}`);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
varying float vWfCamDist;
uniform float uWindTime; uniform vec2 uWindDir; uniform float uWindStrength;
uniform float uWindBase; uniform float uWindSpan; uniform float uWindAmount;`)
      .replace("#include <project_vertex>", `#include <project_vertex>
vWfCamDist = -mvPosition.z;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
    vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  #else
    vec3 iPos = vec3(0.0);
  #endif
  float h = clamp((position.y + uWindBase) / uWindSpan, 0.0, 1.0);
  float phase = iPos.x * 0.35 + iPos.z * 0.27;
  float gust = sin(uWindTime * 1.3 + phase) + 0.5 * sin(uWindTime * 2.7 + phase * 1.7);
  float flutter = sin(uWindTime * 5.0 + phase * 2.3 + position.x * 2.0) * 0.12;
  float bend = uWindStrength * uWindAmount * h * h * (0.65 + gust * 0.35 + flutter);
  transformed.x += uWindDir.x * bend;
  transformed.z += uWindDir.y * bend;
}`);
  };
}
