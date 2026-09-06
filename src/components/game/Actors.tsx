import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";




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


/* ---------------- NPC convoy trucks — armoured 6x6 hauler (concept-art reference) ---------------- */

function ArmoredHauler() {
  const wheelZ = [3.1, -0.6, -2.2];
  return (
    <group>
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[3.1, 0.5, 10.4]} />
        <meshStandardMaterial color={STEEL_DARK} metalness={0.6} roughness={0.6} />
      </mesh>
      {/* armoured cab + sloped windscreen plate */}
      <mesh position={[0, 2.1, 3.2]} castShadow>
        <boxGeometry args={[3.3, 2.1, 3]} />
        <meshStandardMaterial color="#6d7176" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.75, 4.6]} rotation={[-0.32, 0, 0]} castShadow>
        <boxGeometry args={[3, 1.2, 0.22]} />
        <meshStandardMaterial color="#2b3238" metalness={0.75} roughness={0.25} />
      </mesh>
      {/* grille guard + headlights */}
      <mesh position={[0, 1.6, 5]} castShadow>
        <boxGeometry args={[3.1, 1.1, 0.3]} />
        <meshStandardMaterial color={STEEL_DARK} metalness={0.7} roughness={0.5} />
      </mesh>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 1.75, 5.2]}>
          <boxGeometry args={[0.5, 0.3, 0.14]} />
          <meshStandardMaterial color="#fff3cf" emissive="#ffd889" emissiveIntensity={2.6} toneMapped={false} />
        </mesh>
      ))}
      {/* roof rack */}
      <mesh position={[0, 3.25, 3.2]} castShadow>
        <boxGeometry args={[3.1, 0.16, 2.4]} />
        <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.7} />
      </mesh>
      {/* ribbed cargo bed with tarp cap */}
      <mesh position={[0, 2.35, -1.6]} castShadow>
        <boxGeometry args={[3.4, 2, 6.2]} />
        <meshStandardMaterial color="#8b8f93" metalness={0.35} roughness={0.65} />
      </mesh>
      {[-3.6, -2.2, -0.8, 0.6].map((z) => (
        <mesh key={z} position={[0, 2.35, z]} castShadow>
          <boxGeometry args={[3.55, 1.9, 0.14]} />
          <meshStandardMaterial color="#5f6367" metalness={0.5} roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0, 3.45, -1.6]} castShadow>
        <boxGeometry args={[3.5, 0.22, 6.3]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.9} />
      </mesh>
      {/* six heavy wheels */}
      {wheelZ.map((z) =>
        [-1.75, 1.75].map((x) => (
          <mesh key={`${x}:${z}`} position={[x, 0.95, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.95, 0.95, 0.72, 14]} />
            <meshStandardMaterial color="#191b1d" roughness={0.95} />
          </mesh>
        )),
      )}
    </group>
  );
}

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
          <ArmoredHauler />
          <pointLight position={[0, 1.8, 6]} color="#ffe2b0" intensity={10} distance={30} decay={2} />
        </group>
      ))}
    </group>
  );
}

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
