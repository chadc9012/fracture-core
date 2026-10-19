import { Text } from "./SafeText";
import { DistrictLight } from "./DistrictLight";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { THALASSIA_CENTER } from "@/game/thalassia-site";
import { DOCK, DOCK_DECK_Y, REACTOR_Y, RING, airStations, airlockSite, coolantPhase, dockSite, ringWaypoint } from "@/game/thalassia-sectors";
import { airlockRestored, type MissionRun } from "@/game/missions/descent-protocol";
import { softSprite } from "./softSprite";

/** Thalassia's mission spaces (rules in thalassia-sectors.ts): the Sentry Dock with its submersible berth, airlock and
 * hull alarms; the Abyssal Ring's coolant floor that visibly charges and arcs on the real cycle, with raised safe
 * catwalks; the Sunk-Core reactor over the rift; and the air stations (green = working, red = dead). Presentation only. */
export function ThalassiaSectors({ descent, everRestored }: { descent: MissionRun | null; everRestored: boolean }) {
  const restored = everRestored || airlockRestored(descent);
  return <group>
    <SentryDock restored={restored} />
    <CoolantRing />
    <SunkCore />
    {airStations().map((s) => <AirStation key={s.id} x={s.x} y={s.y} z={s.z} live={s.id === "ring" || restored} />)}
    {descent && ["RING"].includes(descent.state) && <Beacon x={ringWaypoint().x} z={ringWaypoint().z} y={-8} color="#7fe6ff" />}
  </group>;
}

const STEEL = "#2a333d";

function SentryDock({ restored }: { restored: boolean }) {
  const d = dockSite(), a = airlockSite();
  const alarms = useRef<THREE.Group>(null), door = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    alarms.current?.children.forEach((c, i) => { c.rotation.y = t * 3 + i; (((c as THREE.Group).children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(restored ? "#3dff9a" : "#ffa21a"); });
    if (door.current) door.current.position.y += ((restored ? DOCK_DECK_Y + 7.5 : DOCK_DECK_Y + 2.6) - door.current.position.y) * Math.min(1, dt * 1.5);
  });
  return <group name="thal:dock">
    {/* berth deck and a docking ring around the sub */}
    <mesh receiveShadow position={[d.x, DOCK_DECK_Y - 0.5, d.z]}><cylinderGeometry args={[DOCK.r, DOCK.r * 1.05, 1, 32]} /><meshStandardMaterial color={STEEL} metalness={0.8} roughness={0.35} /></mesh>
    <mesh position={[d.x + 3, DOCK_DECK_Y + 3, d.z]} rotation-z={Math.PI / 2}><torusGeometry args={[4.2, 0.35, 10, 32]} /><meshStandardMaterial color="#3a4652" metalness={0.85} roughness={0.3} emissive="#0e2a3a" /></mesh>
    {/* the submersible, berthed */}
    <group name="thal:sub" position={[d.x + 6, DOCK_DECK_Y + 3, d.z]}>
      <mesh castShadow rotation-z={Math.PI / 2}><capsuleGeometry args={[2.2, 7, 8, 16]} /><meshStandardMaterial color="#c8a24a" metalness={0.5} roughness={0.45} /></mesh>
      <mesh position={[-4.6, 0.6, 0]}><sphereGeometry args={[1.5, 16, 12]} /><meshPhysicalMaterial color="#9fdcff" transparent opacity={0.45} roughness={0.05} /></mesh>
      <mesh position={[0, 2.5, 0]}><boxGeometry args={[3, 1.2, 1.4]} /><meshStandardMaterial color="#a8853a" metalness={0.5} roughness={0.5} /></mesh>
      <DistrictLight range={90} position={[-6, 0.4, 0]} color="#fff2c0" intensity={20} distance={30} decay={2} />
    </group>
    {/* airlock frame and the pressure door that rises once restored */}
    <group name="thal:airlock" position={[a.x, 0, a.z]}>
      {[-3, 3].map((zz) => <mesh key={zz} castShadow position={[0, DOCK_DECK_Y + 4, zz]}><boxGeometry args={[1.2, 8, 1]} /><meshStandardMaterial color={STEEL} metalness={0.8} roughness={0.35} /></mesh>)}
      <mesh position={[0, DOCK_DECK_Y + 8.3, 0]}><boxGeometry args={[1.2, 0.8, 7]} /><meshStandardMaterial color={STEEL} metalness={0.8} roughness={0.35} /></mesh>
      <mesh ref={door} position={[0, DOCK_DECK_Y + 2.6, 0]}><boxGeometry args={[0.5, 5, 5]} /><meshStandardMaterial color="#4a3b26" metalness={0.7} roughness={0.5} /></mesh>
      <Text position={[0.7, DOCK_DECK_Y + 9.2, 0]} rotation-y={Math.PI / 2} fontSize={0.7} color={restored ? "#3dff9a" : "#ffa21a"} anchorX="center">{restored ? "AIRLOCK · PRESSURISED" : "AIRLOCK · SEAL FAULT"}</Text>
    </group>
    {/* readability (live playtest: the deck and airlock read as one dark mass): a lit rim around the berth, edge-lit airlock posts and a
        work light over the deck. Emissive strips cost nothing per pixel; the one point light covers the berth. */}
    <mesh position={[d.x, DOCK_DECK_Y + 0.02, d.z]} rotation-x={-Math.PI / 2}><ringGeometry args={[DOCK.r - 0.6, DOCK.r - 0.2, 48]} /><meshBasicMaterial color="#5fe0ff" toneMapped={false} /></mesh>
    <mesh position={[d.x, DOCK_DECK_Y + 0.03, d.z]} rotation-x={-Math.PI / 2}><ringGeometry args={[4.6, 4.9, 32]} /><meshBasicMaterial color="#ffd27a" toneMapped={false} /></mesh>
    {[-3.65, 3.65].map((zz) => <mesh key={zz} position={[a.x + 0.62, DOCK_DECK_Y + 4, a.z + zz]}><boxGeometry args={[0.08, 7.6, 0.12]} /><meshBasicMaterial color={restored ? "#3dff9a" : "#ffa21a"} toneMapped={false} /></mesh>)}
    <DistrictLight range={110} position={[d.x - 4, DOCK_DECK_Y + 9, d.z]} color="#bdefff" intensity={60} distance={40} decay={1.6} />
    {/* rotating hull alarms around the deck */}
    <group ref={alarms}>
      {[0, 1, 2, 3].map((i) => { const ang = (i / 4) * Math.PI * 2; return <group key={i} position={[d.x + Math.cos(ang) * (DOCK.r - 1), DOCK_DECK_Y + 1.2, d.z + Math.sin(ang) * (DOCK.r - 1)]}>
        <mesh><cylinderGeometry args={[0.3, 0.35, 0.5, 10]} /><meshStandardMaterial color="#1c2228" /></mesh>
        <mesh position={[0.25, 0.35, 0]}><boxGeometry args={[0.1, 0.25, 0.6]} /><meshBasicMaterial color="#ffa21a" toneMapped={false} /></mesh>
      </group>; })}
    </group>
  </group>;
}

