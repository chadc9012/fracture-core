/**
 * Hairstyles as geometry (operator-styling.ts HAIR_STYLES), built in head space — metres on a 1.85 m human, origin at the Head
 * bone's rest position, the character facing +Z — and bound to the head bone by operator-head.ts so they follow every animation.
 *
 * Every style is built around the head it goes on: fitSkull() measures the head mesh's own hair surface by direction from the
 * skull's centre, and the skull is that surface less the authored hair's thickness. Caps are lat/long shells over that skull down
 * to the hairline; locs, braids, tails and twists are tubes along curves that leave the scalp, swing clear of the skull and hang.
 * Each strand carries its own slight shade in a vertex colour so hair reads as strands rather than one shell. Deterministic: the
 * same style on the same head always builds the same hair. Pure three.js geometry, so it runs under node in tests.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { HairDef } from "./operator-styling.ts";
import { SKULL } from "./operator-skin-shader.ts";

/** How far the authored hair stands off the skull on the heads (about a finger's width). */
const HAIR_DEPTH = 0.012;
const BINS_PHI = 24, BINS_THETA = 48;

/** The skull a head's hair is built on: `radiusAt(dir)` is the distance from `centre` to the skull along a unit direction. */
export type Skull = { centre: THREE.Vector3; radii: THREE.Vector3; radiusAt: (dir: THREE.Vector3) => number };

const ellipsoidRadius = (radii: THREE.Vector3, dir: THREE.Vector3) => 1 / Math.hypot(dir.x / radii.x, dir.y / radii.y, dir.z / radii.z);

/** the typical skull (operator-skin-shader.ts SKULL), used when a head can't be measured */
export const DEFAULT_SKULL: Skull = (() => {
  const centre = new THREE.Vector3(...SKULL.centre), radii = new THREE.Vector3(...SKULL.radii);
  return { centre, radii, radiusAt: (dir) => ellipsoidRadius(radii, dir) };
})();

const binOf = (dir: THREE.Vector3) => {
  const phi = Math.acos(THREE.MathUtils.clamp(dir.y, -1, 1)), theta = Math.atan2(dir.x, dir.z) + Math.PI; // 0..π, 0..2π
  const i = Math.min(BINS_PHI - 1, Math.floor((phi / Math.PI) * BINS_PHI)), j = Math.min(BINS_THETA - 1, Math.floor((theta / (Math.PI * 2)) * BINS_THETA));
  return i * BINS_THETA + j;
};

/** Measures a head (its vertices as a flat xyz array in head space) and fits its skull: an ellipsoid centred between the jaw
 * and the crown, sized from the outermost surface along each axis (robustly, so a ponytail, a topknot or the hair's own volume
 * can't inflate it), less the authored hair's thickness. */
