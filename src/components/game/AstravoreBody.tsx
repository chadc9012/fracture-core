import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DistrictLight } from "./DistrictLight";
import { scenarioById } from "@/game/unique-scenarios";
import { walkHeight } from "@/game/terrain";
import type { WorldSim } from "@/game/sim";

/** Raid 01's final boss, built procedurally (no authored model yet): a colossal armored upper body rising from the arena floor with
 * the miniature star in its chest. It reads only the sim: arms rise during a tell, the star flares with the attack, and the core
 * burns white-cyan while the weak point / finale window is open. The star shifts colour with the phase (violet, amber, cyan, red).
 * About 24 m tall at the shoulders-and-crown; the design sheet's 150 m upper body is scaled down so the fight fits a 60 m arena. */
const PHASE_COLOR = ["#a463ff", "#ff9a3c", "#4fc3ff", "#ff4a3a"] as const;
const ARENA = scenarioById("astravore")?.lairAt ?? { x: 0, z: 0 };

const armor = new THREE.MeshStandardMaterial({ color: "#1b1626", metalness: 0.9, roughness: 0.42 });
const trim = new THREE.MeshStandardMaterial({ color: "#3b2f55", metalness: 0.85, roughness: 0.35, emissive: "#2a1550", emissiveIntensity: 0.4 });

function Arm({ side, refGroup }: { side: 1 | -1; refGroup: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={refGroup} position={[side * 8.2, 15.5, 0]}>
      <mesh material={armor} position={[0, 0, 0]}><sphereGeometry args={[3.4, 16, 12]} /></mesh>
      <mesh material={trim} position={[side * 1.2, -5.5, 0.8]} rotation={[0, 0, side * 0.1]}><cylinderGeometry args={[2.0, 2.8, 11, 10]} /></mesh>
      <mesh material={armor} position={[side * 2.0, -12.5, 1.6]}><boxGeometry args={[4.6, 4.2, 5.2]} /></mesh>
      {[-1.4, 0, 1.4].map((k) => <mesh key={k} material={trim} position={[side * 2.2 + k * 0.1, -15.3, 1.8 + k]} rotation={[0.3, 0, 0]}><coneGeometry args={[0.7, 3.2, 6]} /></mesh>)}
    </group>
  );
}

function AstravoreBody({ sim, ready }: { sim: WorldSim; /** the shared set that tells Actors a custom boss body is mounted (so the generic boss mesh is not drawn too) */ ready: Set<string> }) {
  const group = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null), armR = useRef<THREE.Group>(null), head = useRef<THREE.Group>(null);
  const core = useRef<THREE.MeshStandardMaterial>(null), ringA = useRef<THREE.Mesh>(null), ringB = useRef<THREE.Mesh>(null), weak = useRef<THREE.Mesh>(null);
  const plates = useRef<THREE.Group>(null);
  const colorRef = useRef(new THREE.Color(PHASE_COLOR[0]));
  const flash = useRef(0), lastPhase = useRef(0);
  useEffect(() => { ready.add("astravore"); return () => { ready.delete("astravore"); }; }, [ready]);
  useFrame(({ clock }, dt) => {
    const g = group.current; if (!g) return;
    const m = sim.machines.find((e) => e.alive && e.scenarioId === "astravore");
    g.visible = Boolean(m); if (!m) return;
    const t = clock.elapsedTime, now = performance.now() / 1000, enc = m.encounter;
    const telling = enc?.state === "TELL", tellK = telling ? 1 - enc!.timer / Math.max(0.01, enc!.tellTotal) : 0;
    const finale = (enc?.finaleUntil ?? 0) > now;
    const open = finale || (m.poiseState?.weakPointUntil ?? 0) > now;
    if (enc && enc.phase !== lastPhase.current) { lastPhase.current = enc.phase; flash.current = 1; }
    flash.current = Math.max(0, flash.current - dt * 0.7);
    colorRef.current.lerp(new THREE.Color(PHASE_COLOR[Math.min(3, enc?.phase ?? 0)]), Math.min(1, dt * 2));
    g.position.set(m.x, walkHeight(m.x, m.z), m.z);
    g.rotation.y = m.rot;
    // the arms rise as the tell winds up, then drop; idle they sway
    const lift = telling ? tellK : 0;
    if (armR.current) armR.current.rotation.x = -lift * 2.2 + Math.sin(t * 0.7) * 0.05;
    if (armL.current) armL.current.rotation.x = -lift * 1.4 + Math.sin(t * 0.7 + 1) * 0.05;
    if (head.current) head.current.rotation.x = -lift * 0.25;
    const c = core.current;
    if (c) { c.emissive.copy(open ? new THREE.Color("#9ffcff") : colorRef.current); c.emissiveIntensity = open ? 7 + Math.sin(t * 14) * 2 : 2 + flash.current * 6 + tellK * 4 + Math.sin(t * 2) * 0.4; }
    if (ringA.current) ringA.current.rotation.z = t * 0.6; if (ringB.current) { ringB.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.5) * 0.3; ringB.current.rotation.z = -t * 0.9; }
    if (weak.current) { weak.current.visible = open; weak.current.scale.setScalar(1 + Math.sin(t * 8) * 0.12); }
    if (plates.current) plates.current.rotation.y = t * 0.15;
  });
  return (
    <group ref={group} visible={false}>
      {/* torso and waist rising from the floor */}
      <mesh material={armor} position={[0, 4, 0]}><cylinderGeometry args={[8.5, 11, 8, 12]} /></mesh>
      <mesh material={trim} position={[0, 11.5, 0]}><cylinderGeometry args={[7.6, 8.8, 8, 12]} /></mesh>
      <mesh material={armor} position={[0, 16, 0]}><boxGeometry args={[17, 4.6, 8]} /></mesh>
      {/* chest cage and the star */}
      <group position={[0, 11.5, 6.4]}>
        <mesh><sphereGeometry args={[3, 24, 18]} /><meshStandardMaterial ref={core} color="#120a22" emissive="#a463ff" emissiveIntensity={2} /></mesh>
        <mesh ref={ringA}><torusGeometry args={[4.6, 0.3, 8, 40]} /><meshBasicMaterial color="#c9a8ff" toneMapped={false} /></mesh>
        <mesh ref={ringB} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[5.6, 0.22, 8, 40]} /><meshBasicMaterial color="#7ee8ff" toneMapped={false} /></mesh>
        <mesh ref={weak} visible={false}><sphereGeometry args={[4.2, 18, 12]} /><meshBasicMaterial color="#9ffcff" transparent opacity={0.28} depthWrite={false} toneMapped={false} /></mesh>
        <DistrictLight range={140} position={[0, 0, 3]} color="#a463ff" intensity={60} distance={70} />
      </group>
      <Arm side={1} refGroup={armR} /><Arm side={-1} refGroup={armL} />
      {/* head and crown */}
      <group ref={head} position={[0, 21.5, 0.6]}>
        <mesh material={armor}><icosahedronGeometry args={[3.2, 1]} /></mesh>
        <mesh position={[0, 0, 2.6]}><sphereGeometry args={[0.55, 10, 8]} /><meshBasicMaterial color="#d9b8ff" toneMapped={false} /></mesh>
        {Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * Math.PI - Math.PI / 2; return <mesh key={i} material={trim} position={[Math.sin(a) * 3.4, 2.6 + Math.cos(a) * 1.6, -0.4]} rotation={[0, 0, -a * 0.6]}><coneGeometry args={[0.7, 4.2 + (i % 2) * 1.6, 5]} /></mesh>; })}
      </group>
      {/* a broken halo of armor plates orbiting behind the shoulders */}
      <group ref={plates} position={[0, 17, -3]}>
        {Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return <mesh key={i} material={trim} position={[Math.cos(a) * 14, Math.sin(a * 2) * 2, Math.sin(a) * 14]} rotation={[a, a * 0.5, 0.4]}><boxGeometry args={[1.2, 4 + (i % 3), 3]} /></mesh>; })}
      </group>
    </group>
  );
}

