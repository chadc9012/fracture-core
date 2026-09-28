import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/** Repeated street furniture shared by the submerged and surface markets. All coordinates are local. */
export function LightBar({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={position}><boxGeometry args={size} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>;
}

export function ShopSign({ label, color, position, face = 1 }: { label: string; color: string; position: [number, number, number]; face?: 1 | -1 }) {
  return (
    <group position={position} rotation-y={face === 1 ? 0 : Math.PI}>
      <mesh><boxGeometry args={[5.2, 1.2, 0.22]} /><meshStandardMaterial color="#101923" metalness={0.65} roughness={0.35} /></mesh>
      <mesh position={[0, 0, 0.13]}><planeGeometry args={[4.95, 0.96]} /><meshBasicMaterial color={color} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <Text position={[0, 0, 0.16]} fontSize={0.52} maxWidth={4.7} color={color} anchorX="center" anchorY="middle" outlineWidth={0.018} outlineColor="#050d13">{label}</Text>
      <LightBar position={[0, -0.64, 0.17]} size={[5.1, 0.07, 0.09]} color={color} />
    </group>
  );
}

/** A self-contained elevated rail with a small articulated, continuously circulating three-car train. */
export function ElevatedTrain({ length, height, accent, dark = "#202d36" }: { length: number; height: number; accent: string; dark?: string }) {
  const train = useRef<THREE.Group>(null);
  const progress = useRef(0.24);
  const carOffsets = useMemo(() => [0, -5.5, -11], []);
  useFrame((_, delta) => {
    progress.current = (progress.current + Math.min(delta, 0.05) * 0.055) % 1;
    if (train.current) train.current.position.z = -length / 2 + progress.current * (length + 17);
  });
  return (
    <group position={[0, height, 0]}>
      {[-1.05, 1.05].map((x) => <group key={x} position-x={x}>
        <mesh><boxGeometry args={[0.24, 0.38, length]} /><meshStandardMaterial color={dark} metalness={0.85} roughness={0.3} /></mesh>
        <LightBar position={[0, -0.25, 0]} size={[0.1, 0.08, length]} color={accent} />
      </group>)}
      {Array.from({ length: Math.floor(length / 12) }, (_, i) => <group key={i} position-z={-length / 2 + i * 12 + 5}>
        <mesh position-y={-0.42}><boxGeometry args={[3.5, 0.32, 0.5]} /><meshStandardMaterial color={dark} metalness={0.7} roughness={0.4} /></mesh>
        <mesh position={[0, -2.6, 0]}><boxGeometry args={[0.36, 5, 0.36]} /><meshStandardMaterial color={dark} metalness={0.7} roughness={0.4} /></mesh>
      </group>)}
      <group ref={train} position-y={0.75}>
        {carOffsets.map((offset) => <group key={offset} position-z={offset}>
          <mesh castShadow><boxGeometry args={[3.05, 2.3, 5]} /><meshStandardMaterial color={dark} metalness={0.65} roughness={0.3} /></mesh>
          <mesh position-y={1.26}><boxGeometry args={[2.6, 0.3, 4.4]} /><meshStandardMaterial color="#6c8691" metalness={0.8} roughness={0.25} /></mesh>
          {[-1, 1].map((side) => <group key={side} position-x={side * 1.55}>
            <mesh position-y={0.3}><boxGeometry args={[0.035, 0.83, 3.85]} /><meshBasicMaterial color="#80d8e8" transparent opacity={0.66} /></mesh>
            <LightBar position={[side * 0.02, -0.8, 0]} size={[0.08, 0.12, 4.6]} color={accent} />
          </group>)}
          <mesh position-z={2.53}><boxGeometry args={[2.4, 0.12, 0.08]} /><meshBasicMaterial color={accent} /></mesh>
        </group>)}
      </group>
    </group>
  );
}