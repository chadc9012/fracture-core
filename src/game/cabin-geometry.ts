/** Cabin interior shapes (FlightCabin.tsx: the airliner / ferry cabin and the Phantom's private cabin). Pure three.js geometry,
 * built once per cabin and merged per material: a fuselage shell from a real cross-section (flat floor, curved sidewalls, arched
 * ceiling) instead of four boxes, rounded/bevelled seats, sofas and furniture (RoundedBoxGeometry, lathes, extrusions), window
 * reveals with rounded corners. Metres; furniture origins sit on the floor, facing -z (forward) unless noted. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { SeatTheme } from "./passenger-cabin";

/** non-indexed, position + normal only, so any of these merge together */
export const prep = (g: THREE.BufferGeometry) => {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k);
  return n;
};
export const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts.map(prep))!;
/** a rounded box (bevelled edges), centred */
export const rbox = (w: number, h: number, d: number, r = 0.03, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const cyl = (rt: number, rb: number, h: number, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
/** a lathe from (radius, height) pairs */
export const lathe = (pts: readonly (readonly [number, number])[], seg = 24) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

/* ---------------- the shell ---------------- */

/** the sidewall is vertical up to this fraction of the cabin height (the window belt), then the ceiling arches over */
export const BELT = 0.64;
/** the inner cross-section, floor at y = 0: flat floor, a rounded foot of the sidewall, a vertical window belt, then the
 * ceiling arch. Counter-clockwise points in (x, y). */
export function cabinProfile(width: number, height: number, inset = 0): THREE.Vector2[] {
  const w = width / 2 + inset, h = height + inset, y0 = -inset, belt = height * BELT;
  const pts: THREE.Vector2[] = [];
  const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number) => {
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push(new THREE.Vector2(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry)); }
  };
  const foot = 0.22 + inset;
  pts.push(new THREE.Vector2(-w + foot, y0), new THREE.Vector2(w - foot, y0));
  arc(w - foot, y0 + foot, foot, foot, -Math.PI / 2, 0, 6); // right foot
  pts.push(new THREE.Vector2(w, belt));
  arc(0, belt, w, h - belt, 0, Math.PI, 28); // the ceiling arch over both sides
  pts.push(new THREE.Vector2(-w, y0 + foot));
  arc(-w + foot, y0 + foot, foot, foot, Math.PI, Math.PI * 1.5, 6); // left foot
  return pts;
}
/** the shell: the cross-section ring (8 cm thick) extruded along z from -length/2 to +length/2; you stand inside the hole */
export function cabinShell(width: number, height: number, length: number, thickness = 0.08): THREE.BufferGeometry {
  const outer = new THREE.Shape(cabinProfile(width, height, thickness));
  outer.holes.push(new THREE.Path(cabinProfile(width, height, 0).reverse()));
  const g = new THREE.ExtrudeGeometry(outer, { depth: length, bevelEnabled: false, steps: 1, curveSegments: 1 });
  g.translate(0, 0, -length / 2);
  g.computeVertexNormals();
  return g;
}
/** where the inner wall is at height y (for placing windows and furniture against it) */
export function wallX(width: number, height: number, y: number): number {
  const belt = height * BELT, w = width / 2;
  if (y <= belt) return w;
  const k = Math.min(1, (y - belt) / (height - belt));
  return w * Math.sqrt(Math.max(0, 1 - k * k));
}

/** a rounded rectangle outline in the XY plane, centred */
export function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/** a window reveal: a rounded frame ring 3 cm deep, facing +z, centred */
export function windowFrame(w: number, h: number, rim = 0.06): THREE.BufferGeometry {
  const s = roundedRect(w + rim * 2, h + rim * 2, Math.min(w, h) * 0.45 + rim);
  const hole = roundedRect(w, h, Math.min(w, h) * 0.45);
  s.holes.push(new THREE.Path(hole.getPoints(10).reverse()));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10 });
  g.computeVertexNormals();
  return g;
}
export const windowPane = (w: number, h: number) => new THREE.ShapeGeometry(roundedRect(w, h, Math.min(w, h) * 0.45), 10);

