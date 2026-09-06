import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

import { MODELS, type ModelKey } from "@/game/models";
import { REGIONS } from "@/game/world";
import { walkHeight } from "@/game/terrain";
import type { WorldSim } from "@/game/sim";
import { addObstacle } from "@/game/obstacles";
import { Model } from "./Vehicle";

const NEXUS = REGIONS.find((r) => r.id === "nexus")!;

/* ---------------- buildings ---------------- */

type Placed = { key: ModelKey; x: number; z: number; y: number; rot: number; scale: number };

function cityBlocks(): Placed[] {
  const out: Placed[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const rings = [
    { r: 7, count: 5, keys: ["tower_a", "tower_b"] as ModelKey[], scale: [7, 10] },
    { r: 14, count: 10, keys: ["tower_b", "block_a"] as ModelKey[], scale: [5, 8] },
    { r: 20.5, count: 14, keys: ["block_a", "block_b"] as ModelKey[], scale: [4, 6] },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const a = (i / ring.count) * Math.PI * 2 + rnd() * 0.2;
      const x = NEXUS.x + Math.cos(a) * ring.r;
      const z = NEXUS.z + Math.sin(a) * ring.r;
      const scale = ring.scale[0]! + rnd() * (ring.scale[1]! - ring.scale[0]!);
      out.push({
        key: ring.keys[Math.floor(rnd() * ring.keys.length)]!,
        x,
        z,
        y: walkHeight(x, z),
        rot: -a + Math.PI / 2,
        scale,
      });
    }
  }
  return out;
}

function CityBuildings() {
  const placed = useMemo(() => {
    const list = cityBlocks();
    for (const b of list) addObstacle("tower", b.x, b.z, b.scale * 0.7, 400, 2);
    return list;
  }, []);

  return (
    <group>
      {placed.map((b, i) => (
        <Model
          key={i}
          modelKey={b.key}
          position={[b.x, b.y, b.z]}
          rotation={[0, b.rot, 0]}
          scale={b.scale}
        />
      ))}
      {/* plaza slab so the hub reads as built ground, not open dirt */}
      <mesh rotation-x={-Math.PI / 2} position={[NEXUS.x, walkHeight(NEXUS.x, NEXUS.z) + 0.06, NEXUS.z]} receiveShadow>
        <circleGeometry args={[NEXUS.radius * 0.86, 64]} />
        <meshStandardMaterial color="#39424f" roughness={0.85} metalness={0.1} />
      </mesh>
      {/* stability field dome */}
      <mesh position={[NEXUS.x, walkHeight(NEXUS.x, NEXUS.z), NEXUS.z]}>
        <sphereGeometry args={[NEXUS.radius, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#66e0ff" transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ---------------- pedestrians (procedural low-poly walkers) ---------------- */

type Ped = { a: number; r: number; speed: number; tint: string; height: number };

function Pedestrian({ ped }: { ped: Ped }) {
  const group = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Mesh>(null!);
  const legR = useRef<THREE.Mesh>(null!);
  const armL = useRef<THREE.Mesh>(null!);
  const armR = useRef<THREE.Mesh>(null!);
  const angle = useRef(ped.a);
  const gait = useRef(Math.random() * 6);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    angle.current += (ped.speed / ped.r) * dt;
    gait.current += dt * 7.5;
    const x = NEXUS.x + Math.cos(angle.current) * ped.r;
    const z = NEXUS.z + Math.sin(angle.current) * ped.r;
    const g = group.current;
    if (!g) return;
    g.position.set(x, walkHeight(x, z), z);
    g.rotation.y = Math.atan2(-Math.sin(angle.current), Math.cos(angle.current)) + Math.PI / 2;
    const s = Math.sin(gait.current) * 0.55;
    if (legL.current) legL.current.rotation.x = s;
    if (legR.current) legR.current.rotation.x = -s;
    if (armL.current) armL.current.rotation.x = -s * 0.8;
    if (armR.current) armR.current.rotation.x = s * 0.8;
  });

  const h = ped.height;
  return (
    <group ref={group} scale={h}>
      {/* legs */}
      <mesh ref={legL} position={[-0.13, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.42, 3, 6]} />
        <meshStandardMaterial color="#2a3140" roughness={0.85} />
      </mesh>
      <mesh ref={legR} position={[0.13, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.42, 3, 6]} />
        <meshStandardMaterial color="#2a3140" roughness={0.85} />
      </mesh>
      {/* torso */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <capsuleGeometry args={[0.19, 0.42, 3, 8]} />
        <meshStandardMaterial color={ped.tint} roughness={0.65} />
      </mesh>
      {/* arms */}
      <mesh ref={armL} position={[-0.28, 1.02, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.38, 3, 6]} />
        <meshStandardMaterial color={ped.tint} roughness={0.7} />
      </mesh>
      <mesh ref={armR} position={[0.28, 1.02, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.38, 3, 6]} />
        <meshStandardMaterial color={ped.tint} roughness={0.7} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.42, 0]} castShadow>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color="#c8a381" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Pedestrians() {
  const peds = useMemo<Ped[]>(() => {
    const tints = ["#4d6b8a", "#7a5a4a", "#3f6d5c", "#8a7a4a", "#5c4a6d"];
    return Array.from({ length: 14 }, (_, i) => ({
      a: (i / 14) * Math.PI * 2,
      r: 10 + (i % 4) * 3.4,
      speed: (i % 2 ? 1 : -1) * (1.6 + (i % 3) * 0.5),
      tint: tints[i % tints.length]!,
      height: 1.05 + (i % 3) * 0.08,
    }));
  }, []);
  return (
    <group>
      {peds.map((p, i) => (
        <Pedestrian key={i} ped={p} />
      ))}
    </group>
  );
}


/* ---------------- traffic (city cars on a loop) ---------------- */

function CityTraffic() {
  const group = useRef<THREE.Group>(null!);
  const cars = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        a: (i / 6) * Math.PI * 2,
        r: NEXUS.radius * 0.72,
        speed: 0.16 + (i % 3) * 0.03,
        key: (["suv", "van", "police"] as ModelKey[])[i % 3]!,
      })),
    [],
  );
  const t = useRef(0);

  useFrame((_, raw) => {
    t.current += Math.min(raw, 0.05);
    const g = group.current;
    if (!g) return;
    cars.forEach((c, i) => {
      const a = c.a + t.current * c.speed;
      const x = NEXUS.x + Math.cos(a) * c.r;
      const z = NEXUS.z + Math.sin(a) * c.r;
      const node = g.children[i]!;
      node.position.set(x, walkHeight(x, z) + 0.6, z);
      node.rotation.y = -a;
    });
  });

  return (
    <group ref={group}>
      {cars.map((c, i) => (
        <group key={i}>
          <Model modelKey={c.key} scale={2.2} />
        </group>
      ))}
    </group>
  );
}

