/**
 * Deterministic, dependency-free organic shape deformation.
 *
 * Two attempts at sourcing real CC0 tree/rock GLB models for the world-dressing pass
 * (Poly Haven PBR rocks, then a "nature-kit" GitHub pack) both turned out to point at
 * unreachable or nonexistent CDN paths and had to be ripped back out after causing a
 * black-screen regression — see AGENTS.md's model-URL rule and roadmap.md. Rather than
 * gamble on a third external source, this file fixes the "boxy" complaint from inside:
 * it takes the same cheap platonic-solid geometry Terrain.tsx already instances and
 * displaces its vertices with a seeded pseudo-noise field, turning a perfect icosahedron
 * or cone into a lumpy, weathered rock or an irregular, non-traffic-cone canopy. Pure
 * three.js math, computed once per shared <Instances> geometry — no network request, so
 * it can never reintroduce the loading failures above.
 */
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Cheap, deterministic 3D pseudo-noise (sum of a few off-axis sine waves). Not real Perlin/
 * simplex noise, but smooth and seed-stable, which is all a one-off vertex displacement needs. */
function noise3(x: number, y: number, z: number, seed: number): number {
  const s = seed * 12.9898 + 1;
  let n = 0;
  n += Math.sin(x * 1.7 + s) * Math.cos(y * 1.3 - s * 0.7) * 0.5;
  n += Math.sin(y * 2.3 - s * 1.9) * Math.cos(z * 1.9 + s * 0.4) * 0.3;
  n += Math.sin(z * 3.1 + s * 0.6) * Math.cos(x * 2.6 - s * 1.1) * 0.2;
  return n; // roughly [-1, 1]
}

/** Displaces every vertex of a geometry outward/inward along its own position vector
 * (treating it as roughly convex/star-shaped around the origin) by the noise field above,
 * then recomputes normals so lighting reads correctly on the new, irregular surface. */
export function organicDeform(geometry: THREE.BufferGeometry, seed: number, amplitude: number, frequency = 0.9): THREE.BufferGeometry {
  const pos = geometry.attributes["position"] as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise3(v.x * frequency, v.y * frequency, v.z * frequency, seed);
    const len = v.length() || 1;
    v.multiplyScalar(1 + (n * amplitude) / len);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/* ---------------- rocks ---------------- */

/** seeded 3D value noise, smooth (quintic fade), roughly [-1, 1] */
function hash3(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295 * 2 - 1;
}
function vnoise(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const f = (t: number) => t * t * t * (t * (t * 6 - 15) + 10), u = f(xf), v = f(yf), w = f(zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm3(x: number, y: number, z: number, seed: number, oct: number): number {
  let a = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { n += vnoise(x * f, y * f, z * f, seed + o * 17) * a; a *= 0.5; f *= 2.03; }
  return n;
}

/** A weathered boulder: a finely subdivided sphere shaped by layered and ridged noise, split by a few fracture planes
 * (the flat faces real broken rock has), lightly terraced into strata, with a flattened base it sits on — smooth
 * shaded, so it reads as stone rather than a faceted low-poly gem. Triangle count scales with size (pebbles stay
 * cheap). `detail` adds subdivision; `amplitude` is how far the surface wanders (default about a quarter radius). */
export function organicRock(radius: number, seed: number, detail = 1, amplitude = radius * 0.24): THREE.BufferGeometry {
  const sub = (radius < 0.8 ? 4 : radius < 1.5 ? 7 : 10) + Math.max(0, detail - 1) * 2;
  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(radius, sub);
  geo.deleteAttribute("normal"); geo.deleteAttribute("uv");
  geo = mergeVertices(geo);
  const pos = geo.attributes["position"] as THREE.BufferAttribute;
  // fracture planes: 3 random cuts on the upper half and sides
  const planes = Array.from({ length: 3 }, (_, k) => {
    const a = (hash3(k, 1, 2, seed) * 0.5 + 0.5) * Math.PI * 2, e = (hash3(k, 3, 4, seed) * 0.5 + 0.5) * 1.1 - 0.2;
    return { n: new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)), o: radius * (0.55 + (hash3(k, 5, 6, seed) * 0.5 + 0.5) * 0.3) };
  });
  const v = new THREE.Vector3(), dir = new THREE.Vector3();
  const amp = amplitude / Math.max(0.001, radius), strata = 2.2 + (hash3(9, 9, 9, seed) * 0.5 + 0.5) * 2.5;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); dir.copy(v).normalize();
    const p = dir.clone().multiplyScalar(1.6);
    const big = fbm3(p.x, p.y, p.z, seed, 3), ridge = 1 - Math.abs(fbm3(p.x * 2.1 + 5, p.y * 2.1, p.z * 2.1 - 3, seed + 3, 3) * 1.6);
    const fine = fbm3(p.x * 6, p.y * 6, p.z * 6, seed + 9, 2);
    let r = radius * (1 + amp * (big * 1.1 + ridge * ridge * 0.35 - 0.15) + amp * 0.12 * fine);
    v.copy(dir).multiplyScalar(r);
    // strata: pull heights a little toward horizontal bands
    const band = Math.round((v.y / radius) * strata) / strata * radius;
    v.y += (band - v.y) * 0.18;
    for (const pl of planes) { const d = v.dot(pl.n) - pl.o; if (d > 0) v.addScaledVector(pl.n, -d * 0.92); }
    // sit flat: squash what is below the base line
    const base = -radius * 0.42;
    if (v.y < base) v.y = base + (v.y - base) * 0.15;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  // box-projected UVs for the rock detail maps (scale ~1 tile per 2 m)
  const nrm = geo.attributes["normal"] as THREE.BufferAttribute, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i)), x = pos.getX(i) * 0.5, y = pos.getY(i) * 0.5, z = pos.getZ(i) * 0.5;
    if (ny >= nx && ny >= nz) { uv[i * 2] = x; uv[i * 2 + 1] = z; } else if (nx >= nz) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  return geo;
}

