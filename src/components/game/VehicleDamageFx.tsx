import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VehicleCondition } from "@/game/vehicle-condition";
/** Fixed mesh budget: no particle allocations or physics in the renderer. */
export function VehicleDamageFx({ condition }: { condition: { current: VehicleCondition } }) {
  const smoke = useRef<THREE.Group>(null);
  const scratches = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (smoke.current) { smoke.current.visible = condition.current.engine > 35; smoke.current.position.y = 2 + Math.sin(clock.elapsedTime * 1.5) * 0.2; }
    if (scratches.current) scratches.current.visible = condition.current.body > 5;
  });
  return <>
    <group ref={smoke} visible={false} position={[0, 2, 2]}>{[0, 1, 2].map((i) => <mesh key={i} position={[i * 0.16, i * 0.5, 0]}><sphereGeometry args={[0.28 + i * 0.15, 8, 6]} /><meshStandardMaterial color="#687078" transparent opacity={0.35} depthWrite={false} /></mesh>)}</group>
    <group ref={scratches} visible={false}>{[-1, 1].map((side) => <mesh key={side} position={[side * 1.53, 1.15, 0.3]} rotation={[0, 0, side * 0.2]}><boxGeometry args={[0.025, 0.04, 1.4]} /><meshStandardMaterial color="#a3abb0" metalness={0.8} roughness={0.6} /></mesh>)}</group>
  </>;
}