export function fitSkull(xyz: ArrayLike<number>): Skull {
  const d = DEFAULT_SKULL;
  // the skull's centre sits halfway between the jaw (the head bone, y 0) and this head's crown: the crown is the highest point
  // over the middle of the head (a tail or knot behind or beside it doesn't count)
  let crown = -Infinity;
  for (let i = 0; i < xyz.length; i += 3) {
    const x = xyz[i]!, y = xyz[i + 1]!, z = xyz[i + 2]!;
    if (Math.abs(x) < 0.035 && z > -0.05 && z < 0.06 && y > crown) crown = y;
  }
  const centre = Number.isFinite(crown) ? new THREE.Vector3(0, THREE.MathUtils.clamp(crown * 0.5, 0.07, 0.1), d.centre.z) : d.centre.clone();
  // the outermost vertex in each direction: for each bin's centre direction, the farthest vertex within a small cone around
  // it (widened until one is found), so sparse patches such as the crown read from their own few vertices and not from
  // neighbouring bins at other radii
  const dirs: THREE.Vector3[] = [], rs: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < xyz.length; i += 3) {
    v.set(xyz[i]!, xyz[i + 1]!, xyz[i + 2]!).sub(centre);
    const r = v.length();
    if (r < 1e-4) continue;
    const dir = v.clone().divideScalar(r);
    // scalp directions only (the upper half and the back), and not far beyond the typical skull (that's a tail or a knot)
    if (dir.y < -0.15 && dir.z > -0.3) continue;
    if (r > ellipsoidRadius(d.radii, dir) * 1.12) continue;
    dirs.push(dir); rs.push(r);
  }
  const outer = new Float32Array(BINS_PHI * BINS_THETA);
  let any = false;
  if (dirs.length) {
    for (let i = 0; i < BINS_PHI; i++) for (let j = 0; j < BINS_THETA; j++) {
      const phi = ((i + 0.5) / BINS_PHI) * Math.PI, theta = ((j + 0.5) / BINS_THETA) * Math.PI * 2 - Math.PI;
      const c = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
      for (const cone of [0.996, 0.985, 0.94, 0.8]) { // cos of ~5°, 10°, 20°, 37°
        let best = 0;
        for (let k = 0; k < dirs.length; k++) if (dirs[k]!.dot(c) > cone && rs[k]! > best) best = rs[k]!;
        if (best > 0) { outer[i * BINS_THETA + j] = best; any = true; break; }
      }
    }
  }
  if (!any) return d;
  // the skull is this head's own ellipsoid: a robust (40th percentile) radius along each axis, front and back apart, so the
  // hair standing off the crown or the base of a tail can't pull it out of shape, less the authored hair's thickness
  const axisStat = (pick: (dir: THREE.Vector3) => boolean, fallback: number) => {
    const picked: number[] = [];
    for (let i = 0; i < BINS_PHI; i++) for (let j = 0; j < BINS_THETA; j++) {
      const r = outer[i * BINS_THETA + j]!;
      if (r <= 0) continue;
      const phi = ((i + 0.5) / BINS_PHI) * Math.PI, theta = ((j + 0.5) / BINS_THETA) * Math.PI * 2 - Math.PI;
      if (pick(new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta)))) picked.push(r);
    }
    if (picked.length < 3) return fallback;
    picked.sort((a, b) => a - b);
    return picked[Math.floor(picked.length * 0.4)]!;
  };
  const ax = axisStat((dir) => Math.abs(dir.x) > 0.8 && dir.y > -0.1, d.radii.x + HAIR_DEPTH) - HAIR_DEPTH;
  const ay = axisStat((dir) => dir.y > 0.8, d.radii.y + HAIR_DEPTH) - HAIR_DEPTH;
  const azFront = axisStat((dir) => dir.z > 0.8 && dir.y > 0, d.radii.z + HAIR_DEPTH) - HAIR_DEPTH;
  const azBack = axisStat((dir) => dir.z < -0.8, d.radii.z + HAIR_DEPTH) - HAIR_DEPTH;
  const radii = new THREE.Vector3(ax, ay, Math.max(azFront, azBack));
  const radiusAt = (dir: THREE.Vector3) => 1 / Math.hypot(dir.x / ax, dir.y / ay, dir.z / (dir.z > 0 ? azFront : azBack));
  return { centre, radii, radiusAt };
}

let SK: Skull = DEFAULT_SKULL;

/** seeded 0..1 */
const rand = (seed: number) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const dirOf = (phi: number, theta: number) => new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
/** a point on the skull: `phi` from the crown (0) down (π/2 is the equator), `theta` around (0 = front, π = back), `lift` outward in metres */
function onSkull(phi: number, theta: number, lift = 0): THREE.Vector3 {
  const dir = dirOf(phi, theta);
  return dir.multiplyScalar(SK.radiusAt(dir) + lift).add(SK.centre);
}
const outward = (p: THREE.Vector3) => p.clone().sub(SK.centre).divide(SK.radii).normalize();

/** non-indexed with a flat colour, so parts merge; `shade` darkens or lightens the strand */
function part(g: THREE.BufferGeometry, shade: number): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") n.deleteAttribute(k);
  if (!n.getAttribute("uv")) n.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n.getAttribute("position").count * 2), 2));
  const count = n.getAttribute("position").count;
  n.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3).fill(shade), 3));
  return n;
}

