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

/** A lumpy, weathered boulder — a subdivided icosahedron with noise displacement instead of
 * a perfectly faceted platonic solid. `detail` >=1 gives enough vertices for the noise to read
 * as rock texture rather than just a dented ball. */
export function organicRock(radius: number, seed: number, detail = 1, amplitude = radius * 0.24): THREE.BufferGeometry {
  return organicDeform(new THREE.IcosahedronGeometry(radius, detail), seed, amplitude);
}

/** An irregular foliage clump for tree canopies — a squashed, noise-displaced icosahedron
 * instead of a clean cone, so a treeline reads as leaf mass rather than stacked party hats. */
export function organicCanopy(radiusXZ: number, heightScale: number, seed: number, amplitude = radiusXZ * 0.3): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radiusXZ, 1);
  geo.scale(1, heightScale, 1);
  return organicDeform(geo, seed, amplitude, 1.1);
}