/** The Hollow Star site: a dark platform ringed with runes, broken pillars, four conduit pylons and drifting shards, with a violet
 * glow at the centre. Static scenery at the lair; hidden beyond 450 m so it costs nothing across the rest of the map. */
export function HollowStarArena() {
  const group = useRef<THREE.Group>(null!);
  const shards = useRef<THREE.Group>(null);
  const y = useMemo(() => walkHeight(ARENA.x, ARENA.z), []);
  useFrame(({ clock, camera }) => {
    const g = group.current; if (!g) return;
    const near = Math.hypot(camera.position.x - ARENA.x, camera.position.z - ARENA.z) < 450;
    g.visible = near; if (!near) return;
    const t = clock.elapsedTime;
    if (shards.current) shards.current.children.forEach((c, i) => { c.position.y = 14 + (i % 5) * 4 + Math.sin(t * 0.5 + i) * 1.2; c.rotation.y = t * 0.2 + i; });
  });
  const pillars = useMemo(() => Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2 + 0.2; return { x: Math.cos(a) * 68, z: Math.sin(a) * 68, h: 10 + ((i * 7) % 9), tilt: ((i % 3) - 1) * 0.14, a }; }), []);
  const shardSpots = useMemo(() => Array.from({ length: 22 }, (_, i) => { const a = i * 2.399, r = 20 + ((i * 13) % 50); return { x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.8 + (i % 4) * 0.5 }; }), []);
  return (
    <group ref={group} position={[ARENA.x, y, ARENA.z]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}><circleGeometry args={[62, 64]} /><meshStandardMaterial color="#0c0a14" metalness={0.8} roughness={0.55} /></mesh>
      {[20, 38, 58].map((r, i) => <mesh key={r} rotation-x={-Math.PI / 2} position={[0, 0.09 + i * 0.01, 0]}><ringGeometry args={[r - 0.35, r, 72]} /><meshBasicMaterial color={i === 1 ? "#7ee8ff" : "#a463ff"} toneMapped={false} /></mesh>)}
      {pillars.map((p, i) => <mesh key={i} material={armor} position={[p.x, p.h / 2, p.z]} rotation={[p.tilt, -p.a, p.tilt * 0.6]}><boxGeometry args={[4.5, p.h, 4.5]} /></mesh>)}
      {[0, 1, 2, 3].map((i) => { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; return <group key={i} position={[Math.cos(a) * 44, 0, Math.sin(a) * 44]}>
        <mesh material={trim} position={[0, 3, 0]}><cylinderGeometry args={[1.1, 1.8, 6, 8]} /></mesh>
        <mesh position={[0, 6.8, 0]}><octahedronGeometry args={[1.3]} /><meshBasicMaterial color="#9ffcff" toneMapped={false} /></mesh>
      </group>; })}
      <group ref={shards}>{shardSpots.map((s, i) => <mesh key={i} position={[s.x, 16, s.z]} scale={s.s}><octahedronGeometry args={[1.2]} /><meshBasicMaterial color={i % 3 === 0 ? "#9ffcff" : "#8c5bff"} toneMapped={false} /></mesh>)}</group>
      <DistrictLight range={500} position={[0, 6, 0]} color="#8c5bff" intensity={40} distance={90} />
    </group>
  );
}

export { AstravoreBody };
