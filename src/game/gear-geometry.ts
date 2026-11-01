/**
 * Face and head accessories (operator-styling.ts ACCESSORIES / HEADGEAR): glasses, shades, a cyber eyepiece, an earpiece;
 * beanies, a cap, a bandana, a headband. Built in head space on the fitted skull like hair (hair-geometry.ts) and bound to the
 * Head bone by operator-head.ts. Each piece comes with its own material description, so a lens can be glass and an LED can glow.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DEFAULT_SKULL, hairline, type Skull } from "./hair-geometry.ts";

export type GearMaterial = { color: string; roughness?: number; metalness?: number; opacity?: number; emissive?: string; emissiveIntensity?: number };
export type GearPiece = { name: string; geometry: THREE.BufferGeometry; material: GearMaterial };

const prep = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") n.deleteAttribute(k); if (!n.getAttribute("uv")) n.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n.getAttribute("position").count * 2), 2)); return n; };
const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts.map(prep), false)!;

/** a rounded-rectangle lens frame (torus squashed to a rounded rect) */
function frame(cx: number, cy: number, cz: number, w: number, h: number, tube: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, w, h, 0, Math.PI * 2, false, 0);
  const pts = shape.getPoints(24).map((p) => new THREE.Vector3(p.x, p.y, 0));
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 32, tube, 6, true);
  g.translate(cx, cy, cz);
  return g;
}
function lens(cx: number, cy: number, cz: number, w: number, h: number): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(1, 24); g.scale(w, h, 1); g.translate(cx, cy, cz);
  return g;
}
/** a temple arm from the frame's outer edge back to the ear */
function arm(side: number, y: number): THREE.BufferGeometry {
  const pts = [new THREE.Vector3(side * 0.058, y, 0.08), new THREE.Vector3(side * 0.072, y, 0.04), new THREE.Vector3(side * 0.074, y - 0.004, -0.012)];
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.0018, 5, false);
}

/** The pieces for an accessory id (empty for "none"). Eyes sit at (±0.03, 0.068, 0.078) in head space. */
export function accessoryPieces(id: string, skull: Skull = DEFAULT_SKULL): GearPiece[] {
  void skull;
  switch (id) {
    case "glasses": return [
      { name: "GearFrame", geometry: merge([frame(0.03, 0.068, 0.084, 0.022, 0.014, 0.0014), frame(-0.03, 0.068, 0.084, 0.022, 0.014, 0.0014), new THREE.BoxGeometry(0.016, 0.003, 0.003).translate(0, 0.072, 0.086), arm(1, 0.07), arm(-1, 0.07)]), material: { color: "#1a1d22", roughness: 0.5, metalness: 0.6 } },
      { name: "GearLens", geometry: merge([lens(0.03, 0.068, 0.0835, 0.021, 0.013), lens(-0.03, 0.068, 0.0835, 0.021, 0.013)]), material: { color: "#cfe6ff", roughness: 0.1, metalness: 0.2, opacity: 0.22 } },
    ];
    case "shades": {
      // one wrapped visor-shaped pair: two lenses joined, curved back at the sides
      const l = new THREE.CylinderGeometry(0.082, 0.082, 0.026, 28, 1, true, -0.95, 1.9);
      l.rotateX(0); l.translate(0, 0.068, 0.004);
      return [
        { name: "GearFrame", geometry: merge([new THREE.BoxGeometry(0.014, 0.004, 0.004).translate(0, 0.07, 0.088), arm(1, 0.07), arm(-1, 0.07)]), material: { color: "#111316", roughness: 0.4, metalness: 0.6 } },
        { name: "GearLens", geometry: merge([l]), material: { color: "#0b0d12", roughness: 0.15, metalness: 0.4, opacity: 0.9 } },
      ];
    }
    case "eyepiece": return [
      { name: "GearFrame", geometry: merge([new THREE.BoxGeometry(0.03, 0.012, 0.006).translate(-0.03, 0.068, 0.084), new THREE.BoxGeometry(0.004, 0.004, 0.11).translate(-0.072, 0.072, 0.03), new THREE.BoxGeometry(0.012, 0.016, 0.016).translate(-0.078, 0.07, -0.02)]), material: { color: "#23262c", roughness: 0.45, metalness: 0.7 } },
      { name: "GearGlow", geometry: merge([new THREE.BoxGeometry(0.024, 0.006, 0.002).translate(-0.03, 0.068, 0.0875)]), material: { color: "#41e6ff", emissive: "#41e6ff", emissiveIntensity: 1.6, roughness: 0.3 } },
    ];
    case "earpiece": return [
      { name: "GearFrame", geometry: merge([new THREE.CapsuleGeometry(0.006, 0.014, 4, 10).rotateZ(Math.PI / 2).translate(0.075, 0.066, -0.012)]), material: { color: "#1c1f24", roughness: 0.5, metalness: 0.6 } },
      { name: "GearGlow", geometry: merge([new THREE.SphereGeometry(0.0025, 8, 6).translate(0.084, 0.066, -0.012)]), material: { color: "#59ff7a", emissive: "#59ff7a", emissiveIntensity: 2, roughness: 0.3 } },
    ];
    default: return [];
  }
}