/** The hairline as the polar angle from the crown at which hair stops, by `theta` (0 = front, π = back): high on the forehead,
 * down to the top of the ears at the sides, to the nape behind. Measured on the authored heads (forehead hairline ≈ y 0.125,
 * ear tops ≈ y 0.07, nape ≈ y 0.03 in head space). */
export function hairline(theta: number): number {
  const t = (1 - Math.cos(theta)) / 2; // 0 front → 1 back
  return THREE.MathUtils.lerp(0.4 * Math.PI, 0.62 * Math.PI, Math.sin(t * Math.PI * 0.5));
}

type Lift = number | ((phi: number, theta: number) => number);
/** A lat/long shell over the skull: `lift` metres off it, down to `limit(theta)` (the hairline for hair), with a closed rim. */
function shell(lift: Lift, limit: (theta: number) => number, shade = 1, rows = 18, cols = 36): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    const theta = (j / cols) * Math.PI * 2;
    const phi = Math.min(limit(theta), (i / rows) * Math.PI);
    const p = onSkull(phi, theta, typeof lift === "number" ? lift : lift(phi, theta));
    pos.push(p.x, p.y, p.z); uv.push(j / cols, i / rows);
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + cols + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return part(g, shade);
}

/** hair shell from the crown down to the hairline (no further than `phiMax`); `sideThick` fades the sides and back thinner */
function cap(thick: number, sideThick: number | undefined, phiMax: number | undefined, shade = 1): THREE.BufferGeometry {
  const lift: Lift = sideThick === undefined ? thick : (phi) => THREE.MathUtils.lerp(thick, sideThick, THREE.MathUtils.smoothstep(phi, 0.22 * Math.PI, 0.5 * Math.PI));
  return shell(lift, (theta) => Math.min(phiMax ?? 0.6 * Math.PI, hairline(theta)), shade);
}

/** a tube along a curve through `pts`, radius `r` (tapering to `rEnd` when given, in three sections) */
function strand(pts: THREE.Vector3[], r: number, seed: number, rEnd?: number, segs = 8): THREE.BufferGeometry[] {
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const shade = 0.82 + rand(seed) * 0.3;
  if (rEnd === undefined) return [part(new THREE.TubeGeometry(curve, segs, r, 5, false), shade)];
  const out: THREE.BufferGeometry[] = [];
  for (let s = 0; s < 3; s++) {
    const a = s / 3, b = (s + 1) / 3;
    const sub = new THREE.CatmullRomCurve3([curve.getPoint(a), curve.getPoint((a + b) / 2), curve.getPoint(b)], false, "centripetal");
    out.push(part(new THREE.TubeGeometry(sub, 4, THREE.MathUtils.lerp(r, rEnd, (s + 0.5) / 3), 6, false), shade));
  }
  return out;
}

/** a hanging loc/braid/twist/curl from a scalp root: leaves outward, then falls under gravity with a little drift */
function hanging(root: THREE.Vector3, length: number, r: number, seed: number, curl = false): THREE.BufferGeometry[] {
  const n = outward(root);
  // strands rooted towards the front sweep to the sides and back rather than falling over the face
  if (n.z > 0.15) { n.x += Math.sign(n.x || 1) * n.z * 0.9; n.z *= 0.15; n.normalize(); }
  const drift = (rand(seed + 1) - 0.5) * 0.04;
  const p1 = root.clone().add(n.clone().multiplyScalar(0.03)).add(new THREE.Vector3(0, -length * 0.15, 0));
  const p2 = root.clone().add(n.clone().multiplyScalar(0.03 + Math.abs(drift))).add(new THREE.Vector3(drift, -length * 0.6, -0.01));
  const p3 = root.clone().add(new THREE.Vector3(n.x * 0.025 + drift * 1.4, -length, n.z * 0.02 - 0.015));
  if (!curl) return strand([root, p1, p2, p3], r, seed);
  // a curl: the same path with a corkscrew around it
  const pts: THREE.Vector3[] = [];
  const base = new THREE.CatmullRomCurve3([root, p1, p2, p3], false, "centripetal");
  const side = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize();
  for (let i = 0; i <= 14; i++) {
    const t = i / 14, a = t * Math.PI * 7 + seed;
    pts.push(base.getPoint(t).add(side.clone().multiplyScalar(Math.cos(a) * 0.012 * t)).add(n.clone().multiplyScalar(Math.sin(a) * 0.012 * t)));
  }
  return strand(pts, r, seed, undefined, 20);
}

