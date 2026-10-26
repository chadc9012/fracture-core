import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DistrictLight } from "./DistrictLight";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { UNIQUE_SCENARIOS, type UniqueScenario } from "@/game/unique-scenarios";
import { walkHeight } from "@/game/terrain";
import type { WorldSim } from "@/game/sim";
import { DragonModel } from "./DragonModel";
import { AstravoreBody, HollowStarArena } from "./AstravoreBody";
import { SummonBodies } from "./SummonBodies";
import { vyrakFire } from "@/game/dragon-look";
import { findQuadrupedLegs, legAngles, type Leg, type RestBone } from "@/game/skeleton-gait";

type GaitJoint = { bone: THREE.Bone; rest: THREE.Quaternion; axis: THREE.Vector3 };
type Gait = { legs: { leg: Leg; hip: GaitJoint; knee: GaitJoint }[] };

/** Finds the legs of a clip-less skinned quadruped and records, per hip/knee, its rest rotation and the body's
 * side-to-side axis expressed in its parent's space, so a swing about that axis never twists the bone. */
function buildGait(object: THREE.Object3D): Gait | null {
  let skeleton: THREE.Skeleton | null = null;
  object.traverse((o) => { const s = (o as THREE.SkinnedMesh).skeleton; if (s && !skeleton) skeleton = s; });
  if (!skeleton) return null;
  const bones = (skeleton as THREE.Skeleton).bones;
  object.updateMatrixWorld(true);
  const index = new Map(bones.map((b, i) => [b, i]));
  const p = new THREE.Vector3();
  const rest: RestBone[] = bones.map((b, i) => { b.getWorldPosition(p); return { index: i, parent: b.parent && index.has(b.parent as THREE.Bone) ? index.get(b.parent as THREE.Bone)! : null, children: b.children.filter((c) => index.has(c as THREE.Bone)).length, x: p.x, y: p.y, z: p.z }; });
  const rig = findQuadrupedLegs(rest);
  if (!rig) return null;
  const lateral = new THREE.Vector3(rig.lateral.x, 0, rig.lateral.z).normalize();
  const joint = (i: number): GaitJoint => {
    const bone = bones[i]!;
    const parentQ = new THREE.Quaternion();
    bone.parent?.getWorldQuaternion(parentQ);
    return { bone, rest: bone.quaternion.clone(), axis: lateral.clone().applyQuaternion(parentQ.invert()).normalize() };
  };
  return { legs: rig.legs.map((leg) => ({ leg, hip: joint(leg.hip), knee: joint(leg.knee) })) };
}
const swing = new THREE.Quaternion();
function pose(j: GaitJoint, angle: number) { swing.setFromAxisAngle(j.axis, angle); j.bone.quaternion.copy(swing).multiply(j.rest); }

/** Scenario ids whose authored model is mounted and drawing. WarMachines keeps the procedural boss body visible until
 * the id is in here, so a slow download or a failed GLB never leaves an invisible boss (and never suspends the world). */
export const scenarioModelReady = new Set<string>();

class Quiet extends Component<{ id: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(error: unknown) { console.warn(`[boss] model for "${this.props.id}" failed, using the procedural body:`, error); }
  override render() { return this.state.failed ? null : this.props.children; }
}

function BossModel({ scenario, sim }: { scenario: UniqueScenario; sim: WorldSim }) {
  const model = scenario.model!;
  const { scene } = useGLTF(model.url);
  const built = useMemo(() => {
    const object = cloneSkinned(scene);
    object.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      m.castShadow = true; m.frustumCulled = false;
      const mat = m.material as THREE.MeshStandardMaterial;
      // the glowing parts are baked into the colour map; lifting it as emissive keeps them lit in shadow
      if (mat.map) { mat.emissiveMap = mat.map; mat.emissive = new THREE.Color("#ffffff"); mat.emissiveIntensity = model.glow; }
    });
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const scale = model.height / Math.max(size.y, 0.001);
    const gait = model.gait === "quadruped" ? buildGait(object) : null;
    if (model.gait && !gait) console.warn(`[boss] could not find legs on "${scenario.id}"; it will glide`);
    return { object, scale, gait, offset: new THREE.Vector3(-centre.x * scale, -box.min.y * scale, -centre.z * scale) };
  }, [scene, model.height, model.glow, model.gait, scenario.id]);
  const stride = useRef({ x: 0, z: 0, phase: 0, speed: 0, init: false });
  useEffect(() => { scenarioModelReady.add(scenario.id); return () => { scenarioModelReady.delete(scenario.id); }; }, [scenario.id]);

  const group = useRef<THREE.Group>(null!);
  useFrame(({ clock }, dtRaw) => {
    const g = group.current;
    if (!g) return;
    const m = sim.machines.find((e) => e.alive && e.scenarioId === scenario.id);
    g.visible = Boolean(m);
    if (!m) { stride.current.init = false; return; }
    if (built.gait) {
      // legs follow real ground speed: phase advances with distance, so paws don't skate
      const dt = Math.min(Math.max(dtRaw, 1e-3), 0.1), st = stride.current;
      if (!st.init) { st.x = m.x; st.z = m.z; st.init = true; }
      const moved = Math.hypot(m.x - st.x, m.z - st.z);
      st.x = m.x; st.z = m.z;
      st.speed += ((moved > 3 ? 0 : moved / dt) - st.speed) * Math.min(1, dt * 6);
      const strideLen = model.height * (st.speed > model.height ? 1.1 : 0.55);
      st.phase += (moved > 3 ? 0 : moved / strideLen) * Math.PI * 2;
      const k = st.speed / Math.max(0.5, model.height * 0.5);
      for (const { leg, hip, knee } of built.gait.legs) { const a = legAngles(leg, st.phase, k); pose(hip, a.hip); pose(knee, a.knee); }
    }
    const t = clock.elapsedTime;
    g.position.set(m.x, walkHeight(m.x, m.z), m.z);
    g.rotation.set(Math.sin(t * 1.6) * 0.02, m.rot, Math.sin(t * 0.9) * 0.03);
    // wind-up telegraph: a quick swell while it charges an attack
    g.scale.setScalar((m.aim ?? 0) > 0 ? 1 + Math.abs(Math.sin(t * 28)) * 0.05 : 1);
  });
  return <group ref={group} visible={false}>
    <group position={built.offset} scale={built.scale}><primitive object={built.object} /></group>
  </group>;
}

