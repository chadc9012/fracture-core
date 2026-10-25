import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

import { TERMINALS, TERMINAL_RADIUS, ELEVATOR_PAD_R, ELEVATOR_PLATFORM_R, PIER_HALF_WIDTH, dockLift, thalassiaElevator, type Terminal } from "@/game/travel";
import { walkHeight, WATER_LEVEL } from "@/game/terrain";
import { chippedBlock, steelDrum } from "@/game/organic-geometry";

/**
 * Continental transit (travel.ts), drawn: a transit terminal beside every landing zone (a canopy over a lit departure pad,
 * a departures board and a beacon mast so it can be found), and the Thalassia elevator off Veyloria's coast (a pier out to
 * a steel platform, an open lift tower with its car, and the matching car at the Sentry Dock far below). Shapes come from
 * the shared generators (chippedBlock, steelDrum) plus lathe/tube pieces with enough segments to read as built things.
 */
const steel = new THREE.MeshStandardMaterial({ color: "#7d868f", roughness: 0.5, metalness: 0.45 });
const darkSteel = new THREE.MeshStandardMaterial({ color: "#3b4148", roughness: 0.65, metalness: 0.4 });
const concrete = new THREE.MeshStandardMaterial({ color: "#8a8780", roughness: 0.92 });
const deckMat = new THREE.MeshStandardMaterial({ color: "#5a5f63", roughness: 0.85, metalness: 0.2 });
const glow = (c: string, k = 2.2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
const cyan = glow("#5ee7ff"), amber = glow("#ffb347"), board = glow("#7fd8ff", 1.4), beam = new THREE.MeshBasicMaterial({ color: "#5ee7ff", transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

function TerminalKiosk({ t, playerRef }: { t: Terminal; playerRef: MutableRefObject<THREE.Group> }) {
  const y = walkHeight(t.x, t.z);
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const geo = useMemo(() => ({
    pad: new THREE.CylinderGeometry(TERMINAL_RADIUS + 0.6, TERMINAL_RADIUS + 1.2, 0.35, 48),
    ring: new THREE.TorusGeometry(TERMINAL_RADIUS, 0.09, 8, 72),
    post: new THREE.CylinderGeometry(0.16, 0.2, 4.2, 16),
    canopy: chippedBlock(TERMINAL_RADIUS * 2.6, 0.35, TERMINAL_RADIUS * 1.8, 7),
    board: new THREE.BoxGeometry(2.4, 1.1, 0.12),
    boardFrame: new THREE.BoxGeometry(2.6, 1.3, 0.2),
    mast: new THREE.CylinderGeometry(0.12, 0.22, 14, 12),
    lamp: new THREE.SphereGeometry(0.35, 16, 12),
    beam: new THREE.CylinderGeometry(0.6, 1.4, 120, 16, 1, true),
    drum: steelDrum(3),
  }), []);
  useFrame((st) => {
    const p = playerRef.current?.position;
    if (!p || !group.current) return;
    const d = Math.hypot(p.x - t.x, p.z - t.z);
    group.current.visible = d < 900;
    if (light.current) { light.current.visible = d < 120; light.current.intensity = 24 + Math.sin(st.clock.elapsedTime * 2) * 6; }
  });
  const R = TERMINAL_RADIUS;
  return (
    <group ref={group} position={[t.x, y, t.z]}>
      <mesh geometry={geo.pad} material={concrete} position={[0, 0.17, 0]} receiveShadow />
      <mesh geometry={geo.ring} material={cyan} position={[0, 0.37, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => <mesh key={i} geometry={geo.post} material={steel} position={[sx! * R * 1.15, 2.1, sz! * R * 0.75]} castShadow />)}
      <mesh geometry={geo.canopy} material={darkSteel} position={[0, 4.35, 0]} castShadow />
      <mesh geometry={geo.boardFrame} material={darkSteel} position={[0, 3.2, -R * 0.78]} />
      <mesh geometry={geo.board} material={board} position={[0, 3.2, -R * 0.78 + 0.11]} />
      <mesh geometry={geo.mast} material={steel} position={[R * 1.6, 7, -R * 0.8]} />
      <mesh geometry={geo.lamp} material={amber} position={[R * 1.6, 14.2, -R * 0.8]} />
      <mesh geometry={geo.beam} material={beam} position={[R * 1.6, 74, -R * 0.8]} />
      {[0, 1, 2].map((i) => <mesh key={i} geometry={geo.drum} material={darkSteel} position={[-R * 1.5, 0.5, -R * 0.4 + i * 1.1]} />)}
      <pointLight ref={light} color="#7fd8ff" position={[0, 3.6, 0]} distance={14} decay={1.6} />
    </group>
  );
}

function ThalassiaElevator({ playerRef }: { playerRef: MutableRefObject<THREE.Group> }) {
  const e = thalassiaElevator();
  const group = useRef<THREE.Group>(null);
  const car = useRef<THREE.Mesh>(null);
  const len = Math.hypot(e.platform.x - e.pier.x, e.platform.z - e.pier.z);
  const yaw = Math.atan2(e.platform.x - e.pier.x, e.platform.z - e.pier.z);
  const towerH = 26;
  const geo = useMemo(() => ({
    deck: new THREE.CylinderGeometry(ELEVATOR_PLATFORM_R, ELEVATOR_PLATFORM_R, 0.5, 64),
    skirt: new THREE.CylinderGeometry(ELEVATOR_PLATFORM_R + 0.2, ELEVATOR_PLATFORM_R - 0.6, 3.2, 64, 1, true),
    pier: new THREE.BoxGeometry(PIER_HALF_WIDTH * 2, 0.4, len, 4, 1, Math.max(4, Math.round(len / 3))),
    pile: chippedBlock(0.7, 8, 0.7, 4),
    rail: new THREE.CylinderGeometry(0.05, 0.05, len, 6),
    leg: new THREE.CylinderGeometry(0.22, 0.3, towerH, 12),
    brace: new THREE.BoxGeometry(5.6, 0.25, 0.25),
    car: new THREE.CylinderGeometry(ELEVATOR_PAD_R, ELEVATOR_PAD_R, 3, 32, 1, true),
    carRoof: new THREE.CylinderGeometry(ELEVATOR_PAD_R + 0.2, ELEVATOR_PAD_R + 0.2, 0.3, 32),
    padRing: new THREE.TorusGeometry(ELEVATOR_PAD_R, 0.1, 8, 64),
    lamp: new THREE.SphereGeometry(0.4, 16, 12),
    dockShaft: new THREE.CylinderGeometry(ELEVATOR_PAD_R + 0.4, ELEVATOR_PAD_R + 0.4, Math.abs(WATER_LEVEL - dockLift().y) + 6, 32, 1, true),
  }), [len]);
  const carMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9fb3c4", roughness: 0.25, metalness: 0.8, transparent: true, opacity: 0.55, side: THREE.DoubleSide }), []);
  const shaftMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#3fd0ff", transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }), []);
  useFrame((st) => {
    const p = playerRef.current?.position;
    if (!p || !group.current) return;
    group.current.visible = Math.hypot(p.x - e.platform.x, p.z - e.platform.z) < 1200;
    if (car.current) car.current.position.y = e.deckY + 1.5 + (Math.sin(st.clock.elapsedTime * 0.25) * 0.5 + 0.5) * 0.15;
  });
  const dock = dockLift();
  return (
    <group ref={group}>
      {/* pier from the shore */}
      <group position={[(e.pier.x + e.platform.x) / 2, e.deckY - 0.2, (e.pier.z + e.platform.z) / 2]} rotation={[0, yaw, 0]}>
        <mesh geometry={geo.pier} material={deckMat} receiveShadow castShadow />
        {Array.from({ length: Math.max(2, Math.floor(len / 8)) }, (_, i) => {
          const z = -len / 2 + 4 + i * 8;
          return <group key={i}><mesh geometry={geo.pile} material={concrete} position={[-PIER_HALF_WIDTH + 0.4, -4, z]} /><mesh geometry={geo.pile} material={concrete} position={[PIER_HALF_WIDTH - 0.4, -4, z]} /></group>;
        })}
        <mesh geometry={geo.rail} material={steel} position={[-PIER_HALF_WIDTH, 1, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geo.rail} material={steel} position={[PIER_HALF_WIDTH, 1, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
      {/* the platform */}
      <group position={[e.platform.x, e.deckY, e.platform.z]}>
        <mesh geometry={geo.deck} material={deckMat} position={[0, -0.25, 0]} receiveShadow castShadow />
        <mesh geometry={geo.skirt} material={darkSteel} position={[0, -1.9, 0]} />
        <mesh geometry={geo.padRing} material={cyan} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => <mesh key={i} geometry={geo.leg} material={steel} position={[sx! * 2.8, towerH / 2, sz! * 2.8]} castShadow />)}
        {[6, 12, 18, 24].map((h) => <group key={h}><mesh geometry={geo.brace} material={steel} position={[0, h, 2.8]} /><mesh geometry={geo.brace} material={steel} position={[0, h, -2.8]} /><mesh geometry={geo.brace} material={steel} position={[2.8, h, 0]} rotation={[0, Math.PI / 2, 0]} /><mesh geometry={geo.brace} material={steel} position={[-2.8, h, 0]} rotation={[0, Math.PI / 2, 0]} /></group>)}
        <mesh geometry={geo.lamp} material={amber} position={[0, towerH + 0.6, 0]} />
        <pointLight color="#7fd8ff" position={[0, 4, 0]} intensity={30} distance={20} decay={1.6} />
      </group>
      <mesh ref={car} geometry={geo.car} material={carMat} position={[e.platform.x, e.deckY + 1.5, e.platform.z]} />
      <mesh geometry={geo.carRoof} material={darkSteel} position={[e.platform.x, e.deckY + 3.1, e.platform.z]} />
      {/* the lift's other end at the Sentry Dock: a lit shaft rising from the berth to the surface */}
      <mesh geometry={geo.dockShaft} material={shaftMat} position={[dock.x, (WATER_LEVEL + dock.y) / 2, dock.z]} />
      <mesh geometry={geo.padRing} material={cyan} position={[dock.x, dock.y + 0.05, dock.z]} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  );
}

export function ContinentTransit({ playerRef }: { playerRef: MutableRefObject<THREE.Group> }) {
  return (
    <>
      {TERMINALS.map((t) => <TerminalKiosk key={t.id} t={t} playerRef={playerRef} />)}
      <ThalassiaElevator playerRef={playerRef} />
    </>
  );
}
