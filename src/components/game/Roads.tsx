import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { allRoadRibbons } from "@/game/road-ribbon";
import { LANES } from "@/game/lanes";
import { roadKind, type RoadKind } from "@/game/road-dressing";

/**
 * Supply-road surfaces (road-ribbon.ts): one draped strip per road with a procedural canvas texture — packed dirt, two
 * darker tyre ruts, a sparse grassy crown, gravel speckle and soft feathered edges that melt into the ground tint
 * terrain.ts already paints along the corridor. Trunk roads are asphalt with lane lines and gravel shoulders, mountain
 * routes gravel (road-dressing.ts roadKind); one draw call per road. If a canvas isn't available the roads keep the ground tint.
 */
function dirtTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const W = 128, H = 256;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(W, H);
  let seed = 1337;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // cheap tileable value noise along v so the ruts wander a little and wet patches come and go
  const wob = (v: number, f: number, ph: number) => Math.sin((v * f + ph) * Math.PI * 2) * 0.5 + Math.sin((v * f * 2 + ph * 1.7) * Math.PI * 2) * 0.25;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / (W - 1), v = y / H;
    let r = 92, gg = 82, b = 70; // packed, darker than loose sand or soil so the road reads in every region
    // tyre ruts: two worn tracks, darker and smoother, drifting slightly along the road
    for (const centre of [0.3, 0.7]) {
      const d = Math.abs(u - centre - wob(v, 1, centre * 3) * 0.02);
      const k = Math.max(0, 1 - d / 0.07);
      r -= 30 * k; gg -= 26 * k; b -= 20 * k;
    }
    // crown between the ruts and both shoulders carry sparse grass
    const crown = Math.max(0, 1 - Math.abs(u - 0.5) / 0.08), shoulder = Math.max(0, (Math.abs(u - 0.5) - 0.36) / 0.14);
    const grass = Math.max(crown * 0.55, shoulder) * (rnd() < 0.5 ? 1 : 0.3);
    r += (78 - r) * grass * 0.6; gg += (98 - gg) * grass * 0.6; b += (54 - b) * grass * 0.6;
    // gravel speckle and grain
    const n = rnd();
    if (n > 0.93) { r += 34; gg += 32; b += 28; } else if (n < 0.06) { r -= 22; gg -= 20; b -= 16; }
    const grain = (rnd() - 0.5) * 14;
    // a damp patch every so often
    const damp = Math.max(0, wob(v, 1, 0.3) - 0.45) * 0.6;
    const o = (y * W + x) * 4;
    img.data[o] = Math.max(0, Math.min(255, (r + grain) * (1 - damp * 0.35)));
    img.data[o + 1] = Math.max(0, Math.min(255, (gg + grain) * (1 - damp * 0.35)));
    img.data[o + 2] = Math.max(0, Math.min(255, (b + grain) * (1 - damp * 0.3)));
    // feathered edges, ragged so the verge doesn't read as a ruler line
    const edge = Math.min(u, 1 - u), rag = 0.07 + wob(v, 3, u < 0.5 ? 0.1 : 0.6) * 0.03;
    img.data[o + 3] = Math.round(255 * Math.min(1, Math.max(0, (edge - 0.01) / rag)));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** shared canvas → texture plumbing for the paved surfaces: (u across 0..1, v along one 7 m tile) → rgba */
function surfaceTexture(W: number, H: number, px: (u: number, v: number, rnd: () => number) => [number, number, number, number]): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); if (!g) return null;
  const img = g.createImageData(W, H);
  let seed = 7919; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, gg, b, a] = px(x / (W - 1), y / H, rnd), o = (y * W + x) * 4;
    img.data[o] = Math.max(0, Math.min(255, r)); img.data[o + 1] = Math.max(0, Math.min(255, gg)); img.data[o + 2] = Math.max(0, Math.min(255, b)); img.data[o + 3] = a;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const wobble = (v: number, f: number, ph: number) => Math.sin((v * f + ph) * Math.PI * 2) * 0.5 + Math.sin((v * f * 2 + ph * 1.7) * Math.PI * 2) * 0.25;

/** two-lane asphalt: dark aggregate with grain and tar patches, worn wheel paths, solid white edge lines, a dashed
 * centre line (3 m dash per 7 m tile), then a gravel shoulder that feathers into the verge */
