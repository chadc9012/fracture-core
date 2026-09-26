import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float, Lightformer, Sparkles, useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import vanguard from "@/assets/forge-vanguard.png";
import assassin from "@/assets/forge-assassin.png";
import tech from "@/assets/forge-tech.png";
import type { AppearanceDefinition, ClassId } from "@/game/loadout";

const CLASS_ART: Record<ClassId, string> = { TITAN: vanguard, HUNTER: assassin, WARLOCK: tech };
const CLASS_LABEL: Record<ClassId, string> = { TITAN: "VANGUARD", HUNTER: "ASSASSIN", WARLOCK: "TECH" };
const CLASS_X: Record<ClassId, number> = { TITAN: -4.6, HUNTER: 0, WARLOCK: 4.6 };

type ForgeMode = "CLASS" | "SUBCLASS" | "APPEARANCE" | "ASSEMBLING";

function CameraRig({ selected, mode }: { selected: ClassId; mode: ForgeMode }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const focus = mode === "CLASS" ? CLASS_X[selected] * 0.16 : CLASS_X[selected] * 0.52;
    target.set(focus, mode === "ASSEMBLING" ? 2.25 : 2.7, mode === "CLASS" ? 11.8 : 8.3);
    camera.position.lerp(target, 1 - Math.exp(-4.8 * dt));
    look.set(mode === "CLASS" ? 0 : CLASS_X[selected] * 0.72, 2.45, 0);
    camera.lookAt(look);
  });
  return null;
}

function ChamberShell({ activeColor }: { activeColor: string }) {
  return <>
    <color attach="background" args={["#03070b"]} />
    <fog attach="fog" args={["#03070b", 12, 34]} />
    <ambientLight intensity={0.35} color="#8fcce6" />
    <directionalLight position={[3, 9, 7]} intensity={2.2} color="#d8f4ff" castShadow />
    <pointLight position={[0, 3, 3]} intensity={28} distance={16} color={activeColor} />
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <circleGeometry args={[15, 64]} />
      <meshStandardMaterial color="#071018" metalness={0.8} roughness={0.5} />
    </mesh>
    {[3.2, 6.6, 10.5].map((radius) => <mesh key={radius} rotation-x={-Math.PI / 2} position-y={0.012}>
      <ringGeometry args={[radius - 0.025, radius + 0.025, 96]} />
      <meshBasicMaterial color={activeColor} transparent opacity={0.3} toneMapped={false} />
    </mesh>)}
    {[-8.2, 8.2].map((x) => <group key={x} position={[x, 3.5, -1]}>
      <mesh castShadow><boxGeometry args={[0.35, 7, 7]} /><meshStandardMaterial color="#0c1720" metalness={0.75} roughness={0.3} /></mesh>
      {[0, 1, 2].map((i) => <mesh key={i} position={[x < 0 ? 0.19 : -0.19, -2 + i * 2, 0]}><boxGeometry args={[0.02, 0.8, 5.6]} /><meshBasicMaterial color={activeColor} transparent opacity={0.3} /></mesh>)}
    </group>)}
    <mesh position={[0, 3.6, -4.4]}><boxGeometry args={[10, 7, 0.3]} /><meshStandardMaterial color="#08131c" metalness={0.9} roughness={0.25} /></mesh>
    <mesh position={[0, 3.6, -4.2]}><ringGeometry args={[2.3, 2.38, 96]} /><meshBasicMaterial color={activeColor} transparent opacity={0.65} toneMapped={false} /></mesh>
    <Sparkles count={70} scale={[16, 7, 11]} size={1.4} speed={0.2} color={activeColor} />
    <Environment><Lightformer intensity={2} position={[0, 8, 3]} scale={[12, 5, 1]} /><Lightformer intensity={1.4} color={activeColor} position={[-7, 2, 0]} rotation-y={Math.PI / 2} scale={[12, 2, 1]} /></Environment>
  </>;
}

