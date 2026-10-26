import * as THREE from "three";
import { REGIONS } from "./world";
import { WATER_LEVEL, solaraValley } from "./terrain";
import forest from "@/assets/polyhaven/forest_ground_04.jpg.asset.json";
import rocks from "@/assets/polyhaven/aerial_rocks_02.jpg.asset.json";
import sand from "@/assets/polyhaven/coast_sand_01.jpg.asset.json";
import snow from "@/assets/polyhaven/snow_02.jpg.asset.json";
import burned from "@/assets/polyhaven/burned_ground_01.jpg.asset.json";
import mud from "@/assets/polyhaven/brown_mud_02.jpg.asset.json";

/** Poly Haven (CC0) ground surfaces, slot order matches the shader weights (wA = 0..2, wB = 3..5). */
export const GROUND_SURFACES = [forest.url, rocks.url, sand.url, snow.url, burned.url, mud.url] as const;
/** relief for the same six surfaces (scripts/build-textures.py: high-passed from each albedo's own detail), same slot order */
export const GROUND_NORMALS = ["forest_ground_04", "aerial_rocks_02", "coast_sand_01", "snow_02", "burned_ground_01", "brown_mud_02"].map((n) => `/textures/ground/${n}_nrm.jpg`);
/** per-surface roughness (forest litter, rock, dry sand, packed snow, ash, wet mud) */
export const GROUND_ROUGHNESS = [0.96, 0.84, 0.93, 0.62, 0.9, 0.52] as const;
export const REGION_SURFACE: Record<string, number> = { veridan: 0, nexus: 1, wastelands: 1, solara: 2, frostspire: 3, ember: 4, swamps: 5 };
const DEFAULT_SURFACE = 1;

/** Soft per-region surface weights at a world point; always sums to 1. */
export function surfaceWeights(x: number, z: number): number[] {
  const w = [0, 0, 0, 0, 0, 0];
  let total = 0;
  for (const r of REGIONS) {
    const slot = REGION_SURFACE[r.id];
    if (slot === undefined) continue;
    const d = Math.hypot(x - r.x, z - r.z) / r.radius;
    const k = Math.max(0, 1 - Math.max(0, d - 0.7) / 0.6);
    w[slot]! += k; total += k;
  }
  if (total < 1) { w[DEFAULT_SURFACE]! += 1 - total; total = 1; }
  const out = w.map((v) => v / total);
  // Solara's river valley grows forest-floor ground through the sand
  const v = solaraValley(x, z);
  return v > 0 ? out.map((x0, i) => x0 * (1 - v) + (i === 0 ? v : 0)) : out;
}

/** seconds, shared by every ground material: drives the seabed caustics (Terrain advances it each frame) */
export const groundTime = { value: 0 };

/** live rain wetness on the ground (wetness.ts stepGroundWetness; Scene sets it each frame): soaked soil darkens and turns glossy,
 * flat hollows collect puddles that mirror the sky (the IBL) once it is wet enough, and rain rings dimple them while it falls.
 * `uWetDetail`: 0 LOW (darken + gloss only), 1 MEDIUM (puddles), 2 HIGH/ULTRA (puddles + rain rings). */
export const groundWeather = {
  uRainWet: { value: 0 },
  uRaining: { value: 0 },
  uPuddles: { value: 0 },
  uWetDetail: { value: 1 },
};

/** Patches a vertex-coloured standard material to blend the six surfaces by wA/wB attributes. Ground below the waterline
 * also gets sunlight caustics: two drifting interference layers, strongest just under the surface and gone by ~24 m. */
