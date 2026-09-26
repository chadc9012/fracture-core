import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { ClassId } from "@/game/loadout";
import type { ArmorVisualState } from "./Scavenger";

/**
 * Sleek armored operative matching the class reference sheets: dark glossy plate over a suit,
 * glowing circuit seams, a band visor. Titan carries a tower shield, Hunter a torn scarf and holsters,
 * Warlock tech goggles and an orbiting drone. Same footprint as the old field model (feet ≈ -1.55, head ≈ 1.2).
 */
export function Operator({ armor = "#1b1f26", cloth = "#0e1014", visor = "#48d8ff", classId = "TITAN", visualState = "STABLE" }: { armor?: string; cloth?: string; visor?: string; classId?: ClassId; visualState?: ArmorVisualState }) {
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const drone = useRef<THREE.Group>(null);
  const orbit = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    const base = visualState === "ASCENDANT" ? 5 : visualState === "FRACTURE" ? 4 : visualState === "ACTIVE" ? 3 : 2.2;
    if (glow.current) glow.current.emissiveIntensity = base + Math.sin(clock.elapsedTime * 3) * 0.5;
    if (drone.current) { const t = clock.elapsedTime; drone.current.position.set(Math.cos(t * 0.9) * 0.9, 1.45 + Math.sin(t * 2) * 0.08, Math.sin(t * 0.9) * 0.9 - 0.2); drone.current.rotation.y = -t * 0.9; }
    if (orbit.current) orbit.current.rotation.y += delta * 1.2;
  });
  const titan = classId === "TITAN", hunter = classId === "HUNTER", warlock = classId === "WARLOCK";
  const bulk = titan ? 1.14 : hunter ? 0.92 : 1;
  const plate = <meshPhysicalMaterial color={armor} metalness={0.75} roughness={0.28} clearcoat={0.8} clearcoatRoughness={0.25} />;
  const suit = <meshStandardMaterial color={cloth} metalness={0.2} roughness={0.75} />;
  const line = <meshStandardMaterial ref={glow} color={visor} emissive={visor} emissiveIntensity={2.2} toneMapped={false} />;
  const seam = (key: string, p: [number, number, number], s: [number, number, number], r: [number, number, number] = [0, 0, 0]) =>
    <mesh key={key} position={p} rotation={r}><boxGeometry args={s} /><meshStandardMaterial color={visor} emissive={visor} emissiveIntensity={2.4} toneMapped={false} /></mesh>;

  return (
    <group scale={[bulk, 1, bulk]}>
      {/* legs: suit capsule + thigh/shin plates + knee caps + boots */}
      {[-0.24, 0.24].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, -0.95, 0]} castShadow><capsuleGeometry args={[0.15, 0.95, 6, 12]} />{suit}</mesh>
          <RoundedBox args={[0.3, 0.42, 0.3]} radius={0.08} position={[0, -0.62, 0.02]} castShadow>{plate}</RoundedBox>
          <RoundedBox args={[0.26, 0.44, 0.28]} radius={0.08} position={[0, -1.16, 0.03]} castShadow>{plate}</RoundedBox>
          <mesh position={[0, -0.88, 0.16]} castShadow><sphereGeometry args={[0.11, 12, 10]} />{plate}</mesh>
          <RoundedBox args={[0.26, 0.16, 0.44]} radius={0.05} position={[0, -1.47, 0.07]} castShadow><meshStandardMaterial color="#0b0d10" roughness={0.6} /></RoundedBox>
          {seam(`shin${x}`, [x > 0 ? 0.13 : -0.13, -1.14, 0.1], [0.02, 0.34, 0.02])}
        </group>
      ))}
      {/* hips + belt */}
      <RoundedBox args={[0.72, 0.26, 0.42]} radius={0.08} position={[0, -0.4, 0]} castShadow>{suit}</RoundedBox>
      <mesh position={[0, -0.34, 0]} castShadow><boxGeometry args={[0.76, 0.08, 0.46]} /><meshStandardMaterial color="#07080a" metalness={0.6} roughness={0.4} /></mesh>
      {/* torso: tapered suit + layered chest cuirass + abdomen segments */}
      <mesh position={[0, 0.1, 0]} castShadow><capsuleGeometry args={[0.34, 0.55, 8, 16]} />{suit}</mesh>
      <RoundedBox args={[0.78, 0.5, 0.5]} radius={0.14} position={[0, 0.32, 0.03]} castShadow>{plate}</RoundedBox>
      {[-0.05, -0.18].map((y, i) => <RoundedBox key={y} args={[0.52 - i * 0.06, 0.1, 0.44]} radius={0.04} position={[0, y, 0.02]} castShadow>{plate}</RoundedBox>)}
      {/* chest circuit sigil */}
      {seam("c1", [0, 0.44, 0.285], [0.24, 0.025, 0.02])}
      {seam("c2", [-0.13, 0.35, 0.285], [0.025, 0.16, 0.02])}
      {seam("c3", [0.13, 0.35, 0.285], [0.025, 0.16, 0.02])}
      {seam("c4", [-0.22, 0.18, 0.27], [0.02, 0.2, 0.02], [0, 0, -0.5])}
      {seam("c5", [0.22, 0.18, 0.27], [0.02, 0.2, 0.02], [0, 0, 0.5])}
      <mesh position={[0, 0.3, 0.29]}><circleGeometry args={[0.045, 16]} />{line}</mesh>
      {/* shoulders + arms */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.5, 0, 0]}>
          <RoundedBox args={[titan ? 0.4 : 0.32, 0.26, 0.42]} radius={0.1} position={[side * 0.04, 0.55, 0]} rotation={[0, 0, side * -0.25]} castShadow>{plate}</RoundedBox>
          {seam(`sh${side}`, [side * 0.1, 0.6, 0.2], [0.14, 0.02, 0.02], [0, 0, side * -0.25])}
          <mesh position={[side * 0.06, 0.18, 0]} castShadow><capsuleGeometry args={[0.1, 0.42, 6, 10]} />{suit}</mesh>
          <RoundedBox args={[0.22, 0.36, 0.22]} radius={0.07} position={[side * 0.07, -0.2, 0.02]} castShadow>{plate}</RoundedBox>
          {seam(`fa${side}`, [side * 0.07, -0.2, 0.13], [0.02, 0.26, 0.02])}
          <mesh position={[side * 0.07, -0.44, 0.02]} castShadow><sphereGeometry args={[0.09, 10, 8]} /><meshStandardMaterial color="#0b0d10" roughness={0.6} /></mesh>
        </group>
      ))}
      {/* neck + helmet with band visor */}
      <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.12, 0.15, 0.16, 12]} />{suit}</mesh>
      <group position={[0, 0.95, 0.02]}>
        <mesh castShadow scale={[0.9, 1.08, 1]}><sphereGeometry args={[0.24, 20, 16]} />{plate}</mesh>
        <RoundedBox args={[0.3, 0.18, 0.16]} radius={0.06} position={[0, -0.12, 0.14]} castShadow>{plate}</RoundedBox>
        {hunter && <mesh position={[0, 0.2, -0.02]} rotation={[0.2, 0, 0]}><boxGeometry args={[0.05, 0.12, 0.34]} />{plate}</mesh>}
        {warlock ? (
          [-0.08, 0.08].map((x) => <group key={x} position={[x, 0.02, 0.22]}><mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.055, 0.06, 0.1, 14]} /><meshStandardMaterial color="#1a1c20" metalness={0.8} roughness={0.3} /></mesh><mesh position={[0, 0, 0.051]}><circleGeometry args={[0.042, 16]} /><meshStandardMaterial color="#ffb347" emissive="#ffa033" emissiveIntensity={3} toneMapped={false} /></mesh></group>)
        ) : (
          <mesh position={[0, 0.02, 0.2]} rotation={[0, 0, 0]}><boxGeometry args={[0.34, 0.04, 0.1]} /><meshStandardMaterial color={hunter ? "#ff3348" : visor} emissive={hunter ? "#ff2a40" : visor} emissiveIntensity={3.2} toneMapped={false} /></mesh>
        )}
      </group>
      {/* class signatures */}
      {titan && <group position={[0, 0.2, -0.36]} rotation={[0.08, 0, 0]}>
        <RoundedBox args={[0.9, 1.5, 0.1]} radius={0.06} castShadow><meshPhysicalMaterial color="#141a20" metalness={0.8} roughness={0.3} clearcoat={0.6} /></RoundedBox>
        {seam("tsh1", [0, 0, -0.06], [0.7, 0.025, 0.02])}{seam("tsh2", [-0.4, 0, -0.06], [0.025, 1.3, 0.02])}{seam("tsh3", [0.4, 0, -0.06], [0.025, 1.3, 0.02])}
      </group>}
      {hunter && <group>
        <mesh position={[0, 0.62, 0.02]} rotation={[0.15, 0, 0]} castShadow><torusGeometry args={[0.22, 0.09, 8, 18]} /><meshStandardMaterial color="#111214" roughness={1} /></mesh>
        <mesh position={[0.18, 0.05, -0.3]} rotation={[0.12, 0.1, -0.08]} castShadow><planeGeometry args={[0.3, 1.2, 1, 6]} /><meshStandardMaterial color="#111214" roughness={1} side={THREE.DoubleSide} /></mesh>
        {[-0.34, 0.34].map((x) => <RoundedBox key={x} args={[0.1, 0.3, 0.16]} radius={0.03} position={[x, -0.6, 0.04]}><meshStandardMaterial color="#0a0b0d" metalness={0.5} roughness={0.5} /></RoundedBox>)}
      </group>}
      {warlock && <group ref={drone}>
        <mesh castShadow scale={[1, 0.55, 1.3]}><sphereGeometry args={[0.13, 14, 10]} /><meshPhysicalMaterial color="#c9d2dc" metalness={0.8} roughness={0.25} clearcoat={1} /></mesh>
        <mesh position={[0, 0, 0.16]}><circleGeometry args={[0.05, 14]} /><meshStandardMaterial color="#ffb347" emissive="#ffa033" emissiveIntensity={3} toneMapped={false} /></mesh>
        {[-1, 1].map((s) => <mesh key={s} position={[s * 0.18, 0, 0]}><boxGeometry args={[0.14, 0.02, 0.06]} /><meshStandardMaterial color="#9aa4ae" metalness={0.8} roughness={0.3} /></mesh>)}
      </group>}
      <group ref={orbit} visible={visualState === "FRACTURE" || visualState === "ASCENDANT"}>
        {[0, 1, 2].map((i) => <mesh key={i} position={[Math.cos(i * 2.1) * 0.85, 0.2 + i * 0.3, Math.sin(i * 2.1) * 0.85]}><octahedronGeometry args={[0.07]} />{line}</mesh>)}
      </group>
      {/* rifle */}
      <group position={[0.46, -0.1, 0.42]}>
        <RoundedBox args={[0.12, 0.16, 0.9]} radius={0.03}><meshStandardMaterial color="#15181c" metalness={0.7} roughness={0.35} /></RoundedBox>
        {seam("gun", [0.065, 0.02, 0.05], [0.01, 0.03, 0.6])}
      </group>
    </group>
  );
}
