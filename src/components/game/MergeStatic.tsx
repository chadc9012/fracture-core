import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Static decoration written as many small meshes (street furniture, entrance trim) costs one draw call per mesh. This
 * renders the children once, bakes every mesh into one geometry per material, and draws those instead: hundreds of draw
 * calls become a handful, which phones need. Only for decoration that never moves, animates or changes after mount. */
export function MergeStatic({ name, children }: { name: string; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const [merged, setMerged] = useState<THREE.Mesh[] | null>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || merged) return;
    root.updateMatrixWorld(true);
    const toRoot = root.matrixWorld.clone().invert(), m = new THREE.Matrix4();
    const groups = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      for (const key of Object.keys(src.attributes)) if (key !== "position" && key !== "normal" && key !== "uv") src.deleteAttribute(key);
      if (!src.attributes.normal) src.computeVertexNormals();
      if (!src.attributes.uv) src.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position!.count * 2), 2));
      src.applyMatrix4(m.multiplyMatrices(toRoot, mesh.matrixWorld));
      const g = groups.get(mesh.material) ?? { geos: [], cast: false, receive: false };
      g.geos.push(src); g.cast ||= mesh.castShadow; g.receive ||= mesh.receiveShadow;
      groups.set(mesh.material, g);
    });
    const out: THREE.Mesh[] = [];
    for (const [mat, g] of groups) {
      const geo = mergeGeometries(g.geos, false);
      for (const s of g.geos) s.dispose();
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `${name}:merged`; mesh.castShadow = g.cast; mesh.receiveShadow = g.receive;
      out.push(mesh);
    }
    setMerged(out);
  }, [merged, name]);
  useLayoutEffect(() => () => { for (const mesh of merged ?? []) mesh.geometry.dispose(); }, [merged]);
  if (merged) return <group name={name}>{merged.map((mesh) => <primitive key={mesh.uuid} object={mesh} />)}</group>;
  return <group ref={ref} name={name}>{children}</group>;
}
