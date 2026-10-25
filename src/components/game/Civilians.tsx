import { useFrame } from "@react-three/fiber";
import { ARM_RELAX, armBones, relaxArm } from "@/game/rest-pose";
import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CIVILIAN_HEIGHT, civilianClip, civilianModelUrl, type CivilianClip } from "@/game/civilian-models";
import { REGIONS } from "@/game/world";
import { NEON_CENTER as NEON } from "@/game/living-world";
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
 * scouts/scavengers in Verdant Forest (per the "World Fracture Civilian Population" reference sheets).
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
    { id: "ryu", name: "Ryu", role: "SCAVENGER", title: "Verdant Forest Scavenger", lore: "Works the tree line for anything worth carrying home.", homeX: veridan.x + 14, homeZ: veridan.z - 6 },
    { id: "lyra", name: "Lyra", role: "OBSERVER", title: "Veridan Outpost Forward Observer", lore: "Watches the tree line from the outpost ridge.", homeX: veridan.x - 10, homeZ: veridan.z + 10 },
    // Living World: Nexus outer districts and Neon City streets (living-world.ts). They panic and run from fights nearby.
    { id: "nx-dock", name: "Dock Hand", role: "ENGINEER", title: "Shipyard Loader", lore: "Moves crates between the shipyard bays.", homeX: nexus.x + 4, homeZ: nexus.z + 60 },
    { id: "nx-trader", name: "Street Trader", role: "VENDOR", title: "Market District Trader", lore: "Sells whatever came in on the last convoy.", homeX: nexus.x + 60, homeZ: nexus.z + 4 },
    { id: "nx-tech", name: "Arcology Tech", role: "ARTISAN", title: "Arcology Maintenance", lore: "Keeps the arcology lifts running.", homeX: nexus.x - 60, homeZ: nexus.z - 4 },
    { id: "nx-clerk", name: "Spire Clerk", role: "OBSERVER", title: "Spire District Clerk", lore: "Files permits nobody reads.", homeX: nexus.x - 4, homeZ: nexus.z - 60 },
    { id: "ne-runner", name: "Courier", role: "SCAVENGER", title: "Neon Courier", lore: "Runs packages through the Undercity.", homeX: NEON.x - 26, homeZ: NEON.z + 7 },
    { id: "ne-vendor", name: "Noodle Vendor", role: "VENDOR", title: "Neon Market Stall", lore: "Best broth under the Grid.", homeX: NEON.x - 3, homeZ: NEON.z + 18 },
    { id: "ne-medic", name: "Street Medic", role: "MEDIC", title: "Undercity Clinic", lore: "Patches up whoever walks in.", homeX: NEON.x + 22, homeZ: NEON.z + 7 },
    { id: "ne-tourist", name: "Spire Visitor", role: "OBSERVER", title: "Checkpoint Queue", lore: "Waiting on clearance, again.", homeX: NEON.x + 2, homeZ: NEON.z - 22 },
    { id: "ne-tech", name: "Grid Tech", role: "ENGINEER", title: "Grid Maintenance", lore: "Climbs the deck pillars all day.", homeX: NEON.x + 30, homeZ: NEON.z + 20 },
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

