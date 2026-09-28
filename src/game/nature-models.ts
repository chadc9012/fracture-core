/** Feeds a real, loaded low-poly GLB model into the existing drei <Instances>/<Instance> pipeline —
 * so a forest of real tree models still renders as cheaply as the cone primitives it replaces.
 * Extracts and (when possible) merges the model's own mesh geometry once per model, baking each
 * sub-mesh's local transform into the geometry first so multi-part models come out positioned
 * correctly with a single draw call per species. */
import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MODELS, type ModelKey } from "./models";

export type InstancedModel = { geometry: THREE.BufferGeometry; material: THREE.Material };

export function useInstancedModel(key: ModelKey): InstancedModel | null {
  const gltf = useGLTF(MODELS[key]) as unknown as { scene: THREE.Object3D };
  return useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    if (!meshes.length) return null;

    const baked = meshes.map((m) => {
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      return g;
    });

    let geometry: THREE.BufferGeometry;
    try {
      geometry = (baked.length > 1 ? mergeGeometries(baked, true) : null) ?? baked[0]!;
    } catch {
      geometry = baked[0]!;
    }

    const sourceMaterial = meshes[0]!.material;
    const material = (Array.isArray(sourceMaterial) ? sourceMaterial[0]! : sourceMaterial).clone();
    if ("vertexColors" in material) (material as THREE.MeshStandardMaterial).vertexColors = geometry.hasAttribute("color");

    return { geometry, material };
  }, [gltf]);
}
