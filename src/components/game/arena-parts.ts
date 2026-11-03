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


/** a concrete jersey barrier in unit size (1 wide on x, 1 tall, 1 long on z), base at y = 0: the sloped safety-shape profile with a
 * flat top, extruded along z, and a groove where two sections would meet */
export function jerseyBarrier(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  // half-profile widths at heights (fractions of the unit): wide foot, a steep lower slope, a near-vertical upper face, flat top
  s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0.5, 0.08); s.lineTo(0.34, 0.26); s.lineTo(0.16, 1); s.lineTo(-0.16, 1); s.lineTo(-0.34, 0.26); s.lineTo(-0.5, 0.08); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }).translate(0, 0, -0.5);
  return g;
}

/** a cargo container in unit size (1 on x, 1 tall, 1 on z), base at y = 0: a box with corrugated ribs on its sides, a top rail,
 * corner castings and the door frame and lock bars on both ends. Scale it to its real size (a 20 ft box is 2.4 x 2.6 x 6). */
export function shippingContainer(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(0.96, 0.94, 0.98).translate(0, 0.49, 0)];
  // ribs along both long (z) sides and across both ends
  for (let i = 0; i < 16; i++) { const z = -0.46 + (i / 15) * 0.92; for (const x of [-0.49, 0.49]) parts.push(new THREE.BoxGeometry(0.02, 0.86, 0.025).translate(x, 0.49, z)); }
  for (let i = 0; i < 7; i++) { const x = -0.4 + (i / 6) * 0.8; parts.push(new THREE.BoxGeometry(0.03, 0.86, 0.02).translate(x, 0.49, -0.5)); }
  // the frame: top and bottom rails, corner posts with castings
  for (const y of [0.03, 0.96]) for (const x of [-0.49, 0.49]) parts.push(new THREE.BoxGeometry(0.04, 0.06, 1).translate(x, y, 0));
  for (const x of [-0.49, 0.49]) for (const z of [-0.49, 0.49]) { parts.push(new THREE.BoxGeometry(0.05, 1, 0.05).translate(x, 0.5, z)); for (const y of [0.03, 0.97]) parts.push(new THREE.BoxGeometry(0.07, 0.07, 0.07).translate(x, y, z)); }
  // the door end (+z): two doors, four vertical lock bars with handles
  parts.push(new THREE.BoxGeometry(0.94, 0.9, 0.015).translate(0, 0.49, 0.495));
  for (const x of [-0.33, -0.12, 0.12, 0.33]) { parts.push(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6).translate(x, 0.49, 0.51)); parts.push(new THREE.BoxGeometry(0.06, 0.02, 0.03).translate(x + 0.03, 0.45, 0.515)); }
  return mergeGeometries(parts.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k); return n; }))!;
}

/** yellow-and-black hazard stripes (diagonal), tiling along u */
export function hazardTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 128; c.height = 32;
  const x = c.getContext("2d")!;
  x.fillStyle = "#151515"; x.fillRect(0, 0, 128, 32);
  x.fillStyle = "#f2c230";
  for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 16, 32); x.lineTo(i * 16 + 8, 32); x.lineTo(i * 16 + 40, 0); x.lineTo(i * 16 + 32, 0); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** a flat strip `w` wide from (ax, az) to (bx, bz) at height y, with u running in metres / `tile` (for hazard stripes on a floor) */
export function floorStrip(ax: number, az: number, bx: number, bz: number, w: number, y: number, tile = 1.6): THREE.BufferGeometry {
  const len = Math.hypot(bx - ax, bz - az), g = new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2);
  const uv = g.attributes["uv"] as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (len / tile));
  return g.rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, y, (az + bz) / 2);
}
