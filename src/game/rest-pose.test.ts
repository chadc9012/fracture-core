// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { ARM_RELAX, armBones, relaxArm } from "./rest-pose";

/** root → spine (with an awkward rest rotation, like a Meshy rig) → upper arm → forearm held out in an A-pose */
function rig(side: 1 | -1, spinTwist = 0.9) {
  const root = new THREE.Group(), spine = new THREE.Bone(), arm = new THREE.Bone(), fore = new THREE.Bone();
  spine.name = "mixamorig:Spine2"; arm.name = `mixamorig:${side > 0 ? "Left" : "Right"}Arm`; fore.name = `mixamorig:${side > 0 ? "Left" : "Right"}ForeArm`;
  root.add(spine); spine.position.set(0, 1.4, 0); spine.quaternion.setFromEuler(new THREE.Euler(0.3, spinTwist, -0.4));
  spine.add(arm);
  // place the arm and elbow at known world points by inverting the spine's rotation
  const inv = spine.quaternion.clone().invert();
  arm.position.copy(new THREE.Vector3(0.2 * side, 0.1, 0).applyQuaternion(inv));
  arm.add(fore);
  fore.position.copy(new THREE.Vector3(0.21 * side, -0.21, 0).applyQuaternion(inv)); // 45° out and down
  root.updateWorldMatrix(true, true);
  return { root, arm, fore };
}
const dirOf = (a: THREE.Object3D, b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3())).normalize();

describe("relaxed rest pose", () => {
  test("an A-pose arm swings down toward the body, on either side, whatever the parent's rest rotation", () => {
    for (const side of [1, -1] as const) for (const twist of [0, 0.9, -2.1]) {
      const { root, arm, fore } = rig(side, twist);
      const before = dirOf(arm, fore);
      relaxArm(arm, fore, root, ARM_RELAX);
      const after = dirOf(arm, fore);
      expect(after.y).toBeLessThan(before.y - 0.15); // hangs lower
      expect(Math.sign(after.x)).toBe(side); // still on its own side (slight splay)
      expect(Math.abs(after.x)).toBeLessThan(Math.abs(before.x));
      expect(Math.abs(after.z)).toBeLessThan(0.05); // no twist forward or back
    }
  });
  test("works when the whole model is turned", () => {
    const { root, arm, fore } = rig(1);
    root.rotation.y = Math.PI / 2; root.updateWorldMatrix(true, true);
    relaxArm(arm, fore, root, 1);
    const after = dirOf(arm, fore);
    expect(after.y).toBeLessThan(-0.95);
  });
  test("zero amount leaves the bone alone, and the Mixamo arm bones are found", () => {
    const { root, arm, fore } = rig(1);
    const q = arm.quaternion.clone();
    expect(relaxArm(arm, fore, root, 0)).toBe(0);
    expect(arm.quaternion.equals(q)).toBe(true);
    expect(armBones(root).length).toBe(1);
  });
});
