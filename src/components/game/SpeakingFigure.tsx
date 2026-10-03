import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { getVoicePose } from "@/game/voice-animation";

/** Interior NPC whose jaw, head and arm follow the voice director's live envelope. */
export function SpeakingFigure({ name, color }: { name: string; color: string }) {
  const head = useRef<THREE.Group>(null!);
  const jaw = useRef<THREE.Mesh>(null!);
  const arm = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);
  const key = name.toUpperCase();
  useFrame((state) => {
    const pose = getVoicePose((s) => s === key, state.clock.elapsedTime);
    if (jaw.current) jaw.current.position.y = 1.62 - pose.jaw * 0.12;
    if (head.current) head.current.rotation.set(pose.nod - pose.lean * 0.5, 0, pose.tilt);
    if (arm.current) arm.current.rotation.x = -pose.arm * 1.4;
    if (torso.current) { torso.current.rotation.x = pose.lean; torso.current.scale.y = 1 + pose.breathe; }
  });
  return (
    <group ref={torso}>
      <mesh position={[0, 0.9, 0]} castShadow><capsuleGeometry args={[0.32, 1.1, 4, 8]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>
      <group ref={arm} position={[0.4, 1.35, 0]}><mesh position={[0, -0.35, 0]} castShadow><capsuleGeometry args={[0.09, 0.55, 4, 6]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh></group>
      <group ref={head} position={[0, 1.75, 0]}>
        <mesh castShadow><sphereGeometry args={[0.24, 16, 12]} /><meshStandardMaterial color="#e8c9a8" roughness={0.7} /></mesh>
        <mesh position={[0.08, 0.04, 0.21]}><sphereGeometry args={[0.03, 6, 6]} /><meshBasicMaterial color="#1b1d22" /></mesh>
        <mesh position={[-0.08, 0.04, 0.21]}><sphereGeometry args={[0.03, 6, 6]} /><meshBasicMaterial color="#1b1d22" /></mesh>
      </group>
      <mesh ref={jaw} position={[0, 1.62, 0.17]}><boxGeometry args={[0.14, 0.035, 0.06]} /><meshBasicMaterial color="#5a2a24" /></mesh>
    </group>
  );
}
