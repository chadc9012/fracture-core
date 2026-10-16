import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { wyrmlingOffset } from "@/game/dragon-covenant";

type Held = { current: { x: number; y: number; z: number; yaw: number; inVehicle?: boolean } };

/** Vyrak's bonded form (dragon-covenant.ts): a small floating wyrmling keeping station at the Operator's shoulder.
 * Presentation only — the bond itself lives in progression.earnedRewards; hidden while driving. Procedural body
 * (no authored GLB yet): ember-lit scales, slow wing beats, a warm under-glow. */
export function Wyrmling({ held }: { held: Held }) {
  const root = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);
  const pos = useRef<THREE.Vector3 | null>(null);
  useFrame(({ clock }, delta) => {
    const s = held.current, g = root.current;
    if (!g) return;
    g.visible = !s.inVehicle;
    if (s.inVehicle) return;
    const t = clock.elapsedTime;
    const [ox, oy, oz] = wyrmlingOffset(t, s.yaw);
    const target = new THREE.Vector3(s.x + ox, s.y + oy, s.z + oz);
    if (!pos.current) pos.current = target.clone();
    pos.current.lerp(target, Math.min(1, delta * 4));
    g.position.copy(pos.current);
    g.rotation.y = s.yaw + Math.sin(t * 0.9) * 0.2;
    const flap = Math.sin(t * 5) * 0.55;
    if (wingL.current) wingL.current.rotation.z = 0.5 + flap;
    if (wingR.current) wingR.current.rotation.z = -0.5 - flap;
  });
  const scale = "#7a2e1d", glow = "#ff7a2e";
  return (
    <group ref={root} scale={0.55}>
      {/* body */}
      <mesh scale={[0.8, 0.7, 1.3]}><sphereGeometry args={[0.4, 14, 10]} /><meshStandardMaterial color={scale} metalness={0.4} roughness={0.5} emissive={glow} emissiveIntensity={0.15} /></mesh>
      {/* head */}
      <mesh position={[0, 0.22, 0.5]} scale={[0.7, 0.6, 0.9]}><sphereGeometry args={[0.24, 12, 8]} /><meshStandardMaterial color={scale} metalness={0.4} roughness={0.5} /></mesh>
      {/* snout + eyes */}
      <mesh position={[0, 0.18, 0.72]} rotation-x={Math.PI / 2}><coneGeometry args={[0.1, 0.25, 8]} /><meshStandardMaterial color={scale} roughness={0.6} /></mesh>
      <mesh position={[0.09, 0.28, 0.6]}><sphereGeometry args={[0.035, 8, 6]} /><meshBasicMaterial color="#ffd27a" toneMapped={false} /></mesh>
      <mesh position={[-0.09, 0.28, 0.6]}><sphereGeometry args={[0.035, 8, 6]} /><meshBasicMaterial color="#ffd27a" toneMapped={false} /></mesh>
      {/* horns */}
      <mesh position={[0.1, 0.38, 0.42]} rotation-x={-0.6}><coneGeometry args={[0.04, 0.22, 6]} /><meshStandardMaterial color="#e8d9c0" roughness={0.4} /></mesh>
      <mesh position={[-0.1, 0.38, 0.42]} rotation-x={-0.6}><coneGeometry args={[0.04, 0.22, 6]} /><meshStandardMaterial color="#e8d9c0" roughness={0.4} /></mesh>
      {/* wings */}
      <mesh ref={wingL} position={[0.32, 0.15, 0]} rotation-y={-0.3}><boxGeometry args={[0.55, 0.03, 0.35]} /><meshStandardMaterial color="#93361f" roughness={0.6} emissive={glow} emissiveIntensity={0.25} side={THREE.DoubleSide} /></mesh>
      <mesh ref={wingR} position={[-0.32, 0.15, 0]} rotation-y={0.3}><boxGeometry args={[0.55, 0.03, 0.35]} /><meshStandardMaterial color="#93361f" roughness={0.6} emissive={glow} emissiveIntensity={0.25} side={THREE.DoubleSide} /></mesh>
      {/* tail */}
      <mesh position={[0, 0, -0.62]} rotation-x={Math.PI / 2 + 0.3}><coneGeometry args={[0.09, 0.6, 8]} /><meshStandardMaterial color={scale} roughness={0.6} /></mesh>
      {/* ember glow under the body */}
      <mesh position={[0, -0.18, 0.1]} rotation-x={Math.PI / 2}><circleGeometry args={[0.2, 14]} /><meshBasicMaterial color={glow} toneMapped={false} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}
