import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { Car } from "./Vehicle";

import { FACTIONS, laneSamples, type WorldSim } from "@/game/sim";
import { walkHeight } from "@/game/terrain";

/* ---------------- supply lanes (roads) ---------------- */

export function SupplyLanes({ sim }: { sim: WorldSim }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const width = 5.5;
    for (const lane of sim.lanes) {
      const pts = laneSamples(lane, 40);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz) || 1;
        const nx = (-dz / len) * width;
        const nz = (dx / len) * width;
        const ay = walkHeight(a.x, a.z) + 0.35;
        const by = walkHeight(b.x, b.z) + 0.35;
        const quad = [
          [a.x + nx, ay, a.z + nz],
          [a.x - nx, ay, a.z - nz],
          [b.x - nx, by, b.z - nz],
          [a.x + nx, ay, a.z + nz],
          [b.x - nx, by, b.z - nz],
          [b.x + nx, by, b.z + nz],
        ];
        for (const v of quad) positions.push(v[0]!, v[1]!, v[2]!);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }, [sim.lanes]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#2e2b26" roughness={0.9} transparent opacity={0.85} />
    </mesh>
  );
}

/* ---------------- faction beacons per zone ---------------- */

export function ZoneBeacons({ sim }: { sim: WorldSim }) {
  const group = useRef<THREE.Group>(null!);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    sim.zones.forEach((z, i) => {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) return;
      const color = FACTIONS[z.owner].color;
      node.children.forEach((child) => {
        const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.color) {
          m.color.set(color);
          if (m.emissive) m.emissive.set(color);
        }
      });
      node.scale.y = z.contested ? 1 + Math.sin(performance.now() * 0.006) * 0.25 : 1;
    });
  });

  return (
    <group ref={group}>
      {sim.zones.map((z) => {
        const y = walkHeight(z.region.x, z.region.z);
        return (
          <group key={z.region.id} position={[z.region.x, y, z.region.z]}>
            <mesh position-y={20}>
              <cylinderGeometry args={[0.4, 0.9, 46, 6, 1, true]} />
              <meshStandardMaterial
                color={FACTIONS[z.owner].color}
                emissive={FACTIONS[z.owner].color}
                emissiveIntensity={1.6}
                transparent
                depthWrite={false}
                opacity={0.18}
                side={THREE.DoubleSide}
                toneMapped={false}
              />
            </mesh>
            <mesh position-y={0.6} rotation-x={-Math.PI / 2}>
              <ringGeometry args={[8, 10, 40]} />
              <meshStandardMaterial
                color={FACTIONS[z.owner].color}
                emissive={FACTIONS[z.owner].color}
                emissiveIntensity={1.4}
                transparent
                opacity={0.6}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ---------------- AI war machines — quad "walking tank" (concept-art reference) ---------------- */

/** Sand-and-gunmetal palette taken from the reference sheets. */
const HULL = "#b9a67c";
const HULL_DARK = "#8d7c58";
const STEEL = "#3c4149";
const STEEL_DARK = "#22262b";

function Leg({ side, front }: { side: 1 | -1; front: 1 | -1 }) {
  return (
    <group position={[1.6 * side, -0.4, 1.5 * front]} rotation={[0, side > 0 ? 0.25 : -0.25, 0]}>
      {/* hip */}
      <mesh castShadow>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial color={STEEL} metalness={0.55} roughness={0.5} />
      </mesh>
      {/* thigh angled outward */}
      <mesh position={[0.8 * side, -0.7, 0.5 * front]} rotation={[0.5 * front, 0, -0.6 * side]} castShadow>
        <boxGeometry args={[0.55, 2.2, 0.7]} />
        <meshStandardMaterial color={HULL_DARK} metalness={0.3} roughness={0.7} />
      </mesh>
      {/* shin down to the foot */}
      <mesh position={[1.5 * side, -2.1, 1.0 * front]} rotation={[0.25 * front, 0, 0.15 * side]} castShadow>
        <boxGeometry args={[0.42, 2.4, 0.5]} />
        <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.55} />
      </mesh>
      {/* foot pad */}
      <mesh position={[1.7 * side, -3.2, 1.2 * front]} castShadow>
        <boxGeometry args={[1, 0.3, 1.5]} />
        <meshStandardMaterial color={STEEL_DARK} roughness={0.9} />
      </mesh>
    </group>
  );
}

function WalkingTank() {
  return (
    <group>
      {/* lower chassis */}
      <mesh castShadow>
        <boxGeometry args={[3.2, 1.5, 4.6]} />
        <meshStandardMaterial color={HULL} metalness={0.25} roughness={0.75} />
      </mesh>
      {/* sloped armour deck */}
      <mesh position={[0, 1.1, -0.2]} rotation={[0.08, 0, 0]} castShadow>
        <boxGeometry args={[2.9, 0.7, 3.6]} />
        <meshStandardMaterial color={HULL_DARK} metalness={0.25} roughness={0.7} />
      </mesh>
      {/* side skirts */}
      <mesh position={[-1.75, 0.1, 0]} castShadow>
        <boxGeometry args={[0.3, 1.3, 4.2]} />
        <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[1.75, 0.1, 0]} castShadow>
        <boxGeometry args={[0.3, 1.3, 4.2]} />
        <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.6} />
      </mesh>
      {/* turret */}
      <mesh position={[0, 2.05, -0.1]} castShadow>
        <boxGeometry args={[2.1, 1, 2.4]} />
        <meshStandardMaterial color={HULL} metalness={0.3} roughness={0.65} />
      </mesh>
      {/* rail gun barrel */}
      <mesh position={[0.25, 2.1, 2.4]} castShadow>
        <boxGeometry args={[0.42, 0.42, 4.2]} />
        <meshStandardMaterial color={STEEL_DARK} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* close-quarters cannon pod */}
      <mesh position={[-1.1, 2.4, 1.1]} rotation={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.7, 0.6, 1.8]} />
        <meshStandardMaterial color={STEEL} metalness={0.7} roughness={0.35} />
      </mesh>
      {/* sensor strip */}
      <mesh position={[0, 2.5, 1.15]}>
        <boxGeometry args={[1.3, 0.16, 0.1]} />
        <meshStandardMaterial color="#ff5a3c" emissive="#ff3a20" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <Leg side={1} front={1} />
      <Leg side={-1} front={1} />
      <Leg side={1} front={-1} />
      <Leg side={-1} front={-1} />
    </group>
  );
}