/** a lat/long shell over the skull at `lift`, from `phiMin` down to `limit(theta)` */
function shell(skull: Skull, lift: number, phiMin: number, limit: (theta: number) => number, rows = 18, cols = 40): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    const theta = (j / cols) * Math.PI * 2;
    const phi = phiMin + Math.min(limit(theta) - phiMin, (i / rows) * (Math.PI - phiMin));
    const dir = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
    const p = dir.clone().multiplyScalar(skull.radiusAt(dir) + lift).add(skull.centre);
    pos.push(p.x, p.y, p.z); uv.push(j / cols, i / rows);
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const a = i * (cols + 1) + j, b = a + cols + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** a band round the head between two polar angles */
const band = (skull: Skull, lift: number, phiA: number, phiB: (theta: number) => number) => shell(skull, lift, phiA, phiB, 4, 40);

/** The pieces for a headgear id (empty for "none"). `hairLift` is how far the hair under it stands off the skull. */
export function headgearPieces(id: string, skull: Skull = DEFAULT_SKULL, hairLift = 0.012): GearPiece[] {
  const lift = hairLift + 0.004;
  switch (id) {
    case "beanie": case "beanie-red": {
      // down over the ears and the brow, with a rolled cuff
      const dome = shell(skull, lift, 0, (theta) => Math.min(0.72 * Math.PI, hairline(theta) + 0.2), 20, 40);
      const cuff = band(skull, lift + 0.006, 0.5 * Math.PI, (theta) => Math.min(0.72 * Math.PI, hairline(theta) + 0.2));
      return [{ name: "GearCloth", geometry: merge([dome, cuff]), material: { color: id === "beanie-red" ? "#8a1f1f" : "#2a2d33", roughness: 0.95 } }];
    }
    case "cap": {
      const dome = shell(skull, lift, 0, (theta) => Math.min(0.56 * Math.PI, hairline(theta) + 0.08), 18, 40);
      // the brim: a flat half-ellipse in front, just above the hairline
      const brimShape = new THREE.Shape(); brimShape.absellipse(0, 0, 0.08, 0.075, -Math.PI * 0.05, Math.PI * 1.1, false, 0);
      const brim = new THREE.ShapeGeometry(brimShape, 24);
      brim.rotateX(Math.PI / 2 - 0.25); // the ellipse's +Y half swings forward (+Z) and tilts down a little
      const front = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), hairline(0) - 0.06);
      const at = front.clone().multiplyScalar(skull.radiusAt(front) + lift).add(skull.centre);
      brim.translate(at.x, at.y + 0.004, at.z - 0.02);
      const brim2 = brim.clone(); brim2.scale(1, -1, 1); // both faces
      return [{ name: "GearCloth", geometry: merge([dome, brim, brim2]), material: { color: "#23272b", roughness: 0.9 } }];
    }
    case "bandana": {
      const wrap = band(skull, lift, 0.28 * Math.PI, (theta) => Math.min(0.5 * Math.PI, hairline(theta) + 0.02));
      const knotDir = new THREE.Vector3(0, Math.cos(0.5 * Math.PI), -Math.sin(0.5 * Math.PI));
      const k = knotDir.clone().multiplyScalar(skull.radiusAt(knotDir) + lift + 0.01).add(skull.centre);
      const knot = new THREE.SphereGeometry(0.012, 10, 8).translate(k.x, k.y, k.z);
      const tailA = new THREE.ConeGeometry(0.008, 0.06, 6).rotateX(Math.PI * 0.75).translate(k.x + 0.012, k.y - 0.03, k.z - 0.02);
      const tailB = new THREE.ConeGeometry(0.008, 0.055, 6).rotateX(Math.PI * 0.75).translate(k.x - 0.014, k.y - 0.028, k.z - 0.018);
      return [{ name: "GearCloth", geometry: merge([wrap, knot, tailA, tailB]), material: { color: "#5a1d1d", roughness: 0.95 } }];
    }
    case "headband": {
      const wrap = band(skull, lift, 0.36 * Math.PI, (theta) => Math.min(0.46 * Math.PI, hairline(theta) + 0.03));
      return [{ name: "GearCloth", geometry: merge([wrap]), material: { color: "#1f2a30", roughness: 0.9 } }];
    }
    default: return [];
  }
}
