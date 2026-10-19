import * as THREE from "three";
import { classifyCarMaterial, finishFor } from "@/game/vehicle-finish";
import { getPerfTier } from "@/game/perf-budget";

/**
 * Gives a car shell real paint, glass, chrome and tyres (vehicle-finish.ts decides which is which). Upgraded materials
 * are cached per source material and tier, so every copy of a model shares them: a street of parked SUVs costs one
 * extra shader, not one per car. Clearcoat paint is a MeshPhysicalMaterial and only used on HIGH/ULTRA.
 */
const cache = new Map<string, THREE.Material>();

function upgrade(src: THREE.Material): THREE.Material {
  if (!(src instanceof THREE.MeshStandardMaterial)) return src;
  const tier = getPerfTier();
  const key = `${src.uuid}@${tier}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const finish = finishFor(classifyCarMaterial(src.name), tier);
  let out: THREE.Material = src;
  if (finish) {
    const m = finish.clearcoat !== undefined ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(m, src);
    // an authored body with its own metal/rough maps (baked wear, scratches) keeps them: only the lacquer is added
    const mapped = !!(src.roughnessMap || src.metalnessMap);
    if (!mapped) {
      if (finish.metalness !== undefined) m.metalness = finish.metalness;
      if (finish.roughness !== undefined) m.roughness = finish.roughness;
    }
    if (finish.envMapIntensity !== undefined) m.envMapIntensity = finish.envMapIntensity;
    if (finish.tint && !m.map) m.color.set(finish.tint);
    if (m instanceof THREE.MeshPhysicalMaterial) { m.clearcoat = (finish.clearcoat ?? 0) * (mapped ? 0.5 : 1); m.clearcoatRoughness = finish.clearcoatRoughness ?? 0; }
    m.name = `${src.name}:finish`;
    out = m;
  }
  cache.set(key, out);
  return out;
}

/** Upgrades from each mesh's original material (kept in userData), so applying again — a re-render, or the quality
 * tier changing mid-game — re-derives the finish for the current tier instead of finishing an already-finished copy
 * (which showed up in-game as "colormap:finish:finish"). */
export function applyVehicleFinish(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = (mesh.userData["finishSource"] ??= mesh.material) as THREE.Material | THREE.Material[];
    mesh.material = Array.isArray(src) ? src.map(upgrade) : upgrade(src);
  });
  return root;
}
