/** Geometry shared by the Killbox arena views (KillboxArena.tsx, DataFieldsArena.tsx). */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** building wall faces with UVs in facade tiles (16 bays of 1.6 m by 16 floors of 3.6 m, facade-windows.ts) */
export function towerShell(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const face = (w: number, cx: number, cz: number, yaw: number) => {
    const g = new THREE.PlaneGeometry(w, y1 - y0);
    const uv = g.attributes["uv"] as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 25.6), uv.getY(i) * ((y1 - y0) / 57.6) + y0 / 57.6);
    return g.rotateY(yaw).translate(cx, (y0 + y1) / 2, cz);
  };
  parts.push(face(x1 - x0, (x0 + x1) / 2, z1, 0), face(x1 - x0, (x0 + x1) / 2, z0, Math.PI), face(z1 - z0, x1, (z0 + z1) / 2, Math.PI / 2), face(z1 - z0, x0, (z0 + z1) / 2, -Math.PI / 2));
  return mergeGeometries(parts)!;
}

/** a box between two corners (world), with UVs (BoxGeometry) */
export const slab = (x: number, y: number, z: number, w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