/** scalp roots in rings from the crown down to the hairline */
function roots(count: number, seed: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const rings = Math.max(2, Math.round(Math.sqrt(count)));
  let i = 0;
  for (let ring = 0; ring < rings && out.length < count; ring++) {
    const phi = 0.12 * Math.PI + (ring / (rings - 1)) * 0.5 * Math.PI;
    const per = Math.max(1, Math.round((count / rings) * (0.5 + Math.sin(phi))));
    for (let k = 0; k < per && out.length < count; k++, i++) {
      const theta = ((k + 0.5) / per) * Math.PI * 2 + rand(seed + i) * 0.2;
      if (phi > hairline(theta) - 0.05) continue; // no roots past the hairline
      out.push(onSkull(phi, theta, 0.004));
    }
  }
  return out;
}

const tie = (at: THREE.Vector3, axis: THREE.Vector3, r: number): THREE.BufferGeometry => {
  const g = new THREE.TorusGeometry(r, 0.004, 6, 14);
  g.lookAt(axis);
  g.translate(at.x, at.y, at.z);
  return part(g, 0.35); // a dark band
};

/** a braid lying along the scalp from front to back at `theta` (mirrored over the crown), then falling behind by `hang` */
function cornrow(theta: number, seed: number, hang: number): THREE.BufferGeometry[] {
  const pts: THREE.Vector3[] = [];
  for (let s = 0; s <= 6; s++) {
    const t = s / 6;
    const th = t < 0.5 ? theta : Math.PI - theta;
    const phi = (hairline(th) - 0.08) * Math.abs(t * 2 - 1);
    pts.push(onSkull(Math.max(0.05, phi), th, 0.006));
  }
  const back = pts[pts.length - 1]!;
  if (hang > 0) pts.push(back.clone().add(new THREE.Vector3(0, -hang * 0.45, -0.025)), back.clone().add(new THREE.Vector3(0, -hang, -0.03)));
  return strand(pts, 0.007, seed);
}

/** a bun: a squashed ball on the skull at (phi, theta), with its tie; `braided` wraps it in a coil of strands */
function bun(phi: number, theta: number, r: number, flat: number, braided: boolean): THREE.BufferGeometry[] {
  const at = onSkull(phi, theta, r * 0.45);
  const n = outward(at);
  const out: THREE.BufferGeometry[] = [];
  const g = new THREE.SphereGeometry(r, 18, 12); g.scale(1, flat, 0.85);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
  g.translate(at.x, at.y, at.z);
  out.push(part(g, 0.95), tie(onSkull(phi, theta, 0.004), n, r * 0.72));
  if (braided) {
    const side = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(side, n).normalize();
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 30; i++) { const a = i * 0.7, rr = r * (0.3 + 0.7 * (i / 30)); pts.push(at.clone().add(side.clone().multiplyScalar(Math.cos(a) * rr)).add(up.clone().multiplyScalar(Math.sin(a) * rr * flat)).add(n.clone().multiplyScalar(r * 0.75 * Math.sqrt(Math.max(0, 1 - (rr / r) ** 2)) + 0.002))); }
    out.push(...strand(pts, 0.006, 77, undefined, 40));
  }
  return out;
}

