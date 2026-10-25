import { useMemo } from "react";
import * as THREE from "three";
import { dinerFront } from "@/game/venue-doors";
import { NEXUS_DINER } from "@/game/venue-life";
import { corrugatedSheet } from "@/game/street-geometry";
import { Text } from "./SafeText";
import { DistrictLight } from "./DistrictLight";

/** The Grid Line Diner's street frontage (venue-life.ts NEXUS_DINER): a ground-floor diner front on the Nexus block nearest
 * the hub, facing it: a lit window strip with a counter silhouette, a two-tone neon sign, a corrugated awning and a warm
 * glow at the door (venue-doors.ts puts the walk-in door marker just outside). Pure dressing on the building's face: the
 * block keeps its own walls and collision. */
export function NexusDiner() {
  const f = useMemo(() => dinerFront(), []);
  const awning = useMemo(() => corrugatedSheet(Math.min(8, f.half * 2 - 0.6), 1.6, 0.12, 0.04), [f.half]);
  const w = Math.min(8, f.half * 2 - 0.6), ground = f.base + 1; // the block's base is sunk 1 m below its lowest corner
  return (
    // stood 0.7 m proud of the face: the block's facade kit (plinths, ledges, its own shopfront boxes) sticks out that far
    <group position={[f.x + Math.sin(f.yaw) * 0.7, ground, f.z + Math.cos(f.yaw) * 0.7]} rotation-y={f.yaw}>
      {/* proud of the block's own ground-floor trim (Nexus facade kit), so nothing of the block's face shows through */}
      <mesh position={[0, 1.5, 0.3]}><boxGeometry args={[w, 3.0, 0.08]} /><meshStandardMaterial color="#3a2a22" roughness={0.8} /></mesh>
      {/* the door at the centre (the walk-in marker stands in front of it), lit windows either side with a counter line */}
      <mesh position={[0, 1.15, 0.36]}><planeGeometry args={[1.3, 2.3]} /><meshStandardMaterial color="#1a120c" emissive="#ffd7a0" emissiveIntensity={1.1} roughness={0.2} /></mesh>
      {[-1, 1].map((sx) => <group key={sx} position={[sx * (w / 4 + 0.33), 1.6, 0.36]}>
        <mesh><planeGeometry args={[w / 2 - 1.3, 1.5]} /><meshStandardMaterial color="#20140c" emissive="#ffb36a" emissiveIntensity={0.95} roughness={0.15} /></mesh>
        <mesh position={[0, -0.45, 0.01]}><boxGeometry args={[w / 2 - 1.3, 0.07, 0.04]} /><meshStandardMaterial color="#c9ced4" metalness={0.8} roughness={0.3} /></mesh>
        <mesh position={[0, 0, 0.02]}><boxGeometry args={[0.05, 1.52, 0.03]} /><meshStandardMaterial color="#2a2d31" metalness={0.6} roughness={0.5} /></mesh>
      </group>)}
      {/* corrugated awning on brackets */}
      <mesh geometry={awning} position={[0, 2.75, 1.05]} rotation-x={0.2} castShadow><meshStandardMaterial color="#8a3a2e" metalness={0.4} roughness={0.7} side={THREE.DoubleSide} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * (w / 2 - 0.3), 2.6, 0.85]} rotation-x={-0.7}><boxGeometry args={[0.05, 0.05, 1]} /><meshStandardMaterial color="#2e3238" metalness={0.6} roughness={0.5} /></mesh>)}
      {/* two-tone neon sign above the awning */}
      <mesh position={[0, 3.55, 0.4]}><boxGeometry args={[Math.min(6.2, w), 0.8, 0.12]} /><meshStandardMaterial color="#0e1116" metalness={0.6} roughness={0.4} /></mesh>
      <Text position={[0, 3.62, 0.48]} fontSize={0.36} whiteSpace="nowrap" color={NEXUS_DINER.color} anchorX="center" anchorY="middle" outlineWidth={0.012} outlineColor="#2a1406">GRID LINE DINER</Text>
      <Text position={[0, 3.3, 0.48]} fontSize={0.13} whiteSpace="nowrap" color={NEXUS_DINER.accent} anchorX="center" anchorY="middle">OPEN DUSK TO DAWN · COFFEE · NOODLES</Text>
      <DistrictLight range={45} position={[0, 2.4, 1.6]} color="#ffc489" intensity={5} distance={9} decay={2} />
    </group>
  );
}
