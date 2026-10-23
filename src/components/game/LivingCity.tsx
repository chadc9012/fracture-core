import { useFrame } from "@react-three/fiber";
import { DistrictLight } from "./DistrictLight";
import { FactionEnemy } from "./EnemyModel";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { heightAt } from "@/game/terrain";
import { FACTIONS } from "@/game/living-world";
import { LIVING_NPCS, livingMarkers, npcWorld, type LivingNpc } from "@/game/living-npcs";
import { FRACTURE_RADIUS } from "@/game/living-events";
import type { LivingRuntime } from "@/game/living-runtime";
import { BEATS, type Guard } from "@/game/city-patrols";
import type { FactionId } from "@/game/living-world";
import type { Civilian } from "@/game/civilians";
import type { PlayerProgression } from "@/game/progression";
import { CivilianBody, DETAIL_DISTANCE } from "./Civilians";
import { HOLLOW_CROWN, VAEL, forgeStage } from "@/game/godforge";
import { GARAGES, type GarageId } from "@/game/fleet";

/** Living World presentation: city patrol guards (and their tracers), the talkable NPCs with name plates, the live
 * world-event beacon / fracture ring, and beacons on revealed stashes and survey points. Reads living-runtime state only;
 * nothing here changes combat, standing or the save. */
const UP = new THREE.Vector3(0, 1, 0);
const DRAW = 200;
/** NPC bodies share the ~100k-triangle civilian GLBs, so they are drawn only up close (the name plate shows from there) */
const NPC_DRAW = 150;

function GuardView({ id, faction, runtime, playerRef }: { id: string; faction: FactionId; runtime: React.RefObject<LivingRuntime | null>; playerRef: React.RefObject<THREE.Object3D> }) {
  const group = useRef<THREE.Group>(null!);
  const drive = useRef({ speed: 0, aiming: false });
  const flash = useRef<THREE.Mesh>(null!);
  const tracer = useRef<THREE.Mesh>(null!);
  const phase = useRef(0);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), mid: new THREE.Vector3(), q: new THREE.Quaternion(), fwd: new THREE.Vector3(0, 1, 0) }), []);
  useFrame((_, dt) => {
    const g: Guard | undefined = runtime.current?.guards.find((x) => x.id === id);
    const p = playerRef.current;
    if (!g || !group.current) return;
    const far = !p || Math.hypot(p.position.x - g.x, p.position.z - g.z) > DRAW;
    group.current.visible = !far;
    tracer.current.visible = false;
    if (far) return;
    const y = heightAt(g.x, g.z);
    group.current.position.set(g.x, y, g.z);
    group.current.quaternion.setFromAxisAngle(UP, g.yaw);
    phase.current += dt;
    drive.current.speed = g.speed; drive.current.aiming = g.flash > 0;
    flash.current.visible = g.flash > 0;
    if (g.flash > 0 && g.shotTo) {
      tmp.a.set(g.x, y + 1.25, g.z);
      tmp.b.set(g.shotTo.x, heightAt(g.shotTo.x, g.shotTo.z) + 1.1, g.shotTo.z);
      const len = tmp.a.distanceTo(tmp.b);
      tmp.mid.addVectors(tmp.a, tmp.b).multiplyScalar(0.5);
      tracer.current.position.copy(tmp.mid);
      tracer.current.quaternion.setFromUnitVectors(tmp.fwd, tmp.b.sub(tmp.a).normalize());
      tracer.current.scale.set(1, len, 1);
      tracer.current.visible = true;
    }
  });
  return (
    <>
      <group ref={group}>
        {/* authored Vanguard trooper (enemy-visuals.ts), animated by the guard's own speed and firing state */}
        <FactionEnemy kind="VANGUARD" role="standard" drive={drive} />
        <mesh ref={flash} position={[0.18, 1.14, 0.9]} visible={false}><sphereGeometry args={[0.12, 8, 6]} /><meshBasicMaterial color="#fff2b0" toneMapped={false} /></mesh>
      </group>
      <mesh ref={tracer} visible={false}><cylinderGeometry args={[0.025, 0.025, 1, 4]} /><meshBasicMaterial color="#ffe08a" transparent opacity={0.85} toneMapped={false} /></mesh>
    </>
  );
}