/** Vyrak: the shared DragonModel at boss scale, with readable telegraphs — wings flare and the jaw/mouth fill with ember during
 * a tell (brighter for the finale), the chest core flashes cyan-white with a ring while the weak point is open. Reads sim only. */
function VyrakBody({ sim }: { sim: WorldSim }) {
  const group = useRef<THREE.Group>(null!);
  const wingL = useRef<THREE.Group>(null), wingR = useRef<THREE.Group>(null), head = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Mesh>(null), core = useRef<THREE.MeshStandardMaterial>(null), mouth = useRef<THREE.MeshBasicMaterial>(null), weak = useRef<THREE.Mesh>(null);
  const flash = useRef(0); const lastPhase = useRef(0);
  // the reference sheet: orange fire through phases 1-2, white-hot gold in phase 3 (Covenant Trial); state so the model re-tints
  const [phase, setPhase] = useState(0);
  const look = vyrakFire(phase), fireRef = useRef(look.fire); fireRef.current = look.fire;
  useEffect(() => { scenarioModelReady.add("vyrak"); return () => { scenarioModelReady.delete("vyrak"); }; }, []);
  useFrame(({ clock }, dt) => {
    const g = group.current; if (!g) return;
    const m = sim.machines.find((e) => e.alive && e.scenarioId === "vyrak");
    g.visible = Boolean(m); if (!m) return;
    const t = clock.elapsedTime, now = performance.now() / 1000, enc = m.encounter;
    const telling = enc?.state === "TELL", tellK = telling ? 1 - enc!.timer / Math.max(0.01, enc!.tellTotal) : 0;
    const finale = (enc?.finaleUntil ?? 0) > now;
    const open = finale || (m.poiseState?.weakPointUntil ?? 0) > now;
    if (enc && enc.phase !== lastPhase.current) { lastPhase.current = enc.phase; flash.current = 1; setPhase(enc.phase); }
    flash.current = Math.max(0, flash.current - dt * 0.8);
    const hover = 3 + Math.sin(t * 1.4) * 0.6 + (enc?.phase === 0 ? 2 : 0);
    g.position.set(m.x, walkHeight(m.x, m.z) + hover, m.z);
    g.rotation.set(-tellK * 0.25, m.rot, Math.sin(t * 0.8) * 0.05);
    const flap = telling ? 0.9 * tellK : Math.sin(t * 3.2) * 0.5;
    if (wingL.current) wingL.current.rotation.z = flap; if (wingR.current) wingR.current.rotation.z = -flap;
    if (head.current) head.current.rotation.x = -tellK * 0.5;
    if (jaw.current) jaw.current.rotation.x = tellK * 0.5;
    if (mouth.current) { mouth.current.opacity = 0.2 + tellK * 0.8; mouth.current.color.set(finale ? "#fff1a8" : fireRef.current); }
    if (core.current) { core.current.emissive.set(open ? "#9ffcff" : fireRef.current); core.current.emissiveIntensity = open ? 6 + Math.sin(t * 14) * 2 : 1.5 + flash.current * 6; }
    if (weak.current) { weak.current.visible = open; weak.current.scale.setScalar(1 + Math.sin(t * 8) * 0.15); }
  });
  return <group ref={group} visible={false}><group scale={2.6}><DragonModel refs={{ wingL, wingR, head, jaw, core, mouth, weak }} fire={look.fire} glow={look.glow} /></group>
    <DistrictLight range={90} position={[0, 1.4, 1.6]} color={look.fire} intensity={30} distance={22} /></group>;
}

/** Authored GLB bodies for Unique Scenario bosses. Each model is downloaded only once its boss has actually been summoned. */
export function ScenarioBosses({ sim }: { sim: WorldSim }) {
  const [wanted, setWanted] = useState<string[]>([]);
  useFrame(() => {
    for (const m of sim.machines) {
      if (m.alive && m.scenarioId && !wanted.includes(m.scenarioId)) {
        const id = m.scenarioId;
        if (id === "vyrak" || id === "astravore" || UNIQUE_SCENARIOS.find((s) => s.id === id)?.model) setWanted((list) => (list.includes(id) ? list : [...list, id]));
      }
    }
  });
  return <><HollowStarArena />{wanted.includes("astravore") && <><AstravoreBody sim={sim} ready={scenarioModelReady} /><SummonBodies sim={sim} /></>}{wanted.includes("vyrak") && <VyrakBody sim={sim} />}{UNIQUE_SCENARIOS.filter((s) => s.model && wanted.includes(s.id)).map((s) => (
    <Quiet key={s.id} id={s.id}><Suspense fallback={null}><BossModel scenario={s} sim={sim} /></Suspense></Quiet>
  ))}</>;
}