/** a tail from a tie point: falls with gravity, swaying `sway` to the side (±1 for twin tails) */
function tail(phi: number, theta: number, length: number, radius: number, sway: number, seed: number): THREE.BufferGeometry[] {
  const base = onSkull(phi, theta, 0.012);
  const n = outward(base);
  const out: THREE.BufferGeometry[] = [tie(base, n, radius * 0.9)];
  const back = new THREE.Vector3(n.x, 0, n.z).normalize();
  const high = phi < 0.45 * Math.PI;
  const pts = [base, base.clone().add(back.clone().multiplyScalar(high ? 0.06 : 0.025)).add(new THREE.Vector3(0, high ? -0.03 : -0.06, 0)),
    base.clone().add(back.clone().multiplyScalar(high ? 0.07 : 0.01)).add(new THREE.Vector3(sway * 0.02, -length * 0.55, 0)),
    base.clone().add(back.clone().multiplyScalar(high ? 0.03 : -0.005)).add(new THREE.Vector3(sway * 0.03, -length, 0))];
  out.push(...strand(pts, radius, seed, radius * 0.45));
  return out;
}

/** hair falling from the hairline: a skirt round the back (and sides, with `span` ≥ 1) down `length`, waved by `waves` */
function curtain(length: number, waves: number, span: number, side: -1 | 0 | 1, seed: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const half = Math.min(Math.PI, 0.45 * Math.PI * span);
  const cols = Math.max(6, Math.round(half * 14));
  for (let j = 0; j <= cols; j++) {
    const theta = Math.PI + (j / cols) * 2 * half - half; // around the back
    if (side === 1 && theta < Math.PI) continue;
    if (side === -1 && theta > Math.PI) continue;
    const top = onSkull(hairline(theta) - 0.02, theta, 0.012);
    const n = outward(top); n.y = 0; n.normalize();
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const wave = waves ? Math.sin(t * Math.PI * 2.2 + j) * 0.012 * waves * t : 0;
      pts.push(top.clone().add(n.clone().multiplyScalar(0.008 + t * 0.03 + wave)).add(new THREE.Vector3(0, -length * t, 0)));
    }
    out.push(...strand(pts, 0.011, seed + j, 0.007));
  }
  return out;
}

/** short strands out of the scalp: lying along it (messy), straight up (spiky) or curled (curly) */
function tufts(count: number, length: number, radius: number, seed: number, spiky: boolean, curl: boolean): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  roots(count, seed).forEach((r, i) => {
    const n = outward(r);
    const side = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(rand(seed + i * 3) - 0.5);
    if (spiky) {
      const g = new THREE.ConeGeometry(radius, length, 5);
      g.translate(0, length / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().add(side.multiplyScalar(0.6)).add(new THREE.Vector3(0, 0.3, 0)).normalize()));
      g.translate(r.x, r.y, r.z);
      out.push(part(g, 0.85 + rand(i) * 0.3));
      return;
    }
    const dir = n.clone().multiplyScalar(0.3).add(side).add(new THREE.Vector3(0, -0.6, 0)).normalize();
    if (curl) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10, a = t * Math.PI * 4 + i; pts.push(r.clone().add(dir.clone().multiplyScalar(length * t)).add(n.clone().multiplyScalar(Math.sin(a) * 0.008)).add(side.clone().multiplyScalar(Math.cos(a) * 0.008))); }
      out.push(...strand(pts, radius, seed + i, undefined, 14));
    } else {
      out.push(...strand([r, r.clone().add(dir.clone().multiplyScalar(length * 0.5)).add(n.clone().multiplyScalar(0.01)), r.clone().add(dir.clone().multiplyScalar(length))], radius, seed + i, radius * 0.5));
    }
  });
  return out;
}

/** a tapered tube along `pts` whose colour runs from the strand's shade at the root to `tip` times it at the end */
function shadedStrand(pts: THREE.Vector3[], r: number, rEnd: number, seed: number, tip: number, segs = 10, radial = 6): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const g = new THREE.TubeGeometry(curve, segs, r, radial, false);
  const pos = g.getAttribute("position") as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  const base = 0.82 + rand(seed) * 0.3, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, k = THREE.MathUtils.lerp(1, rEnd / r, t), shade = base * THREE.MathUtils.lerp(1, tip, THREE.MathUtils.smoothstep(t, 0.45, 1));
    curve.getPointAt(t, c);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
      col.set([shade, shade, shade], idx * 3);
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const n = g.toNonIndexed();
  n.computeVertexNormals();
  return n;
}

