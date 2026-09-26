import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Operator } from "./Operator";
import type { AppearanceDefinition, ClassId } from "@/game/loadout";

export function OperatorPreview({ appearance, classId = "TITAN" }: { appearance: AppearanceDefinition; classId?: ClassId }) {
  return <div className="relative min-h-80 overflow-hidden border border-border bg-card/40 fracture-scan" aria-label={`Live 3D preview of ${appearance.name}`}>
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.4, 10.5], fov: 32 }}>
      <color attach="background" args={["#070b10"]} />
      <fog attach="fog" args={["#070b10", 8, 16]} />
      <ambientLight intensity={0.5} />
      <spotLight position={[0, 6, -4]} angle={0.6} penumbra={0.8} intensity={60} color={appearance.visor} />
      <directionalLight position={[4, 8, 5]} intensity={2.8} color="#d8efff" />
      <pointLight position={[-4, 3, 2]} intensity={20} color={appearance.visor} />
      <group position={[0, -0.05, 0]} scale={1.3} rotation={[0, -0.25, 0]}>
        <Operator armor={appearance.armor} cloth={appearance.cloth} visor={appearance.visor} classId={classId} visualState="ACTIVE" />
      </group>
      <ContactShadows position={[0, -2.08, 0]} opacity={0.65} scale={8} blur={2.5} />
      <Environment><Lightformer intensity={2.4} position={[0, 5, 2]} scale={[8, 8, 1]} /><Lightformer intensity={1.2} color={appearance.visor} position={[-4, 1, 0]} rotation-y={Math.PI / 2} scale={[7, 2, 1]} /></Environment>
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 2.7} maxPolarAngle={Math.PI / 1.75} autoRotate autoRotateSpeed={0.7} target={[0, 0, 0]} />
    </Canvas>
    <div className="pointer-events-none absolute bottom-4 left-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Live operator scan</p>
      <h3 className="mt-1 font-mono text-xl text-foreground">{appearance.name}</h3>
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{appearance.marking}</p>
    </div>
  </div>;
}
