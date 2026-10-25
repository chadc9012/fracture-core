import { useFrame } from "@react-three/fiber";
import { RoundedBox, useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { enemyVisual, type EnemyRole, type EnemyVisual } from "@/game/enemy-visuals";
import { prepareWorldAsset } from "@/game/asset-render-quality";
import { enemyClipWeights, strideRate, type ClipWeights, type EnemyDrive } from "@/game/enemy-anim";
import { enemyWeapon, HELD_MUZZLE, heldPitch, PALM, RAISE_RATE } from "@/game/enemy-weapons";
import { DEATH_BONES, deathBonesAt, type DeathStyle } from "@/game/death-animations";
import type { HandlingClass } from "@/game/weapon-handling";
import { heldWeaponCopy } from "./heldModels";

/** a Mixamo bone by name, whichever way the loader spelled the prefix ("mixamorig:Head" or "mixamorigHead") */
const boneCache = new WeakMap<THREE.Object3D, Map<string, THREE.Object3D | null>>();
/** a rig's bone by Mixamo name (both prefix spellings), cached per rig: hit reactions look bones up every frame */
function rigBone(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let m = boneCache.get(root);
  if (!m) { m = new Map(); boneCache.set(root, m); }
  if (m.has(name)) return m.get(name)!;
  const b = root.getObjectByName(`mixamorig:${name}`) ?? root.getObjectByName(`mixamorig${name}`) ?? root.getObjectByName(name) ?? null;
  m.set(name, b);
  return b;
}

/** Per-machine motion the renderer reads (WarMachines writes it each frame). `procedural` is set by the model: true while it has no clips. */
/** `frozen`: hold the current pose (a corpse); the mixer and procedural motion stop. `death`: a corpse playing its death animation
 * (death-animations.ts: style, seed for its variation, mirror for falls to the right). `muzzle`: where this enemy's held gun's barrel was last frame (world), for shots and flashes. */
/** each pooled machine slot's drive (WarMachines registers them): Scene reads `muzzle` to fire enemy shots from the held gun */
export const enemyDrives: (DriveRef | undefined)[] = [];
export type DriveRef = { current: EnemyDrive & { procedural?: boolean; frozen?: boolean; death?: { age: number; seed: number; style: DeathStyle; mirror: boolean }; /** hit reaction laid over the clips (enemy-reactions.ts reactionBones) */ hit?: Record<string, [number, number, number]> | null; muzzle?: { x: number; y: number; z: number; t: number } } };
import * as THREE from "three";
import { SURFACES, regionLook } from "@/game/visual-standard";

import type { EnemyKind } from "@/game/enemy-visuals";
export type { EnemyKind };

/** Which region's look each enemy faction wears (visual-standard REGION_LOOK). */
export const KIND_REGION: Record<EnemyKind, string> = { RAIDER: "wastelands", OVERCLOCKED: "nexus", ABERRATION: "swamps", VANGUARD: "frostspire", SKYBORN: "ember" };

type Mats = { plate: string; under: string; accent: string; plateKind: keyof typeof SURFACES };

function Plate({ kind, color, ...p }: { kind: keyof typeof SURFACES; color: string; args: [number, number, number]; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const s = SURFACES[kind];
  return <RoundedBox args={p.args} radius={Math.min(...p.args) * 0.25} smoothness={2} position={p.position ?? [0, 0, 0]} rotation={p.rotation ?? [0, 0, 0]} castShadow>
    <meshStandardMaterial color={color} metalness={s.metalness} roughness={s.roughness} />
  </RoundedBox>;
}

function Limb({ m, len, r, side, arm, swing }: { m: Mats; len: number; r: number; side: 1 | -1; arm: boolean; swing: React.RefObject<THREE.Group | null> }) {
  const under = SURFACES.fabric;
  return <group ref={swing}>
    <mesh position-y={-len * 0.25} castShadow><capsuleGeometry args={[r * 0.8, len * 0.5, 4, 8]} /><meshStandardMaterial color={m.under} metalness={under.metalness} roughness={under.roughness} /></mesh>
    <Plate kind={m.plateKind} color={m.plate} args={[r * 2.3, len * 0.42, r * 2.1]} position={[0, -len * 0.22, r * 0.3]} />
    <group position-y={-len * 0.5}>
      <mesh position-y={-len * 0.25} castShadow><capsuleGeometry args={[r * 0.75, len * 0.5, 4, 8]} /><meshStandardMaterial color={m.under} roughness={under.roughness} /></mesh>
      <Plate kind={m.plateKind} color={m.plate} args={[r * 2.2, len * 0.45, r * 2.2]} position={[0, -len * 0.27, arm ? 0 : r * 0.35]} />
      {!arm && <Plate kind="rubber" color="#1c1d20" args={[r * 2.4, r * 1.1, r * 3.6]} position={[0, -len * 0.55, r * 0.7]} />}
      {arm && <mesh position={[0, -len * 0.55, 0]} castShadow><sphereGeometry args={[r * 1.05, 10, 8]} /><meshStandardMaterial color={m.under} roughness={0.7} /></mesh>}
    </group>
    {arm && <mesh position={[side * r * 0.4, len * 0.05, 0]} castShadow><sphereGeometry args={[r * 1.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={m.plate} metalness={SURFACES[m.plateKind].metalness} roughness={SURFACES[m.plateKind].roughness} /></mesh>}
  </group>;
}

/** Articulated region-faction trooper (procedural starter model, ~3.9 units tall to match existing hit volumes). */
export function EnemyModel({ kind, boss, visorRef, headRef, drive }: { kind: EnemyKind; boss: boolean; drive?: DriveRef; visorRef?: React.Ref<THREE.MeshStandardMaterial>; headRef?: React.Ref<THREE.Group> }) {
  const look = regionLook(KIND_REGION[kind]);
  const m: Mats = { plate: look.armor, under: look.cloth, accent: look.accent, plateKind: kind === "ABERRATION" ? "polymer" : kind === "RAIDER" ? "paintedArmor" : look.primary };
  const legs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const arms = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const seed = useRef(Math.random() * 10);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 3 + seed.current;
    const speed = Number.isFinite(drive?.current.speed) ? Math.max(0, drive!.current.speed) : 0;
    const movement = Math.min(1, speed / 1.2);
    const s = Math.sin(t * (1 + Math.min(speed, 8) * 0.22)) * movement;
    legs[0]!.current?.rotation.set(s * 0.45, 0, 0); legs[1]!.current?.rotation.set(-s * 0.45, 0, 0);
    // arms hold the weapon forward, with a little sway
    arms[0]!.current?.rotation.set(-1.1 + s * 0.05, 0, 0.15); arms[1]!.current?.rotation.set(-1.2 - s * 0.05, 0, -0.3);
  });
  const bulk = kind === "VANGUARD" ? 1.15 : kind === "ABERRATION" ? 0.95 : 1;
  const hip = 1.75, limb = 0.26 * bulk;
  return <group>
    {/* pelvis + torso */}
    <Plate kind={m.plateKind} color={m.under} args={[0.95 * bulk, 0.45, 0.6]} position={[0, hip + 0.1, 0]} />
    <mesh position-y={hip + 0.8} castShadow><capsuleGeometry args={[0.45 * bulk, 0.6, 4, 10]} /><meshStandardMaterial color={m.under} roughness={0.85} /></mesh>
    <Plate kind={m.plateKind} color={m.plate} args={[1.25 * bulk, 0.95, 0.42]} position={[0, hip + 0.95, 0.22]} rotation={[-0.08, 0, 0]} />
    <Plate kind={m.plateKind} color={m.plate} args={[1.15 * bulk, 0.9, 0.3]} position={[0, hip + 0.95, -0.3]} />
    <mesh position={[0, hip + 1.05, 0.45]}><boxGeometry args={[0.3, 0.06, 0.02]} /><meshStandardMaterial color="#111" emissive={m.accent} emissiveIntensity={0.9} /></mesh>
    {kind === "RAIDER" && <Plate kind="fabric" color="#4a3b2a" args={[1.4, 0.25, 0.3]} position={[0.1, hip + 1.35, 0]} rotation={[0, 0, -0.5]} />}
    {kind === "VANGUARD" && <Plate kind="bareMetal" color="#9aa6b2" args={[0.9, 1.1, 0.35]} position={[0, hip + 1, -0.6]} />}
    {kind === "OVERCLOCKED" && <mesh position={[0, hip + 1.1, -0.55]}><cylinderGeometry args={[0.18, 0.18, 0.8, 10]} /><meshStandardMaterial color="#222" emissive={m.accent} emissiveIntensity={1.2} /></mesh>}
    {/* head */}
    <group ref={headRef ?? null} position-y={hip + 1.75}>
      <mesh castShadow><sphereGeometry args={[0.36, 16, 12]} /><meshStandardMaterial color={m.plate} metalness={SURFACES[m.plateKind].metalness} roughness={SURFACES[m.plateKind].roughness} /></mesh>
      <Plate kind={m.plateKind} color={m.plate} args={[0.5, 0.22, 0.4]} position={[0, -0.2, 0.12]} />
      <RoundedBox args={[0.5, 0.11, 0.1]} radius={0.03} smoothness={2} position={[0, 0.02, 0.32]}><meshStandardMaterial ref={visorRef ?? null} color="#0b0d10" emissive={m.accent} emissiveIntensity={1.1} roughness={0.15} /></RoundedBox>
      {kind === "ABERRATION" && [-1, 1].map((s) => <mesh key={s} position={[s * 0.25, 0.3, -0.1]} rotation-z={s * -0.5}><coneGeometry args={[0.08, 0.5, 6]} /><meshStandardMaterial color={m.accent} roughness={0.6} /></mesh>)}
      {kind === "VANGUARD" && <mesh position={[0, 0.34, -0.05]}><boxGeometry args={[0.06, 0.16, 0.5]} /><meshStandardMaterial color="#c9d3dc" metalness={0.9} roughness={0.3} /></mesh>}
    </group>
    {/* limbs */}
    {([1, -1] as const).map((side, i) => <group key={`l${side}`} position={[side * 0.3 * bulk, hip, 0]}><Limb m={m} len={1.7} r={limb} side={side} arm={false} swing={legs[i]!} /></group>)}
    {([1, -1] as const).map((side, i) => <group key={`a${side}`} position={[side * 0.78 * bulk, hip + 1.3, 0]}><Limb m={m} len={1.25} r={limb * 0.8} side={side} arm swing={arms[i]!} /></group>)}
    {/* weapon held across the body */}
    <group position={[0.35, hip + 0.85, 0.75]}>
      <Plate kind="bareMetal" color="#2b2e33" args={[0.16, 0.24, kind === "VANGUARD" ? 1.5 : 1.1]} />
      <mesh position={[0, 0.02, kind === "VANGUARD" ? 0.85 : 0.65]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.04, 0.05, 0.4, 8]} /><meshStandardMaterial color="#1a1c1f" metalness={0.9} roughness={0.35} /></mesh>
      <mesh position={[0, 0.14, 0]}><boxGeometry args={[0.05, 0.03, 0.4]} /><meshStandardMaterial color="#111" emissive={m.accent} emissiveIntensity={0.7} /></mesh>
    </group>
    {boss && <mesh position-y={2.5} rotation-x={Math.PI / 2}><torusGeometry args={[2.2, 0.06, 6, 32]} /><meshBasicMaterial color={m.accent} transparent opacity={0.6} /></mesh>}
  </group>;
}

/* ---------------- authored enemy models (enemy-visuals.ts) with silent fallback ---------------- */

class QuietBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const CLIP_NAMES: (keyof ClipWeights)[] = ["idle", "walk", "run", "shoot"];

function Authored({ visual, headRef, drive, onBuilt, weapon }: { visual: EnemyVisual; headRef?: React.Ref<THREE.Group>; drive?: DriveRef; onBuilt?: (obj: THREE.Object3D) => void; weapon?: HandlingClass | null }) {
  const { scene, animations } = useGLTF(visual.url);
  const built = useMemo(() => {
    const obj = cloneSkinned(scene);
    prepareWorldAsset(obj);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      // Skinned animation can move limbs outside their bind-pose bounds.
      m.frustumCulled = !(m as THREE.SkinnedMesh).isSkinnedMesh;
      // Preserve authored GLTF PBR maps, metallic/roughness values and normal
      // maps; replacing them with procedural colors destroys asset fidelity.
      // Shadow reception is safe per instance and adds grounded contact shading.
    });
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = visual.height / Math.max(size.y, 1e-3);
    // rigged models with authored clips get their own mixer; clip names are idle/walk/run/shoot (build-enemy-rigged.py)
    const clips: Partial<Record<keyof ClipWeights, THREE.AnimationAction>> = {};
    let mixer: THREE.AnimationMixer | null = null;
    if (animations.length) {
      mixer = new THREE.AnimationMixer(obj);
      for (const name of CLIP_NAMES) {
        const clip = animations.find((a) => a.name.toLowerCase() === name);
        if (!clip) continue;
        const a = mixer.clipAction(clip); a.play(); a.weight = 0; a.time = Math.random() * clip.duration; clips[name] = a;
      }
      if (!Object.keys(clips).length) mixer = null;
    }
    const hand = rigBone(obj, "RightHand"), knuckle = rigBone(obj, "RightHandMiddle1") ?? hand;
    return { obj, k, offset: [-c.x * k, -box.min.y * k, -c.z * k] as [number, number, number], mixer, clips, hand, knuckle };
  }, [scene, animations, visual.height]);
  // held weapon (enemy-weapons.ts): only rigged bodies with a hand carry one; placed every frame at the palm
  const holder = useMemo(() => { const g = new THREE.Group(); g.name = "enemy:weapon"; g.visible = false; return g; }, []);
  const aimW = useRef(0);
  useEffect(() => {
    if (!weapon || !built.hand || !built.mixer) return;
    let live = true;
    void heldWeaponCopy(weapon).then((m) => { if (live && m) { holder.clear(); holder.add(m); } });
    return () => { live = false; holder.clear(); };
  }, [weapon, built, holder]);
  // corpse collapse: this body's pose deltas and the resting quaternions they are applied on top of
  const collapse = useRef<{ seed: number; base: [string, THREE.Object3D, THREE.Quaternion][] } | null>(null);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), w: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler() }), []);
  const body = useRef<THREE.Group>(null);
  const seed = useRef(Math.random() * 10);
  const posed = useRef(false);
  useEffect(() => { onBuilt?.(built.obj); }, [built, onBuilt]);
  useFrame(({ clock }, dt) => {
    const b = body.current;
    if (!b) return;
    // only the variant actually shown in its pooled slot animates (and reports whether it needs the procedural bob)
    for (let o: THREE.Object3D | null = b; o; o = o.parent) if (!o.visible) return;
    if (drive) drive.current.procedural = !built.mixer;
    if (drive?.current.frozen) {
      holder.visible = false; // a body drops its gun (GoreFx throws a copy)
      // a body: settle into the rest pose once (never the bind/T-pose), then collapse from it
      if (!posed.current && built.mixer) {
        for (const name of CLIP_NAMES) { const a = built.clips[name]; if (a) { a.weight = name === "idle" || (!built.clips.idle && name === "walk") ? 1 : 0; a.time = 0; } }
        built.mixer.update(0);
        b.rotation.set(0, 0, 0);
        collapse.current = null;
      }
      posed.current = true;
      const death = drive.current.death;
      if (death && built.mixer) {
        if (!collapse.current || collapse.current.seed !== death.seed) {
          // a new body in this pooled slot: back to the rest pose, then take this one's collapse
          if (collapse.current) for (const [, bone, q] of collapse.current.base) bone.quaternion.copy(q);
          collapse.current = { seed: death.seed, base: [] };
          for (const name of DEATH_BONES) { const bone = rigBone(built.obj, name); if (bone) collapse.current.base.push([name, bone, bone.quaternion.clone()]); }
        }
        // the death animation: additive on this rig's own rest pose (death-animations.ts)
        const pose = deathBonesAt(death.style, death.age, death.seed, death.mirror);
        for (const [name, bone, base] of collapse.current.base) {
          bone.quaternion.copy(base);
          const e = pose[name];
          if (e) { tmp.e.set(e[0], e[1], e[2]); bone.quaternion.multiply(tmp.q.setFromEuler(tmp.e)); }
        }
      }
      return;
    }
    if (collapse.current) { for (const [, bone, q] of collapse.current.base) bone.quaternion.copy(q); collapse.current = null; }
    posed.current = false;
    if (built.mixer) {
      const d = drive?.current ?? { speed: 0, aiming: false };
      const has = { idle: !!built.clips.idle, walk: !!built.clips.walk, run: !!built.clips.run, shoot: !!built.clips.shoot };
      const w = enemyClipWeights(d, has);
      for (const name of CLIP_NAMES) { const a = built.clips[name]; if (a) a.weight = w[name]; }
      if (built.clips.walk) built.clips.walk.timeScale = strideRate(d.speed, "walk");
      if (built.clips.run) built.clips.run.timeScale = strideRate(d.speed, "run");
      built.mixer.update(Math.min(dt, 0.1));
      // hit reaction: additive on top of whatever clip is playing (the mixer rewrites the bones every frame, so this never accumulates)
      const hit = drive?.current.hit;
      if (hit) for (const [name, e] of Object.entries(hit)) { const bone = rigBone(built.obj, name); if (bone) { tmp.e.set(e[0], e[1], e[2]); bone.quaternion.multiply(tmp.q.setFromEuler(tmp.e)); } }
      b.rotation.set(0, 0, 0);
      // the gun: gripped at the palm, pointing where the body faces (+Z), up to aim while winding up or firing, low ready
      // otherwise (the hand bone twists through the clips, so following it pointed the barrel at the sky)
      if (weapon && built.hand && holder.children.length) {
        aimW.current += ((d.aiming ? 1 : 0) - aimW.current) * Math.min(1, dt * RAISE_RATE);
        built.obj.updateMatrixWorld(true);
        built.hand.getWorldPosition(tmp.v); (built.knuckle ?? built.hand).getWorldPosition(tmp.w);
        tmp.v.lerp(tmp.w, PALM);
        b.worldToLocal(tmp.v);
        holder.position.copy(tmp.v);
        holder.rotation.set(heldPitch(weapon, aimW.current), 0, 0);
        holder.visible = true;
        const mz = HELD_MUZZLE[weapon];
        if (mz && drive) { holder.updateMatrixWorld(true); tmp.w.set(mz[0], mz[1], mz[2]); holder.localToWorld(tmp.w); drive.current.muzzle = { x: tmp.w.x, y: tmp.w.y, z: tmp.w.z, t: performance.now() / 1000 }; }
      }
      return;
    }
    const t = clock.elapsedTime * 3 + seed.current;
    // procedural motion for models without clips: bipeds sway/lean into the stride, creatures undulate
    if (visual.motion === "creature") { b.rotation.set(0, Math.sin(t * 0.7) * 0.12, Math.sin(t) * 0.05); b.scale.set(1, 1 + Math.sin(t * 2) * 0.03, 1); }
    else b.rotation.set(0.06 + Math.sin(t * 2) * 0.03, Math.sin(t) * 0.06, Math.sin(t) * 0.04);
  });
  return <group ref={body}><group ref={headRef ?? null}><primitive object={built.obj} scale={built.k} position={built.offset} /></group><primitive object={holder} /></group>;
}

