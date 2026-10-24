import * as THREE from "three";

/** The bounds of `root` in root's OWN frame (independent of where the object or its parents sit in the world).
 * `Box3.setFromObject` returns a WORLD box, so a vehicle measured while parked at x=-300 got a box 300 m from its
 * body and every effect placed from it (engine smoke, flames, sparks, dents) rendered far from the car. */
export function localBounds(root: THREE.Object3D): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert();
  const out = new THREE.Box3();
  const m = new THREE.Matrix4(), corner = new THREE.Box3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (!mesh.geometry.boundingBox) return;
    m.multiplyMatrices(inv, mesh.matrixWorld);
    corner.copy(mesh.geometry.boundingBox).applyMatrix4(m);
    out.union(corner);
  });
  return out;
}
