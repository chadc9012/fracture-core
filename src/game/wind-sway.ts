import * as THREE from "three";
import { GUST, GUST_WRAP, gustiness, stepGustDrift, windStrength } from "./wind";

/**
 * Wind sway — foliage bends in the vertex shader (no per-frame JS per instance). Every plant leans downwind by how strong the gust
 * patch over it is (wind.ts gustAt, carried across the land by the drift offset, so a gust is seen rolling through the grass and then
 * the canopies), springs back in the lulls, and keeps a small per-instance oscillation and leaf flutter. Bend grows with height up the
 * plant (tips and canopy move, the base stays planted) and follows the shared wind direction in world space, whatever the instance's
 * own yaw. Strength and gustiness follow the live weather wind (weather-cycle.ts windX/windZ), so storms thrash the vegetation and fog
 * hangs still.
 *
 * The same patch carries the foliage weather (wetness.ts rain wetness, dew.ts morning dew): wet leaves darken and turn glossy, and
 * dew beads catch the sun as fine glints that twinkle as the view moves. Scene sets `foliageWeather` each frame; the cost is one
 * uniform-gated branch, and the glints are off on LOW.
 */
/** foliage closer than this to the camera dissolves (metres) */
export const NEAR_FADE = 2.6;

export const windUniforms = {
  uWindTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(1, 0) },
  uWindStrength: { value: 0.3 },
  /** gust pattern drift (m, wrapped at GUST_WRAP) and gustiness 0.35..1 */
  uGustOff: { value: new THREE.Vector2(0, 0) },
  uGustiness: { value: 0.5 },
};

/** live foliage weather, shared by every windSway material */
export const foliageWeather = {
  /** 0..1 morning dew (dew.ts) */
  uDew: { value: 0 },
  /** 0..1 rain wetness on the leaves (wetness.ts, eased) */
  uLeafWet: { value: 0 },
  /** world sun direction and how much direct sun there is (0 night/overcast .. 1) */
  uDewSun: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
  uDewLight: { value: 1 },
  /** 0 = LOW tier (sheen only, no glints), 1 = glints */
  uDewDetail: { value: 1 },
  /** near-camera leaf dissolve: 1 = third person (leaves within NEAR_FADE break up so the operator stays visible), 0 = first person
   * (only leaves touching the lens go; the dissolve band dotted every fern and branch around the player, owner phone shots Oct 26) */
  uNearFade: { value: 1 },
};

/** Scene calls this each frame with the live weather wind. */
export function updateWind(dt: number, windX: number, windZ: number) {
  windUniforms.uWindTime.value += dt;
  const speed = Math.hypot(windX, windZ);
  windUniforms.uWindStrength.value = windStrength(speed);
  // gustiness eases so a front arriving doesn't snap every plant at once
  windUniforms.uGustiness.value += (gustiness(speed) - windUniforms.uGustiness.value) * Math.min(1, dt * 0.8);
  const dir = windUniforms.uWindDir.value;
  if (speed > 0.01) dir.set(windX / speed, windZ / speed);
  const off = windUniforms.uGustOff.value;
  const next = stepGustDrift({ x: off.x, z: off.y }, dir.x, dir.y, speed, dt);
  off.set(next.x, next.z);
}

/** GLSL twin of wind.ts gustAt (same lattice, period and sharpening) */
const GUST_GLSL = /* glsl */ `
float wfGustHash(vec2 c) { c = mod(c, ${GUST.period.toFixed(1)}); return fract(sin(c.x * 127.1 + c.y * 311.7) * 43758.5453); }
float wfGustNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = wfGustHash(i), b = wfGustHash(i + vec2(1.0, 0.0)), c = wfGustHash(i + vec2(0.0, 1.0)), d = wfGustHash(i + vec2(1.0, 1.0));
  return a + (b - a) * f.x + (c - a) * f.y + (a - b - c + d) * f.x * f.y;
}
float wfGust(vec2 w) {
  vec2 p = mod(w - uGustOff, ${GUST_WRAP.toFixed(1)}) / ${GUST.cell.toFixed(1)};
  float n = wfGustNoise(p) * 0.7 + wfGustNoise(p * 2.0 + vec2(17.0, 31.0)) * 0.3;
  return smoothstep(0.38, 0.8, n);
}`;

export type SwayOptions = {
  /** bend from this local height (default: the geometry's own bounding box). Pass the whole model's range for multi-part models
   * (trunk + fronds), so every part bends about the same base and the leaves stay on the branches. */
  range?: { min: number; max: number };
  /** dew pickup: 1 grass and low cover, ~0.4 canopy leaves, 0 bark and stone (default 1) */
  dew?: number;
};

/**
 * Returns an `onBeforeCompile` for a foliage material. `amount` is the bend at the top of the mesh in local units at full strength.
 * The generated code is the same for every call (all differences are uniforms), so materials share one program.
 */
