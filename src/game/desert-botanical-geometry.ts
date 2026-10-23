import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Detailed, reusable cactus silhouette. Geometry is shared across all instances. */
export function createSaguaroGeometry(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  const stem = (radiusTop: number, radiusBottom: number, length: number, x: number, y: number, z: number, rz = 0) => {
    const g = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 12, 6);
    g.translate(0, length / 2, 0);
    g.rotateZ(rz);
    g.translate(x, y, z);
    pieces.push(g);
  };
  stem(0.39, 0.51, 4.8, 0, 0, 0);
  // Curved arms, made from several tapered segments; asymmetry avoids the toy pitchfork silhouette.
  stem(0.22, 0.30, 1.15, 0.28, 2.15, 0, -1.0);
  stem(0.19, 0.23, 1.45, 1.03, 2.65, 0, -0.08);
  stem(0.17, 0.24, 0.95, -0.30, 1.45, 0, 1.06);
  stem(0.14, 0.18, 1.1, -0.96, 1.88, 0, 0.12);
  const cap = (x: number, y: number, z: number, r: number) => {
    const g = new THREE.SphereGeometry(r, 12, 8);
    g.scale(1, 1.2, 1); g.translate(x, y, z); pieces.push(g);
  };
  cap(0, 4.78, 0, 0.39);
  cap(1.14, 4.05, 0, 0.2);
  cap(-1.02, 2.96, 0, 0.16);
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((p) => p.dispose());
  if (!merged) throw new Error("Could not create cactus geometry");
  merged.computeVertexNormals();
  return merged;
}

/** Multi-stem desert scrub rather than single green cones. */
export function createDesertScrubGeometry(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const length = 0.55 + (i % 3) * 0.18;
    const g = new THREE.ConeGeometry(0.065, length, 4, 2);
    g.translate(0, length / 2, 0);
    g.rotateZ(0.3 + (i % 3) * 0.18);
    g.rotateY(a);
    pieces.push(g);
  }
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((p) => p.dispose());
  if (!merged) throw new Error("Could not create desert scrub geometry");
  merged.computeVertexNormals();
  return merged;
}
