import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { SURFACES, regionLook } from "@/game/visual-standard";

export type EnemyKind = "RAIDER" | "OVERCLOCKED" | "ABERRATION" | "VANGUARD";

/** Which region's look each enemy faction wears (visual-standard REGION_LOOK). */
export const KIND_REGION: Record<EnemyKind, string> = { RAIDER: "wastelands", OVERCLOCKED: "nexus", ABERRATION: "swamps", VANGUARD: "frostspire" };

type Mats = { plate: string; under: string; accent: string; plateKind: keyof typeof SURFACES };

function Plate({ kind, color, ...p }: { kind: keyof typeof SURFACES; color: string; args: [number, number, number]; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const s = SURFACES[kind];
  return <RoundedBox args={p.args} radius={Math.min(...p.args) * 0.25} smoothness={2} position={p.position ?? [0, 0, 0]} rotation={p.rotation ?? [0, 0, 0]} castShadow>
    <meshStandardMaterial color={color} metalness={s.metalness} roughness={s.roughness} />
  </RoundedBox>;
}

function Limb({ m, len, r, side, arm, swing }: { m: Mats; len: number; r: number; side: 1 | -1; arm: boolean; swing: React.RefObject<THREE.Group | null> }) {
  const under = SURFACES.fabric;
  return <group ref={swing}>
    <mesh position-y={-len * 0.25} castShadow><capsuleGeometry args={[r * 0.8, len * 0.5, 4, 8]} /><meshStandardMaterial color={m.under} metalness={under.metalness} roughness={under.roughness} /></mesh>
    <Plate kind={m.plateKind} color={m.plate} args={[r * 2.3, len * 0.42, r * 2.1]} position={[0, -len * 0.22, r * 0.3]} />
    <group position-y={-len * 0.5}>
      <mesh position-y={-len * 0.25} castShadow><capsuleGeometry args={[r * 0.75, len * 0.5, 4, 8]} /><meshStandardMaterial color={m.under} roughness={under.roughness} /></mesh>
      <Plate kind={m.plateKind} color={m.plate} args={[r * 2.2, len * 0.45, r * 2.2]} position={[0, -len * 0.27, arm ? 0 : r * 0.35]} />
      {!arm && <Plate kind="rubber" color="#1c1d20" args={[r * 2.4, r * 1.1, r * 3.6]} position={[0, -len * 0.55, r * 0.7]} />}
      {arm && <mesh position={[0, -len * 0.55, 0]} castShadow><sphereGeometry args={[r * 1.05, 10, 8]} /><meshStandardMaterial color={m.under} roughness={0.7} /></mesh>}
    </group>
    {arm && <mesh position={[side * r * 0.4, len * 0.05, 0]} castShadow><sphereGeometry args={[r * 1.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={m.plate} metalness={SURFACES[m.plateKind].metalness} roughness={SURFACES[m.plateKind].roughness} /></mesh>}
  </group>;
}

/** Articulated region-faction trooper (procedural starter model, ~3.9 units tall to match existing hit volumes). */
export function EnemyModel({ kind, boss, visorRef, headRef }: { kind: EnemyKind; boss: boolean; visorRef?: React.Ref<THREE.MeshStandardMaterial>; headRef?: React.Ref<THREE.Group> }) {
  const look = regionLook(KIND_REGION[kind]);
  const m: Mats = { plate: look.armor, under: look.cloth, accent: look.accent, plateKind: kind === "ABERRATION" ? "polymer" : kind === "RAIDER" ? "paintedArmor" : look.primary };
  const legs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const arms = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const seed = useRef(Math.random() * 10);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 3 + seed.current;
    const s = Math.sin(t);
    legs[0]!.current?.rotation.set(s * 0.45, 0, 0); legs[1]!.current?.rotation.set(-s * 0.45, 0, 0);
    // arms hold the weapon forward, with a little sway
    arms[0]!.current?.rotation.set(-1.1 + s * 0.05, 0, 0.15); arms[1]!.current?.rotation.set(-1.2 - s * 0.05, 0, -0.3);
  });
  const bulk = kind === "VANGUARD" ? 1.15 : kind === "ABERRATION" ? 0.95 : 1;
  const hip = 1.75, limb = 0.26 * bulk;
  return <group>
    {/* pelvis + torso */}
    <Plate kind={m.plateKind} color={m.under} args={[0.95 * bulk, 0.45, 0.6]} position={[0, hip + 0.1, 0]} />
    <mesh position-y={hip + 0.8} castShadow><capsuleGeometry args={[0.45 * bulk, 0.6, 4, 10]} /><meshStandardMaterial color={m.under} roughness={0.85} /></mesh>
    <Plate kind={m.plateKind} color={m.plate} args={[1.25 * bulk, 0.95, 0.42]} position={[0, hip + 0.95, 0.22]} rotation={[-0.08, 0, 0]} />
    <Plate kind={m.plateKind} color={m.plate} args={[1.15 * bulk, 0.9, 0.3]} position={[0, hip + 0.95, -0.3]} />
    <mesh position={[0, hip + 1.05, 0.45]}><boxGeometry args={[0.3, 0.06, 0.02]} /><meshStandardMaterial color="#111" emissive={m.accent} emissiveIntensity={0.9} /></mesh>
    {kind === "RAIDER" && <Plate kind="fabric" color="#4a3b2a" args={[1.4, 0.25, 0.3]} position={[0.1, hip + 1.35, 0]} rotation={[0, 0, -0.5]} />}
    {kind === "VANGUARD" && <Plate kind="bareMetal" color="#9aa6b2" args={[0.9, 1.1, 0.35]} position={[0, hip + 1, -0.6]} />}
    {kind === "OVERCLOCKED" && <mesh position={[0, hip + 1.1, -0.55]}><cylinderGeometry args={[0.18, 0.18, 0.8, 10]} /><meshStandardMaterial color="#222" emissive={m.accent} emissiveIntensity={1.2} /></mesh>}
    {/* head */}
    <group ref={headRef ?? null} position-y={hip + 1.75}>
      <mesh castShadow><sphereGeometry args={[0.36, 16, 12]} /><meshStandardMaterial color={m.plate} metalness={SURFACES[m.plateKind].metalness} roughness={SURFACES[m.plateKind].roughness} /></mesh>
      <Plate kind={m.plateKind} color={m.plate} args={[0.5, 0.22, 0.4]} position={[0, -0.2, 0.12]} />
      <RoundedBox args={[0.5, 0.11, 0.1]} radius={0.03} smoothness={2} position={[0, 0.02, 0.32]}><meshStandardMaterial ref={visorRef ?? null} color="#0b0d10" emissive={m.accent} emissiveIntensity={1.1} roughness={0.15} /></RoundedBox>
      {kind === "ABERRATION" && [-1, 1].map((s) => <mesh key={s} position={[s * 0.25, 0.3, -0.1]} rotation-z={s * -0.5}><coneGeometry args={[0.08, 0.5, 6]} /><meshStandardMaterial color={m.accent} roughness={0.6} /></mesh>)}
      {kind === "VANGUARD" && <mesh position={[0, 0.34, -0.05]}><boxGeometry args={[0.06, 0.16, 0.5]} /><meshStandardMaterial color="#c9d3dc" metalness={0.9} roughness={0.3} /></mesh>}
    </group>
    {/* limbs */}
    {([1, -1] as const).map((side, i) => <group key={`l${side}`} position={[side * 0.3 * bulk, hip, 0]}><Limb m={m} len={1.7} r={limb} side={side} arm={false} swing={legs[i]!} /></group>)}
    {([1, -1] as const).map((side, i) => <group key={`a${side}`} position={[side * 0.78 * bulk, hip + 1.3, 0]}><Limb m={m} len={1.25} r={limb * 0.8} side={side} arm swing={arms[i]!} /></group>)}
    {/* weapon held across the body */}
    <group position={[0.35, hip + 0.85, 0.75]}>
      <Plate kind="bareMetal" color="#2b2e33" args={[0.16, 0.24, kind === "VANGUARD" ? 1.5 : 1.1]} />
      <mesh position={[0, 0.02, kind === "VANGUARD" ? 0.85 : 0.65]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.04, 0.05, 0.4, 8]} /><meshStandardMaterial color="#1a1c1f" metalness={0.9} roughness={0.35} /></mesh>
      <mesh position={[0, 0.14, 0]}><boxGeometry args={[0.05, 0.03, 0.4]} /><meshStandardMaterial color="#111" emissive={m.accent} emissiveIntensity={0.7} /></mesh>
    </group>
    {boss && <mesh position-y={2.5} rotation-x={Math.PI / 2}><torusGeometry args={[2.2, 0.06, 6, 32]} /><meshBasicMaterial color={m.accent} transparent opacity={0.6} /></mesh>}
  </group>;
}