function asphaltTexture() {
  return surfaceTexture(256, 512, (u, v, rnd) => {
    const edge = Math.min(u, 1 - u), shoulder = edge < 0.1;
    let r = 54, g = 56, b = 60;
    if (shoulder) { r = 96; g = 90; b = 80; }
    // wheel paths: two per lane, a touch smoother and darker
    for (const c of [0.22, 0.36, 0.64, 0.78]) { const k = Math.max(0, 1 - Math.abs(u - c) / 0.05); r -= 8 * k; g -= 8 * k; b -= 7 * k; }
    // sealed cracks and tar patches
    const patch = Math.max(0, wobble(v, 1, u * 2.3) - 0.62) * 2.2;
    r -= 14 * patch; g -= 14 * patch; b -= 12 * patch;
    // painted lines (slightly worn: speckled alpha in the paint)
    const wear = rnd() < 0.12 ? 0.45 : 1;
    const edgeLine = Math.abs(u - 0.12) < 0.012 || Math.abs(u - 0.88) < 0.012;
    const centre = Math.abs(u - 0.5) < 0.011 && v % 1 < 0.43;
    if (edgeLine || centre) { const w = centre ? [230, 196, 70] : [226, 228, 224]; r += (w[0]! - r) * wear; g += (w[1]! - g) * wear; b += (w[2]! - b) * wear; }
    // aggregate speckle
    const n = rnd();
    if (n > 0.94) { r += 26; g += 26; b += 26; } else if (n < 0.05) { r -= 14; g -= 14; b -= 14; }
    const grain = (rnd() - 0.5) * 10;
    const rag = 0.05 + wobble(v, 3, u < 0.5 ? 0.2 : 0.7) * 0.02;
    return [r + grain, g + grain, b + grain, Math.round(255 * Math.min(1, Math.max(0, (edge - 0.005) / rag)))];
  });
}

/** compacted gravel: grey-brown stones, a lighter crown, two faint tracks, no paint */
function gravelTexture() {
  return surfaceTexture(128, 256, (u, v, rnd) => {
    let r = 118, g = 110, b = 98;
    for (const c of [0.3, 0.7]) { const k = Math.max(0, 1 - Math.abs(u - c - wobble(v, 1, c * 3) * 0.015) / 0.08); r -= 16 * k; g -= 15 * k; b -= 12 * k; }
    const crown = Math.max(0, 1 - Math.abs(u - 0.5) / 0.1); r += 10 * crown; g += 9 * crown; b += 8 * crown;
    const n = rnd();
    if (n > 0.85) { const t = 22 + rnd() * 30; r += t; g += t; b += t * 0.9; } else if (n < 0.12) { r -= 26; g -= 25; b -= 22; }
    const grain = (rnd() - 0.5) * 16, edge = Math.min(u, 1 - u), rag = 0.07 + wobble(v, 3, u < 0.5 ? 0.4 : 0.9) * 0.03;
    return [r + grain, g + grain, b + grain, Math.round(255 * Math.min(1, Math.max(0, (edge - 0.01) / rag)))];
  });
}

const TEXTURE: Record<RoadKind, () => THREE.CanvasTexture | null> = { asphalt: asphaltTexture, gravel: gravelTexture, dirt: dirtTexture };
const ROUGH: Record<RoadKind, number> = { asphalt: 0.82, gravel: 0.97, dirt: 0.95 };

export function Roads() {
  const built = useMemo(() => {
    const kinds: RoadKind[] = ["asphalt", "gravel", "dirt"];
    const mats = new Map<RoadKind, { map: THREE.CanvasTexture; material: THREE.MeshStandardMaterial }>();
    for (const k of kinds) {
      const map = TEXTURE[k]();
      if (!map) continue;
      const material = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: ROUGH[k], metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      // past ~600 m the terrain is drawn at 12 m spacing (up to 6 m off the true height), so a strip that follows the true
      // ground dives under the coarse hills or floats over the dips: fade the road out there, the corridor tint carries on
      material.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n  float roadFar = smoothstep(520.0, 600.0, length(vViewPosition));\n  if (roadFar >= 1.0) discard;");
        sh.fragmentShader = sh.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n  gl_FragColor.a *= 1.0 - roadFar;");
      };
      mats.set(k, { map, material });
    }
    if (!mats.size) return null;
    const meshes = allRoadRibbons().map((r, i) => ({ r, i, kind: roadKind(LANES[i]!) })).filter(({ r, kind }) => r.indices.length && mats.has(kind)).map(({ r, i, kind }) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(r.positions, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(r.uvs, 2));
      g.setIndex(new THREE.BufferAttribute(r.indices, 1));
      g.computeVertexNormals();
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mats.get(kind)!.material);
      m.name = `road:${kind}:${i}`; m.receiveShadow = true; m.renderOrder = 1; m.matrixAutoUpdate = false;
      return m;
    });
    return { mats, meshes };
  }, []);
  useEffect(() => () => { if (!built) return; built.meshes.forEach((m) => m.geometry.dispose()); built.mats.forEach(({ map, material }) => { material.dispose(); map.dispose(); }); }, [built]);
  if (!built) return null;
  return <group name="roads">{built.meshes.map((m) => <primitive key={m.name} object={m} />)}</group>;
}