/** An irregular foliage clump for tree canopies — a squashed, noise-displaced icosahedron
 * instead of a clean cone, so a treeline reads as leaf mass rather than stacked party hats. */
export function organicCanopy(radiusXZ: number, heightScale: number, seed: number, amplitude = radiusXZ * 0.3): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radiusXZ, 1);
  geo.scale(1, heightScale, 1);
  return organicDeform(geo, seed, amplitude, 1.1);
}

/* ---------------- small plants ---------------- */

/** A wildflower clump: a few thin stems (vertex-coloured green) each carrying a five-petal star head (white, with a
 * darker centre); `petalTint` (below) makes a per-instance colour tint only the petals. Replaces the old 6-segment "ball" flowers. */
export function flowerClump(seed: number): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const rnd = (k: number) => hash3(k, seed, 7, 1) * 0.5 + 0.5;
  const stems = 3 + Math.floor(rnd(1) * 3);
  for (let s = 0; s < stems; s++) {
    const a = rnd(10 + s) * Math.PI * 2, d = 0.05 + rnd(20 + s) * 0.22, h = 0.28 + rnd(30 + s) * 0.3;
    const bx = Math.cos(a) * d, bz = Math.sin(a) * d, tx = bx * 1.4, tz = bz * 1.4;
    // stem: a thin 3-sided prism
    const base = pos.length / 3;
    for (let k = 0; k < 3; k++) {
      const t = (k / 3) * Math.PI * 2, ox = Math.cos(t) * 0.012, oz = Math.sin(t) * 0.012;
      pos.push(bx + ox, 0, bz + oz, tx + ox, h, tz + oz); col.push(0.18, 0.32, 0.12, 0.25, 0.42, 0.16);
    }
    for (let k = 0; k < 3; k++) { const a0 = base + k * 2, a1 = base + ((k + 1) % 3) * 2; idx.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1); }
    // head: centre + 10-point star, tilted slightly
    const c = pos.length / 3, r = 0.06 + rnd(40 + s) * 0.05;
    pos.push(tx, h + 0.01, tz); col.push(0.5, 0.38, 0.12);
    for (let i = 0; i < 10; i++) {
      const b = (i / 10) * Math.PI * 2 + rnd(50 + s), rr = i % 2 ? r * 0.62 : r;
      pos.push(tx + Math.sin(b) * rr, h + (i % 2 ? 0.004 : -0.012), tz + Math.cos(b) * rr); col.push(1, 1, 1);
      idx.push(c, c + 1 + i, c + 1 + ((i + 1) % 10));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

/** A saguaro-style cactus: a ribbed column (12 ribs, rounded top) with one or two upturned arms, base at y = 0,
 * about 4.6 m tall at scale 1. Smooth shaded; the ribs carry the form instead of a capsule's plain tube. */
export function saguaro(seed: number): THREE.BufferGeometry {
  const rnd = (k: number) => hash3(k, seed, 3, 5) * 0.5 + 0.5;
  const column = (height: number, radius: number) => {
    const pts: THREE.Vector2[] = [];
    // straight ribbed body, then a domed crown: the last `radius` of height is a quarter circle
    const body = Math.max(0.1, height - radius);
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(radius * (1 - t * 0.06), t * body)); }
    for (let i = 1; i <= 8; i++) { const a = (i / 8) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(0.002, Math.cos(a) * radius * 0.94), body + Math.sin(a) * radius)); }
    const g = new THREE.LatheGeometry(pts, 36);
    const p = g.attributes["position"] as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.12 * Math.pow(Math.abs(Math.cos(a * 6)), 0.6) - 0.06; p.setX(i, x * k); p.setZ(i, z * k); }
    return g;
  };
  const parts: THREE.BufferGeometry[] = [column(4.6, 0.42)];
  const arms = 1 + (rnd(1) > 0.4 ? 1 : 0);
  for (let k = 0; k < arms; k++) {
    const a = rnd(2 + k) * Math.PI * 2 + k * Math.PI, y0 = 1.6 + rnd(5 + k) * 1.2, out = 0.75, up = 1.1 + rnd(8 + k) * 0.8;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.1, y0 - 0.25, 0), new THREE.Vector3(out + 0.3, y0 - 0.3, 0), new THREE.Vector3(out + 0.3, y0 + 0.25, 0));
    const elbow = new THREE.TubeGeometry(curve, 10, 0.26, 16, false);
    const riser = column(up, 0.27).translate(out + 0.3, y0 + 0.2, 0);
    parts.push(elbow.rotateY(a), riser.rotateY(a));
  }
  const merged = mergeGeometries(parts.map((g) => { g.deleteAttribute("uv"); return g.index ? g.toNonIndexed() : g; }))!;
  parts.forEach((g) => g.dispose());
  merged.deleteAttribute("normal");
  const g = mergeVertices(merged);
  g.computeVertexNormals();
  // simple planar UVs for the leaf detail map
  const p = g.attributes["position"] as THREE.BufferAttribute, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = Math.atan2(p.getZ(i), p.getX(i)) * 0.6; uv[i * 2 + 1] = p.getY(i) * 0.5; }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

/** onBeforeCompile hook for flowerClump materials: the instance colour tints only white (petal) vertices, so stems stay
 * green and centres stay dark whatever colour the flower is */
export function petalTint(shader: { vertexShader: string }) {
  shader.vertexShader = shader.vertexShader.replace("#include <color_vertex>", `
#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
  vColor = vec4(1.0);
#endif
#ifdef USE_COLOR
  vColor.rgb *= color.rgb;
#endif
#if defined( USE_COLOR ) && defined( USE_INSTANCING_COLOR )
  if (color.r > 0.9 && color.g > 0.9) vColor.rgb *= instanceColor.rgb;
#elif defined( USE_INSTANCING_COLOR )
  vColor.rgb *= instanceColor.rgb;
#endif
`);
}
