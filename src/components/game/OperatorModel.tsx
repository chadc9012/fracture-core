import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ClassId } from "@/game/loadout";
import { bodyProfile, type BodyType } from "@/game/operators";
import type { ArmorLook } from "@/game/armor-look";
import { boneRegion, buildPalette, vivid } from "@/game/operator-paint";
import { paintSkin, type SkinTextures } from "./operator-skin";
import { SURFACES } from "@/game/visual-standard";
import { equippedPieces, piecesKey, type ArmorPiece } from "@/game/armor-pieces";
import type { GearItem, GearSlot } from "@/game/inventory";
import { HAND_BONE, WEAPON_PROPS } from "@/game/weapon-props";
import { WEAPONS, WEAPON_ORDER, type WeaponId } from "@/game/weapons";

/** the weapon the operator is currently holding; read every frame so a weapon swap needs no rebuild */
export type HeldWeapon = { current: { weapon: WeaponId } };

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

/** Builds one group per weapon on the right-hand bone (only the held one is visible). Starter procedural props from weapon-props.ts. */
function attachWeapons(object: THREE.Object3D, height: number, modelScale: number) {
  const bone = object.getObjectByName(HAND_BONE) ?? object.getObjectByName(HAND_BONE.replace("mixamorig:", "mixamorig"));
  const groups: Partial<Record<WeaponId, THREE.Group>> = {};
  if (!bone) return { groups, dispose: () => {} };
  const unit = height / 1.85, ws = new THREE.Vector3();
  bone.getWorldScale(ws);
  const k = unit / Math.max(ws.y * modelScale, 1e-6);
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const body = new THREE.MeshStandardMaterial({ color: "#2b3138", metalness: 0.6, roughness: 0.45 });
  const trim = new THREE.MeshStandardMaterial({ color: "#8b939c", metalness: 0.85, roughness: 0.35 });
  mats.push(body, trim);
  for (const id of WEAPON_ORDER) {
    const glow = ELEMENT_GLOW[WEAPONS[id].element ?? ""] ?? "#ffb347";
    const accent = new THREE.MeshStandardMaterial({ color: "#10151c", emissive: new THREE.Color(glow), emissiveIntensity: 1.1, roughness: 0.3 });
    mats.push(accent);
    const g = new THREE.Group();
    g.name = `held:${id}`; g.scale.setScalar(k); g.visible = false;
    for (const part of WEAPON_PROPS[id]) {
      const [x, y, z] = part.size;
      const geo = part.shape === "box" ? new THREE.BoxGeometry(x, y, z) : part.shape === "cylinder" ? new THREE.CylinderGeometry(x, x, y, 10) : part.shape === "cone" ? new THREE.ConeGeometry(x, y, 10) : new THREE.SphereGeometry(1, 10, 8).scale(x, y, z);
      geos.push(geo);
      const mesh = new THREE.Mesh(geo, part.tone === "body" ? body : part.tone === "trim" ? trim : accent);
      mesh.position.set(...part.pos);
      if (part.rot) mesh.rotation.set(...part.rot);
      g.add(mesh);
    }
    bone.add(g);
    groups[id] = g;
  }
  return { groups, dispose: () => { Object.values(groups).forEach((g) => g?.removeFromParent()); geos.forEach((x) => x.dispose()); mats.forEach((m) => m.dispose()); } };
}

