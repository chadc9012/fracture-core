import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { localBounds } from "./vehicle-bounds";

/** a car-ish root: a 2 x 1 x 4 box whose centre is 0.5 up, inside wrapper groups like the real scene (lift, scale, yaw, world position) */
function rig(world: [number, number, number], yaw: number, scale: number, lift: number) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshBasicMaterial()); body.position.set(0, 0.5, 0); root.add(body);
  const wrapper = new THREE.Group(); wrapper.scale.setScalar(scale); wrapper.position.y = lift; wrapper.add(root);
  const vehicle = new THREE.Group(); vehicle.position.set(...world); vehicle.rotation.y = yaw; vehicle.add(wrapper);
  return { root, vehicle };
}
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 4));

describe("localBounds", () => {
  test("is the root's own box wherever the vehicle is parked", () => {
    for (const w of [[0, 0, 0], [-300, 19.7, 186], [5000, -40, -2500]] as const) {
      const { root } = rig([...w], 0, 1, 0);
      const b = localBounds(root);
      close(b.min.toArray(), [-1, 0, -2]); close(b.max.toArray(), [1, 1, 2]);
    }
  });
  test("is not enlarged by the vehicle's heading", () => {
    const { root } = rig([-300, 20, 186], 0.8, 1, 0);
    const b = localBounds(root); close(b.min.toArray(), [-1, 0, -2]); close(b.max.toArray(), [1, 1, 2]);
  });
  test("scale and lift apply once the caller maps it into the vehicle frame (as AuthoredVehicle does)", () => {
    const { root } = rig([-300, 20, 186], 1.2, 1.5, -1.9);
    const b = localBounds(root);
    const inVehicle = new THREE.Box3(b.min.clone().multiplyScalar(1.5).add(new THREE.Vector3(0, -1.9, 0)), b.max.clone().multiplyScalar(1.5).add(new THREE.Vector3(0, -1.9, 0)));
    close(inVehicle.min.toArray(), [-1.5, -1.9, -3]); close(inVehicle.max.toArray(), [1.5, -0.4, 3]);
  });
  test("the old world-space measurement was wrong for a parked car (the bug this replaces)", () => {
    const { root } = rig([-300, 19.7, 186], 0, 1, 0);
    root.updateWorldMatrix(true, true);
    expect(new THREE.Box3().setFromObject(root).min.x).toBeLessThan(-290);
    expect(localBounds(root).min.x).toBeCloseTo(-1, 4);
  });
  test("an empty root gives an empty box", () => { expect(localBounds(new THREE.Group()).isEmpty()).toBe(true); });
});
