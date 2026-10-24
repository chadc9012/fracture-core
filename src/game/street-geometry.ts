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