function plateTexture(name: string, title: string, color: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "rgba(6,10,16,0.72)"; g.fillRect(0, 18, 512, 92);
  g.fillStyle = color; g.fillRect(0, 18, 8, 92);
  g.font = "600 44px 'Rajdhani', 'Segoe UI', sans-serif"; g.fillStyle = "#f2f6fa"; g.textBaseline = "middle"; g.fillText(name.toUpperCase(), 26, 50);
  g.font = "500 26px 'Rajdhani', 'Segoe UI', sans-serif"; g.fillStyle = color; g.fillText(title.toUpperCase(), 26, 88);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function NpcView({ npc, playerRef }: { npc: LivingNpc; playerRef: React.RefObject<THREE.Object3D> }) {
  const group = useRef<THREE.Group>(null!);
  const pos = useMemo(() => npcWorld(npc), [npc]);
  const y = useMemo(() => heightAt(pos.x, pos.z), [pos]);
  const live = useRef({ state: "IDLE" } as Civilian);
  const color = FACTIONS[npc.faction].color;
  const plate = useMemo(() => plateTexture(npc.name, `${npc.title} · ${FACTIONS[npc.faction].name}`, color), [npc, color]);
  useFrame(() => {
    const p = playerRef.current;
    if (!p || !group.current) return;
    const d = Math.hypot(p.position.x - pos.x, p.position.z - pos.z);
    group.current.visible = d < NPC_DRAW;
    live.current.hidden = d > NPC_DRAW;
    live.current.far = d > DETAIL_DISTANCE;
    live.current.state = d < 6 ? "GREET" : "IDLE";
    if (d < 14) group.current.children[0]!.quaternion.setFromAxisAngle(UP, Math.atan2(p.position.x - pos.x, p.position.z - pos.z));
  });
  return (
    <group ref={group} position={[pos.x, y, pos.z]}>
      <group>
        <CivilianBody role={npc.body} live={live} />
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}><ringGeometry args={[0.7, 0.85, 32]} /><meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} /></mesh>
      {plate && <sprite position={[0, 2.45, 0]} scale={[1.9, 0.48, 1]}><spriteMaterial map={plate} transparent depthWrite={false} /></sprite>}
    </group>
  );
}

function EventBeacon({ runtime, playerRef }: { runtime: React.RefObject<LivingRuntime | null>; playerRef: React.RefObject<THREE.Object3D> }) {
  const group = useRef<THREE.Group>(null!);
  const column = useRef<THREE.Mesh>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const colMat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame((st) => {
    const ev = runtime.current?.director.current;
    const p = playerRef.current;
    if (!group.current) return;
    if (!ev || ev.phase === "WON" || ev.phase === "FAILED" || !p) { group.current.visible = false; return; }
    group.current.visible = true;
    group.current.position.set(ev.x, heightAt(ev.x, ev.z), ev.z);
    const t = st.clock.elapsedTime;
    colMat.current.color.set(ev.kind === "FRACTURE" ? "#b968ff" : ev.phase === "WARNING" ? "#ffb23e" : "#ff3b4e");
    colMat.current.opacity = 0.35 + Math.sin(t * 4) * 0.12;
    column.current.scale.set(1, 1, 1);
    ring.current.visible = ev.kind === "FRACTURE";
    ring.current.rotation.z = t * 0.6;
    const k = ev.kind === "FRACTURE" ? 1 : 0;
    ring.current.scale.setScalar(k ? 1 + Math.sin(t * 2) * 0.03 : 1);
  });
  return (
    <group ref={group} visible={false}>
      <mesh ref={column} position={[0, 40, 0]}><cylinderGeometry args={[0.6, 1.4, 80, 12, 1, true]} /><meshBasicMaterial ref={colMat} color="#ff3b4e" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.15, 0]} visible={false}><ringGeometry args={[FRACTURE_RADIUS - 0.4, FRACTURE_RADIUS, 48]} /><meshBasicMaterial color="#b968ff" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>
    </group>
  );
}

function MarkerBeacons({ gear }: { gear: PlayerProgression | undefined }) {
  const markers = useMemo(() => (gear ? livingMarkers(gear) : []), [gear]);
  return (
    <group>
      {markers.map((m) => (
        <group key={m.id} position={[m.x, heightAt(m.x, m.z), m.z]}>
          <mesh position={[0, 14, 0]}><cylinderGeometry args={[0.25, 0.5, 28, 8, 1, true]} /><meshBasicMaterial color={m.kind === "stash" ? "#ffd166" : "#7ef2b0"} transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
          <mesh position={[0, 1.2, 0]} rotation-y={Math.PI / 4}><octahedronGeometry args={[0.45, 0]} /><meshStandardMaterial color={m.kind === "stash" ? "#ffd166" : "#7ef2b0"} emissive={m.kind === "stash" ? "#ffb23e" : "#3fd68a"} emissiveIntensity={1.6} toneMapped={false} /></mesh>
        </group>
      ))}
    </group>
  );
}

