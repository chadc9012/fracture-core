import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldSim } from "@/game/sim";
import { walkHeight } from "@/game/terrain";

const TRACER_LIFE = 0.09;
const TRACER_POOL = 12;

/** Presentation for the AI squadmates (squad.ts): armored troopers with a run cycle, rifle, muzzle flash and tracers.
 * Reads sim.squad only; never applies damage or moves anyone. Procedural so it can never fail to load. */
export function Squad({ sim }: { sim: WorldSim }) {
  const mates = useRef<THREE.Group>(null);
  const tracers = useRef<THREE.Group>(null);
  const phase = useRef<number[]>([0, 0]);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);

  useFrame((_, dt) => {
    const root = mates.current, tr = tracers.current;
    if (!root || !tr) return;
    const sq = sim.squad;
    root.visible = sq.enabled;
    tr.visible = sq.enabled;
    if (!sq.enabled) return;
    sq.mates.forEach((m, i) => {
      const g = root.children[i] as THREE.Group | undefined;
      if (!g) return;
      g.position.set(m.x, walkHeight(m.x, m.z), m.z);
      g.rotation.y = m.yaw;
      const p = (phase.current[i] = (phase.current[i] ?? 0) + dt * (2 + m.speed * 1.35));
      const k = Math.min(1, m.speed / 6);
      const swing = Math.sin(p) * 0.85 * k;
      const [, , legL, legR, armL, flash] = g.children as THREE.Object3D[];
      legL!.rotation.x = swing; legR!.rotation.x = -swing;
      armL!.rotation.x = -0.9 + Math.sin(p) * 0.1 * k;
      g.children[1]!.position.y = 1.05 + Math.abs(Math.cos(p)) * 0.06 * k; // torso bob
      flash!.visible = m.firing > 0.06;
      if (flash!.visible) flash!.rotation.z = Math.random() * Math.PI;
    });
    // tracers: newest shots, fading quickly
    const now = sq.clock;
    const live = sq.shots.filter((s) => now - s.at < TRACER_LIFE).slice(-TRACER_POOL);
    tr.children.forEach((c, i) => {
      const s = live[i];
      c.visible = !!s;
      if (!s) return;
      tmp.a.set(s.fromX, walkHeight(s.fromX, s.fromZ) + 1.35, s.fromZ);
      tmp.b.set(s.toX, walkHeight(s.toX, s.toZ) + 1.1, s.toZ);
      const len = tmp.a.distanceTo(tmp.b);
      c.position.copy(tmp.a).lerp(tmp.b, 0.5);
      c.lookAt(tmp.b);
      c.scale.set(1, 1, len);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - (now - s.at) / TRACER_LIFE);
    });
  });

  return (
    <group>
      <group ref={mates}>
        {[0, 1].map((i) => <Trooper key={i} tint={i ? "#5d6b52" : "#4f5d6e"} />)}
      </group>
      <group ref={tracers}>
        {Array.from({ length: TRACER_POOL }, (_, i) => (
          <mesh key={i} visible={false}>
            <boxGeometry args={[0.04, 0.04, 1]} />
            <meshBasicMaterial color="#ffd27a" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** children order is read by Squad: [helmet, torso, legL, legR, armL(+rifle), flash] */
function Trooper({ tint }: { tint: string }) {
  const plate = <meshStandardMaterial color={tint} roughness={0.55} metalness={0.35} />;
  const suit = <meshStandardMaterial color="#23272c" roughness={0.85} />;
  return (
    <group>
      <group position={[0, 1.72, 0]}>
        <mesh castShadow><sphereGeometry args={[0.2, 12, 10]} />{plate}</mesh>
        <mesh position={[0, -0.01, 0.15]}><boxGeometry args={[0.26, 0.08, 0.1]} /><meshStandardMaterial color="#6fe8ff" emissive="#3fc8ff" emissiveIntensity={1.4} /></mesh>
      </group>
      <group position={[0, 1.05, 0]}>
        <mesh castShadow position={[0, 0.25, 0]}><boxGeometry args={[0.52, 0.55, 0.32]} />{plate}</mesh>
        <mesh position={[0, -0.12, 0]}><boxGeometry args={[0.42, 0.25, 0.26]} />{suit}</mesh>
        <mesh position={[0, 0.25, -0.24]}><boxGeometry args={[0.38, 0.42, 0.16]} />{suit}</mesh>
        <mesh position={[-0.33, 0.45, 0]}><boxGeometry args={[0.2, 0.14, 0.34]} />{plate}</mesh>
        <mesh position={[0.33, 0.45, 0]}><boxGeometry args={[0.2, 0.14, 0.34]} />{plate}</mesh>
      </group>
      <group position={[-0.13, 0.92, 0]}>
        <mesh castShadow position={[0, -0.45, 0]}><boxGeometry args={[0.17, 0.9, 0.2]} />{suit}</mesh>
        <mesh position={[0, -0.88, 0.05]}><boxGeometry args={[0.19, 0.12, 0.3]} />{plate}</mesh>
      </group>
      <group position={[0.13, 0.92, 0]}>
        <mesh castShadow position={[0, -0.45, 0]}><boxGeometry args={[0.17, 0.9, 0.2]} />{suit}</mesh>
        <mesh position={[0, -0.88, 0.05]}><boxGeometry args={[0.19, 0.12, 0.3]} />{plate}</mesh>
      </group>
      {/* arms held in a rifle stance, rifle along +z */}
      <group position={[0, 1.42, 0.12]} rotation={[-0.9, 0, 0]}>
        <mesh position={[-0.22, -0.25, 0]}><boxGeometry args={[0.12, 0.5, 0.12]} />{suit}</mesh>
        <mesh position={[0.22, -0.25, 0]}><boxGeometry args={[0.12, 0.5, 0.12]} />{suit}</mesh>
        <group position={[0.05, -0.45, 0.1]} rotation={[0.9, 0, 0]}>
          <mesh><boxGeometry args={[0.08, 0.14, 0.8]} /><meshStandardMaterial color="#1b1d20" metalness={0.6} roughness={0.4} /></mesh>
          <mesh position={[0, -0.12, 0.05]}><boxGeometry args={[0.06, 0.16, 0.08]} /><meshStandardMaterial color="#1b1d20" /></mesh>
        </group>
      </group>
      <mesh position={[0.05, 1.35, 0.95]} visible={false}>
        <planeGeometry args={[0.45, 0.45]} />
        <meshBasicMaterial color="#ffcf6a" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
