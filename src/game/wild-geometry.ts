/** Swamp and volcanic dressing shapes (SwampDressing, EmberPeaks): a weathered fallen log, a mushroom stem and gilled
 * cap, a veined lily pad with a lotus bloom, a slatted boardwalk section, a chamfered basalt column and a volcanic
 * glass shard. Each keeps the unit footprint of the primitive it replaced, so the instancing placement is unchanged. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { barkTrunk } from "./organic-geometry";

const clean = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k); return n; };
const h1 = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (a: number, f: number, seed: number) => Math.sin(a * f + seed) * 0.5 + Math.sin(a * f * 2.3 - seed * 1.7) * 0.3;

/** fallen log, unit like CylinderGeometry(1, 1, 1) (axis Y, centred): bark ridges, a gentle bow, a split, jagged
 * broken ends (no branch stubs: the log is instanced with a long Y scale, which would stretch them into spikes) */
export function fallenLog(seed = 1): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(1, 1, 1, 14, 10, false);
  const p = g.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
    const a = Math.atan2(z, x), end = Math.abs(y) > 0.499;
    let k = 1 + 0.06 * Math.abs(Math.sin(a * 7 + y * 3)) + 0.05 * smooth(y * 6, 1, seed) - (a > 0.3 && a < 0.6 ? 0.1 : 0);
    let yy = y;
    if (end && r > 0.01) yy = y - Math.sign(y) * 0.04 * (0.5 + h1(Math.round(a * 4) + seed + (y > 0 ? 9 : 0)));
    if (end && r <= 0.01) { k = 1; yy = y - Math.sign(y) * 0.02; }
    p.setXYZ(i, x * k + 0.05 * Math.cos(y * Math.PI), yy, z * k);
  }
  g.computeVertexNormals();
  return clean(g);
}

/** mushroom stem, unit like CylinderGeometry(0.8, 1, 1): slightly curved, a bulbous foot and a ring under the cap */
export function mushroomStem(): THREE.BufferGeometry {
  const pr = [[0.001, -0.5], [0.95, -0.5], [1.05, -0.42], [0.85, -0.3], [0.72, 0], [0.68, 0.3], [0.9, 0.36], [0.7, 0.4], [0.66, 0.5], [0.001, 0.5]];
  const g = new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r, y)), 10);
  const p = g.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.35 * (y + 0.5) * (y + 0.5)); }
  g.computeVertexNormals();
  return clean(g);
}

/** mushroom cap, unit like the hemisphere SphereGeometry(1, .., 0, PI/2) (base at y = 0): a domed cap with a curled
 * rim and a gilled underside */
export function mushroomCap(): THREE.BufferGeometry {
  const pr: [number, number][] = [[0.001, 0.92], [0.35, 0.88], [0.65, 0.72], [0.88, 0.46], [1.0, 0.18], [1.02, 0.02], [0.96, -0.04], [0.85, 0.06], [0.5, 0.12], [0.2, 0.14], [0.001, 0.15]];
  const g = new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r, y)), 18);
  const p = g.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.06 * Math.sin(a * 5) + 0.03 * Math.sin(a * 11); p.setXYZ(i, x * k, y * (1 + 0.08 * Math.sin(a * 3)), z * k); }
  g.computeVertexNormals();
  return clean(g);
}

/** lily pad, unit radius, lying in XY (rotate -PI/2 about X like CircleGeometry): notched, edge cupped up, radial veins */
export function lilyPad(): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(1, 28, 0.32, Math.PI * 2 - 0.32);
  const pos: number[] = [];
  // re-tessellate with rings so the edge can cup
  const R = 4, S = 28, a0 = 0.32, span = Math.PI * 2 - 0.32;
  const v = (ri: number, si: number): [number, number, number] => { const r = ri / R, a = a0 + (si / S) * span; const vein = 0.012 * Math.abs(Math.sin(si * 1.5)); return [Math.cos(a) * r, Math.sin(a) * r, 0.06 * r * r * r - vein * r]; };
  for (let ri = 0; ri < R; ri++) for (let si = 0; si < S; si++) { const a = v(ri, si), b = v(ri + 1, si), c = v(ri + 1, si + 1), d = v(ri, si + 1); pos.push(...a, ...b, ...c, ...a, ...c, ...d); }
  g.dispose();
  const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.computeVertexNormals();
  return out;
}

