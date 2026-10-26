import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FACADE, facadePixels } from "@/game/facade-windows";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { lampLevel, worldLight } from "@/game/world-light";
import { windSway } from "@/game/wind-sway";
import { QuietModel } from "./Vehicle";

/**
 * Draw many copies of one authored GLB (buildings, cars, props) as one InstancedMesh per material: the model is
 * flattened once (every mesh baked into its rest transform, merged by material), so thirty towers cost a handful of
 * draw calls. Materials named "Paint" take a per-instance colour; "WindowsLit" glows with the night (worldLight).
 * A model that cannot load draws nothing.
 */
export type GlbInstance = { x: number; y: number; z: number; yaw: number; scale?: number; paint?: string };
type Part = { geometry: THREE.BufferGeometry; material: THREE.Material; paint: boolean; windows: boolean };

const flatCache = new Map<THREE.Object3D, Part[]>();

function strip(g: THREE.BufferGeometry) {
  for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
  if (!g.attributes["uv"]) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes["position"]!.count * 2), 2));
  return g.index ? g.toNonIndexed() : g;
}

export function flattenGlb(scene: THREE.Object3D): Part[] {
  const hit = flatCache.get(scene);
  if (hit) return hit;
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const root = scene.clone(true);
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const g = mesh.geometry;
    if (mats.length === 1 || !g.groups.length) {
      byMat.set(mats[0]!, [...(byMat.get(mats[0]!) ?? []), strip(g.clone().applyMatrix4(mesh.matrixWorld))]);
      return;
    }
    for (const grp of g.groups) {
      const m = mats[grp.materialIndex ?? 0]!;
      const sub = g.clone(); sub.clearGroups();
      if (sub.index) sub.setIndex(Array.from(sub.index.array.slice(grp.start, grp.start + grp.count)));
      byMat.set(m, [...(byMat.get(m) ?? []), strip(sub.applyMatrix4(mesh.matrixWorld))]);
    }
  });
  const parts: Part[] = [];
  for (const [material, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mat = material.clone();
    const paint = material.name === "Paint", windows = material.name === "WindowsLit";
    if (paint) (mat as THREE.MeshStandardMaterial).color.set("#ffffff");
    if (material.name === "Glass") { mat.transparent = true; mat.depthWrite = false; }
    // the owner's night target frames: dense banded office light instead of the baked map's big warm blocks (facade-windows.ts)
    if (windows) { const tex = facadeTexture(); if (tex) { const m = mat as THREE.MeshStandardMaterial; m.emissiveMap = tex; m.emissive.set("#ffffff"); m.needsUpdate = true; } }
    parts.push({ geometry: merged, material: mat, paint, windows });
  }
  flatCache.set(scene, parts);
  return parts;
}

const tmp = new THREE.Object3D(), col = new THREE.Color();

let facadeTex: THREE.DataTexture | null = null;
/** one shared facade map for every tower's lit windows (uploaded once) */
function facadeTexture(): THREE.DataTexture | null {
  if (facadeTex) return facadeTex;
  const t = new THREE.DataTexture(facadePixels(), FACADE.size, FACADE.size, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.flipY = false;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8;
  t.needsUpdate = true;
  return (facadeTex = t);
}

/** a swaying copy of the flattened parts (palms): own material clones, every part bending about the whole model's base and height so
 * the fronds stay on the trunk (wind-sway.ts) */
function swayParts(parts: Part[], amount: number): Part[] {
  const box = new THREE.Box3();
  for (const p of parts) { p.geometry.computeBoundingBox(); if (p.geometry.boundingBox) box.union(p.geometry.boundingBox); }
  if (box.isEmpty()) return parts;
  const range = { min: box.min.y, max: box.max.y };
  return parts.map((p) => {
    if (p.windows || p.material.transparent) return p;
    const material = p.material.clone();
    material.onBeforeCompile = windSway(p.geometry, amount, { range, dew: 0.4 });
    return { ...p, material };
  });
}

function Batch({ url, items, place, shadows, nightGlow, sway }: { url: string; items: GlbInstance[]; place?: ((i: number, o: THREE.Object3D) => void) | undefined; shadows: boolean; nightGlow: [number, number]; sway?: number | undefined }) {
  const { scene } = useGLTF(url);
  const flat = useMemo(() => flattenGlb(scene), [scene]);
  const parts = useMemo(() => (sway ? swayParts(flat, sway) : flat), [flat, sway]);
  useEffect(() => () => { if (parts !== flat) parts.forEach((p, i) => { if (p.material !== flat[i]!.material) p.material.dispose(); }); }, [parts, flat]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const write = (initial: boolean) => {
    for (let k = 0; k < parts.length; k++) {
      const im = refs.current[k];
      if (!im) continue;
      for (let i = 0; i < items.length; i++) {
        const it = items[i]!;
        tmp.position.set(it.x, it.y, it.z); tmp.rotation.set(0, it.yaw, 0); tmp.scale.setScalar(it.scale ?? 1);
        if (place) place(i, tmp);
        tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix);
        if (initial && parts[k]!.paint) im.setColorAt(i, col.set(it.paint ?? "#8d96a1"));
      }
      im.instanceMatrix.needsUpdate = true;
      if (initial && im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
    }
  };
  useLayoutEffect(() => { write(true); }); // eslint-disable-line react-hooks/exhaustive-deps
  const glow = useRef(-1);
  useFrame(() => {
    if (place) write(false);
    const k = Math.round(lampLevel(worldLight.night) * 40) / 40;
    if (k !== glow.current) {
      glow.current = k;
      for (const p of parts) if (p.windows) (p.material as THREE.MeshStandardMaterial).emissiveIntensity = nightGlow[0] + (nightGlow[1] - nightGlow[0]) * k;
    }
  });
  return <group>{parts.map((p, k) => (
    <instancedMesh key={k} ref={(el) => { refs.current[k] = el; }} args={[p.geometry, p.material, Math.max(1, items.length)]} castShadow={shadows && !p.material.transparent} receiveShadow={shadows} frustumCulled={!place} />
  ))}</group>;
}

/** `nightGlow`: lit-window emissive multiplier [by day, at night]; `sway`: wind bend at the top of the model (model units), for plants */
export function InstancedGlb({ url, items, place, shadows = true, nightGlow = [0.08, 1.8], sway }: { url: string; items: GlbInstance[]; place?: (i: number, o: THREE.Object3D) => void; shadows?: boolean; nightGlow?: [number, number]; sway?: number }) {
  if (!items.length) return null;
  return (
    <QuietModel url={url} fallback={null}>
      <Suspense fallback={null}><Batch url={url} items={items} place={place} shadows={shadows} nightGlow={nightGlow} sway={sway} /></Suspense>
    </QuietModel>
  );
}
