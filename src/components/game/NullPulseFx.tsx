import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldSim } from "@/game/sim";
import { walkHeight } from "@/game/terrain";
import { pulseFrame, type PulseFxTier } from "@/game/null-pulse-fx";

/** Cyan Null Disruption shockwave. Starts only when sim.nullPulse changes (i.e. the perk really fired), is sized to the
 * real stun radius, and is two persistent meshes toggled by visibility (no per-pulse allocation, nothing left behind).
 * It is a stun/poise shockwave, NOT a shield-removal effect. */
export function NullPulseFx({ sim, tier, reducedMotion }: { sim: WorldSim; tier: PulseFxTier; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const dome = useRef<THREE.Mesh>(null);
  const seen = useRef(0);
  const start = useRef(-1);
  const at = useRef({ x: 0, z: 0, r: 1 });
  useFrame(() => {
    const g = group.current, rm = ring.current, dm = dome.current;
    if (!g || !rm || !dm) return;
    const p = sim.nullPulse;
    const now = performance.now() / 1000;
    if (p && p.id !== seen.current) { seen.current = p.id; start.current = now; at.current = { x: p.x, z: p.z, r: p.radius }; }
    const f = start.current < 0 ? pulseFrame(-1, { reducedMotion, tier }) : pulseFrame(now - start.current, { reducedMotion, tier });
    g.visible = f.active;
    if (!f.active) return;
    const { x, z, r } = at.current;
    g.position.set(x, walkHeight(x, z) + 0.25, z);
    const s = Math.max(0.001, f.ringScale * r);
    rm.scale.set(s, s, 1);
    (rm.material as THREE.MeshBasicMaterial).opacity = f.ringOpacity;
    dm.visible = f.domeOpacity > 0;
    dm.scale.set(s, s, s);
    (dm.material as THREE.MeshBasicMaterial).opacity = f.domeOpacity;
  });
  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={20}>
        <ringGeometry args={[0.92, 1, 64]} />
        <meshBasicMaterial color="#19e6ff" transparent opacity={0} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={dome} visible={false} renderOrder={19}>
        <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#19e6ff" transparent opacity={0} depthWrite={false} toneMapped={false} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}
