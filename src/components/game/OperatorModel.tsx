import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ClassId } from "@/game/loadout";
import { bodyProfile, type BodyType } from "@/game/operators";
import type { ArmorLook } from "@/game/armor-look";
import { buildPalette, regionWeights, type Palette } from "@/game/operator-paint";
import { SURFACES } from "@/game/visual-standard";
import { equippedPieces, piecesKey, type ArmorPiece } from "@/game/armor-pieces";
import type { GearItem, GearSlot } from "@/game/inventory";

export type WornGear = { inventory: GearItem[]; equippedGear: Partial<Record<GearSlot, string>> };

const ELEMENT_GLOW: Record<string, string> = { KINETIC: "#ffd9a0", THERMAL: "#ff8a3a", CRYO: "#8fd8ff", ARC: "#6fe7ff", BIO: "#9cff8a" };

/** Builds the separate armor meshes and parents them to the rig's bones so they follow every clip. */
function attachArmor(object: THREE.Object3D, pieces: ArmorPiece[], height: number, modelScale: number, colors: { armor: string; trim: string; accent: string }) {
  const made: THREE.Object3D[] = [];
  const mats = {
    armor: new THREE.MeshStandardMaterial({ color: colors.armor, metalness: SURFACES.paintedArmor.metalness, roughness: SURFACES.paintedArmor.roughness }),
    trim: new THREE.MeshStandardMaterial({ color: colors.trim, metalness: SURFACES.bareMetal.metalness, roughness: SURFACES.bareMetal.roughness }),
    accent: new THREE.MeshStandardMaterial({ color: "#10151c", emissive: new THREE.Color(colors.accent), emissiveIntensity: 0.9, roughness: 0.3 }),
  };
  const geos: THREE.BufferGeometry[] = [];
  const unit = height / 1.85;
  const ws = new THREE.Vector3();
  for (const piece of pieces) {
    const bone = object.getObjectByName(piece.bone) ?? object.getObjectByName(piece.bone.replace("mixamorig:", "mixamorig"));
    if (!bone) continue;
    bone.getWorldScale(ws);
    const g = new THREE.Group();
    g.name = `armor:${piece.slot}`;
    g.scale.setScalar(unit / Math.max(ws.y * modelScale, 1e-6));
    for (const part of piece.parts) {
      const [x, y, z] = part.size;
      const geo = part.shape === "box" ? new THREE.BoxGeometry(x, y, z)
        : part.shape === "sphere" ? new THREE.SphereGeometry(1, 14, 10).scale(x, y, z)
        : part.shape === "cylinder" ? new THREE.CylinderGeometry(x, x * 0.85, y, 12).scale(1, 1, z / Math.max(x, 1e-6))
        : part.shape === "cone" ? new THREE.ConeGeometry(x, y, 8)
        : new THREE.TorusGeometry(x, y * 0.5, 8, 20);
      geos.push(geo);
      const mesh = new THREE.Mesh(geo, mats[part.tone]);
      mesh.position.set(...part.pos);
      if (part.rot) mesh.rotation.set(...part.rot);
      g.add(mesh);
    }
    bone.add(g);
    made.push(g);
  }
  return () => { made.forEach((g) => g.removeFromParent()); geos.forEach((x) => x.dispose()); Object.values(mats).forEach((m) => m.dispose()); };
}

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


/** Gives every skinned mesh vertex colours from the paint plan, blended by skin weights, on a private copy of the
 * geometry (the cached GLTF geometry is shared by every clone). The GLBs carry no materials, so this is what
 * makes the helmet, chest, gauntlets and legs read as separate armor pieces. */
function paintVertexColors(mesh: THREE.SkinnedMesh, palette: Palette) {
  const geo = mesh.geometry.clone();
  const skinIndex = geo.getAttribute("skinIndex"), skinWeight = geo.getAttribute("skinWeight"), position = geo.getAttribute("position");
  if (!skinIndex || !skinWeight || !position) { mesh.geometry = geo; return geo; }
  const names = mesh.skeleton.bones.map((b) => b.name);
  const colours = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, new THREE.Color(v.color)])) as Record<string, THREE.Color>;
  const out = new Float32Array(position.count * 3);
  const j = [0, 0, 0, 0], w = [0, 0, 0, 0];
  for (let i = 0; i < position.count; i++) {
    for (let k = 0; k < 4; k++) { j[k] = k === 0 ? skinIndex.getX(i) : k === 1 ? skinIndex.getY(i) : k === 2 ? skinIndex.getZ(i) : skinIndex.getW(i); w[k] = k === 0 ? skinWeight.getX(i) : k === 1 ? skinWeight.getY(i) : k === 2 ? skinWeight.getZ(i) : skinWeight.getW(i); }
    const parts = regionWeights(names, j, w);
    let r = 0, g = 0, b = 0;
    for (const [region, f] of Object.entries(parts)) { const c = colours[region]; if (c) { r += c.r * f!; g += c.g * f!; b += c.b * f!; } }
    out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(out, 3));
  mesh.geometry = geo;
  return geo;
}