export function applySurfaceBlend(mat: THREE.MeshStandardMaterial, textures: THREE.Texture[], normals: THREE.Texture[] | null = null) {
  const relief = !!normals && normals.length === textures.length && !!mat.normalMap;
  mat.customProgramCacheKey = () => `surface-blend|${relief ? "relief" : "flat"}`;
  mat.onBeforeCompile = (shader) => {
    textures.forEach((t, i) => { shader.uniforms[`uSurf${i}`] = { value: t }; });
    if (relief) normals!.forEach((t, i) => { shader.uniforms[`uSurfN${i}`] = { value: t }; });
    shader.uniforms["uGroundTime"] = groundTime;
    Object.assign(shader.uniforms, groundWeather);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 wA; attribute vec3 wB; varying vec3 vWA; varying vec3 vWB; varying vec2 vSurfUv; varying vec3 vGroundW;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWA = wA; vWB = wB; vSurfUv = position.xy / 9.0; vGroundW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${textures.map((_, i) => `uniform sampler2D uSurf${i};${relief ? ` uniform sampler2D uSurfN${i};` : ""}`).join("\n")}\nvarying vec3 vWA; varying vec3 vWB; varying vec2 vSurfUv; varying vec3 vGroundW; uniform float uGroundTime;
      uniform float uRainWet; uniform float uRaining; uniform float uPuddles; uniform float uWetDetail;
      // anti-tiling: every surface is sampled at its 9 m tile and again at a rotated ~33 m tile, mixed by a slow world
      // noise, so the ground stops showing a repeating stamp; a broad brightness variation breaks up large flats
      float wfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float wfNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(wfHash(i), wfHash(i + vec2(1.0, 0.0)), f.x), mix(wfHash(i + vec2(0.0, 1.0)), wfHash(i + vec2(1.0, 1.0)), f.x), f.y); }
      vec3 wfSurf(sampler2D s, vec2 a, vec2 adx, vec2 ady, vec2 b, vec2 bdx, vec2 bdy, float k) {
        return mix(textureGrad(s, a, adx, ady).rgb, textureGrad(s, b, bdx, bdy).rgb, k);
      }
      float causticLayer(vec2 p, float t) {
        vec2 q = p + vec2(sin(p.y * 1.3 + t), cos(p.x * 1.1 - t * 0.8)) * 0.9;
        return pow(abs(sin(q.x) * sin(q.y)), 0.35);
      }`)
      // only the surfaces that weigh in here are sampled (usually one or two of the six); gradients come from outside the
      // branches so mip selection stays correct where neighbouring pixels take different branches
      .replace("#include <color_fragment>", `#include <color_fragment>
      vec2 sdx = dFdx(vSurfUv), sdy = dFdy(vSurfUv);
      const mat2 wfRot = mat2(0.8, -0.6, 0.6, 0.8);
      vec2 uvB = wfRot * vSurfUv * 0.27 + 0.37, bdx = wfRot * sdx * 0.27, bdy = wfRot * sdy * 0.27;
      float wfK = 0.25 + 0.5 * smoothstep(0.25, 0.75, wfNoise(vGroundW.xz * 0.011));
      vec3 surf = vec3(0.0);
      if (vWA.x > 0.004) surf += wfSurf(uSurf0, vSurfUv, sdx, sdy, uvB, bdx, bdy, wfK) * vWA.x;
      if (vWA.y > 0.004) surf += wfSurf(uSurf1, vSurfUv, sdx, sdy, uvB, bdx, bdy, wfK) * vWA.y;
      if (vWA.z > 0.004) surf += wfSurf(uSurf2, vSurfUv, sdx, sdy, uvB, bdx, bdy, wfK) * vWA.z;
      if (vWB.x > 0.004) surf += wfSurf(uSurf3, vSurfUv, sdx, sdy, uvB, bdx, bdy, wfK) * vWB.x;
      if (vWB.y > 0.004) surf += wfSurf(uSurf4, vSurfUv, sdx, sdy, uvB, bdx, bdy, wfK) * vWB.y;
      if (vWB.z > 0.004) surf += wfSurf(uSurf5, vSurfUv, sdx, sdy, uvB, bdx, bdy, wfK) * vWB.z;
      // steep ground shows bare rock (the rock surface) instead of stretched grass, sand or ash
      vec3 wfN = normalize(cross(dFdx(vGroundW), dFdy(vGroundW)));
      float wfSteep = smoothstep(0.32, 0.62, 1.0 - abs(wfN.y)) * (1.0 - vWA.y) * (1.0 - vWB.x * 0.6);
      if (wfSteep > 0.01) surf = mix(surf, wfSurf(uSurf1, vSurfUv * 0.6, sdx * 0.6, sdy * 0.6, uvB, bdx, bdy, wfK) * vec3(0.92, 0.9, 0.88), wfSteep);
      // broad light/dark patches (soil moisture, wear) so big flats aren't one even tone
      surf *= 0.86 + 0.28 * wfNoise(vGroundW.xz * 0.035 + 7.0);
      // Texture albedo is authored in sRGB and decoded by the renderer. Preserve
      // the vertex biome tint without amplifying highlights into clipping.
      // Keep a little vertex colour for wet/steep transitions and distant LODs.
      diffuseColor.rgb *= mix(vec3(1.0), clamp(surf * 1.7, 0.0, 1.35), 0.86);
      float depthUnder = ${WATER_LEVEL.toFixed(2)} - vGroundW.y;
      if (depthUnder > 0.0 && depthUnder < 24.0) {
        float t = uGroundTime;
        vec2 cp = vGroundW.xz * 0.42;
        // two layers crossing at different scales and speeds; their product keeps only the bright knots of the web
        float c = causticLayer(cp, t * 0.9) * causticLayer(cp * 1.37 + 3.1, -t * 0.7);
        c = smoothstep(0.55, 0.95, c);
        float fade = smoothstep(0.0, 0.6, depthUnder) * (1.0 - smoothstep(6.0, 24.0, depthUnder));
        diffuseColor.rgb *= 1.0 + c * 0.9 * fade;
      }`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
      roughnessFactor = dot(vWA, vec3(${GROUND_ROUGHNESS.slice(0, 3).map((r) => r.toFixed(2)).join(", ")})) + dot(vWB, vec3(${GROUND_ROUGHNESS.slice(3).map((r) => r.toFixed(2)).join(", ")}));
      roughnessFactor = clamp(roughnessFactor, 0.4, 1.0);`)
      // rain wetness: after the normal maps, before lighting. Snow and dry sand drain or freeze, so they take little of it; ground
      // under the sea is already wet.
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      if (uRainWet > 0.01 && vGroundW.y > ${(WATER_LEVEL + 0.15).toFixed(2)}) {
        float soak = uRainWet * (1.0 - vWB.x * 0.85) * (1.0 - vWA.z * 0.45);
        // soil and litter darken a lot when wet, rock a little; everything gets a damp sheen
        diffuseColor.rgb *= 1.0 - soak * mix(0.34, 0.16, wfSteep);
        roughnessFactor = mix(roughnessFactor, 0.34, soak * 0.85);
        if (uWetDetail > 0.5 && uPuddles > 0.01) {
          // puddles in flat hollows: a broad noise mask that grows with the wetness, only on near-level ground
          float flat_ = smoothstep(0.955, 0.99, abs(wfN.y));
          float pn = wfNoise(vGroundW.xz * 0.11) * 0.65 + wfNoise(vGroundW.xz * 0.37 + 11.0) * 0.35;
          float puddle = smoothstep(1.0 - 0.42 * uPuddles, 1.09 - 0.42 * uPuddles, pn) * flat_ * (1.0 - vWB.x) * (1.0 - vWA.z * 0.8);
          if (puddle > 0.01) {
            vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
            vec3 pN = upV;
            float ringFade = uRaining * (1.0 - smoothstep(8.0, 28.0, length(cameraPosition - vGroundW))); // rings alias into speckle far off
            if (uWetDetail > 1.5 && ringFade > 0.02) {
              // rain rings: each 0.45 m cell drops a ring at its own time; the ring front tilts the mirror normal
              vec2 rc = vGroundW.xz / 0.45, ri = floor(rc), rf = fract(rc) - 0.5;
              float rh = fract(sin(dot(ri, vec2(127.1, 311.7))) * 43758.5453);
              float ph = fract(uGroundTime * (0.9 + rh * 0.6) + rh * 7.0);
              vec2 off = (vec2(fract(rh * 17.3), fract(rh * 31.7)) - 0.5) * 0.4;
              vec2 d = rf - off; float r = length(d);
              float ring = sin(clamp((r - ph * 0.5) * 40.0, -3.1416, 3.1416)) * (1.0 - ph) * step(r, ph * 0.5 + 0.08) * ringFade;
              vec3 tW = vec3(d.x, 0.0, d.y) / max(r, 1e-3) * ring * 0.35;
              pN = normalize(upV + (viewMatrix * vec4(tW, 0.0)).xyz);
            }
            normal = normalize(mix(normal, pN, puddle));
            // standing water hides the ground texture under a dark, muddy film; the mirror does the rest
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.5, 0.2))) * vec3(0.32, 0.3, 0.27), puddle * 0.85);
            roughnessFactor = mix(roughnessFactor, 0.04, puddle);
          }
        }
      }`);
    if (relief) shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      {
        // surface relief: each surface's own normal map, blended by the same weights as its colour, on top of the fine detail
        vec3 gN = vec3(0.0);
        if (vWA.x > 0.004) gN += (textureGrad(uSurfN0, vSurfUv, sdx, sdy).xyz * 2.0 - 1.0) * vWA.x;
        if (vWA.y > 0.004) gN += (textureGrad(uSurfN1, vSurfUv, sdx, sdy).xyz * 2.0 - 1.0) * vWA.y;
        if (vWA.z > 0.004) gN += (textureGrad(uSurfN2, vSurfUv, sdx, sdy).xyz * 2.0 - 1.0) * vWA.z;
        if (vWB.x > 0.004) gN += (textureGrad(uSurfN3, vSurfUv, sdx, sdy).xyz * 2.0 - 1.0) * vWB.x;
        if (vWB.y > 0.004) gN += (textureGrad(uSurfN4, vSurfUv, sdx, sdy).xyz * 2.0 - 1.0) * vWB.y;
        if (vWB.z > 0.004) gN += (textureGrad(uSurfN5, vSurfUv, sdx, sdy).xyz * 2.0 - 1.0) * vWB.z;
        gN.xy *= 1.15;
        gN.z = max(gN.z, 0.05);
        mat3 gTbn = getTangentFrame(-vViewPosition, normal, vSurfUv);
        normal = normalize(gTbn * normalize(gN));
      }`);
  };
  mat.needsUpdate = true;
}

let pending: Promise<THREE.Texture[] | null> | null = null;
/** Loads all surfaces once; resolves null if any fails so the procedural ground stays. */
export function loadGroundSurfaces(): Promise<THREE.Texture[] | null> {
  if (pending) return pending;
  const loader = new THREE.TextureLoader();
  pending = Promise.all(GROUND_SURFACES.map((url) => loader.loadAsync(url).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = 4; return t;
  }))).catch(() => {
    // a dropped request must not pin every biome to the fallback for the life of the page: the next mount retries
    pending = null;
    return null;
  });
  return pending;
}

let pendingNormals: Promise<THREE.Texture[] | null> | null = null;
/** Loads the six relief maps once (linear data, not colour); resolves null on any failure so the ground keeps its flat look. */
export function loadGroundNormals(): Promise<THREE.Texture[] | null> {
  if (pendingNormals) return pendingNormals;
  const loader = new THREE.TextureLoader();
  pendingNormals = Promise.all(GROUND_NORMALS.map((url) => loader.loadAsync(url).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t;
  }))).catch(() => { pendingNormals = null; return null; });
  return pendingNormals;
}
