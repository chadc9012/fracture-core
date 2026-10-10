import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { lootCaches, RARITY_HEX, type LootCache } from "@/game/loot-caches";

/**
 * World loot caches, drawn as three instanced meshes (crate, rarity-lit seam, faint sky beam) so
 * ~40 caches cost three draw calls. Opened-today caches are hidden; scenario rules live in loot-caches.ts.
 */
export function LootCaches({ opened }: { opened: string[] }) {
  const visible = useMemo(() => lootCaches().filter((c) => !opened.includes(c.id)), [opened]);
  const crate = useRef<THREE.InstancedMesh>(null!);
  const seam = useRef<THREE.InstancedMesh>(null!);
  const beam = useRef<THREE.InstancedMesh>(null!);
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: false }), []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    visible.forEach((c: LootCache, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (c.x * 13.1 + c.z * 7.7) % (Math.PI * 2));
      m.compose(new THREE.Vector3(c.x, c.y + 0.45, c.z), q, new THREE.Vector3(1, 1, 1));
      crate.current?.setMatrixAt(i, m);
      seam.current?.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(c.x, c.y + 12, c.z), q, new THREE.Vector3(1, 1, 1));
      beam.current?.setMatrixAt(i, m);
      col.set(RARITY_HEX[c.rarity]);
      seam.current?.setColorAt(i, col);
      beam.current?.setColorAt(i, col);
    });
    for (const r of [crate, seam, beam]) if (r.current) {
      r.current.count = visible.length;
      r.current.instanceMatrix.needsUpdate = true;
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
    }
  }, [visible]);

  useFrame(({ clock }) => { beamMat.opacity = 0.12 + Math.sin(clock.elapsedTime * 2) * 0.05; });

  const max = lootCaches().length;
  return (
    <group>
      <instancedMesh ref={crate} args={[undefined, undefined, max]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1.4, 0.9, 0.9]} />
        <meshStandardMaterial color="#3b4048" metalness={0.7} roughness={0.45} />
      </instancedMesh>
      <instancedMesh ref={seam} args={[undefined, undefined, max]} frustumCulled={false}>
        <boxGeometry args={[1.45, 0.08, 0.95]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.4} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={beam} args={[undefined, undefined, max]} material={beamMat} frustumCulled={false}>
        <cylinderGeometry args={[0.15, 0.4, 24, 8, 1, true]} />
      </instancedMesh>
    </group>
  );
}