export function Humanoid({ role, phase, walking, greeting }: { role: CivilianRole; phase: number; walking: boolean; greeting: boolean }) {
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

export class Quiet extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Authored civilian body (civilian-models.ts) with idle / walk / wave clips crossfaded from the AI state. */
export function CivilianModel({ role, live, url }: { role: CivilianRole; live: React.RefObject<Civilian>; /** another authored body (a sheet merchant, merchant-models.ts) */ url?: string | null | undefined }) {
  const { scene, animations } = useGLTF(url ?? civilianModelUrl(role));
  const built = useMemo(() => {
    const obj = cloneSkinned(scene);
    obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = CIVILIAN_HEIGHT / Math.max(size.y, 1e-3);
    const mixer = new THREE.AnimationMixer(obj);
    const actions: Partial<Record<CivilianClip, THREE.AnimationAction>> = {};
    for (const name of ["idle", "walk", "wave"] as const) {
      const clip = animations.find((a) => a.name === name);
      if (clip) { const a = mixer.clipAction(clip); a.play(); a.weight = name === "idle" ? 1 : 0; a.time = Math.random() * clip.duration; actions[name] = a; }
    }
    // a body with no idle clip would hold its rig's A-pose: relax the arms instead (rest-pose.ts)
    const relaxArms = actions.idle ? [] : armBones(obj);
    return { obj, k, offset: [-c.x * k, -box.min.y * k, -c.z * k] as [number, number, number], mixer, actions, relaxArms };
  }, [scene, animations]);
  const weights = useRef<Record<CivilianClip, number>>({ idle: 1, walk: 0, wave: 0 });
  useFrame((_, dt) => {
    built.obj.visible = !live.current?.far;
    if (live.current?.hidden || live.current?.far) return;
    const want = civilianClip(live.current?.state ?? "IDLE");
    const k = 1 - Math.exp(-dt * 6);
    for (const name of ["idle", "walk", "wave"] as const) {
      const w = weights.current;
      w[name] += ((name === want ? 1 : 0) - w[name]) * k;
      const a = built.actions[name] ?? (name === "wave" ? built.actions.idle : undefined);
      if (built.actions[name]) built.actions[name]!.weight = w[name];
      else if (a) a.weight = Math.max(a.weight, w[name]);
    }
    built.mixer.update(Math.min(dt, 0.1));
    for (const { arm, elbow } of built.relaxArms) relaxArm(arm, elbow, built.obj, ARM_RELAX);
  });
  return <primitive object={built.obj} scale={built.k} position={built.offset} />;
}

/** Level of detail: the authored body (~100k triangles, own animation mixer) up close, a cheap procedural stand-in past
 * DETAIL_DISTANCE. `live.current.far` is set by whoever owns the position (Civilians loop, LivingCity NPCs). */
export const DETAIL_DISTANCE = 32;
export function CivilianBody({ role, live }: { role: CivilianRole; live: React.RefObject<Civilian> }) {
  const lo = useRef<THREE.Group>(null!);
  useFrame(() => { if (lo.current) lo.current.visible = !!live.current?.far; });
  const fallback = <Humanoid role={role} phase={0} walking={false} greeting={false} />;
  return (
    <>
      <group ref={lo} visible={false}><Humanoid role={role} phase={0} walking={false} greeting={false} /></group>
      <Quiet fallback={fallback}><Suspense fallback={fallback}><CivilianModel role={role} live={live} /></Suspense></Quiet>
    </>
  );
}

function CivilianView({ civilian, sharedRef }: { civilian: Civilian; sharedRef: React.RefObject<Civilian[]> }) {
  const group = useRef<THREE.Group>(null!);
  const live = useRef(civilian);
  useFrame(() => {
    const current = sharedRef.current?.find((c) => c.id === civilian.id) ?? civilian;
    live.current = current;
    if (!group.current) return;
    group.current.visible = !current.hidden;
    if (current.hidden) return;
    group.current.position.set(current.x, heightAt(current.x, current.z), current.z);
    group.current.quaternion.setFromAxisAngle(UP, current.heading);
    const bob = current.state === "WANDER" ? Math.abs(Math.sin(current.phase)) * 0.04 : 0;
    group.current.position.y += bob;
  });
  return (
    <group ref={group}>
      <CivilianBody role={civilian.role} live={live} />
    </group>
  );
}

export function Civilians({ playerRef, threatsRef }: { playerRef: React.RefObject<THREE.Object3D>; threatsRef?: React.RefObject<{ x: number; z: number }[]> }) {
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
      const far = Math.hypot(c.x - p.position.x, c.z - p.position.z);
      c.hidden = far > 150;
      c.far = far > DETAIL_DISTANCE; // authored bodies are ~100k triangles each: full detail only up close
      if (far > 140) continue;
      stepCivilian(c, dt, p.position.x, p.position.z, rndRef.current, threatsRef?.current ?? []);
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
