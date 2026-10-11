import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { droneStation, stepDrone, type DronePose } from "@/game/nova-drone";

type Held = { current: { x: number; y: number; z: number; yaw: number; inVehicle?: boolean } };

/** NOVA's hovering field drone (rules: nova-drone.ts): a small saucer with an amber under-glow and a cyan sensor eye, keeping station at the
 * Operator's left shoulder. Presentation only; hidden while driving. Four meshes, no lights (the glow is emissive). */
export function NovaDrone({ held }: { held: Held }) {
  const root = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const pose = useRef<DronePose | null>(null);
  useFrame(({ clock }, delta) => {
    const s = held.current, g = root.current;
    if (!g) return;
    g.visible = !s.inVehicle;
    if (s.inVehicle) return;
    const t = clock.elapsedTime;
    const target = droneStation(s.x, s.y, s.z, s.yaw, t);
    pose.current = pose.current ? stepDrone(pose.current, target, Math.min(delta, 0.1)) : target;
    const p = pose.current;
    g.position.set(p.x, p.y, p.z);
    g.rotation.set(Math.sin(t * 1.3) * 0.08, p.yaw, Math.cos(t * 1.1) * 0.08);
    if (ring.current) ring.current.rotation.y = t * 2.2;
  });
  return (
    <group ref={root}>
      <mesh scale={[1, 0.32, 1]}><sphereGeometry args={[0.34, 20, 10]} /><meshStandardMaterial color="#3b4048" metalness={0.85} roughness={0.3} /></mesh>
      <mesh ref={ring} rotation-x={Math.PI / 2}><torusGeometry args={[0.36, 0.035, 6, 24]} /><meshStandardMaterial color="#9aa3ad" metalness={0.9} roughness={0.25} /></mesh>
      <mesh position={[0, -0.09, 0]} rotation-x={Math.PI / 2}><circleGeometry args={[0.22, 20]} /><meshBasicMaterial color="#ffb347" toneMapped={false} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.02, 0.31]}><sphereGeometry args={[0.045, 10, 8]} /><meshBasicMaterial color="#63f2ff" toneMapped={false} /></mesh>
    </group>
  );
}