/** Real enemy model for this faction/role; procedural trooper while loading or if the model fails. */
export function FactionEnemy({ kind, role, visorRef, headRef, drive, onBuilt, armed = true }: { kind: EnemyKind; role: EnemyRole; visorRef?: React.Ref<THREE.MeshStandardMaterial>; headRef?: React.Ref<THREE.Group>; drive?: DriveRef; onBuilt?: (obj: THREE.Object3D) => void; /** carry the faction/rank weapon (enemy-weapons.ts); bodies (GoreFx) pass false */ armed?: boolean }) {
  // the procedural stand-in is built ~3.9 units tall with boots ~0.18 below its origin: scale it to the authored height and
  // stand its boots on the ground, so a loading or failed model never shows a 3.9 m trooper sunk into the floor
  const k = enemyVisual(kind, role).height / 3.9;
  const fallback = <group scale={k} position={[0, 0.18 * k, 0]}><EnemyModel kind={kind} boss={role === "boss"} {...(drive ? { drive } : {})} {...(visorRef ? { visorRef } : {})} {...(headRef ? { headRef } : {})} /></group>;
  return <QuietBoundary fallback={fallback}><Suspense fallback={fallback}><Authored visual={enemyVisual(kind, role)} weapon={armed ? enemyWeapon(kind, role) : null} {...(headRef ? { headRef } : {})} {...(drive ? { drive } : {})} {...(onBuilt ? { onBuilt } : {})} /></Suspense></QuietBoundary>;
}