/** an overhead bin run along z (length) on the +x side; mirror with scale x -1. The outer edge follows the curved wall from
 * the bin floor up to its top; the top runs in to the door, which bulges down to a rounded lip. */
export function overheadBins(width: number, height: number, length: number): THREE.BufferGeometry {
  const yb = height * 0.71, yt = height * 0.88, xi = width / 2 - 0.6, s = new THREE.Shape();
  s.moveTo(xi + 0.08, yb);
  for (let i = 0; i <= 8; i++) { const y = yb + ((yt - yb) * i) / 8; s.lineTo(wallX(width, height, y) - 0.015, y); }
  s.lineTo(xi + 0.06, yt);
  s.quadraticCurveTo(xi - 0.04, yt - 0.03, xi - 0.05, yt - 0.14);
  s.lineTo(xi - 0.03, yb + 0.07);
  s.quadraticCurveTo(xi - 0.01, yb, xi + 0.08, yb);
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -length / 2);
  g.computeVertexNormals();
  return g;
}
/** the bins' underside lip, where the light strip sits */
export const binLip = (width: number, height: number) => ({ x: width / 2 - 0.6, y: height * 0.71 });
/** a bulkhead across the cabin at z = 0 (facing ±z), following the cross-section, with a doorway cut through the middle */
export function bulkhead(width: number, height: number, doorW = 0.9, doorH = 1.95, thickness = 0.08): THREE.BufferGeometry {
  const s = new THREE.Shape(cabinProfile(width - 0.02, height - 0.01, 0));
  if (doorW > 0) {
    s.holes.push(new THREE.Path(roundedRect(doorW, doorH, 0.12).getPoints(8).map((p) => new THREE.Vector2(p.x, p.y + doorH / 2 + 0.03)).reverse()));
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 8 });
  g.translate(0, 0, -thickness / 2);
  g.computeVertexNormals();
  return g;
}

/* ---------------- passenger seats ---------------- */

export type SeatParts = { fabric: THREE.BufferGeometry; frame: THREE.BufferGeometry; trim: THREE.BufferGeometry; back: THREE.BufferGeometry; shell: THREE.BufferGeometry | null; canopy: THREE.BufferGeometry | null };
/** one seat for a theme, origin on the floor under the seat's centre, facing -z. `back` is the backrest alone (fabric), pivoting
 * at its foot (0, 0.5, +depth/2), so the player's own seat can recline; the instanced seats use `fabric`, which includes it. */
