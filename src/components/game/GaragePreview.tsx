import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Suspense } from "react";

import type { FleetModel } from "@/game/fleet-models";
import type { VehicleCosmetics } from "@/game/fleet";
import { AuthoredVehicle } from "./AuthoredVehicle";

/**
 * Showroom turntable for the garage (stage 52, rebuilt on the authored models): the same AuthoredVehicle the road uses,
 * with the saved paint and cosmetics, under studio light strips. Drag to orbit, scroll to zoom; it turns slowly on its own.
 */
export function GaragePreview({ model, paint, cosmetics, className }: { model: FleetModel; paint?: string | null; cosmetics?: VehicleCosmetics | null; className?: string }) {
  const span = model.kind === "air" ? 16 : model.kind === "heavy" || model.kind === "boat" ? 13 : 8;
  return (
    <div className={className} aria-label={`3D preview: ${model.label}`}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [span * 0.75, span * 0.32, span * 0.75], fov: 35 }} gl={{ antialias: true }}>
        <color attach="background" args={["#07090d"]} />
        <ambientLight intensity={0.15} />
        <directionalLight position={[5, 9, 4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
        <Suspense fallback={null}>
          <AuthoredVehicle model={model} paint={paint} cosmetics={cosmetics} lights />
          <Environment resolution={256}>
            <Lightformer form="rect" intensity={3} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 3, 1]} />
            <Lightformer form="rect" intensity={2} color="#7fd8ff" position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
            <Lightformer form="rect" intensity={2} color="#ff6ad5" position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} />
            <Lightformer form="ring" intensity={1.5} position={[0, 3, 8]} scale={4} />
          </Environment>
        </Suspense>
        <mesh rotation-x={-Math.PI / 2} receiveShadow><circleGeometry args={[span * 1.4, 64]} /><meshStandardMaterial color="#0d1015" metalness={0.6} roughness={0.25} /></mesh>
        <ContactShadows position={[0, 0.01, 0]} opacity={0.7} scale={span * 2} blur={2.4} far={4} />
        <OrbitControls enablePan={false} minDistance={span * 0.45} maxDistance={span * 1.6} maxPolarAngle={Math.PI / 2.05} autoRotate autoRotateSpeed={0.6} target={[0, model.kind === "air" ? 1.6 : 0.8, 0]} />
      </Canvas>
    </div>
  );
}
