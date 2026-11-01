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

/** A lat/long shell over the skull: `lift` metres off it, down to `limit(theta)` (the hairline for hair), with a closed rim. */
function shell(lift: number, limit: (theta: number) => number, shade = 1, rows = 18, cols = 36): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    const theta = (j / cols) * Math.PI * 2;
    const phi = Math.min(limit(theta), (i / rows) * Math.PI);
    const p = onSkull(phi, theta, lift);
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

/** hair shell from the crown down to the hairline, no further than `phiMax` anywhere */
const cap = (phiMax: number, thick: number, shade = 1) => shell(thick, (theta) => Math.min(phiMax, hairline(theta)), shade);

/** a tube along a curve through `pts`, radius `r` (tapering to `rEnd` when given, in three sections) */
function strand(pts: THREE.Vector3[], r: number, seed: number, rEnd?: number): THREE.BufferGeometry[] {
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const shade = 0.82 + rand(seed) * 0.3;
  if (rEnd === undefined) return [part(new THREE.TubeGeometry(curve, 8, r, 5, false), shade)];
  const out: THREE.BufferGeometry[] = [];
  for (let s = 0; s < 3; s++) {
    const a = s / 3, b = (s + 1) / 3;
    const sub = new THREE.CatmullRomCurve3([curve.getPoint(a), curve.getPoint((a + b) / 2), curve.getPoint(b)], false, "centripetal");
    out.push(part(new THREE.TubeGeometry(sub, 4, THREE.MathUtils.lerp(r, rEnd, (s + 0.5) / 3), 6, false), shade));
  }
  return out;
}