export function seatParts(t: SeatTheme, pitch: number): SeatParts {
  const w = t.width, d = t.depth, seatY = 0.46, plush = t.leather ? 0.15 : 0.11;
  const cushion = rbox(w - 0.04, plush, d, 0.045).translate(0, seatY, 0);
  const backH = t.backHeight, base = 0.15 + t.reclineMax * 0.002;
  const back = merge([
    rbox(w - 0.05, backH, 0.11, 0.045).translate(0, backH / 2, 0),
    rbox(w * 0.78, 0.18, 0.09, 0.04).translate(0, backH + 0.08, -0.02), // headrest
  ]).rotateX(base).translate(0, seatY + 0.04, d / 2 - 0.02);
  const frame: THREE.BufferGeometry[] = [
    rbox(w * 0.9, 0.08, d * 0.86, 0.02).translate(0, seatY - 0.1, 0), // pan
    cyl(0.025, 0.03, seatY - 0.12, 10).translate(0, (seatY - 0.12) / 2, -d * 0.25),
    cyl(0.025, 0.03, seatY - 0.12, 10).translate(0, (seatY - 0.12) / 2, d * 0.3),
    rbox(w * 0.7, 0.04, 0.06, 0.015).translate(0, 0.03, -d * 0.25), // feet rails
    rbox(w * 0.7, 0.04, 0.06, 0.015).translate(0, 0.03, d * 0.3),
    // the shell of the backrest that the row behind looks at (with the seat-back screen's bezel)
    rbox(w - 0.03, backH * 0.92, 0.04, 0.02).translate(0, backH * 0.46, 0.06).rotateX(base).translate(0, seatY + 0.04, d / 2 - 0.02),
  ];
  const trim: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    trim.push(rbox(0.055, 0.06, d * 0.82, 0.025).translate(s * (w / 2 - 0.01), seatY + 0.2, 0.02));
    trim.push(rbox(0.04, 0.2, 0.05, 0.015).translate(s * (w / 2 - 0.01), seatY + 0.09, d * 0.3));
  }
  let shell: THREE.BufferGeometry | null = null, canopy: THREE.BufferGeometry | null = null;
  if (t.shell === "suite") {
    // a walled suite: a high wraparound rear shell, a privacy wall on the aisle side, a side console and the screen wall ahead
    const len = Math.min(pitch - 0.2, 2.2);
    shell = merge([
      rbox(w + 0.34, 1.18, 0.07, 0.03).translate(0, 0.59, d / 2 + 0.22),
      rbox(0.07, 1.18, len, 0.03).translate(0, 0.59, d / 2 + 0.22 - len / 2).translate(-(w / 2 + 0.17), 0, 0),
      rbox(0.32, 0.62, len * 0.55, 0.04).translate(w / 2 + 0.06, 0.31, d / 2 + 0.2 - len * 0.3), // console
      rbox(w + 0.34, 1.05, 0.07, 0.03).translate(0, 0.525, d / 2 + 0.22 - len), // front wall
      rbox(0.9, 0.06, 0.5, 0.02).translate(0, 0.42, -d / 2 - 0.45), // ottoman top
      rbox(0.8, 0.36, 0.44, 0.04).translate(0, 0.2, -d / 2 - 0.45),
    ]);
  } else if (t.shell === "pod") {
    shell = merge([
      new THREE.LatheGeometry([0.02, 0.5, 0.58, 0.6, 0.56].map((r, i) => new THREE.Vector2(r * (w / 0.7), i * 0.12)), 32).scale(1, 1, 1.5).translate(0, 0, 0.05),
    ]);
    canopy = new THREE.SphereGeometry(w * 0.95, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 1, 1.5).translate(0, 0.55, 0.05);
  }
  return { fabric: merge([cushion, back]), frame: merge(frame), trim: merge(trim), back: merge([rbox(w - 0.05, backH, 0.11, 0.045).translate(0, backH / 2, 0), rbox(w * 0.78, 0.18, 0.09, 0.04).translate(0, backH + 0.08, -0.02)]), shell, canopy };
}
/** the seat-back screen (a rounded bezel holds it; this is the glass), facing +z */
export const seatScreen = (w = 0.24, h = 0.15) => new THREE.ShapeGeometry(roundedRect(w, h, 0.015), 4);

/* ---------------- people ---------------- */

/** a seated figure (origin under the seat, facing -z): body/limbs in clothing, head and hands in skin. Simple but rounded. */
export function seatedFigure(): { clothes: THREE.BufferGeometry; skin: THREE.BufferGeometry; hair: THREE.BufferGeometry } {
  const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 6, 14);
  const clothes = merge([
    cap(0.17, 0.32).scale(1.15, 1, 0.75).rotateX(-0.12).translate(0, 0.86, 0.12), // torso
    cap(0.075, 0.34).rotateX(Math.PI / 2).translate(-0.1, 0.56, -0.12), // thighs
    cap(0.075, 0.34).rotateX(Math.PI / 2).translate(0.1, 0.56, -0.12),
    cap(0.06, 0.36).translate(-0.1, 0.3, -0.33), // shins
    cap(0.06, 0.36).translate(0.1, 0.3, -0.33),
    cap(0.05, 0.26).rotateX(0.5).translate(-0.24, 0.8, 0.02), // upper arms
    cap(0.05, 0.26).rotateX(0.5).translate(0.24, 0.8, 0.02),
    cap(0.045, 0.24).rotateX(Math.PI / 2 - 0.15).translate(-0.24, 0.64, -0.14), // forearms on the armrests
    cap(0.045, 0.24).rotateX(Math.PI / 2 - 0.15).translate(0.24, 0.64, -0.14),
  ]);
  const skin = merge([
    new THREE.SphereGeometry(0.105, 20, 14).scale(0.9, 1.1, 1).translate(0, 1.28, 0.1),
    cyl(0.045, 0.05, 0.1, 12).translate(0, 1.15, 0.12),
    new THREE.SphereGeometry(0.045, 10, 8).translate(-0.24, 0.63, -0.28),
    new THREE.SphereGeometry(0.045, 10, 8).translate(0.24, 0.63, -0.28),
  ]);
  const hair = new THREE.SphereGeometry(0.112, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.92, 1.1, 1.05).translate(0, 1.3, 0.11);
  return { clothes, skin, hair };
}

