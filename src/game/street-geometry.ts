/** Street furniture shapes that read as real hardware instead of boxes: a tapered lamp pole with a curved arm and a
 * cobra-head luminaire, a pressed W-beam guard-rail profile, and a C-channel rail post. Pure three.js geometry, built
 * once and instanced (RoadDressing.tsx, Nexus streets). All face local +Z (the arm leans over the road along +Z). */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const clean = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k); return n; };

/** pole + base plinth + curved outreach arm, height `h`, arm reach `reach` (no luminaire: that is lit separately) */
export function lampPole(h = 8, reach = 2.2): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.CylinderGeometry(0.085, 0.15, h - 0.6, 10).translate(0, (h - 0.6) / 2 + 0.3, 0));
  parts.push(new THREE.CylinderGeometry(0.24, 0.28, 0.3, 8).translate(0, 0.15, 0)); // base plinth
  parts.push(new THREE.CylinderGeometry(0.16, 0.2, 0.18, 10).translate(0, 0.62, 0)); // access-door collar
  const arm = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, h - 0.9, 0), new THREE.Vector3(0, h + 0.15, 0.25), new THREE.Vector3(0, h - 0.05, reach));
  parts.push(new THREE.TubeGeometry(arm, 14, 0.055, 6, false));
  return mergeGeometries(parts.map(clean))!;
}

/** cobra-head luminaire at the end of `lampPole`'s arm: a flattened teardrop shell */
export function lampHead(h = 8, reach = 2.2): THREE.BufferGeometry {
  const prof = [[0, 0], [0.14, 0.02], [0.2, 0.08], [0.18, 0.2], [0.12, 0.44], [0.06, 0.62], [0, 0.66]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof, 12);
  g.rotateX(Math.PI / 2); // length along +Z
  g.scale(1.25, 0.55, 1);
  g.translate(0, h - 0.1, reach - 0.05);
  return clean(g);
}

/** the lit lens under the cobra head */
export function lampLens(h = 8, reach = 2.2): THREE.BufferGeometry {
  return new THREE.CircleGeometry(0.16, 12).rotateX(Math.PI / 2).scale(1.3, 1, 1.6).translate(0, h - 0.17, reach + 0.25);
}

/** pressed-steel W-beam, 1 m long along Z (stretch by sz), centred 0.62 m up, the channel facing +X (the road) */
export function wBeam(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const pts: [number, number][] = [[0, -0.16], [0.05, -0.1], [0.02, 0], [0.05, 0.1], [0, 0.16], [-0.012, 0.16], [0.036, 0.1], [0.008, 0], [0.036, -0.1], [-0.012, -0.16]];
  s.moveTo(pts[0]![0], pts[0]![1]); for (const [x, y] of pts.slice(1)) s.lineTo(x, y); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0.62, -0.5);
  return clean(g);
}

/** C-channel steel post with a spacer block, 0.85 m */
export function railPost(): THREE.BufferGeometry {
  const parts = [
    new THREE.BoxGeometry(0.1, 0.85, 0.012).translate(-0.08, 0.42, 0.045),
    new THREE.BoxGeometry(0.1, 0.85, 0.012).translate(-0.08, 0.42, -0.045),
    new THREE.BoxGeometry(0.012, 0.85, 0.1).translate(-0.125, 0.42, 0),
    new THREE.BoxGeometry(0.07, 0.3, 0.07).translate(-0.04, 0.62, 0), // spacer block
  ];
  return mergeGeometries(parts.map(clean))!;
}

/** flexible delineator post: rounded, slightly tapered */
export function delineator(): THREE.BufferGeometry {
  return clean(new THREE.CylinderGeometry(0.05, 0.065, 1.1, 8).translate(0, 0.55, 0));
}

/* ---------------- rooftop plant (Nexus roofs) ---------------- */

/** water tank, unit like CylinderGeometry(1, 1, 1) centred: timber-hooped drum on a short leg frame, conical lid */
export function waterTank(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.92, 0.95, 0.72, 16).translate(0, 0.04, 0), new THREE.ConeGeometry(1.0, 0.2, 16).translate(0, 0.5, 0)];
  for (const y of [-0.2, 0.05, 0.3]) parts.push(new THREE.TorusGeometry(0.94, 0.018, 4, 24).rotateX(Math.PI / 2).translate(0, y, 0));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; parts.push(new THREE.BoxGeometry(0.08, 0.22, 0.08).translate(Math.cos(a) * 0.7, -0.4, Math.sin(a) * 0.7)); }
  parts.push(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6).translate(0.95, -0.2, 0)); // outlet pipe
  return mergeGeometries(parts.map(clean))!;
}

/** packaged HVAC unit, unit like BoxGeometry(1,1,1) centred: cabinet with louvred sides, two fan shrouds on top */
export function hvacUnit(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(1, 0.86, 1).translate(0, -0.07, 0)];
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) parts.push(new THREE.BoxGeometry(0.02, 0.06, 0.9).translate(s * 0.51, -0.4 + i * 0.12, 0));
  for (const z of [-0.24, 0.24]) { parts.push(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 14, 1, true).translate(0, 0.42, z)); parts.push(new THREE.CylinderGeometry(0.19, 0.19, 0.01, 14).translate(0, 0.4, z)); }
  return mergeGeometries(parts.map(clean))!;
}

/** lattice antenna mast in metres, base at y = 0, `h` tall: three tapered legs, cross bracing every 1.5 m, a dish */
export function antennaMast(h = 12): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const r0 = 0.45, r1 = 0.08, leg = (i: number, y: number) => { const a = (i / 3) * Math.PI * 2, r = r0 + (r1 - r0) * (y / h); return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); };
  const strut = (a: THREE.Vector3, b: THREE.Vector3, rad: number) => { const d = b.clone().sub(a), g = new THREE.CylinderGeometry(rad, rad, d.length(), 4); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())); return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); };
  for (let i = 0; i < 3; i++) parts.push(strut(leg(i, 0), leg(i, h), 0.035));
  for (let y = 0; y < h - 1; y += 1.5) for (let i = 0; i < 3; i++) { parts.push(strut(leg(i, y), leg((i + 1) % 3, y + 1.5), 0.015)); parts.push(strut(leg(i, y + 1.5), leg((i + 1) % 3, y + 1.5), 0.015)); }
  parts.push(new THREE.CylinderGeometry(0.02, 0.03, 2, 5).translate(0, h + 1, 0));
  parts.push(new THREE.SphereGeometry(0.45, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3).rotateX(Math.PI / 2).translate(0, h * 0.7, 0.3));
  return mergeGeometries(parts.map(clean))!;
}
