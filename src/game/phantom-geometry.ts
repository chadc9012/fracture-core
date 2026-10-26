/** The Phantom Stealth Jet's exterior (the private hangar's model, PhantomHangar.tsx). Pure three.js geometry, metres, nose at
 * -z, y up, origin on the ground under the fuselage centre. Shapes are real aircraft construction, not boxes: a lathed fuselage
 * (ogive nose, parallel cabin section, tapered tail cone) flattened into a stealth section, bevelled extruded wings per planform
 * (swept / delta / split canard), a canted V-tail, aft-mounted lathed engine nacelles with pylons, a wraparound cockpit visor,
 * cabin windows, and gear with real tyres (organic-geometry tyre). Merged per material. */
import * as THREE from "three";
import { tyre } from "./organic-geometry";
import { lathe, merge, rbox, roundedRect } from "./cabin-geometry";
import type { PhantomWing } from "./phantom-jet";

export const PHANTOM_DIMS = { length: 40, radius: 3.05, squash: 0.82, clearance: 1.55 } as const;
const { length: L, radius: R, squash: SQ, clearance: GC } = PHANTOM_DIMS;
/** fuselage centre height */
export const FUSE_Y = GC + R * SQ;

/** fuselage radius at t (0 = nose tip, 1 = tail) */
export function fuselageRadius(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  if (k < 0.16) { const u = k / 0.16; return R * Math.pow(1 - (1 - u) * (1 - u), 0.62); }
  if (k < 0.68) return R;
  const u = (k - 0.68) / 0.32;
  return R * (1 - 0.82 * u * u * (3 - 2 * u)) ;
}
function fuselage(): THREE.BufferGeometry {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 64; i++) { const t = i / 64; pts.push([Math.max(0.001, fuselageRadius(t)), t * L]); }
  pts.push([0.001, L]);
  return lathe(pts, 48).rotateX(Math.PI / 2).scale(1, SQ, 1).translate(0, FUSE_Y, -L / 2);
}
/** a bevelled planform: points as (span outward, forward), extruded `thick`, lying flat; mirrored for both sides */
function planform(pts: readonly (readonly [number, number])[], thick: number, y: number, z: number): THREE.BufferGeometry {
  const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  const right = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.45, bevelSize: Math.min(0.14, thick * 0.6), bevelSegments: 3, curveSegments: 4 })
    .rotateX(-Math.PI / 2).translate(0, y - thick / 2, z);
  const left = right.clone().scale(-1, 1, 1);
  // scaling by -1 flips the winding: turn the triangles back so the left wing is lit from outside
  const idx = left.index;
  if (idx) for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); }
  else { const p = left.attributes["position"] as THREE.BufferAttribute; for (let i = 0; i < p.count; i += 3) { const ax = p.getX(i + 1), ay = p.getY(i + 1), az = p.getZ(i + 1); p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, ax, ay, az); } }
  left.computeVertexNormals();
  return merge([right, left]);
}
/** wing planforms (span outward from the fuselage side, forward toward the nose) */
const WING_PLAN: Record<PhantomWing, { main: [number, number][]; canard?: [number, number][]; tip: number }> = {
  swept: { main: [[1.8, 4.2], [10.6, -2.6], [10.9, -3.9], [10.2, -4.4], [1.8, -4.8]], tip: 10.6 },
  delta: { main: [[1.6, 8.5], [9.2, -5.2], [9.3, -6.3], [1.6, -7.2]], tip: 9.2 },
  split: { main: [[1.8, 2.8], [9.8, -3.4], [10.0, -4.5], [1.8, -5.4]], canard: [[1.4, 13.6], [5.2, 11.2], [5.3, 10.5], [1.4, 10.6]], tip: 9.8 },
};
/** a fin in the (aft, up) plane: root chord at the bottom, swept back to the tip */
function fin(root: number, tip: number, h: number, sweep: number, thick: number): THREE.BufferGeometry {
  const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(root, 0), new THREE.Vector2(sweep + tip, h), new THREE.Vector2(sweep, h)]);
  return new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.4, bevelSize: 0.08, bevelSegments: 3 }).translate(0, 0, -thick / 2).rotateY(-Math.PI / 2);
}
function nacelle(): { shell: THREE.BufferGeometry; intake: THREE.BufferGeometry; nozzle: THREE.BufferGeometry } {
  const len = 5.2, r = 0.82;
  const shell = lathe([[r * 0.86, 0], [r * 1.0, 0.25], [r, 1.6], [r * 0.95, len * 0.75], [r * 0.72, len]], 36).rotateX(Math.PI / 2);
  const intake = lathe([[r * 0.86, 0], [r * 0.8, 0.02], [r * 0.7, 0.3], [0.001, 0.36]], 36).rotateX(Math.PI / 2);
  const nozzle = lathe([[r * 0.72, 0], [r * 0.6, -0.05], [r * 0.45, -0.4], [0.001, -0.45]], 36).rotateX(Math.PI / 2).translate(0, 0, len);
  return { shell, intake, nozzle };
}

