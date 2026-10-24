/** Street furniture geometry (city-streets.ts props, drawn by CityStreets.tsx): each piece is built from bevelled boxes,
 * lathed profiles and 16-24 segment cylinders, merged into one vertex-coloured geometry so a whole kind draws in a single
 * instanced call. Local frame: ground at y = 0, +x along the kerb, +z toward the street. Metres. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { organicCanopy } from "./organic-geometry";

export type StreetPalette = {
  /** cast-iron frames, poles, signal housings */
  iron: string; wood: string; steel: string; bin: string; concrete: string; soil: string; hydrant: string; cap: string;
  /** reflective band on bollards, trim */
  band: string; glassFrame: string;
};
export const NEXUS_PALETTE: StreetPalette = { iron: "#2b3034", wood: "#8b5a35", steel: "#9aa1a8", bin: "#2f4a3c", concrete: "#9b978d", soil: "#3a2b20", hydrant: "#b3231f", cap: "#d9b43a", band: "#e8e2cf", glassFrame: "#3c4248" };
export const NEON_PALETTE: StreetPalette = { iron: "#1c1f27", wood: "#3b4250", steel: "#5e6878", bin: "#232833", concrete: "#3d424c", soil: "#1d1712", hydrant: "#d6a21e", cap: "#2a2d36", band: "#38e8ff", glassFrame: "#262a33" };

const col = new THREE.Color();
type Part = { g: THREE.BufferGeometry; color: string; m?: THREE.Matrix4 };
const T = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: [number, number, number] = [1, 1, 1]) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(...s));

/** bakes parts into one non-indexed geometry with position, normal and a per-part vertex colour */
export function bake(parts: readonly Part[]): THREE.BufferGeometry {
  const geos = parts.map(({ g, color, m }) => {
    if (!g.attributes["normal"]) g.computeVertexNormals(); // smooth, while still indexed
    const q = g.index ? g.toNonIndexed() : g.clone();
    if (m) q.applyMatrix4(m);
    for (const name of Object.keys(q.attributes)) if (name !== "position" && name !== "normal") q.deleteAttribute(name);
    const n = q.attributes["position"]!.count, c = new Float32Array(n * 3);
    col.set(color).convertSRGBToLinear();
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    q.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return q;
  });
  const out = mergeGeometries(geos, false)!;
  for (const g of geos) g.dispose();
  out.computeBoundingSphere();
  return out;
}

const rbox = (w: number, h: number, d: number, r = Math.min(w, h, d) * 0.3) => new RoundedBoxGeometry(w, h, d, 1, Math.min(r, Math.min(w, h, d) / 2 - 1e-4));
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 18) => new THREE.CylinderGeometry(rt, rb, h, seg);
const lathe = (prof: readonly [number, number][], seg = 16) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/** a park bench: four timber seat slats and two back slats on cast-iron end frames, 1.9 m long, seat at 0.45 m, facing +z */
export function benchGeometry(p: StreetPalette): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (const x of [-0.78, 0.78]) {
    parts.push({ g: box(0.07, 0.44, 0.07), color: p.iron, m: T(x, 0.22, 0.17) }, { g: box(0.07, 0.44, 0.07), color: p.iron, m: T(x, 0.22, -0.17) });
    parts.push({ g: box(0.07, 0.05, 0.5), color: p.iron, m: T(x, 0.42, -0.02) });
    parts.push({ g: box(0.06, 0.48, 0.06), color: p.iron, m: T(x, 0.68, -0.25, -0.18) });
    parts.push({ g: box(0.06, 0.05, 0.42), color: p.iron, m: T(x, 0.66, -0.02) }, { g: box(0.05, 0.22, 0.05), color: p.iron, m: T(x, 0.55, 0.17) });
    parts.push({ g: box(0.12, 0.03, 0.1), color: p.iron, m: T(x, 0.015, 0.17) }, { g: box(0.12, 0.03, 0.1), color: p.iron, m: T(x, 0.015, -0.17) });
  }
  for (let k = 0; k < 4; k++) parts.push({ g: rbox(1.86, 0.035, 0.095, 0.012), color: p.wood, m: T(0, 0.46, 0.17 - k * 0.11) });
  for (const y of [0.62, 0.76]) parts.push({ g: rbox(1.86, 0.095, 0.03, 0.012), color: p.wood, m: T(0, y, -0.26 - (y - 0.62) * 0.18, -0.18) });
  return bake(parts);
}

