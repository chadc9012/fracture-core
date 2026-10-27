import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { PlayerCharacter } from "@/game/deployment/deployCharacter";
import { OperatorModel } from "./OperatorModel";
import { Operator } from "./Operator";

/** The character-select centrepiece (Stage 47): the Operator full-body and life-size in the frame, in the colours of the
 * rookie variant they wear, lit like the concept sheet (warm key from the front-left, a rim light in their accent colour,
 * a glow ring on a transparent floor so the page's own backdrop shows through). They breathe while idle and turn slowly; drag to look around them. */
export function OperatorStage({ character }: { character: Pick<PlayerCharacter, "classId" | "bodyType" | "appearance" | "face" | "skin" | "eyes"> }) {
  const a = character.appearance;
  return <div className="relative h-full w-full" aria-label="Operator preview: drag to rotate">
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0.95, 7.2], fov: 30 }} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }} shadows>
      <hemisphereLight args={["#b9c8dc", "#120d0a", 0.35]} />
      <directionalLight position={[-3, 5.5, 4.5]} intensity={2.6} color="#ffe6c8" castShadow shadow-mapSize={[1024, 1024]} />
      <spotLight position={[2.6, 4.2, -3.2]} angle={0.55} penumbra={0.9} intensity={70} color={a.visor} />
      <spotLight position={[-2.8, 3, -3.5]} angle={0.6} penumbra={1} intensity={35} color="#9fc4ff" />
      <pointLight position={[0, 0.25, 1.8]} intensity={3} color="#ffb070" distance={5} />
      <Suspense fallback={null}>
        <Idle>
          <OperatorModel colorway classId={character.classId} bodyType={character.bodyType} face={character.face} skin={character.skin} eyes={character.eyes} height={2.15} feetY={0} color={a.armor} trim={a.visor} cloth={a.cloth} pose="showcase"
            fallback={<group position-y={1.05}><Operator armor={a.armor} cloth={a.cloth} visor={a.visor} trim={a.trim} classId={character.classId} visualState="ACTIVE" /></group>} />
        </Idle>
        <Environment resolution={128}>
          <Lightformer intensity={1.6} position={[0, 5, 3]} scale={[8, 4, 1]} />
          <Lightformer intensity={2.2} color={a.visor} position={[4, 1.5, -2]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
          <Lightformer intensity={0.8} color="#ffd2a0" position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
        </Environment>
      </Suspense>
      <Floor accent={a.visor} />
      <ContactShadows position={[0, 0.005, 0]} opacity={0.7} scale={5} blur={2.4} far={3} />
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 2.6} maxPolarAngle={Math.PI / 1.95} autoRotate autoRotateSpeed={0.45} target={[0, 0.72, 0]} />
    </Canvas>
  </div>;
}

/** idle: a slow breath (chest rise) and a slight weight shift, so the showcase pose never reads as a statue */
function Idle({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, el = g.current;
    if (!el) return;
    const breath = Math.sin(t * 1.25) * 0.5 + 0.5;
    el.scale.set(1 + breath * 0.006, 1 + breath * 0.012, 1 + breath * 0.008);
    el.rotation.z = Math.sin(t * 0.45) * 0.012;
    el.position.x = Math.sin(t * 0.45) * 0.015;
  });
  return <group ref={g} rotation-y={-0.3}>{children}</group>;
}

function Floor({ accent }: { accent: string }) {
  return <group>
    <mesh rotation-x={-Math.PI / 2} position-y={0.004}><ringGeometry args={[1.05, 1.12, 96]} /><meshBasicMaterial color={accent} toneMapped={false} transparent opacity={0.85} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position-y={0.003}><ringGeometry args={[1.12, 1.9, 96]} /><meshBasicMaterial color={accent} transparent opacity={0.07} /></mesh>
  </group>;
}