/* ---------------- the Phantom's furniture ---------------- */

/** a three-seat sofa w wide, facing -z: plinth, seat cushions, back cushions, rolled arms */
export function sofa(w = 1.9, d = 0.9): { body: THREE.BufferGeometry; cushions: THREE.BufferGeometry } {
  const n = Math.max(1, Math.round(w / 0.68)), cw = (w - 0.3) / n;
  const body = merge([
    rbox(w, 0.3, d, 0.06).translate(0, 0.2, 0),
    rbox(w, 0.5, 0.18, 0.07).translate(0, 0.55, d / 2 - 0.09),
    ...[-1, 1].map((s) => rbox(0.16, 0.34, d, 0.07).translate(s * (w / 2 - 0.08), 0.52, 0)),
    ...[-1, 1].map((s) => cyl(0.03, 0.022, 0.06, 10).translate(s * (w / 2 - 0.1), 0.03, 0)),
  ]);
  const cushions: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.15 + cw * (i + 0.5);
    cushions.push(rbox(cw - 0.02, 0.15, d - 0.22, 0.06).translate(x, 0.42, -0.06));
    cushions.push(rbox(cw - 0.03, 0.42, 0.16, 0.07).rotateX(-0.14).translate(x, 0.72, d / 2 - 0.22));
  }
  return { body, cushions: merge(cushions) };
}
/** a round pedestal table (lathe), top radius r at height h */
export const pedestalTable = (r = 0.38, h = 0.48) => merge([
  lathe([[0, 0], [0.22, 0], [0.22, 0.02], [0.05, 0.06], [0.04, h - 0.05], [r * 0.4, h - 0.03], [r, h - 0.02], [r, h + 0.015], [0, h + 0.015]], 36),
]);
/** a bottle (lathe): body, shoulder, neck */
export const bottle = (h = 0.3, r = 0.04) => lathe([[0, 0], [r, 0], [r, h * 0.62], [r * 0.45, h * 0.78], [r * 0.3, h * 0.82], [r * 0.3, h], [0, h]], 18);
/** a tumbler (lathe) */
export const tumbler = (h = 0.09, r = 0.035) => lathe([[0, 0], [r * 0.9, 0], [r, h], [r * 0.92, h], [r * 0.82, 0.01], [0, 0.01]], 18);
/** a bar counter along z (length), its service side at +x: plinth, fluted front panel, bevelled stone top */
export function barCounter(length = 3.4): { body: THREE.BufferGeometry; top: THREE.BufferGeometry } {
  const parts: THREE.BufferGeometry[] = [rbox(0.62, 0.98, length, 0.03).translate(0, 0.49, 0), rbox(0.5, 0.08, length - 0.06, 0.02).translate(0.02, 0.04, 0)];
  for (let i = 0; i < Math.floor(length / 0.12); i++) parts.push(cyl(0.025, 0.025, 0.82, 10).translate(-0.31, 0.5, -length / 2 + 0.08 + i * 0.12)); // flutes
  return { body: merge(parts), top: rbox(0.78, 0.05, length + 0.1, 0.02, 4).translate(-0.06, 1.0, 0) };
}
/** a bar stool (lathe seat on a column) */
export const barStool = () => merge([
  lathe([[0, 0], [0.2, 0], [0.2, 0.02], [0.04, 0.05], [0.035, 0.68], [0.18, 0.7], [0.19, 0.76], [0, 0.78]], 28),
]);
/** a desk 1.4 wide facing -z with a drawer pedestal */
export const desk = (w = 1.4, d = 0.7) => ({
  top: rbox(w, 0.05, d, 0.02, 4).translate(0, 0.74, 0),
  body: merge([rbox(0.42, 0.7, d - 0.06, 0.02).translate(w / 2 - 0.24, 0.36, 0), ...[-1].map((s) => rbox(0.05, 0.7, d - 0.08, 0.015).translate(s * (w / 2 - 0.04), 0.36, 0)), rbox(w - 0.1, 0.4, 0.03, 0.01).translate(0, 0.52, d / 2 - 0.04)]),
});
/** an office / gaming chair: five-star base, column, rounded seat and tall back, facing -z */
export const swivelChair = (gaming = false) => merge([
  ...Array.from({ length: 5 }, (_, i) => rbox(0.3, 0.04, 0.05, 0.015).translate(0.15, 0.06, 0).rotateY((i / 5) * Math.PI * 2)),
  ...Array.from({ length: 5 }, (_, i) => new THREE.SphereGeometry(0.03, 10, 8).translate(0.29, 0.03, 0).rotateY((i / 5) * Math.PI * 2)),
  cyl(0.03, 0.035, 0.36, 12).translate(0, 0.25, 0),
  rbox(0.5, 0.09, 0.48, 0.04).translate(0, 0.47, 0),
  rbox(0.48, gaming ? 0.82 : 0.6, 0.08, 0.04).rotateX(0.12).translate(0, gaming ? 0.92 : 0.82, 0.25),
  ...(gaming ? [-1, 1].map((s) => rbox(0.07, 0.5, 0.1, 0.03).rotateX(0.12).translate(s * 0.27, 0.86, 0.24)) : []),
  ...[-1, 1].map((s) => rbox(0.05, 0.04, 0.3, 0.015).translate(s * 0.27, 0.66, 0.02)),
]);
/** a monitor on a foot, its glass facing +z, w wide. Returns case and glass. */
export function monitor(w = 0.62, h = 0.36): { body: THREE.BufferGeometry; glass: THREE.BufferGeometry } {
  return {
    body: merge([rbox(w + 0.03, h + 0.03, 0.03, 0.01).translate(0, h / 2 + 0.14, 0), rbox(0.05, 0.14, 0.03, 0.01).translate(0, 0.07, 0.02), rbox(0.22, 0.015, 0.16, 0.007).translate(0, 0.008, 0.02)]),
    glass: new THREE.ShapeGeometry(roundedRect(w, h, 0.01), 2).translate(0, h / 2 + 0.14, 0.016),
  };
}
/** a double bed, headboard at +z: plinth, mattress, duvet, two pillows, a tufted headboard */
export function bed(w = 1.8, l = 2.05): { body: THREE.BufferGeometry; linen: THREE.BufferGeometry; duvet: THREE.BufferGeometry } {
  const head: THREE.BufferGeometry[] = [rbox(w + 0.2, 1.0, 0.12, 0.05).translate(0, 0.62, l / 2 + 0.04)];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) head.push(new THREE.SphereGeometry(0.018, 8, 6).translate(-w / 2 + 0.2 + i * ((w - 0.4) / 5), 0.5 + j * 0.22, l / 2 - 0.02));
  return {
    body: merge([rbox(w + 0.1, 0.28, l + 0.05, 0.05).translate(0, 0.16, 0), ...head]),
    linen: merge([rbox(w - 0.04, 0.2, l - 0.04, 0.08).translate(0, 0.39, 0), ...[-1, 1].map((s) => rbox(0.68, 0.14, 0.4, 0.07).translate(s * 0.42, 0.56, l / 2 - 0.3))]),
    duvet: rbox(w + 0.04, 0.08, l * 0.62, 0.04).translate(0, 0.5, -l * 0.18),
  };
}
/** a screen in a rounded frame facing +z, w × h */
export function screenPanel(w: number, h: number): { frame: THREE.BufferGeometry; glass: THREE.BufferGeometry } {
  return { frame: rbox(w + 0.08, h + 0.08, 0.06, 0.02).translate(0, 0, -0.03), glass: new THREE.ShapeGeometry(roundedRect(w, h, 0.02), 4).translate(0, 0, 0.002) };
}
/** a low credenza / sideboard along z, with a recessed plinth */
export const credenza = (length = 1.6, h = 0.62, d = 0.45) => merge([rbox(d, h - 0.06, length, 0.03).translate(0, 0.06 + (h - 0.06) / 2, 0), rbox(d - 0.08, 0.06, length - 0.08, 0.01).translate(0, 0.03, 0)]);