/** a litter bin: a lathed steel body with rolled rim, two hoops and a domed lid with a posting slot, 0.95 m tall */
export function binGeometry(p: StreetPalette): THREE.BufferGeometry {
  const body = lathe([[0.001, 0], [0.24, 0], [0.25, 0.02], [0.26, 0.1], [0.275, 0.8], [0.29, 0.82], [0.29, 0.85], [0.001, 0.85]]);
  const lid = lathe([[0.3, 0], [0.3, 0.03], [0.27, 0.06], [0.2, 0.1], [0.1, 0.12], [0.001, 0.125]]);
  return bake([
    { g: body, color: p.bin }, { g: lid, color: p.steel, m: T(0, 0.85, 0) },
    { g: new THREE.TorusGeometry(0.272, 0.014, 4, 18), color: p.steel, m: T(0, 0.3, 0, Math.PI / 2) },
    { g: new THREE.TorusGeometry(0.278, 0.014, 4, 18), color: p.steel, m: T(0, 0.6, 0, Math.PI / 2) },
    { g: rbox(0.26, 0.05, 0.08, 0.015), color: "#0d0f12", m: T(0, 0.92, 0.2, -0.5) },
    { g: cyl(0.16, 0.18, 0.04, 20), color: p.iron, m: T(0, 0.02, 0) },
  ]);
}

/** a steel bollard: a lathed post with a domed head, a base flange and a reflective band, 0.95 m tall */
export function bollardGeometry(p: StreetPalette): THREE.BufferGeometry {
  const post = lathe([[0.001, 0], [0.14, 0], [0.14, 0.05], [0.1, 0.07], [0.095, 0.8], [0.1, 0.82], [0.105, 0.86], [0.09, 0.91], [0.05, 0.945], [0.001, 0.95]], 12);
  return bake([{ g: post, color: p.iron }, { g: cyl(0.099, 0.099, 0.07, 12), color: p.band, m: T(0, 0.72, 0) }]);
}

/** a cast concrete planter, 1.5 x 0.66 m, with a soil top; the shrubs are planterFoliageGeometry */
export function planterGeometry(p: StreetPalette): THREE.BufferGeometry {
  return bake([
    { g: rbox(1.5, 0.62, 0.66, 0.05), color: p.concrete, m: T(0, 0.31, 0) },
    { g: rbox(1.56, 0.06, 0.72, 0.025), color: p.concrete, m: T(0, 0.63, 0) },
    { g: rbox(1.38, 0.05, 0.54, 0.02), color: p.soil, m: T(0, 0.62, 0) },
    { g: rbox(1.4, 0.05, 0.58, 0.02), color: "#2a2a28", m: T(0, 0.025, 0) },
  ]);
}
export function planterFoliageGeometry(): THREE.BufferGeometry {
  const a = organicCanopy(0.42, 0.75, 11), b = organicCanopy(0.36, 0.8, 23), c = organicCanopy(0.3, 0.9, 37);
  const g = bake([{ g: a, color: "#4f7a37", m: T(-0.4, 0.86, 0) }, { g: b, color: "#3f6a2f", m: T(0.12, 0.84, 0.04) }, { g: c, color: "#5a8640", m: T(0.5, 0.82, -0.03) }]);
  a.dispose(); b.dispose(); c.dispose();
  return g;
}

/** a fire hydrant: flanged base, barrel, bonnet, two hose outlets and a pumper nozzle facing the street, 0.8 m tall */
export function hydrantGeometry(p: StreetPalette): THREE.BufferGeometry {
  const barrel = lathe([[0.001, 0], [0.17, 0], [0.17, 0.05], [0.13, 0.07], [0.12, 0.1], [0.115, 0.5], [0.13, 0.52], [0.14, 0.56], [0.12, 0.6], [0.09, 0.68], [0.04, 0.72], [0.001, 0.73]], 14);
  return bake([
    { g: barrel, color: p.hydrant },
    { g: cyl(0.025, 0.03, 0.06, 6), color: p.cap, m: T(0, 0.76, 0) },
    { g: cyl(0.045, 0.045, 0.12, 10), color: p.hydrant, m: T(0.15, 0.4, 0, 0, 0, Math.PI / 2) },
    { g: cyl(0.045, 0.045, 0.12, 10), color: p.hydrant, m: T(-0.15, 0.4, 0, 0, 0, Math.PI / 2) },
    { g: cyl(0.055, 0.055, 0.03, 10), color: p.cap, m: T(0.215, 0.4, 0, 0, 0, Math.PI / 2) },
    { g: cyl(0.055, 0.055, 0.03, 10), color: p.cap, m: T(-0.215, 0.4, 0, 0, 0, Math.PI / 2) },
    { g: cyl(0.07, 0.07, 0.12, 16), color: p.hydrant, m: T(0, 0.34, 0.15, Math.PI / 2) },
    { g: cyl(0.08, 0.08, 0.035, 16), color: p.cap, m: T(0, 0.34, 0.215, Math.PI / 2) },
  ]);
}

/** a bus / tram shelter, 3.6 m long and 1.5 m deep, open toward the street: four posts, a cantilevered roof with fascia,
 * a bench and a kerb-side timetable post. Glass panes and the lit advert are separate meshes (shelterGlass/Ad). */
