import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { walkHeight } from "@/game/terrain";
import type { WorldSim } from "@/game/sim";

/** Ground telegraphs for enemy attack patterns (enemy-patterns.ts): a ring where a leap, bash, ambush or artillery shell will land,
 *  and a lane where a Charger will run. They fill as the wind-up progresses, so the player can read when to move. Reads
 *  `machine.patternTell` only; pooled meshes, nothing allocated per frame. */
const POOL = 16;
export function PatternTelegraphs({ sim }: { sim: WorldSim }) {
  const root = useRef<THREE.Group>(null!);
  const idx = useMemo(() => Array.from({ length: POOL }, (_, i) => i), []);
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    let n = 0;
    for (const m of sim.machines) {
      const t = m.alive ? m.patternTell : undefined;
      if (!t || n >= POOL) continue;
      const node = g.children[n++] as THREE.Group, ring = node.children[0] as THREE.Mesh, lane = node.children[1] as THREE.Mesh;
      node.visible = true;
      const y = walkHeight(t.x, t.z) + 0.2;
      const ringMat = ring.material as THREE.MeshBasicMaterial, laneMat = lane.material as THREE.MeshBasicMaterial;
      if (t.kind === "RING") {
        ring.visible = true; lane.visible = false;
        node.position.set(t.x, y, t.z); node.rotation.y = 0;
        ring.scale.setScalar(Math.max(0.3, t.radius));
        ringMat.opacity = 0.25 + 0.6 * t.progress;
      } else {
        // a lane runs from the enemy to the locked point; the tell point is the far end
        ring.visible = false; lane.visible = true;
        const sx = m.x, sz = m.z, len = Math.hypot(t.x - sx, t.z - sz) || 1;
        node.position.set((sx + t.x) / 2, walkHeight(sx, sz) + 0.2, (sz + t.z) / 2);
        node.rotation.y = Math.atan2(t.x - sx, t.z - sz);
        lane.scale.set(Math.max(0.5, t.width), len, 1);
        laneMat.opacity = 0.18 + 0.5 * t.progress;
      }
    }
    for (let i = n; i < POOL; i++) (g.children[i] as THREE.Object3D).visible = false;
  });
  return <group ref={root}>{idx.map((i) => <group key={i} visible={false}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.82, 1, 40]} /><meshBasicMaterial color="#ff4a2a" transparent opacity={0.6} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1, 1]} /><meshBasicMaterial color="#ff4a2a" transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} /></mesh>
  </group>)}</group>;
}
