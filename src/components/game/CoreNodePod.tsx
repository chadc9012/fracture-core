import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { walkHeight } from "@/game/terrain";
import { coreLook, easeOpen, petalTilt, POD_PETALS } from "@/game/core-reveal";
import type { MissionRun } from "@/game/missions/core-node";

/** The Core Node: an armoured pod on a plinth that splits open to reveal the burning core (trailer set piece).
 * Reads the real mission run; never advances it. Procedural so it can never fail to load. */
export function CoreNodePod({ run }: { run: MissionRun }) {
  const target = run.target!;
  const base = useMemo(() => walkHeight(target.x, target.z), [target.x, target.z]);
  const petals = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const rings = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const alarm = useRef<THREE.MeshBasicMaterial>(null);
  const open = useRef(0);
  const spin = useRef(0);

  useFrame(({ clock }, dt) => {
    const look = coreLook(run.state, run.hack);
    open.current = easeOpen(open.current, look.open, Math.min(dt, 0.1));
    spin.current += dt * look.spin;
    const t = clock.elapsedTime;
    petals.current?.children.forEach((p, i) => {
      const hinge = p as THREE.Group;
      hinge.rotation.set(0, (i / POD_PETALS) * Math.PI * 2 + spin.current * 0.1, 0);
      const leaf = (hinge.children[0] as THREE.Group).children[0] as THREE.Group;
      leaf.rotation.x = petalTilt(open.current);
    });
    const pulse = 0.85 + 0.15 * Math.sin(t * 3);
    if (coreMat.current) coreMat.current.emissiveIntensity = look.glow * 3 * pulse;
    if (core.current) { core.current.rotation.y = spin.current; core.current.scale.setScalar(0.9 + 0.1 * pulse + open.current * 0.25); }
    if (rings.current) { rings.current.rotation.y = spin.current * 0.7; rings.current.children.forEach((r, i) => { r.rotation.x = Math.PI / 2 + Math.sin(t * 0.6 + i) * 0.4 * (0.3 + open.current); }); }
    if (beam.current) { beam.current.visible = look.beam && open.current > 0.6; (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.15 * Math.sin(t * 7); }
    if (light.current) light.current.intensity = 20 + 80 * look.glow * open.current + 15 * pulse;
    if (alarm.current) alarm.current.opacity = look.alarm ? 0.35 + 0.35 * Math.max(0, Math.sin(t * 6)) : 0;
  });

  const steel = <meshStandardMaterial color="#2a3038" metalness={0.85} roughness={0.35} />;
  return (
    <group position={[target.x, base, target.z]}>
      {/* plinth */}
      <mesh receiveShadow castShadow position={[0, 0.6, 0]}><cylinderGeometry args={[5, 6, 1.2, 8]} />{steel}</mesh>
      <mesh position={[0, 1.25, 0]}><cylinderGeometry args={[3.2, 3.6, 0.1, 32]} /><meshBasicMaterial ref={alarm} color="#ff3030" transparent opacity={0} toneMapped={false} /></mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} castShadow position={[Math.cos((i * Math.PI) / 2) * 4.2, 3.2, Math.sin((i * Math.PI) / 2) * 4.2]} rotation={[0, -(i * Math.PI) / 2, (i % 2 ? 1 : -1) * 0.12]}>
          <boxGeometry args={[0.6, 4.4, 0.9]} />{steel}
        </mesh>
      ))}
      <group position={[0, 6, 0]}>
        {/* the core */}
        <mesh ref={core}><icosahedronGeometry args={[1.6, 1]} /><meshStandardMaterial ref={coreMat} color="#2a0f4a" emissive="#b07cff" emissiveIntensity={1} roughness={0.3} metalness={0.1} flatShading /></mesh>
        <pointLight ref={light} color="#b48cff" intensity={20} distance={60} decay={2} />
        {/* orbit rings */}
        <group ref={rings}>
          {[2.6, 3.2].map((r, i) => <mesh key={i}><torusGeometry args={[r, 0.06, 6, 64]} /><meshBasicMaterial color={i ? "#7fe6ff" : "#d6b8ff"} toneMapped={false} /></mesh>)}
        </group>
        {/* armoured petals, hinged at the base of the pod */}
        <group ref={petals}>
          {Array.from({ length: POD_PETALS }, (_, i) => (
            <group key={i}>
              {/* hinge at the bottom of the pod; the leaf is an orange-slice of the shell facing +z, tipped outward */}
              <group position={[0, -2.3, 0]}>
                <group>
                  <mesh castShadow position={[0, 2.3, 0]}>
                    <sphereGeometry args={[2.3, 10, 12, Math.PI / 2 - Math.PI / POD_PETALS + 0.03, (Math.PI * 2) / POD_PETALS - 0.06, 0, Math.PI]} />
                    <meshStandardMaterial color="#3a4250" metalness={0.8} roughness={0.4} side={THREE.DoubleSide} flatShading />
                  </mesh>
                </group>
              </group>
            </group>
          ))}
        </group>
        {/* the beam that answers Solar Array Alpha once the node is open */}
        <mesh ref={beam} position={[0, 60, 0]} visible={false}><cylinderGeometry args={[0.5, 1.1, 120, 16, 1, true]} /><meshBasicMaterial color="#c9a8ff" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
      </group>
    </group>
  );
}
