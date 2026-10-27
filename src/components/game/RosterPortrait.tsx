import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bounds, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { PlayerCharacter } from "@/game/deployment/deployCharacter";
import { OperatorModel } from "./OperatorModel";
import { Operator } from "./Operator";

/** A saved operator standing in their roster card: the authored body in their own colours, lit like a hero shot (warm key,
 * cool rim in their visor colour), turning slowly. One small canvas per filled slot; empty slots keep the plain card. */
export function RosterPortrait({ character, active }: { character: PlayerCharacter; active: boolean }) {
  const a = character.appearance;
  return <div className="pointer-events-none h-64 w-full" aria-hidden="true">
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.2, 5.6], fov: 30 }} gl={{ alpha: true, antialias: true }} frameloop={active ? "always" : "demand"}>
      <ambientLight intensity={0.45} />
      <directionalLight position={[2.5, 5, 4]} intensity={2.4} color="#fff0da" />
      <directionalLight position={[-3, 2.5, -3]} intensity={3.2} color={a.visor} />
      <pointLight position={[0, 0.4, 2.2]} intensity={4} color="#6fd8ff" distance={6} />
      <Suspense fallback={null}>
        <Bounds fit clip margin={0.82}>
          <Spin active={active}>
            <OperatorModel colorway classId={character.classId} bodyType={character.bodyType} face={character.face} skin={character.skin} eyes={character.eyes} height={2.75} feetY={-1.55} color={a.armor} trim={a.visor} cloth={a.cloth} pose="showcase"
              fallback={<Operator armor={a.armor} cloth={a.cloth} visor={a.visor} trim={a.trim} classId={character.classId} visualState="ACTIVE" />} />
          </Spin>
        </Bounds>
      </Suspense>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={4} blur={2.2} />
    </Canvas>
  </div>;
}
function Spin({ children, active }: { children: React.ReactNode; active: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (g.current && active) g.current.rotation.y += Math.min(dt, 0.05) * 0.3; });
  return <group ref={g} position-y={1.55} rotation-y={-0.35}>{children}</group>;
}
