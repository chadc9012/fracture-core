import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ClassId } from "@/game/loadout";
import { bodyProfile, type BodyType } from "@/game/operators";

/** Authored (Meshy) operator models, served from /public. GOLIATH, NYX and CIPHER are rigged (Mixamo skeleton; walk/run for all, plus showcase for GOLIATH and idle for NYX); Anything missing or failing to load falls back to the procedural Operator. */
export const OPERATOR_MODELS: Partial<Record<ClassId, { url: string; tint: boolean; rigged: boolean }>> = {
  TITAN: { url: "/models/operators/goliath.glb", tint: true, rigged: true },
  WARLOCK: { url: "/models/operators/cipher.glb", tint: true, rigged: true },
  HUNTER: { url: "/models/operators/nyx.glb", tint: true, rigged: true },
};

export type ModelMotion = { current: { phase: number; intensity: number; air: boolean; stance?: "STAND" | "CROUCH" | "PRONE"; /** 0..1 progress through a slide, -1 when not sliding */ slideT?: number } };

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

const actions0 = (a: Record<string, THREE.AnimationAction>, name: string) => Boolean(a[name]);

function Model({ url, tint, height, feetY, color, pose, motion, bodyType }: { bodyType: BodyType | undefined; url: string; tint: boolean; height: number; feetY: number; color: string | undefined; pose: "showcase" | "locomotion"; motion: ModelMotion | undefined }) {
  const { scene, animations } = useGLTF(url);
  const built = useMemo(() => {
    const object = cloneSkinned(scene);
    let skinned = false;
    const robot = bodyProfile(bodyType).segmented;
    const material = tint ? new THREE.MeshStandardMaterial({ color: robot ? new THREE.Color(color ?? "#6b6f76").lerp(new THREE.Color("#9aa7b5"), 0.55) : (color ?? "#6b6f76"), metalness: robot ? 1 : 0.55, roughness: robot ? 0.22 : 0.5 }) : null;
    if (material && robot) {
      // segmented chassis: glowing cyan seams every quarter metre up the body, in model-relative height
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying float vSeamY;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvSeamY = (modelMatrix * vec4(transformed, 1.0)).y - modelMatrix[3].y;");
        shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vSeamY;").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\nfloat seam = smoothstep(0.86, 0.97, fract(vSeamY * 4.0)) - smoothstep(0.97, 1.0, fract(vSeamY * 4.0));\ntotalEmissiveRadiance += vec3(0.05, 0.85, 1.0) * seam * 1.6;");
      };
      material.customProgramCacheKey = () => "operator-robot-seams";
    }
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
  }, [scene, animations, height, feetY, tint, color, bodyType]);
  useEffect(() => () => { built.material?.dispose(); built.mixer?.stopAllAction(); }, [built]);

  const rig = useRef<THREE.Group>(null);
  const body = useRef({ crouch: 0, prone: 0, lean: 0 });
  useFrame(({ clock }, dt) => {
    // stance pose: squash toward the ground for a crouch, tip face-down for prone, lean back in a slide (all pivot on the feet)
    const m0 = pose === "locomotion" ? motion?.current : undefined;
    const sliding = (m0?.slideT ?? -1) >= 0;
    const b = body.current;
    const k = 1 - Math.exp(-12 * dt);
    b.crouch += (((m0?.stance === "CROUCH" ? 1 : 0) || (sliding ? 0.7 : 0)) - b.crouch) * k;
    b.prone += ((m0?.stance === "PRONE" ? 1 : 0) - b.prone) * k;
    b.lean += ((sliding ? 1 : 0) - b.lean) * k;
    if (rig.current) {
      // body type reshapes the one authored mesh: height, shoulder width and waist depth relative to the male baseline
      const prof = bodyProfile(bodyType);
      const wide = 1 + (prof.shoulders - 1.06) * 2.2;
      rig.current.scale.set(wide, prof.height * (1 - 0.24 * b.crouch), 1 + (prof.waist - 1) * 1.8);
      rig.current.rotation.x = b.prone * 1.25 - b.lean * (actions0(built.actions, "slide") ? 0 : 0.45);
      rig.current.position.set(0, feetY + b.prone * 0.25, -b.prone * height * 0.4);
    }
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
      // flex clip (GOLIATH) > idle clip (NYX) > walk held at mid-stance (CIPHER), a relaxed standing pose
      const loop = actions.showcase ?? actions.idle;
      if (loop) set(actions.showcase ? "showcase" : "idle", 1, clock.elapsedTime / loop.getClip().duration);
      else set("walk", 1, 0.25);
    } else if (sliding && actions.slide) {
      // authored slide clip (NYX) scrubbed by slide progress
      set("slide", 1, Math.min(0.999, Math.max(0, m0?.slideT ?? 0)));
    } else {
      const m = motion?.current;
      const cycle = m ? m.phase / (Math.PI * 2) : 0;
      const i = m?.intensity ?? 0;
      const run = smooth(0.4, 0.62, i);
      // with an idle clip, standing still plays it; without one the stride simply freezes mid-step
      const moving = actions.idle ? Math.min(1, i * 5) : 1;
      set("walk", moving * (1 - run), cycle);
      set("run", moving * run, cycle);
      if (actions.idle) set("idle", 1 - moving, clock.elapsedTime / actions.idle.getClip().duration);
    }
    mixer.update(0);
  });
  return <group ref={rig} position={[0, feetY, 0]}><primitive object={built.object} scale={built.scale} position={[built.offset.x, built.offset.y - feetY, built.offset.z]} /></group>;
}

/** Draws the authored model for `classId` if one exists, else `fallback` (also while loading or on failure).
 * `pose="showcase"` loops the flex clip (forge); `"locomotion"` drives walk/run from the live stride phase. */
export function OperatorModel({ classId, height, feetY, fallback, color, pose = "showcase", motion, bodyType }: {
  bodyType?: BodyType | undefined; classId: ClassId; height: number; feetY: number; fallback: ReactNode; color?: string | undefined; pose?: "showcase" | "locomotion"; motion?: ModelMotion | undefined;
}) {
  const entry = OPERATOR_MODELS[classId];
  // a static mesh would just slide across the ground, so the world only uses rigged models
  if (!entry || (pose === "locomotion" && !entry.rigged)) return <>{fallback}</>;
  return <Quiet fallback={fallback}><Suspense fallback={fallback}><Model url={entry.url} tint={entry.tint} height={height} feetY={feetY} color={color} pose={pose} motion={motion} bodyType={bodyType} /></Suspense></Quiet>;
}
