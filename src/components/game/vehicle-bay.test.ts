import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { bayFrom } from "./VehicleDamageFx";

describe("vehicle damage placement", () => {
  test("without bounds it uses the typical car numbers", () => {
    expect(bayFrom(null)).toEqual({ x: 0, y: 1.55, z: 1.9, side: 1.45, scale: 1 });
  });
  test("a scaled-up body puts the engine bay on its own hood, above the body's middle and near the nose", () => {
    // a jeep-sized body: 3.3 m wide, 3.6 m tall, 7 m long, front at +z
    const b = new THREE.Box3(new THREE.Vector3(-1.65, 0, -3.5), new THREE.Vector3(1.65, 3.6, 3.5));
    const bay = bayFrom(b);
    expect(bay.y).toBeGreaterThan(1.8);
    expect(bay.y).toBeLessThan(3.6);
    expect(bay.z).toBeGreaterThan(2);
    expect(bay.z).toBeLessThan(3.5);
    expect(bay.side).toBeCloseTo(1.65);
    expect(bay.scale).toBeGreaterThan(1);
  });
});
