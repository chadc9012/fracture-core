/** Expedition-camp kit for the cold regions (FrostspireDressing camps, ice fields): a canvas ridge tent, a ribbed
 * equipment case, a runner sled with lashed cargo and a terminated ice/quartz crystal. Pure three.js geometry, built
 * once and instanced; each keeps the unit footprint of the primitive it replaced so placement code is unchanged. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const clean = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k); return n; };
const h1 = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** A-frame ridge tent, unit size centred like ConeGeometry(1, 1): ridge along Z (|z| ≤ 0.5), eaves at |x| = 0.9,
 * canvas sagging between the end poles, closed ends, a ridge pole and a little skirt flare at the ground. */
export function ridgeTent(): THREE.BufferGeometry {
  const U = 10, V = 5, pos: number[] = [];
  const pt = (side: number, u: number, v: number): [number, number, number] => {
    const sag = 0.07 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1));
    const flare = v > 0.85 ? (v - 0.85) * 0.5 : 0;
    return [side * (0.9 * v - sag + flare), 0.5 - v - (v === 0 ? 0.02 * Math.sin(Math.PI * u) : 0), -0.5 + u];
  };
  for (const side of [-1, 1]) for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
    const a = pt(side, i / U, j / V), b = pt(side, (i + 1) / U, j / V), c = pt(side, (i + 1) / U, (j + 1) / V), d = pt(side, i / U, (j + 1) / V);
    if (side > 0) pos.push(...a, ...d, ...c, ...a, ...c, ...b); else pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const panels = new THREE.BufferGeometry(); panels.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); panels.computeVertexNormals();
  const end = (z: number) => { const s = new THREE.Shape(); s.moveTo(-0.9, -0.5); s.lineTo(0, 0.5); s.lineTo(0.9, -0.5); s.lineTo(0.22, -0.5); s.lineTo(0.05, -0.05); s.lineTo(-0.05, -0.05); s.lineTo(-0.22, -0.5); s.closePath(); const g = new THREE.ShapeGeometry(s); if (z < 0) g.rotateY(Math.PI); return g.translate(0, 0, z); };
  const pole = new THREE.CylinderGeometry(0.018, 0.018, 1.12, 5).rotateX(Math.PI / 2).translate(0, 0.51, 0);
  const uprights = [-0.52, 0.52].map((z) => new THREE.CylinderGeometry(0.016, 0.016, 1.08, 5).translate(0, 0.0, z));
  return mergeGeometries([clean(panels), clean(end(0.5)), clean(end(-0.5)), clean(pole), ...uprights.map(clean)])!;
}

/** ribbed equipment case, unit cube centred like BoxGeometry(1,1,1): chamfered shell, two raised bands, corner caps
 * and a lid seam */
export function equipmentCase(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(0.94, 0.94, 0.94)];
  for (const y of [-0.28, 0.24]) parts.push(new THREE.BoxGeometry(1, 0.07, 1).translate(0, y, 0));
  parts.push(new THREE.BoxGeometry(0.97, 0.03, 0.97).translate(0, 0.36, 0)); // lid seam lip
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) parts.push(new THREE.BoxGeometry(0.14, 0.14, 0.14).translate(x * 0.44, y * 0.44, z * 0.44));
  for (const z of [-1, 1]) parts.push(new THREE.BoxGeometry(0.3, 0.06, 0.05).translate(0, 0.05, z * 0.5)); // handles
  return mergeGeometries(parts.map(clean))!;
}

/** cargo sled in metres, base on y = 0, 2.4 m long along Z: two runners with upswept bows, a slatted deck on
 * stanchions and a lashed tarp bundle */
export function cargoSled(seed = 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-0.38, 0.38]) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0.03, -1.15), new THREE.Vector3(x, 0.02, 0.6), new THREE.Vector3(x, 0.1, 1.05), new THREE.Vector3(x, 0.38, 1.25)]);
    parts.push(new THREE.TubeGeometry(c, 16, 0.035, 5, false));
    for (const z of [-0.9, -0.3, 0.3, 0.85]) parts.push(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 5).translate(x, 0.13, z));
  }
  for (let i = 0; i < 9; i++) parts.push(new THREE.BoxGeometry(0.9, 0.03, 0.18).translate(0, 0.24, -1 + i * 0.23));
  parts.push(new THREE.BoxGeometry(0.06, 0.06, 2.1).translate(-0.45, 0.28, -0.05), new THREE.BoxGeometry(0.06, 0.06, 2.1).translate(0.45, 0.28, -0.05));
  // tarp bundle: a softened, slumped box
  const tarp = new THREE.BoxGeometry(0.78, 0.42, 1.3, 4, 3, 6).toNonIndexed(), p = tarp.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 - 0.18 * (y + 0.21) / 0.42 - 0.05 * h1(Math.round(x * 9) + Math.round(z * 9) * 31 + seed); p.setXYZ(i, x * k, y + 0.02 * Math.sin(z * 9 + seed), z * (1 - 0.06 * Math.abs(y) / 0.21)); }
  tarp.computeVertexNormals(); parts.push(tarp.translate(0, 0.47, -0.25));
  for (const z of [-0.65, -0.25, 0.15]) parts.push(new THREE.BoxGeometry(0.82, 0.44, 0.03).translate(0, 0.47, z)); // straps
  return mergeGeometries(parts.map(clean))!;
}

/** a terminated six-sided crystal, unit height centred on y = 0 (like CylinderGeometry(r, r, 1)): an irregular prism
 * with a faceted point; flat-shade it. */
export function crystalShard(seed = 1): THREE.BufferGeometry {
  const pts: number[] = [], ring = (y: number, r: number, k: number) => Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2 + 0.2 * (h1(seed * 7 + i) - 0.5); const rr = r * (0.82 + 0.36 * h1(seed * 13 + i + k * 6)); return [Math.cos(a) * rr, y, Math.sin(a) * rr] as const; });
  const b = ring(-0.5, 0.62, 0), m = ring(0.22, 0.6, 1), tip = [0.06 * (h1(seed) - 0.5), 0.5, 0.06 * (h1(seed + 1) - 0.5)] as const;
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    pts.push(...b[i]!, ...m[i]!, ...m[j]!, ...b[i]!, ...m[j]!, ...b[j]!); // side
    pts.push(...m[i]!, ...tip, ...m[j]!); // termination facet
    pts.push(0, -0.5, 0, ...b[i]!, ...b[j]!); // base
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); g.computeVertexNormals();
  return g;
}
