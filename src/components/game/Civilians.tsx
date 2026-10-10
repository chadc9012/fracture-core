import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { REGIONS } from "@/game/world";
import { heightAt } from "@/game/terrain";
import { mulberry32 } from "@/game/rng";
import {
  spawnCivilian,
  stepCivilian,
  type Civilian,
  type CivilianRole,
  type CivilianSpec,
} from "@/game/civilians";

/**
 * Ambient, friendly civilian population — Nexus City's techs, vendors and medics and the outpost
 * scouts/scavengers in Veridan Forest (per the "World Fracture Civilian Population" reference sheets).
 * Same centrally-stepped / imperative-view pattern as Weather.tsx and Wildlife.tsx: one shared array is
 * advanced once per frame, and each <CivilianView> only ever reads it to set transforms.
 */
const byId = (id: string) => REGIONS.find((r) => r.id === id)!;

function buildRoster(): CivilianSpec[] {
  const nexus = byId("nexus");
  const veridan = byId("veridan");
  const specs: CivilianSpec[] = [
    { id: "kael", name: "Kael", role: "ENGINEER", title: "Former Nexus Reactor Tech", lore: "Keeps the old reactor conduits from drifting out of sync.", homeX: nexus.x - 10, homeZ: nexus.z + 8 },
    { id: "elara", name: "Elara", role: "VENDOR", title: "Nexus Market Vendor", lore: "Runs a stall of re-purposed tools and salvage.", homeX: nexus.x + 6, homeZ: nexus.z - 9 },
    { id: "aris", name: "Dr. Aris", role: "MEDIC", title: "Refugee Camp Lead Physician", lore: "Treats arrivals from the outer zones.", homeX: nexus.x - 4, homeZ: nexus.z - 12 },
    { id: "jael", name: "Jael", role: "ARTISAN", title: "Nexus Arcology Tech-Smith", lore: "Precision salvage work on arcology systems.", homeX: nexus.x + 12, homeZ: nexus.z + 5 },
    { id: "ryu", name: "Ryu", role: "SCAVENGER", title: "Veridan Forest Scavenger", lore: "Works the tree line for anything worth carrying home.", homeX: veridan.x + 14, homeZ: veridan.z - 6 },
    { id: "lyra", name: "Lyra", role: "OBSERVER", title: "Veridan Outpost Forward Observer", lore: "Watches the tree line from the outpost ridge.", homeX: veridan.x - 10, homeZ: veridan.z + 10 },
  ];
  return specs;
}

const UP = new THREE.Vector3(0, 1, 0);

/** jacket / accent-glow palette per role, matching the reference sheets' cyan/teal tech-wear */
const ROLE_LOOK: Record<CivilianRole, { jacket: string; trim: string; glow: string; hooded: boolean }> = {
  ENGINEER: { jacket: "#4a5240", trim: "#39421f", glow: "#7ef27e", hooded: false },
  VENDOR: { jacket: "#3a4148", trim: "#2b3138", glow: "#5ad0e0", hooded: false },
  MEDIC: { jacket: "#8a8168", trim: "#5f5a48", glow: "#5ad0e0", hooded: false },
  ARTISAN: { jacket: "#33373d", trim: "#22262b", glow: "#5ad0e0", hooded: false },
  SCAVENGER: { jacket: "#5c5648", trim: "#3f3a2f", glow: "#4de3a8", hooded: true },
  OBSERVER: { jacket: "#4a5142", trim: "#33382c", glow: "#5ad0e0", hooded: false },
};