function Projection({ id, selected, mode, onSelect }: { id: ClassId; selected: boolean; mode: ForgeMode; onSelect: (id: ClassId) => void }) {
  const texture = useTexture(CLASS_ART[id]);
  const group = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.MeshBasicMaterial>(null);
  const x = CLASS_X[id];
  const hidden = mode !== "CLASS" && !selected;
  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    const targetScale = hidden ? 0.001 : selected ? (mode === "ASSEMBLING" ? 1.3 : 1.08) : 0.86;
    const s = THREE.MathUtils.lerp(group.current.scale.x, targetScale, 1 - Math.exp(-8 * delta));
    group.current.scale.setScalar(s);
    group.current.position.y = Math.sin(clock.elapsedTime * 1.25 + x) * 0.035;
    if (pulse.current) pulse.current.opacity = selected ? 0.45 + Math.sin(clock.elapsedTime * 3) * 0.12 : 0.16;
  });
  return <group ref={group} position={[x, 0, 0]} onClick={(event) => { event.stopPropagation(); if (mode === "CLASS") onSelect(id); }}>
    <Float speed={selected ? 1.2 : 0.6} rotationIntensity={0.015} floatIntensity={0.08}>
      <mesh position={[0, 3.15, 0]} renderOrder={2}>
        <planeGeometry args={[3.7, 5.55]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.08} depthWrite={false} toneMapped={false} />
      </mesh>
    </Float>
    <mesh rotation-x={-Math.PI / 2} position-y={0.04}>
      <ringGeometry args={[1.25, 1.55, 64]} />
      <meshBasicMaterial ref={pulse} color={id === "HUNTER" ? "#ff334d" : "#5de7ff"} transparent opacity={0.25} toneMapped={false} />
    </mesh>
    <pointLight position={[0, 1.6, 1]} intensity={selected ? 20 : 7} distance={7} color={id === "HUNTER" ? "#ff334d" : "#5de7ff"} />
  </group>;
}

function ForgeTable({ appearance, visible }: { appearance: AppearanceDefinition; visible: boolean }) {
  const orbit = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (orbit.current) orbit.current.rotation.y += delta * 0.35; });
  if (!visible) return null;
  return <group position={[0, 0.15, 2.1]}>
    <mesh castShadow><cylinderGeometry args={[2.1, 2.45, 0.5, 8]} /><meshStandardMaterial color="#101a22" metalness={0.9} roughness={0.25} /></mesh>
    <mesh position-y={0.27}><cylinderGeometry args={[1.8, 1.8, 0.03, 48]} /><meshBasicMaterial color={appearance.visor} transparent opacity={0.7} toneMapped={false} /></mesh>
    <group ref={orbit} position-y={1.25}>
      {[0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.cos(i * Math.PI / 2) * 1.35, 0.25 + (i % 2) * 0.5, Math.sin(i * Math.PI / 2) * 1.35]} rotation={[0.3, i, 0]}>
        {i === 0 ? <sphereGeometry args={[0.28, 16, 12]} /> : <octahedronGeometry args={[0.3]} />}
        <meshPhysicalMaterial color={appearance.armor} emissive={appearance.visor} emissiveIntensity={0.6} metalness={0.85} roughness={0.25} transparent opacity={0.82} />
      </mesh>)}
    </group>
  </group>;
}

export function IdentityForge({ classId, appearance, mode, onSelectClass }: { classId: ClassId; appearance: AppearanceDefinition; mode: ForgeMode; onSelectClass: (id: ClassId) => void }) {
  useEffect(() => { useTexture.preload(vanguard); useTexture.preload(assassin); useTexture.preload(tech); }, []);
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 2.7, 12], fov: 42 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
    <ChamberShell activeColor={appearance.visor} />
    <CameraRig selected={classId} mode={mode} />
    {(["TITAN", "HUNTER", "WARLOCK"] as ClassId[]).map((id) => <Projection key={id} id={id} selected={id === classId} mode={mode} onSelect={onSelectClass} />)}
    <ForgeTable appearance={appearance} visible={mode === "APPEARANCE" || mode === "ASSEMBLING"} />
    <mesh position={[0, 3.5, -4]} visible={mode === "ASSEMBLING"}><planeGeometry args={[8, 7]} /><meshBasicMaterial color={appearance.visor} transparent opacity={0.08} blending={THREE.AdditiveBlending} /></mesh>
  </Canvas>;
}

export { CLASS_LABEL };