export function windSway(geometry: THREE.BufferGeometry, amount: number, opts: SwayOptions = {}) {
  if (!opts.range && !geometry.boundingBox) geometry.computeBoundingBox();
  const min = opts.range ? opts.range.min : geometry.boundingBox!.min.y;
  const max = opts.range ? opts.range.max : geometry.boundingBox!.max.y;
  const base = -min;
  const span = Math.max(0.001, max - min);
  const dewK = opts.dew ?? 1;
  return (shader: { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader?: string }) => {
    Object.assign(shader.uniforms, windUniforms, foliageWeather, { uWindBase: { value: base }, uWindSpan: { value: span }, uWindAmount: { value: amount }, uDewK: { value: dewK } });
    if (shader.fragmentShader) {
      const physical = shader.fragmentShader.includes("#include <lights_physical_fragment>");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>
varying float vWfCamDist; varying vec3 vWfW;
uniform float uNearFade; uniform float uDew; uniform float uLeafWet; uniform vec3 uDewSun; uniform float uDewLight; uniform float uDewDetail; uniform float uDewK;`)
        // near-camera dissolve: leaves, fronds and bushes within NEAR_FADE metres of the camera break up in a screen-door pattern, so a
        // third-person camera pushed into a tree or a fern shows the operator instead of a wall of leaf
        .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
float fwNear = mix(0.3, ${NEAR_FADE.toFixed(2)}, uNearFade);
if (vWfCamDist < fwNear) {
  // fully gone inside the inner radius (a sparse grid of surviving pixels used to hang in front of the lens), then an
  // interleaved-gradient-noise dissolve out to the fade radius: no regular screen-door grid, and it stays stable per pixel
  if (vWfCamDist < fwNear * 0.4) discard;
  float ign = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
  if (ign >= smoothstep(fwNear * 0.4, fwNear, vWfCamDist)) discard;
}`)
        // foliage weather: rain-wet leaves darken and gloss up; dew beads glint where a bead's facet bounces the sun into the eye
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
{
  float fwDew = uDew * uDewK;
  float fwWet = max(fwDew, uLeafWet * min(1.0, uDewK + 0.5));
  if (fwWet > 0.01) {
    diffuseColor.rgb *= 1.0 - uLeafWet * 0.16 * min(1.0, uDewK + 0.5);
    // a damp sheen, not a mirror: the grass normals point up, so a low roughness would wash a whole meadow out with sky
    ${physical ? "roughnessFactor = mix(roughnessFactor, mix(0.62, 0.48, uLeafWet), fwWet * 0.7);" : ""}
    float fwGlint = max(fwDew, uLeafWet * 0.45 * uDewK) * uDewLight * uDewDetail;
    if (fwGlint > 0.01 && vWfCamDist < 14.0) {
      vec3 fwCell = floor(vWfW * 30.0);
      float fwH = fract(sin(dot(fwCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      vec3 fwFacet = normalize(vec3(fract(fwH * 13.17) - 0.5, 0.35 + fract(fwH * 7.31), fract(fwH * 3.77) - 0.5));
      vec3 fwView = normalize(cameraPosition - vWfW);
      float fwFacing = dot(reflect(-normalize(uDewSun), fwFacet), fwView);
      // one cell in ~6 holds a bead; it lights only while its facet bounces the sun into the eye, so beads twinkle as you move
      float fwBead = step(0.84, fwH) * smoothstep(0.94, 0.992, fwFacing);
      totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * fwBead * fwGlint * 2.2 * (1.0 - smoothstep(5.0, 14.0, vWfCamDist));
    }
  }
}`);
    }
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
varying float vWfCamDist; varying vec3 vWfW;
uniform float uWindTime; uniform vec2 uWindDir; uniform float uWindStrength; uniform vec2 uGustOff; uniform float uGustiness;
uniform float uWindBase; uniform float uWindSpan; uniform float uWindAmount;
${GUST_GLSL}`)
      .replace("#include <project_vertex>", `#include <project_vertex>
vWfCamDist = -mvPosition.z;
#ifdef USE_INSTANCING
  vWfW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vWfW = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
    mat4 wfM = modelMatrix * instanceMatrix;
  #else
    mat4 wfM = modelMatrix;
  #endif
  vec3 iPos = wfM[3].xyz;
  // the wind blows in world space: bring its direction into this instance's local frame (yawed, scaled, maybe tilted)
  vec3 wfDir = transpose(mat3(wfM)) * vec3(uWindDir.x, 0.0, uWindDir.y);
  wfDir /= max(1e-4, length(wfDir));
  vec3 wfSide = transpose(mat3(wfM)) * vec3(-uWindDir.y, 0.0, uWindDir.x);
  wfSide /= max(1e-4, length(wfSide));
  float h = clamp((position.y + uWindBase) / uWindSpan, 0.0, 1.0);
  float phase = iPos.x * 0.35 + iPos.z * 0.27;
  float g = wfGust(iPos.xz);
  float osc = sin(uWindTime * 1.3 + phase) + 0.5 * sin(uWindTime * 2.7 + phase * 1.7);
  float flutter = sin(uWindTime * (5.0 + g * 3.0) + phase * 2.3 + position.x * 2.0 + position.z * 1.3) * 0.12;
  // steady lean that a passing gust pushes much further, a spring-back oscillation, and leaf flutter that quickens in a gust
  float push = 0.35 + uGustiness * 1.25 * g;
  float bend = uWindStrength * uWindAmount * h * h * (push + osc * 0.22 * (0.6 + g) + flutter * (0.6 + g));
  transformed += wfDir * bend + wfSide * (uWindStrength * uWindAmount * h * h * osc * 0.07);
  // a bent stalk arcs, it doesn't stretch: tips drop a little as they lean
  transformed.y -= h * bend * bend / (2.0 * uWindSpan);
}`);
  };
}
