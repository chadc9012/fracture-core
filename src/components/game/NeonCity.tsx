import { Text } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { REGIONS } from "@/game/world";
import { walkHeight } from "@/game/terrain";
import { addObstacle } from "@/game/obstacles";
import { Model } from "./Vehicle";
import type { ModelKey } from "@/game/models";

/**
 * Neon City — the Syndicate's market/cybernetics district bordering Nexus City (per the
 * "Fractured Earth" street-level reference sheet and the fd-06/fd-07 quest beats in quests.ts,
 * which describe it narratively but never gave it a physical footprint). Sits just outside
 * Nexus's own building ring so leaving the hub on foot brings you straight into it.
 *
 * Purely a hand-built visual district (same category as NexusCity.tsx) — no new region entry,
 * no new terrain rules. Reuses the existing tower/block models with neon strip overlays and
 * lit signage instead of new geometry, and registers collision the same way NexusCity does.
 */
const NEXUS = REGIONS.find((r) => r.id === "nexus")!;
export const NEON_CITY_CENTER = { x: NEXUS.x + 82, z: NEXUS.z - 38 };

const SIGN_COLORS = ["#ff2ea6", "#38e8ff", "#b968ff", "#39ff7a", "#ffcf3a"];

type Placed = { key: ModelKey; x: number; z: number; y: number; rot: number; scale: number; glow: string };

function districtBlocks(): Placed[] {
  const out: Placed[] = [];
  let seed = 501;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const keys: ModelKey[] = ["tower_a", "tower_b", "block_a", "block_b"];
  const cols = 5;
  const rows = 4;
  const spacing = 14;
  for (let cx = 0; cx < cols; cx++) {
    for (let cz = 0; cz < rows; cz++) {
      // leave a cross-shaped street grid clear so the district reads as city blocks, not a solid wall
      if (cx === Math.floor(cols / 2) || cz === Math.floor(rows / 2)) continue;
      const x = NEON_CITY_CENTER.x + (cx - (cols - 1) / 2) * spacing + (rnd() - 0.5) * 3;
      const z = NEON_CITY_CENTER.z + (cz - (rows - 1) / 2) * spacing + (rnd() - 0.5) * 3;
      out.push({
        key: keys[Math.floor(rnd() * keys.length)]!,
        x,
        z,
        y: walkHeight(x, z),
        rot: rnd() * Math.PI * 2,
        scale: 2.6 + rnd() * 1.8,
        glow: SIGN_COLORS[Math.floor(rnd() * SIGN_COLORS.length)]!,
      });
    }
  }
  return out;
}

function NeonStrip({ height, color }: { height: number; color: string }) {
  return (
    <mesh position={[0, height / 2, 0.02]}>
      <boxGeometry args={[0.18, height, 0.06]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3.2} toneMapped={false} />
    </mesh>
  );
}

function Billboard({ x, z, y, rotY, label, sub, color }: { x: number; z: number; y: number; rotY: number; label: string; sub?: string; color: string }) {
  return (
    <group position={[x, y, z]} rotation-y={rotY}>
      <mesh>
        <boxGeometry args={[6.4, 3.2, 0.15]} />
        <meshStandardMaterial color="#0a0d12" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.09]}>
        <planeGeometry args={[6, 2.8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} toneMapped={false} transparent opacity={0.28} />
      </mesh>
      <Text position={[0, sub ? 0.5 : 0, 0.12]} fontSize={0.62} color={color} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000">
        {label}
      </Text>
      {sub && (
        <Text position={[0, -0.55, 0.12]} fontSize={0.3} color="#d8f4ff" anchorX="center" anchorY="middle">
          {sub}
        </Text>
      )}
    </group>
  );
}

function DistrictBuildings() {
  const placed = useMemo(() => {
    const list = districtBlocks();
    for (const b of list) addObstacle("tower", b.x, b.z, b.scale * 0.7, 400, 2);
    return list;
  }, []);
  return (
    <group>
      {placed.map((b, i) => (
        <group key={i} position={[b.x, b.y, b.z]} rotation-y={b.rot}>
          <Model modelKey={b.key} scale={b.scale} />
          <NeonStrip height={b.scale * 3.4} color={b.glow} />
        </group>
      ))}
    </group>
  );
}

/** overhead glowing transit line — a nod to the reference art's monorail sweeping through the skyline */
function OverheadTransit() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const x = NEON_CITY_CENTER.x - 40 + t * 80;
      const z = NEON_CITY_CENTER.z + Math.sin(t * Math.PI * 1.4) * 18;
      pts.push(new THREE.Vector3(x, walkHeight(x, z) + 14, z));
    }
    return pts;
  }, []);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 60, 0.35, 8, false), [curve]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#38e8ff" emissive="#38e8ff" emissiveIntensity={2.2} toneMapped={false} />
    </mesh>
  );
}

export function NeonCity() {
  const y = walkHeight(NEON_CITY_CENTER.x, NEON_CITY_CENTER.z);
  return (
    <group>
      <DistrictBuildings />
      <OverheadTransit />
      {/* street-level glow */}
      <mesh position={[NEON_CITY_CENTER.x, y + 0.03, NEON_CITY_CENTER.z]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[70, 56]} />
        <meshStandardMaterial color="#160a22" roughness={0.7} />
      </mesh>
      <pointLight position={[NEON_CITY_CENTER.x, y + 8, NEON_CITY_CENTER.z]} color="#ff2ea6" intensity={18} distance={60} decay={2} />
      <pointLight position={[NEON_CITY_CENTER.x - 20, y + 8, NEON_CITY_CENTER.z + 15]} color="#38e8ff" intensity={16} distance={50} decay={2} />
      <Billboard x={NEON_CITY_CENTER.x} y={y + 16} z={NEON_CITY_CENTER.z - 30} rotY={0} label="THE FRACTURED EARTH" sub="NEXUS CITY · SAFE ZONE / HUB — NEON CITY · ZONE UNKNOWN" color="#38e8ff" />
      <Billboard x={NEON_CITY_CENTER.x + 34} y={y + 10} z={NEON_CITY_CENTER.z + 4} rotY={-Math.PI / 2.4} label="NEON CITY MARKET" sub="CYBERNETICS & MODS" color="#ff2ea6" />
      <Billboard x={NEON_CITY_CENTER.x - 34} y={y + 9} z={NEON_CITY_CENTER.z + 10} rotY={Math.PI / 2.4} label="SYNTH-COFFEE" sub="& DATA-SHARDS" color="#ffcf3a" />
    </group>
  );
}
