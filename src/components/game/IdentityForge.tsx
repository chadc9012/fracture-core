import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { AppearanceDefinition, ClassId } from "@/game/loadout";
import type { BodyType } from "@/game/operators";
import type { ArmorLook } from "@/game/armor-look";
import { defaultAppearance } from "@/game/deployment/forgeState";
import { Operator } from "./Operator";
import { OperatorModel } from "./OperatorModel";

const CLASS_LABEL: Record<ClassId, string> = { TITAN: "GOLIATH", HUNTER: "NYX", WARLOCK: "CIPHER" };
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

/** A real operator standing on the ring, slowly turning like a showcase pedestal — Operator.tsx's
 * own feet-at-(-1.55)/head-at-1.2 footprint means it just needs to sit 1.55 above the ring. */
function Showcase({ classId, appearance, bodyType, look, selected, hidden, mode, onSelect }: {
  classId: ClassId;
  look?: ArmorLook | undefined;
  appearance: AppearanceDefinition;
  bodyType: BodyType;
  selected: boolean;
  hidden: boolean;
  mode: ForgeMode;
  onSelect: (id: ClassId) => void;
}) {
  const x = CLASS_X[classId];
  const group = useRef<THREE.Group>(null);
  const turntable = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.MeshBasicMaterial>(null);
  const accent = classId === "HUNTER" ? "#ff334d" : "#5de7ff";
  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    if (group.current) {
      const targetScale = hidden ? 0.001 : selected ? (mode === "ASSEMBLING" ? 1.12 : 1.04) : 0.82;
      const s = THREE.MathUtils.lerp(group.current.scale.x, targetScale, 1 - Math.exp(-8 * delta));
      group.current.scale.setScalar(s);
    }
    if (turntable.current) turntable.current.rotation.y += delta * (selected ? 0.5 : 0.22);
    if (pulse.current) pulse.current.opacity = selected ? 0.45 + Math.sin(clock.elapsedTime * 3) * 0.12 : 0.16;
  });
  return <group ref={group} position={[x, 0, 0]} onClick={(event) => { event.stopPropagation(); if (mode === "CLASS") onSelect(classId); }}>
    <group ref={turntable} position-y={1.55}>
      <OperatorModel
        bodyType={bodyType} classId={classId}
        height={2.75}
        feetY={-1.55}
        color={appearance.armor}
        cloth={appearance.cloth}
        look={look}
        fallback={<Operator armor={appearance.armor} cloth={appearance.cloth} visor={appearance.visor} trim={appearance.trim} classId={classId} bodyType={bodyType} visualState="ACTIVE" />}
      />
    </group>
    <mesh rotation-x={-Math.PI / 2} position-y={0.04}>
      <ringGeometry args={[1.25, 1.55, 64]} />
      <meshBasicMaterial ref={pulse} color={accent} transparent opacity={0.25} toneMapped={false} />
    </mesh>
    <ContactShadows position={[0, 0.03, 0]} opacity={0.55} scale={5} blur={2.2} color={accent} />
    <pointLight position={[0, 1.6, 1]} intensity={selected ? 22 : 7} distance={7} color={accent} />
  </group>;
}

export function IdentityForge({ classId, appearance, bodyType, look, mode, onSelectClass }: { look?: ArmorLook; classId: ClassId; appearance: AppearanceDefinition; bodyType: BodyType; mode: ForgeMode; onSelectClass: (id: ClassId) => void }) {
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 2.7, 12], fov: 42 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
    <ChamberShell activeColor={appearance.visor} />
    <CameraRig selected={classId} mode={mode} />
    {(["TITAN", "HUNTER", "WARLOCK"] as ClassId[]).map((id) => (
      <Showcase
        key={id}
        classId={id}
        appearance={id === classId ? appearance : defaultAppearance(id)}
        bodyType={bodyType}
        look={id === classId ? look : undefined}
        selected={id === classId}
        hidden={mode !== "CLASS" && id !== classId}
        mode={mode}
        onSelect={onSelectClass}
      />
    ))}
    <mesh position={[0, 3.5, -4]} visible={mode === "ASSEMBLING"}><planeGeometry args={[8, 7]} /><meshBasicMaterial color={appearance.visor} transparent opacity={0.08} blending={THREE.AdditiveBlending} /></mesh>
  </Canvas>;
}

export { CLASS_LABEL };