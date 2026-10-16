import * as THREE from "three";
import { SURFACES, emissiveFor, wornRoughness, type SurfaceKind } from "./visual-standard";
/** Reused micro-surface maps; not a substitute for authored UVs, meshes or skin/hair assets. */
const details = new Map<SurfaceKind, { normal: THREE.DataTexture; roughness: THREE.DataTexture }>();
function detailFor(kind: SurfaceKind) {
 const cached = details.get(kind); if (cached) return cached;
 const size = 64, normal = new Uint8Array(size * size * 4), roughness = new Uint8Array(size * size * 4);
 for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const i = (y * size + x) * 4, weave = kind === "fabric" || kind === "carbonFiber";
  const a = weave ? Math.sin(x * Math.PI / 2) * 7 : Math.sin(y * Math.PI / 4) * 2;
  const b = weave ? Math.sin(y * Math.PI / 2) * 7 : Math.sin(x * Math.PI / 4) * 2;
  normal.set([128 + a, 128 + b, 254, 255], i);
  const r = weave ? 225 + Math.sin((x + y) * Math.PI / 2) * 14 : 238 + Math.sin(y * Math.PI / 4) * 8;
  roughness.set([r, r, r, 255], i);
 }
 const texture = (data: Uint8Array) => {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; return t;
 };
 const result = { normal: texture(normal), roughness: texture(roughness) }; details.set(kind, result); return result;
}
export function createCinematicMaterial(kind: SurfaceKind, color: THREE.ColorRepresentation, wear = 0, emissive?: THREE.ColorRepresentation) {
 const surface = SURFACES[kind];
 const micro = ["fabric", "carbonFiber", "paintedArmor", "bareMetal", "ceramic"].includes(kind) ? detailFor(kind) : null;
 return new THREE.MeshPhysicalMaterial({
  color, metalness: surface.metalness, roughness: wornRoughness(kind, wear),
  clearcoat: kind === "paintedArmor" || kind === "ceramic" ? 0.18 : 0,
  clearcoatRoughness: 0.4, sheen: kind === "fabric" ? 0.25 : 0, sheenRoughness: 0.85,
  normalMap: micro?.normal ?? null, normalScale: new THREE.Vector2(0.22, 0.22), roughnessMap: micro?.roughness ?? null,
  emissive: emissive ?? 0, emissiveIntensity: emissive ? emissiveFor(kind, 0.7, false) : 0,
 });
}
/** Clone, never mutate useGLTF's cached materials; preserve every authored texture and color. */
export function cinematicImported(source: THREE.Material): THREE.Material {
 const m = source.clone();
 if (m instanceof THREE.MeshStandardMaterial) {
  m.roughness = Math.max(0.18, Math.min(0.98, m.roughness));
  m.envMapIntensity = Math.min(1.15, m.envMapIntensity); m.emissiveIntensity = Math.min(1.4, m.emissiveIntensity);
 }
 return m;
}
