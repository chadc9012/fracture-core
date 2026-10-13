import * as THREE from "three";
import { BOOTS, type BootId } from "@/game/skate-boots";
import { skateDesign } from "@/game/skate-visuals";
import type { ClassId } from "@/game/loadout";
import { SURFACES } from "@/game/visual-standard";

/** Build in model-up coordinates, then preserve that frame when parenting to foot bones. */
export function attachSkates(object: THREE.Object3D, id: BootId, cls: ClassId, scale: number) {
  if (id === "none") return () => {};
  const d = skateDesign(id, cls), color = BOOTS[id].color;
  const body = new THREE.MeshStandardMaterial({ color, ...SURFACES.paintedArmor });
  const metal = new THREE.MeshStandardMaterial({ color: "#647380", ...SURFACES.bareMetal });
  const glow = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.4 });
  const groups: THREE.Group[] = [], geometries: THREE.BufferGeometry[] = [];
  object.updateWorldMatrix(true, true);
  for (const side of ["Left", "Right"]) {
    const bone = object.getObjectByName(`mixamorig:${side}Foot`) ?? object.getObjectByName(`mixamorig${side}Foot`);
    if (!bone) continue;
    const foot = new THREE.Vector3(); bone.getWorldPosition(foot); object.worldToLocal(foot);
    const g = new THREE.Group(); g.name = `skates:${id}:${side}`;
    // Preserve model-up axes, rather than assuming all foot bones use the same roll.
    g.position.copy(foot); g.scale.setScalar(1 / Math.max(scale, 1e-6));
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, pos: [number, number, number], rot?: [number, number, number]) => { geometries.push(geometry); const m = new THREE.Mesh(geometry, material); m.position.set(...pos); if (rot) m.rotation.set(...rot); g.add(m); };
    mesh(new THREE.BoxGeometry(d.width, 0.04, d.length), body, [0, -0.07, 0.06]);
    mesh(new THREE.BoxGeometry(d.width * 0.8, 0.065, 0.045), metal, [0, -0.015, -0.045]);
    mesh(new THREE.BoxGeometry(d.width + 0.012, 0.012, d.length * 0.7), glow, [0, -0.065, 0.075]);
    if (d.wheelRadius) for (const z of [-0.02, 0.12]) mesh(new THREE.CylinderGeometry(d.wheelRadius, d.wheelRadius, d.width + 0.022, 16), metal, [0, -0.1, z], [0, 0, Math.PI / 2]);
    if (d.rail) mesh(new THREE.BoxGeometry(d.width + 0.045, 0.016, 0.24), metal, [0, -0.14, 0.065]);
    if (d.wings) for (const sign of [-1, 1]) mesh(new THREE.BoxGeometry(0.06, 0.02, 0.16), glow, [sign * (d.width / 2 + 0.02), -0.05, 0.04], [0, sign * 0.35, sign * 0.2]);
    if (d.turbines) for (const sign of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 16), metal, [sign * (d.width / 2 + 0.025), 0, -0.035], [Math.PI / 2, 0, 0]);
      mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 16), glow, [sign * (d.width / 2 + 0.025), 0, -0.1]);
    }
    object.add(g); object.updateWorldMatrix(true, true); bone.attach(g); groups.push(g);
  }
  return () => { groups.forEach((g) => g.removeFromParent()); geometries.forEach((g) => g.dispose()); body.dispose(); metal.dispose(); glow.dispose(); };
}