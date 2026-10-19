import * as THREE from "three";
import { REGIONS } from "./world";
import { WATER_LEVEL } from "./terrain";
import forest from "@/assets/polyhaven/forest_ground_04.jpg.asset.json";
import rocks from "@/assets/polyhaven/aerial_rocks_02.jpg.asset.json";
import sand from "@/assets/polyhaven/coast_sand_01.jpg.asset.json";
import snow from "@/assets/polyhaven/snow_02.jpg.asset.json";
import burned from "@/assets/polyhaven/burned_ground_01.jpg.asset.json";
import mud from "@/assets/polyhaven/brown_mud_02.jpg.asset.json";

/** Poly Haven (CC0) ground surfaces, slot order matches the shader weights (wA = 0..2, wB = 3..5). */
export const GROUND_SURFACES = [forest.url, rocks.url, sand.url, snow.url, burned.url, mud.url] as const;
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
  return w.map((v) => v / total);
}

/** seconds, shared by every ground material: drives the seabed caustics (Terrain advances it each frame) */
export const groundTime = { value: 0 };

/** Patches a vertex-coloured standard material to blend the six surfaces by wA/wB attributes. Ground below the waterline
 * also gets sunlight caustics: two drifting interference layers, strongest just under the surface and gone by ~24 m. */
export function applySurfaceBlend(mat: THREE.MeshStandardMaterial, textures: THREE.Texture[]) {
  mat.onBeforeCompile = (shader) => {
    textures.forEach((t, i) => { shader.uniforms[`uSurf${i}`] = { value: t }; });
    shader.uniforms["uGroundTime"] = groundTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 wA; attribute vec3 wB; varying vec3 vWA; varying vec3 vWB; varying vec2 vSurfUv; varying vec3 vGroundW;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWA = wA; vWB = wB; vSurfUv = position.xy / 9.0; vGroundW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${textures.map((_, i) => `uniform sampler2D uSurf${i};`).join("\n")}\nvarying vec3 vWA; varying vec3 vWB; varying vec2 vSurfUv; varying vec3 vGroundW; uniform float uGroundTime;
      float causticLayer(vec2 p, float t) {
        vec2 q = p + vec2(sin(p.y * 1.3 + t), cos(p.x * 1.1 - t * 0.8)) * 0.9;
        return pow(abs(sin(q.x) * sin(q.y)), 0.35);
      }`)
      // only the surfaces that weigh in here are sampled (usually one or two of the six); gradients come from outside the
      // branches so mip selection stays correct where neighbouring pixels take different branches
      .replace("#include <color_fragment>", `#include <color_fragment>
      vec2 sdx = dFdx(vSurfUv), sdy = dFdy(vSurfUv);
      vec3 surf = vec3(0.0);
      if (vWA.x > 0.004) surf += textureGrad(uSurf0, vSurfUv, sdx, sdy).rgb * vWA.x;
      if (vWA.y > 0.004) surf += textureGrad(uSurf1, vSurfUv, sdx, sdy).rgb * vWA.y;
      if (vWA.z > 0.004) surf += textureGrad(uSurf2, vSurfUv, sdx, sdy).rgb * vWA.z;
      if (vWB.x > 0.004) surf += textureGrad(uSurf3, vSurfUv, sdx, sdy).rgb * vWB.x;
      if (vWB.y > 0.004) surf += textureGrad(uSurf4, vSurfUv, sdx, sdy).rgb * vWB.y;
      if (vWB.z > 0.004) surf += textureGrad(uSurf5, vSurfUv, sdx, sdy).rgb * vWB.z;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * surf * 2.2, 0.8);
      float depthUnder = ${WATER_LEVEL.toFixed(2)} - vGroundW.y;
      if (depthUnder > 0.0 && depthUnder < 24.0) {
        float t = uGroundTime;
        vec2 cp = vGroundW.xz * 0.42;
        // two layers crossing at different scales and speeds; their product keeps only the bright knots of the web
        float c = causticLayer(cp, t * 0.9) * causticLayer(cp * 1.37 + 3.1, -t * 0.7);
        c = smoothstep(0.55, 0.95, c);
        float fade = smoothstep(0.0, 0.6, depthUnder) * (1.0 - smoothstep(6.0, 24.0, depthUnder));
        diffuseColor.rgb *= 1.0 + c * 0.9 * fade;
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
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }))).catch(() => {
    // a dropped request must not pin every biome to the fallback for the life of the page: the next mount retries
    pending = null;
    return null;
  });
  return pending;
}
