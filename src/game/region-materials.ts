import * as THREE from "three";
import { REGIONS } from "./world";
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

/** Patches a vertex-coloured standard material to blend the six surfaces by wA/wB attributes. */
export function applySurfaceBlend(mat: THREE.MeshStandardMaterial, textures: THREE.Texture[]) {
  mat.onBeforeCompile = (shader) => {
    textures.forEach((t, i) => { shader.uniforms[`uSurf${i}`] = { value: t }; });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 wA; attribute vec3 wB; varying vec3 vWA; varying vec3 vWB; varying vec2 vSurfUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWA = wA; vWB = wB; vSurfUv = position.xy / 9.0;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${textures.map((_, i) => `uniform sampler2D uSurf${i};`).join("\n")}\nvarying vec3 vWA; varying vec3 vWB; varying vec2 vSurfUv;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
      vec3 surf = texture2D(uSurf0, vSurfUv).rgb * vWA.x + texture2D(uSurf1, vSurfUv).rgb * vWA.y + texture2D(uSurf2, vSurfUv).rgb * vWA.z
        + texture2D(uSurf3, vSurfUv).rgb * vWB.x + texture2D(uSurf4, vSurfUv).rgb * vWB.y + texture2D(uSurf5, vSurfUv).rgb * vWB.z;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * surf * 2.2, 0.8);`);
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
  }))).catch(() => null);
  return pending;
}
