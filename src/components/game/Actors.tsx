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

/* ---------------- AI war machines ---------------- */

export function WarMachines({ sim }: { sim: WorldSim }) {
  const group = useRef<THREE.Group>(null!);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    sim.machines.forEach((m, i) => {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) return;
      node.visible = m.alive;
      if (!m.alive) return;
      node.position.set(m.x, m.y, m.z);
      node.rotation.y = m.rot;
      node.scale.setScalar(m.scale);
    });
  });

  return (
    <group ref={group}>
      {sim.machines.map((_, i) => (
        <group key={i} visible={false}>
          <mesh castShadow>
            <boxGeometry args={[3.4, 2.4, 4.2]} />
            <meshStandardMaterial color="#2a2230" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 1.8, 0]} castShadow>
            <boxGeometry args={[2, 1.2, 2]} />
            <meshStandardMaterial color="#3a2f45" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.8, 2.4]}>
            <boxGeometry args={[0.6, 0.5, 1.6]} />
            <meshStandardMaterial
              color="#ff4d4d"
              emissive="#ff2d2d"
              emissiveIntensity={3}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[-1.9, -0.6, 0]} castShadow>
            <boxGeometry args={[0.8, 1.4, 4.4]} />
            <meshStandardMaterial color="#191420" roughness={0.9} />
          </mesh>
          <mesh position={[1.9, -0.6, 0]} castShadow>
            <boxGeometry args={[0.8, 1.4, 4.4]} />
            <meshStandardMaterial color="#191420" roughness={0.9} />
          </mesh>
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
