import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { nodeState, type Structure } from "@/game/destruction";

const BASE: Record<string, string> = { CONCRETE: "#8d877d", METAL: "#4f5660", GLASS: "#9fdcff" };
const STATE_EMISSIVE = { INTACT: "#000000", CRACKED: "#3a2a00", UNSTABLE: "#ff7a1a", CRITICAL: "#ff2020" } as const;

/** Renders a structural graph; visibility and damage tint update imperatively from the node state. */
export function Interior({ structure }: { structure: Structure }) {
  const meshes = useRef<Record<string, THREE.Mesh | null>>({});
  const debris = useRef<(THREE.Mesh | null)[]>([]);
  const seen = useRef(-1);
  useFrame(() => {
    if (seen.current !== structure.version) {
      seen.current = structure.version;
      for (const n of structure.nodes.values()) {
        const m = meshes.current[n.id]; if (!m) continue;
        m.visible = !n.isDestroyed;
        const mat = m.material as THREE.MeshStandardMaterial;
        const state = nodeState(n);
        mat.emissive.set(STATE_EMISSIVE[state]);
        mat.emissiveIntensity = state === "CRITICAL" ? 0.9 : state === "UNSTABLE" ? 0.45 : 0.3;
      }
    }
    structure.debris.forEach((d, i) => {
      const m = debris.current[i]; if (!m) return;
      m.visible = d.alive;
      if (d.alive) { m.position.set(d.x, d.y, d.z); m.rotation.x += d.spin * 0.016; m.rotation.z += d.spin * 0.01; m.scale.setScalar(d.size); (m.material as THREE.MeshStandardMaterial).color.set(d.color); }
    });
  });
  return (
    <group>
      {[...structure.nodes.values()].map((n) => (
        <mesh key={n.id} ref={(m) => { meshes.current[n.id] = m; }} position={[n.x, n.y, n.z]} castShadow receiveShadow>
          <boxGeometry args={[n.w, n.h, n.d]} />
          <meshStandardMaterial color={BASE[n.material]} roughness={n.material === "GLASS" ? 0.05 : n.material === "METAL" ? 0.4 : 0.9} metalness={n.material === "METAL" ? 0.7 : 0.05} transparent={n.material === "GLASS"} opacity={n.material === "GLASS" ? 0.35 : 1} />
        </mesh>
      ))}
      {structure.debris.map((_, i) => (
        <mesh key={i} ref={(m) => { debris.current[i] = m; }} visible={false} castShadow>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color="#888" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