/** coolant floor: an annulus of glowing liquid; it brightens while charging and flashes with arcs during a discharge.
 *  Raised catwalk segments above reach are the safe route across. */
function CoolantRing() {
  const C = THALASSIA_CENTER;
  const mat = useRef<THREE.MeshStandardMaterial>(null), arcs = useRef<THREE.Group>(null);
  const arcGeo = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const pts: number[] = [], a0 = (i / 10) * Math.PI * 2, r = (RING.inner + RING.outer) / 2;
    for (let k = 0; k < 8; k++) { const a = a0 + k * 0.04; pts.push(Math.cos(a) * (r + Math.sin(k * 2.7 + i) * 3), RING.floorY + 0.2 + Math.abs(Math.sin(k * 1.9 + i)) * 1.8, Math.sin(a) * (r + Math.cos(k * 3.1) * 3)); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#e6fbff", toneMapped: false }));
  }), []);
  useFrame(() => {
    const ph = coolantPhase(performance.now() / 1000); // same clock Scene uses for the damage
    if (mat.current) { mat.current.emissiveIntensity = ph === "ARC" ? 3.2 : ph === "WARN" ? 1.4 + Math.sin(performance.now() / 60) * 0.6 : 0.6; }
    arcs.current?.children.forEach((c) => { c.visible = ph === "ARC" && Math.random() < 0.7; });
  });
  const walks = useMemo(() => Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + 0.3), []);
  return <group name="thal:ring" position={[C.x, 0, C.z]}>
    <mesh position-y={RING.floorY} rotation-x={-Math.PI / 2}><ringGeometry args={[RING.inner, RING.outer, 64, 1]} /><meshStandardMaterial ref={mat} color="#0b3a4a" emissive="#2fd0ff" emissiveIntensity={0.6} transparent opacity={0.85} roughness={0.15} side={THREE.DoubleSide} /></mesh>
    <group ref={arcs}>{arcGeo.map((l, i) => <primitive key={i} object={l} />)}</group>
    {/* safe catwalks: radial spans above the coolant's reach */}
    {walks.map((a, i) => <group key={i} rotation-y={-a}>
      <mesh castShadow receiveShadow position={[(RING.inner + RING.outer) / 2, RING.floorY + 3.6, 0]}><boxGeometry args={[RING.outer - RING.inner + 2, 0.3, 2.2]} /><meshStandardMaterial color="#39434e" metalness={0.8} roughness={0.35} /></mesh>
      {[-1.1, 1.1].map((z) => <mesh key={z} position={[(RING.inner + RING.outer) / 2, RING.floorY + 4.3, z]}><boxGeometry args={[RING.outer - RING.inner + 2, 0.08, 0.08]} /><meshBasicMaterial color="#ffd27a" toneMapped={false} /></mesh>)}
    </group>)}
    {/* containment pylons on the inner rim */}
    {Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return <mesh key={i} castShadow position={[Math.cos(a) * (RING.inner - 1), RING.floorY + 5, Math.sin(a) * (RING.inner - 1)]}><cylinderGeometry args={[0.6, 0.8, 10, 8]} /><meshStandardMaterial color={STEEL} metalness={0.8} roughness={0.3} emissive="#0c2b3a" /></mesh>; })}
  </group>;
}

