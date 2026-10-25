import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "./SafeText";
import { walkHeight } from "@/game/terrain";
import { NEON_FLAT } from "@/game/world";

/** One reusable performance-stage renderer, shared by all five stages. */
type StageStyle = { name: string; color: string; x: number; y: number; z: number; width: number };
export const CONCERT_STAGES: readonly StageStyle[] = [
  { name: "ROCK", color: "#ff684f", x: -17, y: 4, z: 0, width: 12 },
  { name: "RAP", color: "#f6b54a", x: 17, y: 4, z: 0, width: 12 },
  { name: "POP", color: "#ff63cc", x: -17, y: 14, z: 0, width: 12 },
  { name: "EDM", color: "#54cfff", x: 17, y: 14, z: 0, width: 12 },
  { name: "HEADLINER", color: "#d89cff", x: 0, y: 26, z: -3, width: 24 },
];

function ConcertStage({ stage }: { stage: StageStyle }) {
  const { name, color, x, y, z, width } = stage;
  return <group position={[x, y, z]}>
    <mesh position={[0, 0.35, 0]} receiveShadow>
      <boxGeometry args={[width, 0.7, 7]} />
      <meshStandardMaterial color="#171a25" metalness={0.55} roughness={0.42} />
    </mesh>
    <mesh position={[0, 3.3, -3.25]}>
      <boxGeometry args={[width, 5.5, 0.24]} />
      <meshStandardMaterial color="#101324" emissive={color} emissiveIntensity={0.25} />
    </mesh>
    <Text position={[0, 3.6, -3.08]} fontSize={name === "HEADLINER" ? 1.4 : 0.95} color={color} anchorX="center">{name}</Text>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * (width / 2 - 0.5), 2.2, -2.7]}>
        <boxGeometry args={[0.8, 3.4, 0.7]} />
        <meshStandardMaterial color="#101018" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[side * (width / 2 - 0.5), 3.8, -2.3]}>
        <sphereGeometry args={[0.26, 8, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.3} />
      </mesh>
    </group>)}
    <mesh position={[0, 0.75, 2.9]}>
      <boxGeometry args={[width, 0.12, 0.16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} />
    </mesh>
  </group>;
}

/** Architecture-only first pass. Open-front atrium makes all indoor stages visible;
 * it does not yet provide walkable floors, elevators, audio, crowds or shows. */
export function NeonConcertComplex({ center }: { center: { x: number; z: number } }) {
  // Place near the edge of the plateau to avoid the established central market.
  const x = center.x + NEON_FLAT * 0.54;
  const z = center.z - NEON_FLAT * 0.43;
  const y = walkHeight(x, z);
  const columns = useMemo(() => [-29, -9, 9, 29], []);
  return <group position={[x, y, z]}>
    <mesh position={[0, 0.4, 0]} receiveShadow>
      <boxGeometry args={[68, 0.8, 36]} />
      <meshStandardMaterial color="#222736" roughness={0.65} metalness={0.35} />
    </mesh>
    {/* Open facade, structural frames, two indoor decks and accessible-looking roof. */}
    {[0, 10, 20, 25].map(level => <mesh key={level} position={[0, level, -2]} receiveShadow>
      <boxGeometry args={[64, 0.48, 32]} />
      <meshStandardMaterial color="#292b3a" metalness={0.45} roughness={0.54} />
    </mesh>)}
    {columns.map(cx => [-17, 13].map(cz => <mesh key={`${cx}-${cz}`} position={[cx, 12.5, cz]}>
      <boxGeometry args={[0.9, 25, 0.9]} />
      <meshStandardMaterial color="#48536b" metalness={0.74} roughness={0.28} />
    </mesh>))}
    <mesh position={[0, 12.5, -18]}>
      <boxGeometry args={[64, 25, 0.6]} />
      <meshStandardMaterial color="#111526" metalness={0.48} roughness={0.36} />
    </mesh>
    {CONCERT_STAGES.map(stage => <ConcertStage key={stage.name} stage={stage} />)}
    {/* Atrium bridge railings and clear entrance promenade. */}
    {[10, 20].map(level => <group key={level}>
      <mesh position={[0, level + 1, 13.4]}>
        <boxGeometry args={[62, 1.9, 0.12]} />
        <meshStandardMaterial color="#4dbbd0" transparent opacity={0.35} metalness={0.3} roughness={0.18} depthWrite={false} />
      </mesh>
      <mesh position={[0, level + 0.2, 13.4]}>
        <boxGeometry args={[62, 0.15, 0.24]} />
        <meshStandardMaterial color="#6ed4f4" emissive="#24a8dc" emissiveIntensity={0.65} />
      </mesh>
    </group>)}
    <mesh position={[0, 28.6, 13]}>
      <boxGeometry args={[48, 3, 0.55]} />
      <meshStandardMaterial color="#111525" metalness={0.6} roughness={0.3} />
    </mesh>
    <Text position={[0, 28.6, 13.35]} fontSize={1.8} color="#edb7ff" anchorX="center">THE UNDERSTAGE</Text>
    <Text position={[0, 1.8, 17.5]} fontSize={1.1} color="#b8eaff" anchorX="center">LIVE MUSIC HALL</Text>
  </group>;
}