export type PhantomExteriorGeo = {
  paint: THREE.BufferGeometry; trim: THREE.BufferGeometry; glass: THREE.BufferGeometry; windows: THREE.BufferGeometry;
  metal: THREE.BufferGeometry; tyres: THREE.BufferGeometry; strip: THREE.BufferGeometry; exhaust: THREE.BufferGeometry;
  navLeft: THREE.Vector3; navRight: THREE.Vector3; tail: THREE.Vector3;
};
/** the whole aircraft for one wing style */
export function phantomExterior(wing: PhantomWing): PhantomExteriorGeo {
  const plan = WING_PLAN[wing];
  const wingY = FUSE_Y - R * SQ * 0.45;
  const paint: THREE.BufferGeometry[] = [fuselage(), planform(plan.main, 0.34, wingY, -1.0)];
  if (plan.canard) paint.push(planform(plan.canard, 0.18, FUSE_Y - R * SQ * 0.1, -1.0));
  // V-tail: two fins canted 32 degrees out from the top of the tail cone
  for (const s of [-1, 1]) paint.push(fin(6.2, 2.2, 5.4, 4.6, 0.28).rotateZ(-s * 0.56).translate(s * 0.5, FUSE_Y + R * SQ * 0.55, L / 2 - 9.4));
  // aft engines on pylons, high on the rear fuselage
  const n = nacelle(), metal: THREE.BufferGeometry[] = [], exhaust: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const at = new THREE.Vector3(s * (R * 0.95 + 0.95), FUSE_Y + R * SQ * 0.42, L * 0.14);
    paint.push(n.shell.clone().translate(at.x, at.y, at.z));
    paint.push(rbox(1.1, 0.32, 2.6, 0.12).translate(s * (R * 0.86 + 0.2), at.y - 0.1, at.z + 2.4));
    metal.push(n.intake.clone().translate(at.x, at.y, at.z));
    exhaust.push(n.nozzle.clone().translate(at.x, at.y, at.z));
  }
  // cockpit visor: a wraparound smoked canopy over the nose
  // (a slice of the nose's own lathe, 1.5% proud of the skin, over the upper front: phi = PI is the top after the lathe is laid along z)
  const visorPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) { const t = 0.075 + (i / 16) * 0.095; visorPts.push(new THREE.Vector2(fuselageRadius(t) * 1.015, t * L)); }
  const glass = new THREE.LatheGeometry(visorPts, 40, Math.PI - 1.05, 2.1).rotateX(Math.PI / 2).scale(1, SQ, 1).translate(0, FUSE_Y, -L / 2);
  // cabin windows along both sides
  const win: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) for (const s of [-1, 1]) {
    const z = -L / 2 + 10 + i * 1.55, x = s * (R + 0.006);
    win.push(new THREE.ShapeGeometry(roundedRect(0.34, 0.46, 0.15), 6).rotateY(s * Math.PI / 2).translate(x, FUSE_Y + 0.25, z));
  }
  // undercarriage: nose leg with two wheels, two main legs with two wheels each
  const tyres: THREE.BufferGeometry[] = [];
  const leg = (x: number, z: number, h: number) => metal.push(new THREE.CylinderGeometry(0.12, 0.14, h, 16).translate(x, h / 2 + 0.5, z), rbox(0.5, 0.18, 0.5, 0.06).translate(x, 0.62, z));
  const wheel = (x: number, z: number, k: number) => tyres.push(tyre().scale(k, k, k).rotateY(Math.PI / 2).translate(x, 0.63 * k, z));
  leg(0, -L / 2 + 7, GC + 0.4); wheel(-0.32, -L / 2 + 7, 0.8); wheel(0.32, -L / 2 + 7, 0.8);
  for (const s of [-1, 1]) { leg(s * 2.4, 1.2, GC + 0.6); wheel(s * 2.0, 1.2, 1); wheel(s * 2.8, 1.2, 1); }
  // gear doors and a dark composite belly fairing
  const trim: THREE.BufferGeometry[] = [rbox(3.6, 0.5, 9, 0.24).translate(0, GC + 0.25, 0.6), ...[-1, 1].map((s) => rbox(0.08, 1.1, 1.6, 0.03).translate(s * 1.0, GC - 0.1, -L / 2 + 7))];
  const strip: THREE.BufferGeometry[] = [-1, 1].map((s) => rbox(0.05, 0.05, L * 0.55, 0.02).translate(s * R * 0.95, FUSE_Y - R * SQ * 0.32, -1));
  const navZ = -1.0 - (plan.main[1]![1] + plan.main[2]![1]) / 2;
  return {
    paint: merge(paint), trim: merge(trim), glass, windows: merge(win), metal: merge(metal), tyres: merge(tyres), strip: merge(strip), exhaust: merge(exhaust),
    navLeft: new THREE.Vector3(-(plan.tip + 0.1), wingY + 0.1, navZ),
    navRight: new THREE.Vector3(plan.tip + 0.1, wingY + 0.1, navZ),
    tail: new THREE.Vector3(0, FUSE_Y + 0.2, L / 2 - 0.4),
  };
}
