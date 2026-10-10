import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldSim } from "@/game/sim";
import { walkHeight } from "@/game/terrain";

const POOL = 10;

/** Presentation for Unique Scenario encounters (encounter-sim.ts). It only READS sim.encounterZones / sim.encounterEvents:
 * zone discs are amber while arming, red once they hurt (pale blue for slowing zones), and the attack telegraph is a ring that
 * fills over the tell time. Damage, slowing and hit tests all happen in the sim; hiding this component changes nothing but visibility.
 * Pooled meshes, no per-frame allocation. With reduced motion the pulsing is replaced by steady opacity. */
export function EncounterFx({ sim, reducedMotion }: { sim: WorldSim; reducedMotion: boolean }) {
  const discs = useRef<(THREE.Mesh | null)[]>([]);
  const tellRing = useRef<THREE.Mesh>(null);
  const tellFill = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const now = performance.now() / 1000;
    const zones = sim.encounterZones;
    for (let i = 0; i < POOL; i++) {
      const mesh = discs.current[i];
      if (!mesh) continue;
      const z = zones[i];
      if (!z) { mesh.visible = false; continue; }
      const armed = now >= z.armAt;
      mesh.visible = true;
      mesh.position.set(z.x, walkHeight(z.x, z.z) + 0.2, z.z);
      mesh.scale.set(z.radius, z.radius, 1);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.set(z.kind === "SLOW" ? (armed ? "#9fe3ff" : "#d8f4ff") : armed ? "#ff3b2e" : "#ffb02e");
      mat.opacity = armed ? (reducedMotion ? 0.5 : 0.42 + Math.sin(now * 6) * 0.1) : 0.22;
    }
    const tell = [...sim.encounterEvents].reverse().find((e) => e.kind === "TELL");
    const ring = tellRing.current, fill = tellFill.current;
    if (!ring || !fill) return;
    const left = tell ? tell.at + tell.duration - now : -1;
    if (!tell || left <= 0 || tell.radius <= 0) { ring.visible = false; fill.visible = false; return; }
    const progress = 1 - left / Math.max(0.01, tell.duration);
    const y = walkHeight(tell.x, tell.z) + 0.3;
    ring.visible = fill.visible = true;
    ring.position.set(tell.x, y, tell.z); fill.position.set(tell.x, y + 0.02, tell.z);
    ring.scale.set(tell.radius, tell.radius, 1);
    const f = Math.max(0.001, tell.radius * progress);
    fill.scale.set(f, f, 1);
  });
  return (
    <group>
      {Array.from({ length: POOL }, (_, i) => (
        <mesh key={i} ref={(m) => { discs.current[i] = m; }} visible={false} rotation={[-Math.PI / 2, 0, 0]} renderOrder={18}>
          <circleGeometry args={[1, 40]} />
          <meshBasicMaterial color="#ffb02e" transparent opacity={0.3} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh ref={tellRing} visible={false} rotation={[-Math.PI / 2, 0, 0]} renderOrder={21}>
        <ringGeometry args={[0.96, 1, 64]} />
        <meshBasicMaterial color="#ffd36a" transparent opacity={0.9} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={tellFill} visible={false} rotation={[-Math.PI / 2, 0, 0]} renderOrder={20}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color="#ff5a2e" transparent opacity={0.28} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