/** secrets.ts: a faint violet shimmer over the secret NOVA is sensing (within SECRET_SHIMMER); brighter when it answers now */
function SecretShimmer({ runtime }: { runtime: React.RefObject<LivingRuntime | null> }) {
  const g = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame((st) => {
    const near = runtime.current?.secretNear;
    if (!g.current) return;
    g.current.visible = !!near;
    if (!near) return;
    const t = st.clock.elapsedTime;
    g.current.position.set(near.x, heightAt(near.x, near.z) + 1.2 + Math.sin(t * 1.3) * 0.15, near.z);
    g.current.rotation.y = t * 0.8;
    mat.current.opacity = (near.open ? 0.55 : 0.22) * (0.75 + Math.sin(t * 3) * 0.25);
  });
  return (
    <group ref={g} visible={false}>
      <mesh><octahedronGeometry args={[0.35, 0]} /><meshBasicMaterial ref={mat} color="#c89bff" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.1, 0]}><ringGeometry args={[0.9, 1.05, 24]} /><meshBasicMaterial color="#c89bff" transparent opacity={0.35} depthWrite={false} toneMapped={false} /></mesh>
    </group>
  );
}

/** godforge.ts: the Hollow Crown ruin (always there, sealed until the three marks are found), and Vael at her forge once the
 * Furnace Guardian has fallen. Presentation only; the guardian and Vael's reach are decided in godforge.ts/living-runtime. */