/** Authored (Meshy) operator models, served from /public. GOLIATH, NYX and CIPHER are rigged (Mixamo skeleton; walk/run for all, plus showcase for GOLIATH and idle for NYX); Anything missing or failing to load falls back to the procedural Operator. */
export const OPERATOR_MODELS: Partial<Record<ClassId, { url: string; tint: boolean; rigged: boolean }>> = {
  TITAN: { url: "/models/operators/goliath-hd.glb", tint: true, rigged: true },
  // CIPHER ships its own authored textures (Meshy, re-encoded by scripts/build-operator-authored.py): no runtime paint, no procedural plates on top.
  WARLOCK: { url: "/models/operators/cipher-authored.glb", tint: false, rigged: true },
  HUNTER: { url: "/models/operators/nyx-hd.glb", tint: true, rigged: true },
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

function Model({ url, tint, height, feetY, color, trim, pose, motion, bodyType, look, cloth, gear, classId, held }: { held: HeldWeapon | undefined; trim: string | undefined; gear: WornGear | undefined; classId: ClassId; look: ArmorLook | undefined; cloth: string | undefined; bodyType: BodyType | undefined; url: string; tint: boolean; height: number; feetY: number; color: string | undefined; pose: "showcase" | "locomotion"; motion: ModelMotion | undefined }) {
  const { scene, animations } = useGLTF(url);
  const built = useMemo(() => {
    const object = cloneSkinned(scene);
    let skinned = false;
    const robot = bodyProfile(bodyType).segmented;
    const palette = tint ? buildPalette({ armor: color, cloth, look, bodyType, trim }) : null;
    // The body is painted into a texture through its UVs (game/operator-texture.ts): armor regions, seams, cavity shading, wear and the
    // visor. The emissive map carries a faint cool floor (so shadowed plates never go black) plus the visor slit glow.
    // shared visual standard: segmented chassis reads as bare metal, armored operators as painted ceramic plate
    const surface = robot ? SURFACES.bareMetal : SURFACES.paintedArmor;
    const skins: SkinTextures[] = [];
    const material = palette ? new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: surface.metalness, roughness: surface.roughness, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1 }) : null;
    const accent = vivid(trim ?? "#4fd8ff", 0.55, 0.7);
    const texSize = pose === "showcase" ? 768 : 512;
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
      if (m.isSkinnedMesh) {
        skinned = true; m.frustumCulled = false;
        if (palette && material) {
          const skin = paintSkin(m, palette, { size: texSize, accent });
          if (skin) { skins.push(skin); material.map = skin.map; material.emissiveMap = skin.emissiveMap; }
          else { material.color.set(palette.chest.color); material.emissive.set("#1c2836"); } // mesh lacks UVs/skin data: flat plate colour, never black
        }
      }
      if (material) m.material = material;
    });
    // F3 diagnostics (PerfProbe): what the paint path actually did for this operator, so a grey result can be traced
    let verts = 0, matCount = 0; const share: Record<string, number> = {};
    object.traverse((o) => { const m = o as THREE.SkinnedMesh; if (!m.isMesh) return; matCount += Array.isArray(m.material) ? m.material.length : 1; verts += m.geometry.getAttribute("position")?.count ?? 0; if (m.isSkinnedMesh) for (const b of m.skeleton.bones) { const r = boneRegion(b.name); share[r] = (share[r] ?? 0) + 1; } });
    object.userData["operatorDiag"] = { url, tint, texturePaint: skins.length > 0, textureSize: skins[0]?.size ?? 0, textureCovered: skins[0] ? Math.round(skins[0].covered * 100) + "%" : "0%", visorTexels: skins[0]?.visorTexels ?? 0, materials: matCount, vertices: verts, bonesByRegion: share, armor: color ?? "(none)", trim: trim ?? "(none)", chest: palette?.chest.color ?? "(no palette)", helmet: palette?.helmet.color ?? "(no palette)", suit: palette?.suit.color ?? "(no palette)" };
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const scale = height / Math.max(size.y, 0.001);
    const mixer = skinned && animations.length ? new THREE.AnimationMixer(object) : null;
    const actions: Record<string, THREE.AnimationAction> = {};
    if (mixer) for (const clip of animations) { const a = mixer.clipAction(pinRootMotion(clip)); a.timeScale = 0; a.play(); a.weight = 0; actions[clip.name] = a; }
    return { object, scale, material, skins, mixer, actions, offset: new THREE.Vector3(-centre.x * scale, feetY - box.min.y * scale, -centre.z * scale) };
  }, [scene, animations, height, feetY, tint, color, trim, bodyType, look, cloth, pose]);
  const armorKey = piecesKey(gear, classId);
  useEffect(() => {
    // an authored (untinted) body already wears its armor in its textures; procedural plates would float over it
    const pieces = tint ? equippedPieces(gear, classId) : [];
    if (!pieces.length) return;
    built.object.updateMatrixWorld(true);
    const accent = ELEMENT_GLOW[gear?.inventory.find((g) => g.id === gear.equippedGear.chest)?.element ?? "ARC"] ?? "#6fe7ff";
    return attachArmor(built.object, pieces, height, built.scale, { armor: color ?? "#9aa3ad", trim: "#3b4048", accent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, armorKey, color, height, tint]);
  const heldGroups = useRef<Partial<Record<WeaponId, THREE.Group>>>({});
  useEffect(() => {
    if (!held) return;
    built.object.updateMatrixWorld(true);
    const w = attachWeapons(built.object, height, built.scale);
    heldGroups.current = w.groups;
    return () => { heldGroups.current = {}; w.dispose(); };
  }, [built, held, height]);
  useEffect(() => () => { built.material?.dispose(); built.skins.forEach((t) => { t.map.dispose(); t.emissiveMap.dispose(); }); built.mixer?.stopAllAction(); }, [built]);

  const rig = useRef<THREE.Group>(null);
  const body = useRef({ crouch: 0, prone: 0, lean: 0 });
  useFrame(({ clock }, dt) => {
    if (held) { const w = held.current.weapon; for (const id of WEAPON_ORDER) { const g = heldGroups.current[id]; if (g) g.visible = id === w; } }
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
export function OperatorModel({ classId, height, feetY, fallback, color, trim, pose = "showcase", motion, bodyType, look, cloth, gear, held }: {
  /** weapon in hand (starter procedural props); omit for no weapon */
  held?: HeldWeapon | undefined;
  /** equipped inventory: each worn armor slot attaches its own pieces to the rig */
  gear?: WornGear | undefined;
  trim?: string | undefined; look?: ArmorLook | undefined; cloth?: string | undefined; bodyType?: BodyType | undefined; classId: ClassId; height: number; feetY: number; fallback: ReactNode; color?: string | undefined; pose?: "showcase" | "locomotion"; motion?: ModelMotion | undefined;
}) {
  const entry = OPERATOR_MODELS[classId];
  // a static mesh would just slide across the ground, so the world only uses rigged models
  if (!entry || (pose === "locomotion" && !entry.rigged)) return <>{fallback}</>;
  return <Quiet fallback={fallback}><Suspense fallback={fallback}><Model url={entry.url} tint={entry.tint} height={height} feetY={feetY} color={color} trim={trim} pose={pose} motion={motion} bodyType={bodyType} look={look} cloth={cloth} gear={gear} classId={classId} held={held} /></Suspense></Quiet>;
}