function Humanoid({ role, phase, walking, greeting }: { role: CivilianRole; phase: number; walking: boolean; greeting: boolean }) {
  const look = ROLE_LOOK[role];
  const legRef = useRef<THREE.Group>(null!);
  const armRef = useRef<THREE.Group>(null!);
  const waveArm = useRef<THREE.Group>(null!);
  useFrame(() => {
    const swing = walking ? Math.sin(phase) * 0.42 : 0;
    if (legRef.current) legRef.current.children.forEach((leg, i) => { leg.rotation.x = i === 0 ? swing : -swing; });
    if (armRef.current) armRef.current.children.forEach((arm, i) => { arm.rotation.x = i === 0 ? -swing * 0.7 : swing * 0.7; });
    if (waveArm.current) waveArm.current.rotation.z = greeting ? Math.PI * 0.55 + Math.sin(phase * 4) * 0.25 : 0;
  });
  return (
    <group scale={0.95}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.46, 0.7, 0.28]} />
        <meshStandardMaterial color={look.jacket} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.98, 0.15]}>
        <boxGeometry args={[0.3, 0.14, 0.05]} />
        <meshStandardMaterial color={look.glow} emissive={look.glow} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshStandardMaterial color="#cfa789" roughness={0.9} />
      </mesh>
      {look.hooded && (
        <mesh position={[0, 1.62, -0.03]} castShadow>
          <sphereGeometry args={[0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshStandardMaterial color={look.trim} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
      <group ref={armRef} position={[0, 1.28, 0]}>
        <group position={[-0.32, 0, 0]}>
          <mesh castShadow><capsuleGeometry args={[0.08, 0.55, 4, 6]} /><meshStandardMaterial color={look.jacket} roughness={0.85} /></mesh>
        </group>
        <group ref={waveArm} position={[0.32, 0, 0]}>
          <mesh position={[0, -0.28, 0]} castShadow><capsuleGeometry args={[0.08, 0.55, 4, 6]} /><meshStandardMaterial color={look.jacket} roughness={0.85} /></mesh>
        </group>
      </group>
      <group ref={legRef} position={[0, 0.65, 0]}>
        <mesh position={[-0.14, -0.32, 0]} castShadow><capsuleGeometry args={[0.09, 0.64, 4, 6]} /><meshStandardMaterial color={look.trim} roughness={0.9} /></mesh>
        <mesh position={[0.14, -0.32, 0]} castShadow><capsuleGeometry args={[0.09, 0.64, 4, 6]} /><meshStandardMaterial color={look.trim} roughness={0.9} /></mesh>
      </group>
    </group>
  );
}

function CivilianView({ civilian, sharedRef }: { civilian: Civilian; sharedRef: React.RefObject<Civilian[]> }) {
  const group = useRef<THREE.Group>(null!);
  const live = useRef(civilian);
  useFrame(() => {
    const current = sharedRef.current?.find((c) => c.id === civilian.id) ?? civilian;
    live.current = current;
    if (!group.current) return;
    group.current.position.set(current.x, heightAt(current.x, current.z), current.z);
    group.current.quaternion.setFromAxisAngle(UP, current.heading);
    const bob = current.state === "WANDER" ? Math.abs(Math.sin(current.phase)) * 0.04 : 0;
    group.current.position.y += bob;
  });
  return (
    <group ref={group}>
      <Humanoid role={civilian.role} phase={civilian.phase} walking={live.current.state === "WANDER"} greeting={live.current.state === "GREET"} />
    </group>
  );
}

export function Civilians({ playerRef }: { playerRef: React.RefObject<THREE.Object3D> }) {
  const roster = useMemo(() => buildRoster(), []);
  const civilians = useMemo(() => roster.map((spec, i) => spawnCivilian(spec, i)), [roster]);
  const civiliansRef = useRef<Civilian[]>(civilians);
  const rndRef = useRef(mulberry32(4040));

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.08);
    const p = playerRef.current;
    if (!p) return;
    for (const c of civiliansRef.current) {
      // only bother stepping AI for civilians anywhere near the player — same distance culling as Wildlife
      if (Math.hypot(c.x - p.position.x, c.z - p.position.z) > 140) continue;
      stepCivilian(c, dt, p.position.x, p.position.z, rndRef.current);
    }
  });

  return (
    <group>
      {civilians.map((c) => (
        <CivilianView key={c.id} civilian={c} sharedRef={civiliansRef} />
      ))}
    </group>
  );
}
