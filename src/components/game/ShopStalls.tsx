import { useMemo } from "react";
import { REGIONAL_SHOPS, type ShopKind } from "@/game/regional-shops";
import { walkHeight } from "@/game/terrain";
import { DistrictLight } from "./DistrictLight";

const KIND_COLOR: Record<ShopKind, string> = {
  weapons: "#ff7a3c", armor: "#66e0ff", supplies: "#8fe08a", mods: "#c86bff", gunsmith: "#ffd27a", vehicles: "#e8f4ff",
};

/** Walk-up vendor stalls: counter, canopy and a glowing kind-coloured sign so shops read from a distance. */
export function ShopStalls() {
  const stalls = useMemo(() => REGIONAL_SHOPS.map((s) => ({ ...s, y: walkHeight(s.x, s.z) })), []);
  return (
    <group>
      {stalls.map((s) => (
        <group key={s.id} position={[s.x, s.y, s.z]}>
          <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.4, 1.1, 1]} />
            <meshStandardMaterial color="#2d3744" metalness={0.5} roughness={0.5} />
          </mesh>
          {[-1.1, 1.1].map((x) => (
            <mesh key={x} position={[x, 1.5, -0.4]}>
              <cylinderGeometry args={[0.06, 0.06, 3, 6]} />
              <meshStandardMaterial color="#1a2129" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 3, 0]} rotation-x={0.15}>
            <boxGeometry args={[2.8, 0.08, 1.8]} />
            <meshStandardMaterial color="#39424f" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.55, 0.5]}>
            <boxGeometry args={[1.8, 0.35, 0.05]} />
            <meshBasicMaterial color={KIND_COLOR[s.kind]} toneMapped={false} />
          </mesh>
          {/* warm lantern under the canopy lights the counter; the sign casts a soft wash of its own colour */}
          <mesh position={[0, 2.75, 0.2]}><sphereGeometry args={[0.12, 10, 8]} /><meshStandardMaterial color="#2a1a0c" emissive="#ffb35c" emissiveIntensity={2.2} toneMapped={false} /></mesh>
          <DistrictLight range={45} position={[0, 2.6, 0.4]} color="#ffb867" intensity={6} distance={9} decay={2} />
          <DistrictLight range={45} position={[0, 2.4, 1.1]} color={KIND_COLOR[s.kind]} intensity={2.2} distance={5} decay={2} />
        </group>
      ))}
    </group>
  );
}