export function shelterGeometry(p: StreetPalette): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (const x of [-1.75, 1.75]) for (const z of [-0.66, 0.5]) parts.push({ g: rbox(0.09, 2.5, 0.09, 0.02), color: p.glassFrame, m: T(x, 1.25, z) });
  parts.push({ g: rbox(3.86, 0.1, 1.72, 0.03), color: p.glassFrame, m: T(0, 2.56, -0.04, 0.04) });
  parts.push({ g: rbox(3.9, 0.24, 0.06, 0.02), color: p.steel, m: T(0, 2.5, 0.82) });
  for (const z of [-0.66]) parts.push({ g: rbox(3.5, 0.06, 0.06, 0.02), color: p.glassFrame, m: T(0, 0.2, z) }, { g: rbox(3.5, 0.06, 0.06, 0.02), color: p.glassFrame, m: T(0, 2.3, z) });
  parts.push({ g: rbox(2.4, 0.04, 0.34, 0.015), color: p.wood, m: T(-0.25, 0.47, -0.42) });
  for (const x of [-1.25, 0.75]) parts.push({ g: rbox(0.05, 0.45, 0.3, 0.015), color: p.iron, m: T(x, 0.23, -0.44) });
  parts.push({ g: cyl(0.04, 0.04, 2.6, 12), color: p.steel, m: T(1.55, 1.3, 1.05) }, { g: rbox(0.36, 0.48, 0.05, 0.015), color: p.cap, m: T(1.55, 2.3, 1.05) });
  return bake(parts);
}
export function shelterGlassGeometry(): THREE.BufferGeometry {
  return bake([
    { g: new THREE.BoxGeometry(3.42, 2.06, 0.02), color: "#ffffff", m: T(0, 1.25, -0.66) },
    { g: new THREE.BoxGeometry(0.02, 2.06, 1.08), color: "#ffffff", m: T(-1.75, 1.25, -0.08) },
  ]);
}
export function shelterAdGeometry(): THREE.BufferGeometry {
  return bake([{ g: new THREE.BoxGeometry(0.1, 1.85, 1.04), color: "#ffffff", m: T(1.75, 1.2, -0.08) }]);
}

/** a traffic-signal pole (5.8 m, with a pedestrian head at 2.7 m); the mast arm is signalMastGeometry, unit length along +x */
export function signalPoleGeometry(p: StreetPalette): THREE.BufferGeometry {
  return bake([
    { g: cyl(0.085, 0.11, 5.8, 14), color: p.iron, m: T(0, 2.9, 0) },
    { g: cyl(0.2, 0.22, 0.12, 18), color: p.iron, m: T(0, 0.06, 0) },
    { g: cyl(0.12, 0.12, 0.3, 18), color: p.iron, m: T(0, 0.27, 0) },
    { g: rbox(0.3, 0.42, 0.22, 0.03), color: p.iron, m: T(0, 2.7, 0.18) },
    { g: rbox(0.22, 0.14, 0.02, 0.005), color: "#f2f2f2", m: T(0, 2.76, 0.295) },
    { g: rbox(0.22, 0.14, 0.02, 0.005), color: "#d9541e", m: T(0, 2.6, 0.295) },
    { g: rbox(0.12, 0.2, 0.1, 0.02), color: p.cap, m: T(0, 1.15, 0.12) },
  ]);
}
export function signalMastGeometry(p: StreetPalette): THREE.BufferGeometry {
  return bake([{ g: cyl(0.055, 0.07, 1, 14), color: p.iron, m: T(0.5, 0, 0, 0, 0, Math.PI / 2) }]);
}
/** the hanging three-lamp head (housing, backplate and visors); the lit lens is its own instanced disc */
export function signalHeadGeometry(p: StreetPalette): THREE.BufferGeometry {
  const parts: Part[] = [{ g: rbox(0.34, 1.0, 0.26, 0.04), color: p.iron }, { g: rbox(0.52, 1.18, 0.03, 0.01), color: "#111317", m: T(0, 0, -0.14) }, { g: cyl(0.03, 0.03, 0.3, 8), color: p.iron, m: T(0, 0.62, 0) }];
  for (const y of [0.32, 0, -0.32]) {
    parts.push({ g: new THREE.CylinderGeometry(0.135, 0.135, 0.18, 10, 1, true, -Math.PI / 2, Math.PI), color: p.iron, m: T(0, y + 0.03, 0.2, Math.PI / 2) });
    parts.push({ g: new THREE.CircleGeometry(0.1, 14), color: "#1a1c20", m: T(0, y, 0.132) });
  }
  return bake(parts);
}

/** a street-name sign post, 3.2 m; the two name blades are drawn from a text atlas by CityStreets.tsx */
export function signPostGeometry(p: StreetPalette): THREE.BufferGeometry {
  return bake([
    { g: cyl(0.045, 0.05, 3.2, 14), color: p.steel, m: T(0, 1.6, 0) },
    { g: new THREE.SphereGeometry(0.06, 12, 8), color: p.steel, m: T(0, 3.24, 0) },
    { g: cyl(0.09, 0.1, 0.06, 14), color: p.iron, m: T(0, 0.03, 0) },
  ]);
}