const actions0 = (a: Record<string, THREE.AnimationAction>, name: string) => Boolean(a[name]);

function Model({ url, tint, height, feetY, color, trim, pose, motion, bodyType, look, cloth, gear, classId }: { trim: string | undefined; gear: WornGear | undefined; classId: ClassId; look: ArmorLook | undefined; cloth: string | undefined; bodyType: BodyType | undefined; url: string; tint: boolean; height: number; feetY: number; color: string | undefined; pose: "showcase" | "locomotion"; motion: ModelMotion | undefined }) {
  const { scene, animations } = useGLTF(url);
  const built = useMemo(() => {
    const object = cloneSkinned(scene);
    let skinned = false;
    const robot = bodyProfile(bodyType).segmented;
    const palette = tint ? buildPalette({ armor: color, cloth, look, bodyType, trim }) : null;
    // vertex colours carry the armor regions; a faint cool emissive floor keeps shadowed plates from going black
    // shared visual standard: segmented chassis reads as bare metal, armored operators as painted ceramic plate
    const surface = robot ? SURFACES.bareMetal : SURFACES.paintedArmor;
    const material = palette ? new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, metalness: surface.metalness, roughness: surface.roughness, emissive: new THREE.Color("#1c2836"), emissiveIntensity: 1 }) : null;
    const ownGeometries: THREE.BufferGeometry[] = [];
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
      if (m.isSkinnedMesh) { skinned = true; m.frustumCulled = false; if (palette) ownGeometries.push(paintVertexColors(m, palette)); }
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
    return { object, scale, material, ownGeometries, mixer, actions, offset: new THREE.Vector3(-centre.x * scale, feetY - box.min.y * scale, -centre.z * scale) };
  }, [scene, animations, height, feetY, tint, color, trim, bodyType, look, cloth]);
  const armorKey = piecesKey(gear, classId);
  useEffect(() => {
    const pieces = equippedPieces(gear, classId);
    if (!pieces.length) return;
    built.object.updateMatrixWorld(true);
    const accent = ELEMENT_GLOW[gear?.inventory.find((g) => g.id === gear.equippedGear.chest)?.element ?? "ARC"] ?? "#6fe7ff";
    return attachArmor(built.object, pieces, height, built.scale, { armor: color ?? "#9aa3ad", trim: "#3b4048", accent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, armorKey, color, height]);
  useEffect(() => () => { built.material?.dispose(); built.ownGeometries.forEach((g) => g.dispose()); built.mixer?.stopAllAction(); }, [built]);

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
      const loop = actions["showcase"] ?? actions["idle"];
      if (loop) set(actions["showcase"] ? "showcase" : "idle", 1, clock.elapsedTime / loop.getClip().duration);
      else set("walk", 1, 0.25);
    } else if (sliding && actions["slide"]) {
      // authored slide clip (NYX) scrubbed by slide progress
      set("slide", 1, Math.min(0.999, Math.max(0, m0?.slideT ?? 0)));
    } else {
      const m = motion?.current;
      const cycle = m ? m.phase / (Math.PI * 2) : 0;
      const i = m?.intensity ?? 0;
      const run = smooth(0.4, 0.62, i);
      // with an idle clip, standing still plays it; without one the stride simply freezes mid-step
      const moving = actions["idle"] ? Math.min(1, i * 5) : 1;
      set("walk", moving * (1 - run), cycle);
      set("run", moving * run, cycle);
      if (actions["idle"]) set("idle", 1 - moving, clock.elapsedTime / actions["idle"].getClip().duration);
    }
    mixer.update(0);
  });
  return <group ref={rig} position={[0, feetY, 0]}><primitive object={built.object} scale={built.scale} position={[built.offset.x, built.offset.y - feetY, built.offset.z]} /></group>;
}

/** Draws the authored model for `classId` if one exists, else `fallback` (also while loading or on failure).
 * `pose="showcase"` loops the flex clip (forge); `"locomotion"` drives walk/run from the live stride phase. */
export function OperatorModel({ classId, height, feetY, fallback, color, trim, pose = "showcase", motion, bodyType, look, cloth, gear }: {
  /** equipped inventory: each worn armor slot attaches its own pieces to the rig */
  gear?: WornGear | undefined;
  trim?: string | undefined; look?: ArmorLook | undefined; cloth?: string | undefined; bodyType?: BodyType | undefined; classId: ClassId; height: number; feetY: number; fallback: ReactNode; color?: string | undefined; pose?: "showcase" | "locomotion"; motion?: ModelMotion | undefined;
}) {
  const entry = OPERATOR_MODELS[classId];
  // a static mesh would just slide across the ground, so the world only uses rigged models
  if (!entry || (pose === "locomotion" && !entry.rigged)) return <>{fallback}</>;
  return <Quiet fallback={fallback}><Suspense fallback={fallback}><Model url={entry.url} tint={entry.tint} height={height} feetY={feetY} color={color} trim={trim} pose={pose} motion={motion} bodyType={bodyType} look={look} cloth={cloth} gear={gear} classId={classId} /></Suspense></Quiet>;
}
