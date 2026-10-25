import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { HandlingClass } from "@/game/weapon-handling";

/** held-weapon models by handling class: the first-person GLBs (ViewWeapon.tsx), one load each, shared by every operator and
 * enemy that carries one. Node contract: <Prefix>Body / Blade / Mag / Action / Bolt / Accent. */
export const HELD_MODEL: Record<HandlingClass, { url: string; prefix: string }> = {
  rifle: { url: "/models/weapons/rifle.glb", prefix: "Rifle" }, pistol: { url: "/models/weapons/pistol.glb", prefix: "Pistol" },
  shotgun: { url: "/models/weapons/shotgun.glb", prefix: "Shotgun" }, heavy: { url: "/models/weapons/heavy.glb", prefix: "Heavy" },
  launcher: { url: "/models/weapons/launcher.glb", prefix: "Launcher" }, sword: { url: "/models/weapons/sword.glb", prefix: "Sword" },
};
const heldCache = new Map<string, Promise<THREE.Object3D | null>>();
export function heldModel(url: string): Promise<THREE.Object3D | null> {
  let p = heldCache.get(url);
  if (!p) { p = new GLTFLoader().loadAsync(url).then((g) => g.scene).catch(() => null); heldCache.set(url, p); }
  return p;
}

/** a fresh copy of a held weapon, turned so the barrel points along +Z (the viewmodels point it along -Z); the accent parts
 * take `accent` when given. Resolves null if the file is unreachable. */
export async function heldWeaponCopy(cls: HandlingClass, accent?: THREE.Material): Promise<THREE.Group | null> {
  const spec = HELD_MODEL[cls];
  const scene = await heldModel(spec.url);
  if (!scene) return null;
  const model = new THREE.Group(); model.rotation.y = Math.PI;
  for (const part of ["Body", "Blade", "Mag", "Action", "Bolt", "Accent"]) {
    const node = scene.getObjectByName(spec.prefix + part); if (!node) continue;
    const c = node.clone(true);
    c.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = false; if (accent && (m.material as THREE.Material).name === `${spec.prefix}Accent`) m.material = accent; });
    model.add(c);
  }
  if (!model.children.length) return null;
  const out = new THREE.Group(); out.add(model);
  return out;
}