/* ---------------- defence turrets ---------------- */

export function Turrets({ sim }: { sim: WorldSim }) {
  const group = useRef<THREE.Group>(null!);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    sim.turrets.forEach((t, i) => {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) return;
      node.rotation.y = t.rot;
      const flash = node.children[2] as THREE.Mesh | undefined;
      if (flash) {
        flash.visible = t.flash > 0.05;
        flash.scale.setScalar(0.6 + t.flash);
      }
    });
  });

  return (
    <group ref={group}>
      {sim.turrets.map((t, i) => (
        <group key={i} position={[t.x, t.y, t.z]}>
          <mesh position={[0, 1.6, 0]} castShadow>
            <cylinderGeometry args={[1.1, 1.6, 3.2, 10]} />
            <meshStandardMaterial color="#2d3744" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 3.4, 1.4]} castShadow>
            <boxGeometry args={[0.6, 0.6, 3]} />
            <meshStandardMaterial color="#1a2129" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 3.4, 3.2]} visible={false}>
            <sphereGeometry args={[0.7, 10, 10]} />
            <meshBasicMaterial color="#9fe8ff" toneMapped={false} />
          </mesh>
          <pointLight position={[0, 3.6, 0]} color="#66e0ff" intensity={4} distance={16} decay={2} />
        </group>
      ))}
    </group>
  );
}

export function NexusCity({ sim }: { sim: WorldSim }) {
  return (
    <group>
      <CityBuildings />
      <Pedestrians />
      <CityTraffic />
      <Turrets sim={sim} />
    </group>
  );
}