/** short twists over the top of the head (operator-styling.ts twistTop): each rises off the scalp, then tips over and falls
 * outward, wound as two strands (a small helix), lighter or darker at the ends by `tip` */
function twistTop(count: number, length: number, radius: number, seed: number, phiMax: number, tip: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const rings = Math.max(3, Math.round(Math.sqrt(count * 0.6)));
  let i = 0;
  for (let ring = 0; ring < rings; ring++) {
    const phi = 0.03 * Math.PI + (ring / (rings - 1)) * (phiMax - 0.03 * Math.PI);
    const per = Math.max(3, Math.round((count / rings) * (0.35 + 1.3 * Math.sin(phi))));
    for (let k = 0; k < per; k++, i++) {
      const theta = ((k + 0.5 + rand(seed + i) * 0.4) / per) * Math.PI * 2 + ring * 0.37;
      if (phi > hairline(theta) - 0.06) continue;
      const root = onSkull(phi, theta, 0.003), n = outward(root);
      const h = dirOf(0.5 * Math.PI, theta).add(new THREE.Vector3(0, 0, 0.35)).normalize(); // outward, a little forward
      const L = length * (0.75 + rand(seed + i * 5) * 0.5);
      const fall = 0.08 + (phi / phiMax) * 0.3; // the outer twists lean over further
      const side = new THREE.Vector3().crossVectors(n, h).normalize();
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 8; s++) {
        const t = s / 8;
        const p = root.clone()
          .add(n.clone().multiplyScalar(L * (0.75 * t - 0.2 * t * t)))
          .add(h.clone().multiplyScalar(L * fall * t * t))
          .add(new THREE.Vector3(0, -L * fall * 0.6 * t * t * t, 0));
        const a = t * Math.PI * 5 + rand(seed + i) * 6; // the two-strand wind
        p.add(side.clone().multiplyScalar(Math.cos(a) * radius * 0.45)).add(h.clone().multiplyScalar(Math.sin(a) * radius * 0.25));
        pts.push(p);
      }
      out.push(shadedStrand(pts, radius, radius * 0.6, seed + i, tip));
    }
  }
  return out;
}

/** a fringe over the forehead: swept to one side (`sweep` ±1), straight (0), or pushed up and back (`up`) */
function fringe(sweep: -1 | 0 | 1, lift: number, up: boolean): THREE.BufferGeometry[] {
  if (up) {
    const out: THREE.BufferGeometry[] = [];
    for (let k = -3; k <= 3; k++) {
      const th = k * 0.18;
      const r = onSkull(hairline(th) - 0.1, th, 0.008);
      const n = outward(r);
      out.push(...strand([r, r.clone().add(n.clone().multiplyScalar(lift * 0.6)).add(new THREE.Vector3(0, lift * 0.8, 0)), r.clone().add(n.clone().multiplyScalar(-0.01)).add(new THREE.Vector3(0, lift * 1.3, -0.03))], 0.012, 90 + k, 0.006));
    }
    return out;
  }
  const a = onSkull(0.36 * Math.PI, -0.6 * (sweep || 1), lift), b = onSkull(0.4 * Math.PI, -0.15 * (sweep || 1), lift + 0.008), c = onSkull(0.44 * Math.PI, 0.35 * (sweep || 1), lift + 0.004);
  return sweep === 0 ? strand([onSkull(0.42 * Math.PI, -0.45, lift + 0.004), onSkull(0.44 * Math.PI, 0, lift + 0.008), onSkull(0.42 * Math.PI, 0.45, lift + 0.004)], 0.014, 3) : strand([a, b, c], 0.016, 3);
}

