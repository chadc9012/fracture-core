import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { badlands, type Formation } from "@/game/badlands";
import { sandstoneFormation } from "@/game/organic-geometry";
import { addObstacle } from "@/game/obstacles";
import { walkHeight } from "@/game/terrain";

const BUTTE_SEEDS = [11, 23, 37] as const, SPIRE_SEEDS = [5, 19] as const;
let registered = false; // the obstacle grid has no removal: register the towers once, however often the region remounts

/** The Wastelands badlands (badlands.ts): fluted sandstone buttes and spires, instanced per geometry variant (5 draws),
 * vertex-coloured strata, sunk a little into the dunes so the rubble apron meets the sand. Solid, indestructible rock. */
export function Badlands({ shadows }: { shadows: boolean }) {
  const all = useMemo(() => badlands(), []);
  useEffect(() => {
    if (registered) return;
    registered = true;
    for (const f of all) addObstacle("rock", f.x, f.z, f.r * (f.kind === "spire" ? 1.05 : 0.95), 1e9, 3);
  }, [all]);
  const geos = useMemo(() => ({ butte: BUTTE_SEEDS.map((s) => sandstoneFormation(s, "butte")), spire: SPIRE_SEEDS.map((s) => sandstoneFormation(s, "spire")) }), []);
  useEffect(() => () => { [...geos.butte, ...geos.spire].forEach((g) => g.dispose()); }, [geos]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 }), []);
  useEffect(() => () => material.dispose(), [material]);
  return <group name="badlands">
    {geos.butte.map((g, i) => <Batch key={`b${i}`} geometry={g} material={material} items={all.filter((f) => f.kind === "butte" && f.seed % BUTTE_SEEDS.length === i)} shadows={shadows} />)}
    {geos.spire.map((g, i) => <Batch key={`s${i}`} geometry={g} material={material} items={all.filter((f) => f.kind === "spire" && f.seed % SPIRE_SEEDS.length === i)} shadows={shadows} />)}
  </group>;
}

const tmp = new THREE.Object3D();
function Batch({ geometry, material, items, shadows }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: Formation[]; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    items.forEach((f, i) => {
      // the base sits below the lowest ground under the footprint, so a tower on a dune slope never floats
      let low = Infinity;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; low = Math.min(low, walkHeight(f.x + Math.cos(a) * f.r, f.z + Math.sin(a) * f.r)); }
      tmp.position.set(f.x, Math.min(low, walkHeight(f.x, f.z)) - 1.2, f.z);
      tmp.rotation.set(0, f.yaw, 0);
      tmp.scale.set(f.r, f.h, f.r);
      tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadows} receiveShadow />;
}
