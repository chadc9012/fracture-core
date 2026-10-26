import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldSim } from "@/game/sim";
import { walkHeight } from "@/game/terrain";
import { MAW_RADIUS } from "@/game/maw-collapse";

const DURATION = 0.9;
/** Violet Maw Collapse: a ring that contracts inward (the pull), with a dark core flash. Starts only when sim.mawCollapse changes. One persistent group, toggled by visibility. */
export function MawCollapseFx({ sim, reducedMotion }: { sim: WorldSim; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const seen = useRef(0);
  const start = useRef(-1);
  const at = useRef({ x: 0, z: 0 });
  useFrame(() => {
    const g = group.current, rm = ring.current, cm = core.current;
    if (!g || !rm || !cm) return;
    const c = sim.mawCollapse, now = performance.now() / 1000;
    if (c && c.id !== seen.current) { seen.current = c.id; start.current = now; at.current = { x: c.x, z: c.z }; }
    const t = start.current < 0 ? 1 : (now - start.current) / DURATION;
    g.visible = t >= 0 && t < 1;
    if (!g.visible) return;
    g.position.set(at.current.x, walkHeight(at.current.x, at.current.z) + 0.25, at.current.z);
    const s = Math.max(0.05, reducedMotion ? MAW_RADIUS * 0.5 : MAW_RADIUS * (1 - t * 0.9));
    rm.scale.set(s, s, 1);
    (rm.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
    const k = reducedMotion ? 1.2 : 0.6 + 1.6 * Math.sin(Math.min(1, t * 1.4) * Math.PI);
    cm.scale.set(k, k, k);
    (cm.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t);
  });
  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={20}>
        <ringGeometry args={[0.92, 1, 64]} />
        <meshBasicMaterial color="#a970ff" transparent opacity={0} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={core} position={[0, 1, 0]} renderOrder={19}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#2a0a4a" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