/** a braid ring around the head just above the hairline */
function crown(): THREE.BufferGeometry[] {
  const pts: THREE.Vector3[] = [];
  for (let j = 0; j <= 40; j++) { const th = (j / 40) * Math.PI * 2; pts.push(onSkull(hairline(th) - 0.12, th, 0.012)); }
  return strand(pts, 0.011, 88, undefined, 60);
}

/** one thick braid from behind the ear over the shoulder on `side` */
function sideBraid(side: -1 | 1, length: number): THREE.BufferGeometry[] {
  const th = side * 0.72 * Math.PI;
  const top = onSkull(0.5 * Math.PI, th, 0.014);
  const pts = [top, top.clone().add(new THREE.Vector3(side * 0.01, -0.08, 0.03)), top.clone().add(new THREE.Vector3(side * 0.005, -length * 0.6, 0.06)), top.clone().add(new THREE.Vector3(0, -length, 0.075))];
  const out = strand(pts, 0.016, 99, 0.009);
  out.push(tie(pts[3]!.clone().add(new THREE.Vector3(0, 0.02, 0)), new THREE.Vector3(0, 1, 0), 0.011));
  return out;
}

/** the geometry for a hairstyle on `skull`, or null for "as modelled" and bald */
export function hairGeometry(style: HairDef, skull: Skull = DEFAULT_SKULL): THREE.BufferGeometry | null {
  SK = skull;
  if (style.kind !== "built" || !style.parts?.length) return null;
  const parts: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  let seed = 1;
  for (const p of style.parts) {
    seed += 17;
    switch (p.kind) {
      case "cap": parts.push(cap(p.thick, p.sideThick, p.phiMax, p.shade)); break;
      case "fringe": parts.push(...fringe(p.sweep, p.lift ?? 0.012, p.up ?? false)); break;
      case "hanging": roots(p.count, p.seed).forEach((r, i) => parts.push(...hanging(r, p.length + rand(p.seed + i) * p.jitter, p.radius, p.seed + i, p.curl))); break;
      case "tied": {
        const gather = p.bun ? onSkull(0.42 * Math.PI, Math.PI, 0.03) : onSkull(0.56 * Math.PI, Math.PI, 0.03);
        roots(p.count, 17).forEach((r, i) => {
          const midDir = outward(r.clone().add(gather).multiplyScalar(0.5));
          const mid = midDir.clone().multiplyScalar(SK.radiusAt(midDir) + 0.012).add(SK.centre);
          parts.push(...strand([r, mid, gather], p.radius, i));
        });
        if (p.bun) { parts.push(...bun(0.42 * Math.PI, Math.PI, 0.04, 0.9, false)); break; }
        parts.push(tie(gather, new THREE.Vector3(0, 0.3, -1), 0.03));
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const start = gather.clone().add(new THREE.Vector3(Math.cos(a) * 0.018, Math.sin(a) * 0.012, -0.01));
          parts.push(...strand([start, start.clone().add(new THREE.Vector3(Math.cos(a) * 0.01, -0.1, -0.02)), start.clone().add(new THREE.Vector3(Math.cos(a) * 0.015, -0.22, -0.01))], p.radius, 50 + i));
        }
        break;
      }
      case "tail": parts.push(...tail(p.phi, p.theta, p.length, p.radius, p.sway ?? 0, seed)); break;
      case "bun": parts.push(...bun(p.phi, p.theta, p.r, p.flat ?? 1, p.braided ?? false)); break;
      case "crest": {
        const w = p.width ?? 0.022;
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          const th = t < 0.5 ? 0 : Math.PI;
          const phi = (hairline(th) - 0.06) * Math.abs(t * 2 - 1);
          const at = onSkull(Math.max(0.03, phi), th, 0.002);
          const n = outward(at);
          const h = p.height * (0.75 + 0.35 * Math.sin(t * Math.PI));
          const g = new THREE.BoxGeometry(w, h, 0.028);
          g.translate(0, h / 2, 0);
          g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, n));
          g.translate(at.x, at.y, at.z);
          parts.push(part(g, 0.9 + 0.1 * rand(i)));
        }
        break;
      }
      case "afro": {
        const g = shell(0, (theta) => Math.min(0.7 * Math.PI, hairline(theta) + (p.extra ?? 0.25)), 1, 36, 72);
        const pos = g.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(pos, i);
          v.add(outward(v).multiplyScalar(p.lift + rand(i * 7) * p.jitter));
          pos.setXYZ(i, v.x, v.y, v.z);
        }
        g.computeVertexNormals();
        parts.push(g);
        break;
      }
      case "curtain": parts.push(...curtain(p.length, p.waves ?? 0, p.span ?? 1, p.side ?? 0, seed)); break;
      case "cornrows": for (let i = 0; i < p.rows; i++) parts.push(...cornrow(-0.6 + (i / (p.rows - 1)) * 1.2, i, p.hang ?? 0.15)); break;
      case "crown": parts.push(...crown()); break;
      case "tufts": parts.push(...tufts(p.count, p.length, p.radius, p.seed, p.spiky ?? false, p.curl ?? false)); break;
      case "sideBraid": parts.push(...sideBraid(p.side, p.length)); break;
      case "twistTop": parts.push(...twistTop(p.count, p.length, p.radius, p.seed, p.phiMax, p.tip ?? 1)); break;
    }
  }
  if (!parts.length) return null;
  const merged = mergeGeometries(parts, false);
  if (!merged) return null;
  merged.computeBoundingSphere();
  return merged;
}

