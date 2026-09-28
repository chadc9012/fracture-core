import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { WATER_LEVEL } from "@/game/terrain";
import { addObstacle } from "@/game/obstacles";

/**
 * Thalassia — the Deepmind's sunken ark-city (per the "Thalassia" region-map reference sheet:
 * residential domes, an industrial power sector, an AI control core, a defense ring, transit
 * tunnels, and an "unknown abyss" beneath). quests.ts's fd-16/fd-17/fd-18 chain already sends
 * the player diving here ("Descent Protocol" / "The System Core"), but until now that dive had
 * no physical destination — just an empty-water survive timer. This gives it one.
 *
 * Placed in open ocean well past the last landmass, where terrain.ts's coastline falloff has
 * already sunk the seabed to its deepest point, so the whole structure sits fully submerged
 * under real water depth. Purely hand-built set-dressing (same category as NexusCity.tsx /
 * NeonCity.tsx) — no new region entry; reachable by simply swimming out and down.
 */
export const THALASSIA_CENTER = { x: -97, z: -208 };
const SEA_FLOOR_Y = -16;
const CORE_Y = SEA_FLOOR_Y + 26;

function ResidentialDome({ x, z, radius, glow }: { x: number; z: number; radius: number; glow: string }) {
  return (
    <group position={[x, SEA_FLOOR_Y + radius * 0.15, z]}>
      <mesh>
        <sphereGeometry args={[radius, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color="#2c5566" transparent opacity={0.35} roughness={0.15} metalness={0.2} side={THREE.DoubleSide} />
      </mesh>
      <mesh position-y={-radius * 0.3}>
        <cylinderGeometry args={[radius * 0.55, radius * 0.6, radius * 0.5, 16]} />
        <meshStandardMaterial color="#1c2b33" roughness={0.7} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * radius * 0.4, -radius * 0.1, Math.sin(a) * radius * 0.4]}>
            <boxGeometry args={[0.4, radius * 0.7, 0.4]} />
            <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

/** central spire: industrial power sector (lower ring) + AI control core (glowing twin orbs) */
function CoreSpire() {
  const orbA = useRef<THREE.Mesh>(null!);
  const orbB = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (orbA.current) orbA.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.06);
    if (orbB.current) orbB.current.scale.setScalar(1 + Math.sin(t * 1.4 + Math.PI) * 0.06);
  });
  return (
    <group position={[THALASSIA_CENTER.x, CORE_Y, THALASSIA_CENTER.z]}>
      {/* support column from the sea floor */}
      <mesh position-y={-(CORE_Y - SEA_FLOOR_Y) / 2}>
        <cylinderGeometry args={[2.2, 3, CORE_Y - SEA_FLOOR_Y, 10]} />
        <meshStandardMaterial color="#333c44" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* industrial power sector ring */}
      <mesh position-y={-3}>
        <torusGeometry args={[9, 1.4, 10, 28]} />
        <meshStandardMaterial color="#4a4f57" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-4.5, -3, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[1.6, 1.6, 3.2, 12]} />
        <meshStandardMaterial color="#6b7480" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* AI control core: twin glowing orbs */}
      <mesh ref={orbA} position={[-1.6, 2, 0]}>
        <sphereGeometry args={[1.5, 16, 12]} />
        <meshStandardMaterial color="#3ab8ff" emissive="#3ab8ff" emissiveIntensity={2.6} toneMapped={false} />
      </mesh>
      <mesh ref={orbB} position={[1.6, 2, 0]}>
        <sphereGeometry args={[1.5, 16, 12]} />
        <meshStandardMaterial color="#ff8a2e" emissive="#ff8a2e" emissiveIntensity={2.6} toneMapped={false} />
      </mesh>
      <mesh position-y={6}>
        <cylinderGeometry args={[0.4, 1.4, 5, 8]} />
        <meshStandardMaterial color="#7d8894" metalness={0.6} roughness={0.35} />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#7fd6ff" intensity={26} distance={45} decay={2} />
    </group>
  );
}

function DefenseRing() {
  return (
    <mesh position={[THALASSIA_CENTER.x, SEA_FLOOR_Y + 4, THALASSIA_CENTER.z]} rotation-x={Math.PI / 2}>
      <torusGeometry args={[34, 0.8, 8, 48]} />
      <meshStandardMaterial color="#c94a4a" emissive="#c94a4a" emissiveIntensity={1.1} toneMapped={false} transparent opacity={0.55} />
    </mesh>
  );
}

function TransitTunnel({ fromX, fromZ, toX, toZ }: { fromX: number; fromZ: number; toX: number; toZ: number }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(fromX, SEA_FLOOR_Y + 3, fromZ),
      new THREE.Vector3((fromX + toX) / 2, SEA_FLOOR_Y + 5, (fromZ + toZ) / 2),
      new THREE.Vector3(toX, SEA_FLOOR_Y + 3, toZ),
    ]);
    return new THREE.TubeGeometry(curve, 20, 1, 8, false);
  }, [fromX, fromZ, toX, toZ]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#3a5560" transparent opacity={0.5} roughness={0.2} metalness={0.3} />
    </mesh>
  );
}

export function Thalassia() {
  const domes = useMemo(
    () => [
      { x: THALASSIA_CENTER.x - 26, z: THALASSIA_CENTER.z - 14, radius: 9, glow: "#5fd8ff" },
      { x: THALASSIA_CENTER.x - 34, z: THALASSIA_CENTER.z + 10, radius: 7, glow: "#5fd8ff" },
      { x: THALASSIA_CENTER.x + 24, z: THALASSIA_CENTER.z - 20, radius: 8, glow: "#7fffb0" },
    ],
    [],
  );

  useMemo(() => {
    addObstacle("tower", THALASSIA_CENTER.x, THALASSIA_CENTER.z, 10, 600, 3);
    for (const d of domes) addObstacle("tower", d.x, d.z, d.radius * 0.8, 300, 2);
  }, [domes]);

  return (
    <group>
      <CoreSpire />
      <DefenseRing />
      {domes.map((d, i) => (
        <ResidentialDome key={i} x={d.x} z={d.z} radius={d.radius} glow={d.glow} />
      ))}
      {domes.map((d, i) => (
        <TransitTunnel key={i} fromX={THALASSIA_CENTER.x} fromZ={THALASSIA_CENTER.z} toX={d.x} toZ={d.z} />
      ))}
      {/* sea-floor marker + label, readable once the player dives close enough */}
      <Text position={[THALASSIA_CENTER.x, CORE_Y + 8, THALASSIA_CENTER.z]} fontSize={2.4} color="#bfeaff" anchorX="center" anchorY="middle" outlineWidth={0.05} outlineColor="#001018">
        THALASSIA
      </Text>
      <mesh position={[THALASSIA_CENTER.x, SEA_FLOOR_Y - 0.2, THALASSIA_CENTER.z]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[60, 32]} />
        <meshStandardMaterial color="#0c1a20" roughness={0.9} />
      </mesh>
      {/* faint reminder of the WATER_LEVEL surface far overhead, so depth reads correctly */}
      <pointLight position={[THALASSIA_CENTER.x, WATER_LEVEL - 1, THALASSIA_CENTER.z]} color="#2a5a70" intensity={4} distance={80} decay={2} />
    </group>
  );
}
