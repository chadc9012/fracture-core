import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import type { WorldSim } from "@/game/sim";
import { walkHeight } from "@/game/terrain";
import { MAX_RIFT_TURRETS } from "@/game/operator-abilities";

/** CIPHER's deployable turrets: a fixed pool of small rift-cored guns toggled from sim.riftTurrets. */
export function RiftTurrets({ sim }: { sim: WorldSim }) {
  const pool = useRef<THREE.Group>(null!);
  useFrame(() => {
    const g = pool.current;
    if (!g) return;
    for (let i = 0; i < MAX_RIFT_TURRETS; i++) {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) continue;
      const t = sim.riftTurrets[i];
      node.visible = Boolean(t);
      if (!t) continue;
      node.position.set(t.x, walkHeight(t.x, t.z), t.z);
      const head = node.children[1] as THREE.Group | undefined;
      if (head) head.rotation.y = t.rot;
      const flash = head?.children[1] as THREE.Mesh | undefined;
      if (flash) { flash.visible = t.flash > 0.05; flash.scale.setScalar(0.5 + t.flash); }
    }
  });
  return <group ref={pool}>
    {Array.from({ length: MAX_RIFT_TURRETS }, (_, i) => <group key={i} visible={false}>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.55, 0.8, 1, 8]} /><meshStandardMaterial color="#2a2f44" metalness={0.7} roughness={0.35} /></mesh>
      <group position={[0, 1.2, 0]}>
        <mesh position={[0, 0, 0.6]}><boxGeometry args={[0.28, 0.28, 1.4]} /><meshStandardMaterial color="#15182a" metalness={0.8} roughness={0.3} /></mesh>
        <mesh position={[0, 0, 1.4]} visible={false}><sphereGeometry args={[0.3, 8, 8]} /><meshBasicMaterial color="#ffc864" toneMapped={false} /></mesh>
        <mesh position={[0, 0.35, 0]}><octahedronGeometry args={[0.28]} /><meshBasicMaterial color="#b06bff" toneMapped={false} /></mesh>
      </group>
      <pointLight position={[0, 1.4, 0]} color="#b06bff" intensity={3} distance={7} />
    </group>)}
  </group>;
}
