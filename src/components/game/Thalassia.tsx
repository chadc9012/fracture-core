import { Text } from "@react-three/drei";
import { DistrictLight } from "./DistrictLight";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { WATER_LEVEL } from "@/game/terrain";
import { addObstacle } from "@/game/obstacles";
import { ElevatedTrain, LightBar, ShopSign } from "./DistrictStreet";

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
 *
 * Visual target for the interior "street view" (District B1): src/assets/thalassia-street-reference.jpg
 * — glass-vault promenade with ocean on one side, amber strip lights, monorail overhead, tiered
 * market decks with holo signs (KAIZEN, AURA-SYS, NEO-FISHERY), steam vents and crowds.
 */
export const THALASSIA_CENTER = { x: -97, z: -208 };
const SEA_FLOOR_Y = -16;
const CORE_Y = SEA_FLOOR_Y + 26;

/** Dry, enclosed street at the seabed. Its long axis points toward the central spire. */
export const THALASSIA_STREET = { x: THALASSIA_CENTER.x + 17, z: THALASSIA_CENTER.z + 34, halfWidth: 6, halfLength: 27, floor: SEA_FLOOR_Y + 0.28 };

function UnderwaterStreet() {
  const { x, z, floor } = THALASSIA_STREET;
  return (
    <group position={[x, floor, z]}>
      {/* The sea-facing side stays transparent: the exterior domes, defense ring and seabed remain visible. */}
      <mesh receiveShadow position-y={-0.15}><boxGeometry args={[17.5, 0.42, 62]} /><meshStandardMaterial color="#263b43" roughness={0.67} metalness={0.25} /></mesh>
      <mesh receiveShadow position={[0, 0.06, 0]}><boxGeometry args={[9.8, 0.1, 61]} /><meshStandardMaterial color="#3d5058" metalness={0.45} roughness={0.42} /></mesh>
      {Array.from({ length: 15 }, (_, i) => {
        const zz = -28 + i * 4;
        return <group key={i} position-z={zz}>
          <LightBar position={[-4.55, 0.16, 0]} size={[0.12, 0.035, 3.3]} color="#ffb866" />
          <LightBar position={[4.55, 0.16, 0]} size={[0.12, 0.035, 3.3]} color="#ffb866" />
          <LightBar position={[0, 0.13, 0]} size={[1.3, 0.015, 0.06]} color="#7c9caa" />
        </group>;
      })}
      {/* Ribbed glass vault. A largely open arch on the right frames the ocean rather than hiding it. */}
      {Array.from({ length: 12 }, (_, i) => {
        const zz = -29 + i * 5.3;
        return <group key={i} position-z={zz}>
          <mesh position={[-5.25, 4, 0]}><boxGeometry args={[0.26, 8, 0.3]} /><meshStandardMaterial color="#78929b" metalness={0.8} roughness={0.23} /></mesh>
          <mesh position={[5.25, 4, 0]}><boxGeometry args={[0.26, 8, 0.3]} /><meshStandardMaterial color="#78929b" metalness={0.8} roughness={0.23} /></mesh>
          <mesh position={[0, 8.1, 0]}><boxGeometry args={[10.7, 0.23, 0.35]} /><meshStandardMaterial color="#78929b" metalness={0.8} roughness={0.23} /></mesh>
          <LightBar position={[-5.13, 3.8, 0.22]} size={[0.07, 6.8, 0.08]} color="#ffc17b" />
          <LightBar position={[0, 7.92, 0.22]} size={[10, 0.08, 0.1]} color="#ffb86a" />
        </group>;
      })}
      {[-5.25, 5.25].map((xx) => <mesh key={xx} position={[xx, 4, 0]}>
        <boxGeometry args={[0.045, 7.8, 59]} />
        <meshPhysicalMaterial color="#94d3e5" transparent opacity={0.13} metalness={0.08} roughness={0.06} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>)}
      <mesh position={[0, 8.12, 0]}><boxGeometry args={[10.4, 0.06, 59]} /><meshPhysicalMaterial color="#a2ddec" transparent opacity={0.12} roughness={0.06} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      {/* Two raised market tiers, inset behind the left glazing. The center remains traversable. */}
      {[2.25, 4.8].map((level, i) => <group key={level} position={[-6.9, level, 0]}>
        <mesh receiveShadow><boxGeometry args={[4.8, 0.28, 54]} /><meshStandardMaterial color={i ? "#273c46" : "#364b51"} metalness={0.5} roughness={0.49} /></mesh>
        <mesh position={[2.3, 0.65, 0]}><boxGeometry args={[0.12, 1.2, 54]} /><meshStandardMaterial color="#628a96" metalness={0.8} roughness={0.25} /></mesh>
        {[-20, -5, 10, 24].map((zz, j) => <group key={zz} position={[-1.1, 0.9, zz]}>
          <mesh><boxGeometry args={[2.6, 1.65, 5.1]} /><meshStandardMaterial color="#182e38" roughness={0.5} metalness={0.45} /></mesh>
          <LightBar position={[0, 0.88, 2.6]} size={[2.4, 0.09, 0.08]} color={j % 2 ? "#7edee6" : "#ffc17b"} />
        </group>)}
        <LightBar position={[2.42, -0.13, 0]} size={[0.08, 0.09, 54]} color="#ffb968" />
      </group>)}
      <ShopSign label="KAIZEN" color="#ffbb70" position={[-4.6, 3.8, -19]} />
      <ShopSign label="AURA-SYS" color="#67e6e9" position={[-4.6, 6.1, 0]} />
      <ShopSign label="NEO-FISHERY" color="#ffbb70" position={[-4.6, 3.8, 19]} />
      <ElevatedTrain length={59} height={10.6} accent="#ffb86a" />
      <DistrictLight position={[-3, 5, -10]} color="#ffc085" intensity={22} distance={31} />
      <DistrictLight position={[2, 5, 15]} color="#7acddd" intensity={17} distance={29} />
      {/* Deep-sea silhouettes and distant beacons beyond the glazing. */}
      {[[-10, 3], [8, 8], [23, 12], [-24, 18]].map(([zz, xx], i) => <group key={i} position={[xx ?? 10, 0, zz ?? 0]}>
        <mesh position-y={2.7}><cylinderGeometry args={[0.2, 0.6, 5.5, 7]} /><meshStandardMaterial color="#173a49" roughness={0.75} /></mesh>
        <mesh position-y={5.2}><sphereGeometry args={[0.46, 8, 6]} /><meshBasicMaterial color="#4a9cba" transparent opacity={0.56} /></mesh>
      </group>)}
    </group>
  );
}

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
      <DistrictLight position={[0, 2, 0]} color="#7fd6ff" intensity={26} distance={45} decay={2} />
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
      <UnderwaterStreet />
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
      <DistrictLight position={[THALASSIA_CENTER.x, WATER_LEVEL - 1, THALASSIA_CENTER.z]} color="#2a5a70" intensity={4} distance={80} decay={2} />
    </group>
  );
}