/** The skin-toned skull that closes the head once its authored hair is cut away (operator-skin-shader.ts): a shell just under
 * the skull surface, so it only shows where the hair was, reaching past the hairline under the face's own skin. */
export function scalpGeometry(skull: Skull): THREE.BufferGeometry {
  SK = skull;
  // past the hairline in front (under the forehead's own skin), right down to the nape behind, where the cut hair leaves nothing
  // just past the hairline in front (the forehead's own skin takes over; any further and it shows as a band on narrower
  // heads), right down to the nape behind
  const g = shell(-0.005, (theta) => Math.min(0.88 * Math.PI, hairline(theta) + THREE.MathUtils.lerp(0.05, 0.8, (1 - Math.cos(theta)) / 2)), 1, 24, 40);
  g.deleteAttribute("color");
  g.deleteAttribute("uv");
  return g;
}

let strandTex: THREE.Texture | null = null;
/** A tiling strand texture (fine streaks along V) so caps and tails read as hair rather than a shell; null without a DOM. */
export function strandTexture(): THREE.Texture | null {
  if (strandTex) return strandTex;
  if (typeof document === "undefined") return null;
  const size = 256, canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#d2d2d2"; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const x = rand(i * 3.1) * size, w = 0.6 + rand(i * 5.3) * 1.6, l = 0.45 + rand(i * 7.7) * 0.6;
    ctx.strokeStyle = `rgba(${Math.round(l * 255)},${Math.round(l * 255)},${Math.round(l * 255)},0.55)`; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (rand(i) - 0.5) * 6, size); ctx.stroke();
  }
  strandTex = new THREE.CanvasTexture(canvas);
  strandTex.wrapS = strandTex.wrapT = THREE.RepeatWrapping;
  strandTex.repeat.set(6, 2);
  strandTex.colorSpace = THREE.SRGBColorSpace;
  return strandTex;
}

/** Binds built hair fully to one bone (the body's Head) so it rides along with the skinned head. */
export function bindHairToBone(geo: THREE.BufferGeometry, boneIndex: number, unit: number, headRest: THREE.Vector3): THREE.BufferGeometry {
  geo.scale(unit, unit, unit);
  geo.translate(headRest.x, headRest.y, headRest.z);
  const count = geo.getAttribute("position").count;
  const idx = new Uint16Array(count * 4), w = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { idx[i * 4] = boneIndex; w[i * 4] = 1; }
  geo.setAttribute("skinIndex", new THREE.BufferAttribute(idx, 4));
  geo.setAttribute("skinWeight", new THREE.BufferAttribute(w, 4));
  return geo;
}
