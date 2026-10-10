import * as THREE from "three";
import type { Palette } from "@/game/operator-paint";
import { weldIds, vertexCurvature } from "@/game/operator-mesh";
import { bakeTexels, paintBaked, regionWeightArray, type Baked } from "@/game/operator-texture";

/** Texture-space paint for a skinned operator mesh (see game/operator-texture.ts). The model-only bake is cached per geometry and
 * resolution, so changing colours or armor only re-runs the cheap palette pass. Returns null when the mesh lacks what painting needs
 * (the caller then keeps a flat material). */
const bakes = new WeakMap<THREE.BufferGeometry, Map<number, Baked>>();

export type SkinTextures = { map: THREE.DataTexture; emissiveMap: THREE.DataTexture; size: number; covered: number; visorTexels: number };

function bakeFor(mesh: THREE.SkinnedMesh, size: number, forward: 1 | -1): Baked | null {
  const geo = mesh.geometry;
  let bySize = bakes.get(geo);
  const have = bySize?.get(size);
  if (have) return have;
  const pos = geo.getAttribute("position"), nrm = geo.getAttribute("normal"), uv = geo.getAttribute("uv"), si = geo.getAttribute("skinIndex"), sw = geo.getAttribute("skinWeight");
  if (!pos || !nrm || !uv || !si || !sw || !geo.index || pos.itemSize !== 3) return null;
  const position = pos.array as Float32Array, normal = nrm.array as Float32Array;
  const count = pos.count;
  const names = mesh.skeleton.bones.map((b) => b.name);
  const regionWeights = regionWeightArray(names, si.array as ArrayLike<number>, sw.array as ArrayLike<number>, count);
  const { weld, count: wc } = weldIds(position);
  const curvature = vertexCurvature(position, normal, geo.index.array as ArrayLike<number>, weld, wc);
  const baked = bakeTexels({ position, normal, uv: uv.array as Float32Array, index: geo.index.array as ArrayLike<number>, regionWeights, curvature }, size, forward);
  if (!bySize) { bySize = new Map(); bakes.set(geo, bySize); }
  bySize.set(size, baked);
  return baked;
}

function texture(data: Uint8Array, size: number): THREE.DataTexture {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // glTF UVs have v = 0 at the first row
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

export function paintSkin(mesh: THREE.SkinnedMesh, palette: Palette, opts: { size: number; accent: string; forward?: 1 | -1 }): SkinTextures | null {
  const baked = bakeFor(mesh, opts.size, opts.forward ?? 1);
  if (!baked) return null;
  const out = paintBaked(baked, palette, { accent: opts.accent });
  return { map: texture(out.color, out.size), emissiveMap: texture(out.emissive, out.size), size: out.size, covered: out.covered, visorTexels: out.visorTexels };
}
