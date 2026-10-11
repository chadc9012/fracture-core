import { useLayoutEffect } from "react";
import * as THREE from "three";

const tmp = new THREE.Object3D();
const col = new THREE.Color();
/** Writes instance matrices (and optional colours) once per `items` identity. `place` gets a reset Object3D. */
export function useInstances<T>(ref: { current: THREE.InstancedMesh | null }, items: readonly T[], place: (o: THREE.Object3D, p: T, i: number) => void, color?: (p: T, i: number) => string) {
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    items.forEach((p, i) => {
      tmp.position.set(0, 0, 0); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1);
      place(tmp, p, i); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix);
      if (color) m.setColorAt(i, col.set(color(p, i)));
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
}
