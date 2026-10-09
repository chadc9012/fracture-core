import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ClassId } from "@/game/loadout";

/** Authored (Meshy) operator models, served from /public. GOLIATH and CIPHER are rigged (Mixamo skeleton with
 * walk/run clips, GOLIATH also showcase); NYX is a static textured mesh until its rig arrives; Anything missing or failing to load falls back to the procedural Operator. */
export const OPERATOR_MODELS: Partial<Record<ClassId, { url: string; tint: boolean; rigged: boolean }>> = {
  TITAN: { url: "/models/operators/goliath.glb", tint: true, rigged: true },
  WARLOCK: { url: "/models/operators/cipher.glb", tint: true, rigged: true },
  HUNTER: { url: "/models/operators/nyx.glb", tint: false, rigged: false },
};

export type ModelMotion = { current: { phase: number; intensity: number; air: boolean } };

class Quiet extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Mixamo clips carry the hips' travel; the game moves the body itself, so pin hips x/z to frame 0. */
function pinRootMotion(clip: THREE.AnimationClip) {
  const out = clip.clone();
  for (const track of out.tracks) {
    if (!/Hips\.position$/.test(track.name)) continue;
    const v = track.values;
    const x0 = v[0] ?? 0, z0 = v[2] ?? 0;
    for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
  }
  return out;
}

function Model({ url, tint, height, feetY, color, pose, motion }: { url: string; tint: boolean; height: number; feetY: number; color: string | undefined; pose: "showcase" | "locomotion"; motion: ModelMotion | undefined }) {
  const { scene, animations } = useGLTF(url);
  const built = useMemo(() => {
    const object = cloneSkinned(scene);
    let skinned = false;
    const material = tint ? new THREE.MeshStandardMaterial({ color: color ?? "#6b6f76", metalness: 0.55, roughness: 0.5 }) : null;
    object.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      m.castShadow = false; m.receiveShadow = false;
      if (m.isSkinnedMesh) { skinned = true; m.frustumCulled = false; }
      if (material) m.material = material;
    });
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const scale = height / Math.max(size.y, 0.001);
    const mixer = skinned && animations.length ? new THREE.AnimationMixer(object) : null;
    const actions: Record<string, THREE.AnimationAction> = {};
    if (mixer) for (const clip of animations) { const a = mixer.clipAction(pinRootMotion(clip)); a.timeScale = 0; a.play(); a.weight = 0; actions[clip.name] = a; }
    return { object, scale, material, mixer, actions, offset: new THREE.Vector3(-centre.x * scale, feetY - box.min.y * scale, -centre.z * scale) };
  }, [scene, animations, height, feetY, tint, color]);
  useEffect(() => () => { built.material?.dispose(); built.mixer?.stopAllAction(); }, [built]);

  useFrame(({ clock }) => {
    const { mixer, actions } = built;
    if (!mixer) return;
    const set = (name: string, weight: number, cycle: number) => {
      const a = actions[name];
      if (!a) return;
      a.weight = weight;
      a.time = ((cycle % 1) + 1) % 1 * a.getClip().duration;
    };
    for (const key of Object.keys(actions)) { const a = actions[key]; if (a) a.weight = 0; }
    if (pose === "showcase") {
      // no flex clip (CIPHER): hold the walk cycle at mid-stance, which reads as a relaxed standing pose
      if (actions.showcase) set("showcase", 1, clock.elapsedTime / actions.showcase.getClip().duration);
      else set("walk", 1, 0.25);
    } else {
      const m = motion?.current;
      const cycle = m ? m.phase / (Math.PI * 2) : 0;
      const run = smooth(0.4, 0.62, m?.intensity ?? 0);
      set("walk", 1 - run, cycle);
      set("run", run, cycle);
    }
    mixer.update(0);
  });
  return <primitive object={built.object} scale={built.scale} position={built.offset} />;
}

/** Draws the authored model for `classId` if one exists, else `fallback` (also while loading or on failure).
 * `pose="showcase"` loops the flex clip (forge); `"locomotion"` drives walk/run from the live stride phase. */
export function OperatorModel({ classId, height, feetY, fallback, color, pose = "showcase", motion }: {
  classId: ClassId; height: number; feetY: number; fallback: ReactNode; color?: string | undefined; pose?: "showcase" | "locomotion"; motion?: ModelMotion | undefined;
}) {
  const entry = OPERATOR_MODELS[classId];
  // a static mesh would just slide across the ground, so the world only uses rigged models
  if (!entry || (pose === "locomotion" && !entry.rigged)) return <>{fallback}</>;
  return <Quiet fallback={fallback}><Suspense fallback={fallback}><Model url={entry.url} tint={entry.tint} height={height} feetY={feetY} color={color} pose={pose} motion={motion} /></Suspense></Quiet>;
}