/** a hanging loc/braid/twist from a scalp root: leaves outward, then falls under gravity with a little drift */
function hanging(root: THREE.Vector3, length: number, r: number, seed: number): THREE.BufferGeometry[] {
  const n = outward(root);
  // strands rooted towards the front sweep to the sides and back rather than falling over the face
  if (n.z > 0.15) { n.x += Math.sign(n.x || 1) * n.z * 0.9; n.z *= 0.15; n.normalize(); }
  const drift = (rand(seed + 1) - 0.5) * 0.04;
  const p1 = root.clone().add(n.clone().multiplyScalar(0.03)).add(new THREE.Vector3(0, -length * 0.15, 0));
  const p2 = root.clone().add(n.clone().multiplyScalar(0.03 + Math.abs(drift))).add(new THREE.Vector3(drift, -length * 0.6, -0.01));
  const p3 = root.clone().add(new THREE.Vector3(n.x * 0.025 + drift * 1.4, -length, n.z * 0.02 - 0.015));
  return strand([root, p1, p2, p3], r, seed);
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

/** a braid lying along the scalp from front to back at `theta` (mirrored over the crown), then falling behind */
function cornrow(theta: number, seed: number): THREE.BufferGeometry[] {
  const pts: THREE.Vector3[] = [];
  for (let s = 0; s <= 6; s++) {
    const t = s / 6;
    const th = t < 0.5 ? theta : Math.PI - theta;
    const phi = (hairline(th) - 0.08) * Math.abs(t * 2 - 1);
    pts.push(onSkull(Math.max(0.05, phi), th, 0.006));
  }
  const back = pts[pts.length - 1]!;
  pts.push(back.clone().add(new THREE.Vector3(0, -0.07, -0.03)), back.clone().add(new THREE.Vector3(0, -0.15, -0.035)));
  return strand(pts, 0.007, seed);
}

/** the geometry for a hairstyle on `skull`, or null for "as modelled" and bald */
export function hairGeometry(style: HairDef, skull: Skull = DEFAULT_SKULL): THREE.BufferGeometry | null {
  SK = skull;
  const parts: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  switch (style.kind) {
    case "authored": case "none": return null;
    case "buzz": parts.push(cap(0.6 * Math.PI, 0.002, 0.9)); break;
    case "cap": parts.push(cap(0.6 * Math.PI, 0.012)); break;
    case "undercut": parts.push(cap(0.38 * Math.PI, 0.016)); break;
    case "fringe": {
      parts.push(cap(0.56 * Math.PI, 0.012));
      parts.push(...strand([onSkull(0.36 * Math.PI, -0.6, 0.012), onSkull(0.4 * Math.PI, -0.15, 0.02), onSkull(0.44 * Math.PI, 0.35, 0.016)], 0.016, 3));
      break;
    }
    case "dreads": {
      parts.push(cap(0.6 * Math.PI, 0.008));
      roots(34, 11).forEach((r, i) => parts.push(...hanging(r, 0.24 + rand(i) * 0.1, 0.009, i)));
      break;
    }
    case "twists": {
      parts.push(cap(0.6 * Math.PI, 0.006));
      roots(60, 23).forEach((r, i) => parts.push(...hanging(r, 0.17 + rand(i) * 0.09, 0.0045, i)));
      break;
    }
    case "box-braids": {
      parts.push(cap(0.6 * Math.PI, 0.006));
      roots(48, 37).forEach((r, i) => parts.push(...hanging(r, 0.3 + rand(i) * 0.08, 0.0062, i)));
      break;
    }
    case "dreads-tied": {
      parts.push(cap(0.6 * Math.PI, 0.008));
      const gather = onSkull(0.56 * Math.PI, Math.PI, 0.03);
      roots(30, 17).forEach((r, i) => {
        // the loc runs along the skull's surface to the gather point: its midpoint is pushed back out onto the skull
        const midDir = outward(r.clone().add(gather).multiplyScalar(0.5));
        const mid = midDir.clone().multiplyScalar(SK.radiusAt(midDir) + 0.012).add(SK.centre);
        parts.push(...strand([r, mid, gather], 0.0085, i));
      });
      parts.push(tie(gather, new THREE.Vector3(0, 0.3, -1), 0.03));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const start = gather.clone().add(new THREE.Vector3(Math.cos(a) * 0.018, Math.sin(a) * 0.012, -0.01));
        parts.push(...strand([start, start.clone().add(new THREE.Vector3(Math.cos(a) * 0.01, -0.1, -0.02)), start.clone().add(new THREE.Vector3(Math.cos(a) * 0.015, -0.22, -0.01))], 0.0085, 50 + i));
      }
      break;
    }
    case "cornrows": {
      parts.push(cap(0.6 * Math.PI, 0.001, 0.85));
      for (let i = 0; i < 7; i++) parts.push(...cornrow(-0.6 + (i / 6) * 1.2, i));
      break;
    }
    case "ponytail-high": {
      parts.push(cap(0.6 * Math.PI, 0.01));
      const base = onSkull(0.3 * Math.PI, Math.PI, 0.012);
      parts.push(tie(base, new THREE.Vector3(0, 0.5, -1), 0.02));
      parts.push(...strand([base, base.clone().add(new THREE.Vector3(0, -0.03, -0.06)), base.clone().add(new THREE.Vector3(0.01, -0.14, -0.07)), base.clone().add(new THREE.Vector3(0.015, -0.26, -0.03))], 0.022, 5, 0.01));
      break;
    }
    case "ponytail-low": {
      parts.push(cap(0.6 * Math.PI, 0.01));
      const base = onSkull(0.62 * Math.PI, Math.PI, 0.01);
      parts.push(tie(base, new THREE.Vector3(0, -0.2, -1), 0.02));
      parts.push(...strand([base, base.clone().add(new THREE.Vector3(0, -0.06, -0.025)), base.clone().add(new THREE.Vector3(0.008, -0.16, -0.01)), base.clone().add(new THREE.Vector3(0.012, -0.25, 0.01))], 0.02, 7, 0.009));
      break;
    }
    case "bun": {
      parts.push(cap(0.6 * Math.PI, 0.01));
      const at = onSkull(0.38 * Math.PI, Math.PI, 0.028);
      const g = new THREE.SphereGeometry(0.038, 18, 12); g.scale(1, 0.9, 0.8); g.translate(at.x, at.y, at.z);
      parts.push(part(g, 0.95), tie(onSkull(0.38 * Math.PI, Math.PI, 0.004), new THREE.Vector3(0, 0.4, -1), 0.028));
      break;
    }
    case "topknot": {
      parts.push(cap(0.3 * Math.PI, 0.012));
      const at = onSkull(0.03 * Math.PI, Math.PI, 0.016);
      const g = new THREE.SphereGeometry(0.034, 18, 12); g.scale(1, 1.1, 1); g.translate(at.x, at.y, at.z);
      parts.push(part(g, 0.95), tie(onSkull(0.03 * Math.PI, Math.PI, 0.006), up, 0.022));
      break;
    }
    case "mohawk": {
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const th = t < 0.5 ? 0 : Math.PI;
        const phi = (hairline(th) - 0.06) * Math.abs(t * 2 - 1);
        const p = onSkull(Math.max(0.03, phi), th, 0.002);
        const n = outward(p);
        const h = 0.05 + 0.03 * Math.sin(t * Math.PI);
        const g = new THREE.BoxGeometry(0.022, h, 0.028);
        g.translate(0, h / 2, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, n));
        g.translate(p.x, p.y, p.z);
        parts.push(part(g, 0.9 + 0.1 * rand(i)));
      }
      break;
    }
    case "afro": {
      // a full round natural: the skull pushed out 3–4 cm with a rough surface, down to just past the hairline
      const g = shell(0, (theta) => Math.min(0.7 * Math.PI, hairline(theta) + 0.25), 1, 36, 72);
      const pos = g.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        const n = outward(v);
        v.add(n.multiplyScalar(0.032 + rand(i * 7) * 0.004));
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      parts.push(g);
      break;
    }
    case "long": {
      parts.push(cap(0.58 * Math.PI, 0.012));
      // a curtain down the back and sides from the crown to below the shoulders
      const sheet = new THREE.CylinderGeometry(SK.radii.x * 1.06, SK.radii.x * 1.2, 0.36, 20, 1, true, Math.PI * 0.55, Math.PI * 0.9);
      sheet.translate(SK.centre.x, SK.centre.y - 0.1, SK.centre.z);
      parts.push(part(sheet, 0.95));
      for (const side of [-1, 1]) {
        const top = onSkull(0.5 * Math.PI, side * 1.25, 0.012);
        parts.push(...strand([top, top.clone().add(new THREE.Vector3(side * 0.01, -0.12, 0.02)), top.clone().add(new THREE.Vector3(side * 0.01, -0.26, 0.03))], 0.02, side + 100, 0.012));
      }
      break;
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
  const g = shell(-0.002, (theta) => Math.min(0.88 * Math.PI, hairline(theta) + THREE.MathUtils.lerp(0.14, 0.8, (1 - Math.cos(theta)) / 2)), 1, 24, 40);
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
