/** Relaxed standing pose for operator bodies that ship without an idle clip (the Meshy rookie bodies: walk/run only).
 * Holding the walk clip still leaves the arms out in the A-pose the model was rigged in, which reads stiff on the hero
 * select and when standing in the world. This rotates each upper arm in world space so it hangs closer to the body,
 * which works on any rig whatever its bones' rest orientations (grafting clips by bone name did not: AGENTS.md).
 *
 * Pure apart from mutating the bones it is given; OperatorModel.tsx applies it after the mixer each frame. */
import * as THREE from "three";

/** how far the arm swings toward hanging straight down (0 = untouched, 1 = straight down) */
export const ARM_RELAX = 0.72;
/** the hanging direction keeps a slight outward splay so the hands clear the hips (radians from vertical) */
export const ARM_SPLAY = 0.16;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _dir = new THREE.Vector3(), _goal = new THREE.Vector3();
const _q = new THREE.Quaternion(), _world = new THREE.Quaternion(), _parent = new THREE.Quaternion(), _full = new THREE.Quaternion();

/** the world-space direction an arm should hang in: straight down, tipped outward on the arm's own side */
export function hangDirection(side: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(Math.sign(side) * Math.sin(ARM_SPLAY), -Math.cos(ARM_SPLAY), 0).normalize();
}

/** Swings `arm` (an upper-arm bone) so the arm→`elbow` direction moves `amount` of the way toward hanging, in world space.
 * `side` is the elbow's x offset from the body centre in the root's frame (sign picks the splay). Returns the angle moved. */
export function relaxArm(arm: THREE.Object3D, elbow: THREE.Object3D, root: THREE.Object3D, amount: number): number {
  if (amount <= 0 || !arm.parent) return 0;
  root.updateWorldMatrix(true, true);
  arm.getWorldPosition(_a); elbow.getWorldPosition(_b);
  _dir.subVectors(_b, _a);
  if (_dir.lengthSq() < 1e-10) return 0;
  _dir.normalize();
  // the hang direction lives in the root's frame (the model may be turned), then goes to world space
  const local = root.worldToLocal(_b.clone()).x - root.worldToLocal(_a.clone()).x;
  root.getWorldQuaternion(_world);
  hangDirection(local || 1, _goal).applyQuaternion(_world);
  _full.setFromUnitVectors(_dir, _goal);
  _q.identity().slerp(_full, Math.min(1, amount));
  // world rotation → bone-local: local' = parentWorld⁻¹ · q · boneWorld
  arm.getWorldQuaternion(_world);
  arm.parent.getWorldQuaternion(_parent);
  arm.quaternion.copy(_parent.invert().multiply(_q).multiply(_world));
  arm.updateWorldMatrix(false, true);
  return 2 * Math.acos(Math.min(1, Math.abs(_q.w)));
}

/** the bone names a Mixamo rig uses for the upper arm and elbow, with and without the colon */
export function armBones(object: THREE.Object3D): { arm: THREE.Object3D; elbow: THREE.Object3D }[] {
  const find = (n: string) => object.getObjectByName(`mixamorig:${n}`) ?? object.getObjectByName(`mixamorig${n}`);
  const out: { arm: THREE.Object3D; elbow: THREE.Object3D }[] = [];
  for (const side of ["Left", "Right"]) {
    const arm = find(`${side}Arm`), elbow = find(`${side}ForeArm`);
    if (arm && elbow) out.push({ arm, elbow });
  }
  return out;
}