function HollowCrown({ gear, playerRef }: { gear?: PlayerProgression | undefined; playerRef: React.RefObject<THREE.Object3D> }) {
  const g = useRef<THREE.Group>(null!);
  const fire = useRef<THREE.PointLight>(null!);
  const stage = forgeStage({ earnedRewards: gear?.earnedRewards ?? [] });
  const y = useMemo(() => heightAt(HOLLOW_CROWN.x, HOLLOW_CROWN.z), []);
  const pillars = useMemo(() => Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; return { x: Math.cos(a) * HOLLOW_CROWN.radius, z: Math.sin(a) * HOLLOW_CROWN.radius, h: 5 + ((i * 37) % 7), tilt: ((i * 13) % 5 - 2) * 0.06 }; }), []);
  const live = useRef({ state: "IDLE" } as Civilian);
  useFrame((st) => {
    const p = playerRef.current;
    if (!g.current || !p) return;
    const d = Math.hypot(p.position.x - HOLLOW_CROWN.x, p.position.z - HOLLOW_CROWN.z);
    g.current.visible = d < 260;
    live.current.far = d > DETAIL_DISTANCE; live.current.hidden = d > 150;
    if (fire.current) fire.current.intensity = stage === "GUARDIAN_SLAIN" ? 3 + Math.sin(st.clock.elapsedTime * 9) * 0.6 : 0;
  });
  const glow = stage === "SEALED" ? "#5a3a1a" : "#ffb23e";
  return (
    <group ref={g} position={[HOLLOW_CROWN.x, y, HOLLOW_CROWN.z]}>
      {pillars.map((pl, i) => (
        <mesh key={i} position={[pl.x, pl.h / 2 - 0.5, pl.z]} rotation={[pl.tilt, 0, -pl.tilt]} castShadow>
          <cylinderGeometry args={[0.7, 1.1, pl.h, 6]} /><meshStandardMaterial color="#1a1512" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}><ringGeometry args={[HOLLOW_CROWN.radius - 1.2, HOLLOW_CROWN.radius - 0.6, 48]} /><meshBasicMaterial color={glow} transparent opacity={stage === "SEALED" ? 0.25 : 0.7} toneMapped={false} /></mesh>
      <group position={[0, 0, -HOLLOW_CROWN.radius + 1]}>
        <mesh position={[0, 2.5, 0]}><boxGeometry args={[4.5, 5, 0.6]} /><meshStandardMaterial color="#231a12" roughness={0.7} /></mesh>
        <mesh position={[0, 2.5, 0.32]}><planeGeometry args={[1.6, 1.6]} /><meshBasicMaterial color={glow} transparent opacity={stage === "SEALED" ? 0.3 : 0.9} toneMapped={false} /></mesh>
      </group>
      {stage === "GUARDIAN_SLAIN" && (
        <group position={[VAEL.x - HOLLOW_CROWN.x, 0, VAEL.z - HOLLOW_CROWN.z]}>
          <CivilianBody role="ARTISAN" live={live} />
          <mesh position={[1.6, 0.5, 0]}><boxGeometry args={[1.2, 1, 0.6]} /><meshStandardMaterial color="#2b2b2e" metalness={0.8} roughness={0.35} /></mesh>
          <mesh position={[1.6, 0.4, 1.4]}><cylinderGeometry args={[0.8, 1, 0.8, 10]} /><meshStandardMaterial color="#3a1c0c" emissive="#ff6a1a" emissiveIntensity={1.4} toneMapped={false} /></mesh>
          <DistrictLight lightRef={fire} range={60} position={[1.6, 1.6, 1.4]} color="#ff8a3a" distance={14} intensity={3} />
        </group>
      )}
    </group>
  );
}

/** fleet.ts garage bases: an open hangar frame with a lit sign and roll-up door, amber while for sale, cyan once owned. */
function GarageView({ id, owned, playerRef }: { id: GarageId; owned: boolean; playerRef: React.RefObject<THREE.Object3D> }) {
  const g = GARAGES[id];
  const grp = useRef<THREE.Group>(null!);
  const y = useMemo(() => (g.deckY !== undefined ? g.deckY : heightAt(g.x, g.z)), [g]);
  const color = owned ? "#38e8ff" : "#ffb23e";
  const plate = useMemo(() => plateTexture(g.name, owned ? "Your garage · [Y]" : "Garage base for sale · [Y]", color), [g, owned, color]);
  useFrame(() => { const p = playerRef.current; if (p && grp.current) grp.current.visible = Math.hypot(p.position.x - g.x, p.position.z - g.z) < DRAW; });
  // the hangar opens toward +z (the drop point side); the player stands at the mouth to use it
  return (
    <group ref={grp} position={[g.x, y, g.z - 7]}>
      {[-5, 5].map((x) => <mesh key={x} position={[x, 3, 0]} castShadow><boxGeometry args={[0.6, 6, 10]} /><meshStandardMaterial color="#3a3f45" metalness={0.6} roughness={0.5} /></mesh>)}
      <mesh position={[0, 6.2, 0]} castShadow><boxGeometry args={[11, 0.5, 10.5]} /><meshStandardMaterial color="#2d3238" metalness={0.6} roughness={0.5} /></mesh>
      <mesh position={[0, 3, -5]}><boxGeometry args={[10, 6, 0.3]} /><meshStandardMaterial color="#23272c" metalness={0.5} roughness={0.6} /></mesh>
      <mesh position={[0, 5.4, 5.05]}><boxGeometry args={[9.4, 1.2, 0.2]} /><meshStandardMaterial color="#1b1f24" metalness={0.7} roughness={0.4} /></mesh>
      <mesh position={[0, 0.03, 2]} rotation-x={-Math.PI / 2}><planeGeometry args={[9.6, 14]} /><meshStandardMaterial color="#2a2e33" roughness={0.9} /></mesh>
      {[-4.6, 4.6].map((x) => <mesh key={x} position={[x, 0.05, 5.6]}><boxGeometry args={[0.25, 0.1, 3]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} /></mesh>)}
      <DistrictLight range={60} position={[0, 5, 1]} color={color} intensity={6} distance={14} />
      {plate && <sprite position={[0, 7.4, 5.2]} scale={[4.6, 1.15, 1]}><spriteMaterial map={plate} transparent depthWrite={false} /></sprite>}
    </group>
  );
}

export function LivingCity({ runtime, playerRef, gear }: { runtime: React.RefObject<LivingRuntime | null>; playerRef: React.RefObject<THREE.Object3D>; gear?: PlayerProgression | undefined }) {
  return (
    <group name="living-city">
      {BEATS.map((b) => <GuardView key={b.id} id={b.id} faction={b.faction} runtime={runtime} playerRef={playerRef} />)}
      {LIVING_NPCS.map((n) => <NpcView key={n.id} npc={n} playerRef={playerRef} />)}
      <EventBeacon runtime={runtime} playerRef={playerRef} />
      <SecretShimmer runtime={runtime} />
      <HollowCrown gear={gear} playerRef={playerRef} />
      <MarkerBeacons gear={gear} />
      {(Object.keys(GARAGES) as GarageId[]).map((id) => <GarageView key={id} id={id} owned={(gear?.fleet?.garages ?? []).includes(id)} playerRef={playerRef} />)}
    </group>
  );
}
