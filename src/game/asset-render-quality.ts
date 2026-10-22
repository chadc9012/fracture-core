import * as THREE from "three";

/** Apply consistent rendering quality to imported world assets without replacing their authored PBR materials.
 * Texture settings are modified on the shared GLTF cache intentionally; mesh flags are instance-local.
 * Viewmodels opt out of world shadows because they render in their own depth layer.
 */
export function prepareWorldAsset(root: THREE.Object3D, options: {
  castShadow?: boolean;
  receiveShadow?: boolean;
  anisotropy?: number;
  skinnedCulling?: boolean;
} = {}): void {
  const { castShadow = true, receiveShadow = true, anisotropy = 4, skinnedCulling = false } = options;
  const visited = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh && !skinnedCulling) mesh.frustumCulled = false;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      // Preserve GLTF material identity and authored texture maps; don't replace
      // metallic/roughness/normal maps with flat procedural substitutes.
      const pbr = material as THREE.MeshStandardMaterial;
      for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"] as const) {
        const texture = pbr[key];
        if (!texture?.isTexture || visited.has(texture)) continue;
        visited.add(texture);
        if (texture.magFilter !== THREE.LinearFilter) texture.magFilter = THREE.LinearFilter;
        if (texture.generateMipmaps && texture.minFilter !== THREE.LinearMipmapLinearFilter) {
          texture.minFilter = THREE.LinearMipmapLinearFilter;
        }
        texture.anisotropy = Math.max(texture.anisotropy, Math.min(16, Math.max(1, anisotropy)));
        texture.needsUpdate = true;
      }
    }
  });
}