/** lotus bloom, unit radius ~1, base at y = 0: two rings of pointed, cupped petals */
export function lotusBloom(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const [n, tilt, len, off] of [[8, 0.9, 1, 0], [6, 0.45, 0.8, 0.4]] as const) for (let i = 0; i < n; i++) {
    const petal = new THREE.SphereGeometry(0.5, 6, 4).scale(0.32, 0.12, len).translate(0, 0, len * 0.5).rotateX(-tilt).rotateY((i / n) * Math.PI * 2 + off);
    parts.push(petal);
  }
  parts.push(new THREE.SphereGeometry(0.18, 6, 4).translate(0, 0.12, 0));
  return mergeGeometries(parts.map(clean))!;
}

/** boardwalk section, unit footprint like BoxGeometry(1,1,1): five planks with gaps on two stringers, ends uneven */
export function boardwalkSection(seed = 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) { const w = 0.17, z = -0.4 + i * 0.2, dx = 0.04 * (h1(seed + i) - 0.5); parts.push(new THREE.BoxGeometry(1 - 0.06 * h1(seed * 3 + i), 0.8, w).translate(dx, 0.1, z)); }
  for (const x of [-0.36, 0.36]) parts.push(new THREE.BoxGeometry(0.06, 0.9, 1).translate(x, -0.5, 0));
  return mergeGeometries(parts.map(clean))!;
}

/** basalt column, unit like CylinderGeometry(0.8, 0.85, 1, 6): a hexagonal prism with an irregular, chamfered,
 * slightly tilted top and cooling cracks across the shaft */
export function basaltColumn(seed = 1): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.8, 0.85, 1, 6, 6).toNonIndexed();
  const p = g.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
    const band = Math.round((y + 0.5) * 6), crack = band > 0 && band < 6 && Math.abs((y + 0.5) * 6 - band) < 0.01 ? 0.94 : 1;
    const top = y > 0.49 ? (r > 0.01 ? -0.015 : 0) + 0.03 * x : 0;
    const k = (y > 0.49 && r > 0.01 ? 0.96 : 1) * crack * (1 + 0.03 * (h1(band + seed) - 0.5));
    p.setXYZ(i, x * k, y + top, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** volcanic glass, unit like ConeGeometry(0.9, 1, 5): a cluster of a main blade and two smaller conchoidal shards */
export function obsidianShard(seed = 1): THREE.BufferGeometry {
  const blade = (r: number, h: number, sides: number, s: number) => {
    const g = new THREE.ConeGeometry(r, h, sides, 3).toNonIndexed(), p = g.attributes["position"] as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x); const k = 0.75 + 0.5 * h1(Math.round(a * 3) + s) - 0.12 * Math.abs(Math.sin(y * 9 + s)); p.setXYZ(i, x * k, y, z * k * 0.7); }
    g.computeVertexNormals(); return g;
  };
  return mergeGeometries([
    clean(blade(0.9, 1, 5, seed)),
    clean(blade(0.45, 0.55, 4, seed + 3).rotateZ(0.5).translate(0.55, -0.22, 0.1)),
    clean(blade(0.35, 0.4, 4, seed + 7).rotateX(-0.6).translate(-0.3, -0.3, 0.45)),
  ])!;
}

/** a dead swamp snag in metres, centred like CylinderGeometry(0.15, 0.5, 8) (y -4..4): furrowed bark trunk with a
 * buttressed foot, a jagged broken crown and three bare limbs reaching up and out. Keeps uv (the bark map uses it). */
export function deadSnag(seed = 1): THREE.BufferGeometry {
  const trunk = barkTrunk(seed, 0.16, 0.5, 0.6).scale(1, 8, 1);
  const p = trunk.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 3.6) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y - 0.9 * h1(Math.round(a * 3.2) + seed * 7)); } }
  trunk.computeVertexNormals();
  const limbs = [[1.2, 0.4, 1.6], [2.5, 2.4, 1.2], [0.3, 4.1, 1.0]].map(([y, a, len], i) => {
    const dir = new THREE.Vector3(Math.cos(a!), 1.1 - i * 0.2, Math.sin(a!)).normalize();
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, y!, 0), new THREE.Vector3(dir.x * len! * 0.5, y! + dir.y * len! * 0.4, dir.z * len! * 0.5), new THREE.Vector3(dir.x * len!, y! + dir.y * len! * 0.9, dir.z * len!));
    return new THREE.TubeGeometry(c, 6, 0.07 - i * 0.012, 5, false);
  });
  const keep = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") n.deleteAttribute(k); return n; };
  return mergeGeometries([keep(trunk), ...limbs.map(keep)])!;
}