/** the Sunk-Core: a broken reactor drum over a violet rift glow, buckled pressure doors around it, rising motes */
function SunkCore() {
  const C = THALASSIA_CENTER;
  const rift = useRef<THREE.MeshBasicMaterial>(null), motes = useRef<THREE.Group>(null);
  const tex = useMemo(() => softSprite("dot"), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (rift.current) rift.current.opacity = 0.55 + 0.25 * Math.sin(t * 1.3);
    motes.current?.children.forEach((c, i) => { const k = (t * 0.06 + i / 24) % 1; c.position.set(Math.sin(i * 2.3 + t * 0.2) * 9 * (1 - k), REACTOR_Y - 4 + k * 16, Math.cos(i * 1.7) * 9 * (1 - k)); ((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = (1 - k) * 0.7; });
  });
  return <group name="thal:core" position={[C.x, 0, C.z]}>
    <mesh position-y={REACTOR_Y - 5.5} rotation-x={-Math.PI / 2}><circleGeometry args={[16, 48]} /><meshBasicMaterial ref={rift} color="#8a3dff" transparent toneMapped={false} /></mesh>
    <DistrictLight range={120} position={[0, REACTOR_Y - 2, 0]} color="#9a5cff" intensity={60} distance={45} decay={2} />
    <mesh castShadow position-y={REACTOR_Y}><cylinderGeometry args={[4, 4.6, 6, 12, 1, true]} /><meshStandardMaterial color="#2f3640" metalness={0.8} roughness={0.4} side={THREE.DoubleSide} /></mesh>
    <mesh position-y={REACTOR_Y}><icosahedronGeometry args={[2.2, 1]} /><meshStandardMaterial color="#1a0f2a" emissive="#b07cff" emissiveIntensity={2.4} flatShading /></mesh>
    {Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2; return <mesh key={i} castShadow position={[Math.cos(a) * 11, REACTOR_Y + 1, Math.sin(a) * 11]} rotation={[0.2 * (i % 2 ? 1 : -1), -a, 0.35 * (i % 2 ? -1 : 1)]}><boxGeometry args={[0.6, 7, 5]} /><meshStandardMaterial color="#4a3b26" metalness={0.7} roughness={0.55} /></mesh>; })}
    <group ref={motes}>{Array.from({ length: 24 }, (_, i) => <sprite key={i} scale={[0.6, 0.6, 1]}><spriteMaterial map={tex ?? null} color="#c89bff" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></sprite>)}</group>
    <Text position={[0, REACTOR_Y + 5, 0]} fontSize={0.9} color="#d8c4ff" anchorX="center">CONTAINMENT REACTOR · BREACHED</Text>
  </group>;
}

function AirStation({ x, y, z, live }: { x: number; y: number; z: number; live: boolean }) {
  const lamp = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { if (lamp.current) lamp.current.color.set(live ? (Math.sin(clock.elapsedTime * 2) > 0 ? "#3dff9a" : "#1fbf6a") : "#ff2a2a"); });
  return <group name="thal:air" position={[x, y - 1, z]}>
    <mesh castShadow><cylinderGeometry args={[0.5, 0.7, 2.4, 10]} /><meshStandardMaterial color="#3a4652" metalness={0.8} roughness={0.35} /></mesh>
    <mesh position-y={1.4}><sphereGeometry args={[0.35, 10, 8]} /><meshBasicMaterial ref={lamp} color="#3dff9a" toneMapped={false} /></mesh>
    <Text position={[0, 2.1, 0]} fontSize={0.35} color={live ? "#3dff9a" : "#ff6a6a"} anchorX="center">{live ? "O₂ STATION" : "O₂ STATION · OFFLINE"}</Text>
  </group>;
}

function Beacon({ x, y, z, color }: { x: number; y: number; z: number; color: string }) {
  return <mesh position={[x, y, z]}><cylinderGeometry args={[0.4, 0.4, 20, 8, 1, true]} /><meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} toneMapped={false} /></mesh>;
}