export function WarMachines({ sim }: { sim: WorldSim }) {
  const group = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    sim.machines.forEach((m, i) => {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) return;
      node.visible = m.alive;
      if (!m.alive) return;
      // walking gait: subtle body bob + roll so the legs read as striding
      const gait = t * 3 + i;
      node.position.set(m.x, m.y + Math.abs(Math.sin(gait)) * 0.28, m.z);
      node.rotation.set(Math.sin(gait) * 0.03, m.rot, Math.sin(gait * 0.5) * 0.05);
      node.scale.setScalar(m.scale);
    });
  });

  return (
    <group ref={group}>
      {sim.machines.map((_, i) => (
        <group key={i} visible={false}>
          <WalkingTank />
        </group>
      ))}
    </group>
  );
}


/* ---------------- NPC convoy trucks ---------------- */

export function Convoys({ sim }: { sim: WorldSim }) {
  const group = useRef<THREE.Group>(null!);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    sim.trucks.forEach((t, i) => {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) return;
      node.visible = t.alive;
      if (!t.alive) return;
      node.position.set(t.x, t.y, t.z);
      node.rotation.y = t.rot;
    });
  });

  return (
    <group ref={group}>
      {sim.trucks.map((_, i) => (
        <group key={i} visible={false}>
          <Car body="truck" scale={2.5} lights={false} />
          <mesh position={[0, 1.6, 3.4]}>
            <boxGeometry args={[2, 0.4, 0.3]} />
            <meshStandardMaterial color="#ffe6a8" emissive="#ffd27a" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------- projectiles ---------------- */

export function Bullets({ sim }: { sim: WorldSim }) {
  const group = useRef<THREE.Group>(null!);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    sim.bullets.forEach((b, i) => {
      const node = g.children[i] as THREE.Mesh | undefined;
      if (!node) return;
      node.visible = b.alive;
      if (b.alive) node.position.set(b.x, b.y, b.z);
    });
  });

  return (
    <group ref={group}>
      {sim.bullets.map((_, i) => (
        <mesh key={i} visible={false}>
          <sphereGeometry args={[0.42, 8, 8]} />
          <meshStandardMaterial
            color="#a8f0ff"
            emissive="#66e0ff"
            emissiveIntensity={4}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
