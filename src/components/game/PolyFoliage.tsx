import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import fir from "@/assets/polyhaven/fir_sapling.glb.asset.json";
import broadleaf from "@/assets/polyhaven/island_tree_02.glb.asset.json";
import shrub from "@/assets/polyhaven/shrub_02.glb.asset.json";
import fern from "@/assets/polyhaven/fern_02.glb.asset.json";
import deadLog from "@/assets/polyhaven/dead_tree_trunk.glb.asset.json";
import mossRock from "@/assets/polyhaven/rock_moss_set_01.glb.asset.json";
import { windSway } from "@/game/wind-sway";
import { reportAsset, reportDetail } from "@/game/forest-assets";
import { CULL_RADIUS, movedEnough } from "@/game/foliage-cull";
import { PROXY_COLOR, PROXY_MAX, PROXY_RADIUS, farProxies, isProxied, foliageTris, getPerfTier, maxInstances, nearestWithin, perfTierVersion } from "@/game/perf-budget";

/** Poly Haven (CC0) foliage, simplified + texture-resized offline, rendered as GPU instances
 * (one draw call per sub-mesh). Each species is verified and isolated: on failure the caller
 * keeps its procedural fallback, and the world scene never suspends. */
export const FOLIAGE = { fir: fir.url, broadleaf: broadleaf.url, shrub: shrub.url, fern: fern.url, log: deadLog.url, rock: mossRock.url } as const;
const LABEL: Record<keyof typeof FOLIAGE, string> = { fir: "Fir tree", broadleaf: "Broadleaf tree", shrub: "Shrub", fern: "Fern", log: "Fallen log", rock: "Mossy rock" };
export type FoliageKind = keyof typeof FOLIAGE;
/** `tilt` lays a model on its side (radians about Z) before yawing — used for fallen logs */
export type Placement = { x: number; y: number; z: number; s: number; r: number; tilt?: number };

class Quiet extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch() { this.props.onFail(); }
  override render() { return this.state.failed ? null : this.props.children; }
}

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material };

/** True when a model's top-level children are separate, side-by-side variants rather than parts of one object:
 * their bounding boxes must not overlap each other and their heights must be comparable. */
function looksLikeVariants(kids: THREE.Object3D[]): boolean {
  if (kids.length < 2) return false;
  const boxes = kids.map((k) => { k.updateMatrixWorld(true); return new THREE.Box3().setFromObject(k); });
  if (boxes.some((b) => b.isEmpty())) return false;
  const hs = boxes.map((b) => b.max.y - b.min.y);
  if (Math.max(...hs) > Math.min(...hs) * 3) return false;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (boxes[i]!.intersectsBox(boxes[j]!)) return false;
  return true;
}

function Instanced({ kind, url, items, scale, onReady, shadows, height, sway, variants, radius }: { kind: FoliageKind; radius: number; url: string; items: Placement[]; scale: number; onReady: () => void; shadows: boolean; height?: number | undefined; sway?: number | undefined; variants?: boolean | undefined }) {
  const { scene } = useGLTF(url);
  // Poly Haven files ship several variants side by side. With `variants`, each variant is used (so plants stop
  // repeating one identical model); otherwise, or if the layout doesn't look like variants, the first one is used.
  // Every variant is recentred on its base and normalised to the same target height.
  const built = useMemo(() => {
    const kids = scene.children.filter((c) => { let has = false; c.traverse((o) => { if ((o as THREE.Mesh).isMesh) has = true; }); return has; });
    const picks = variants && looksLikeVariants(kids) ? kids : [scene.children[0] ?? scene];
    return picks.map((variant) => {
      variant.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(variant);
      const centre = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      // normalise to a target height in metres, so the model's authored scale can't break the scene
      const norm = height ? height / Math.max(0.01, box.max.y - box.min.y) : 1;
      const parts: Part[] = [];
      variant.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const g = m.geometry.clone();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(centre, m.matrixWorld));
        const mat = (Array.isArray(m.material) ? m.material[0]! : m.material).clone() as THREE.MeshStandardMaterial;
        if (mat.map && mat.transparent) { mat.transparent = false; mat.alphaTest = 0.5; }
        mat.side = THREE.DoubleSide;
        if (sway) mat.onBeforeCompile = windSway(g, sway / Math.max(0.01, norm));
        parts.push({ geometry: g, material: mat });
      });
      return { parts, norm };
    });
  }, [scene, height, sway, variants]);
  // each instance picks its variant from a hash of its index, so neighbours differ without any visible pattern
  const buckets = useMemo(() => built.map((_, vi) => items.filter((_, i) => built.length === 1 || (Math.imul(i + 1, 2654435761) >>> 0) % built.length === vi)), [built, items]);
  useEffect(() => {
    let triangles = 0;
    built.forEach((v, vi) => v.parts.forEach((p) => { triangles += ((p.geometry.index ? p.geometry.index.count : p.geometry.getAttribute("position").count) / 3) * buckets[vi]!.length; }));
    const first = built[0];
    reportDetail(`${url.split("/").pop()} h=${height ?? "native"}`, { variants: built.length, instances: items.length, triangles: Math.round(triangles), sourceHeight: first ? Math.round((height ? height / first.norm : 0) * 100) / 100 : 0 });
    onReady();
  }, [onReady, built, buckets, items.length, url, height]);
  // triangles one instance of each variant costs (all its sub-meshes); the allowance is shared between variants
  const perInstance = useMemo(() => built.map((v) => v.parts.reduce((t, p) => t + (p.geometry.index ? p.geometry.index.count : p.geometry.getAttribute("position").count) / 3, 0)), [built]);
  // one cheap silhouette per variant (first part only), sized from the model's own bounds so it matches at any scale
  const proxies = useMemo(() => built.map((v) => {
    if (!isProxied(kind)) return null;
    const box = new THREE.Box3();
    v.parts.forEach((p) => { p.geometry.computeBoundingBox(); if (p.geometry.boundingBox) box.union(p.geometry.boundingBox); });
    if (box.isEmpty()) return null;
    const h = box.max.y - box.min.y, w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    // silhouettes sized from the model's own bounds: cone (fir), blob (broadleaf), squashed blob (rock), thin tapered post (standing trunk)
    if (kind === "fir") { const g = new THREE.ConeGeometry(w * 0.42, h, 6, 1); g.translate(0, box.min.y + h / 2, 0); return g; }
    if (kind === "rock") { const g = new THREE.IcosahedronGeometry(w * 0.5, 0); g.scale(1, h / w, 1); g.translate(0, box.min.y + h / 2, 0); return g; }
    if (kind === "log") { const g = new THREE.CylinderGeometry(w * 0.08, w * 0.2, h, 5, 1); g.translate(0, box.min.y + h / 2, 0); return g; }
    const g = new THREE.IcosahedronGeometry(w * 0.5, 0); g.scale(1, 0.85, 1); g.translate(0, box.min.y + h * 0.66, 0); return g;
  }), [built, kind]);
  return <>{built.map((v, vi) => v.parts.map((p, i) => <Mesh key={`${vi}-${i}`} name={`foliage:${kind}`} kind={kind} share={built.length} trisPerInstance={perInstance[vi]!} part={p} items={buckets[vi]!} scale={scale * v.norm} shadows={shadows} radius={radius} proxy={i === 0 ? proxies[vi] ?? null : null} />))}</>;
}

const tmp = new THREE.Object3D();
tmp.rotation.order = "YXZ"; // yaw after tilt, so a laid-down log can still be turned to face any way
function Mesh({ name, kind, share, trisPerInstance, part, items, scale, shadows, radius, proxy }: { proxy?: THREE.BufferGeometry | null; name: string; kind: FoliageKind; share: number; trisPerInstance: number; part: { geometry: THREE.BufferGeometry; material: THREE.Material }; items: Placement[]; scale: number; shadows: boolean; radius: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const farRef = useRef<THREE.InstancedMesh>(null);
  const farMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: isProxied(kind) ? PROXY_COLOR[kind] : "#3a6a3a", roughness: 1, flatShading: true }), [kind]);
  const all = useRef<Float32Array>(new Float32Array(0));
  const last = useRef({ x: Infinity, z: Infinity });
  const clock = useRef(1);
  const seenTier = useRef(-1);
  // matrices for every instance are computed once; the live buffer then only holds the ones near the camera
  const select = (cx: number, cz: number) => {
    const mesh = ref.current;
    if (!mesh) return;
    // nearest-first within the species' triangle allowance for the current quality tier (perf-budget.ts)
    const idx = nearestWithin(items, cx, cz, radius, Math.max(kind === "rock" || kind === "log" ? (trisPerInstance > 60_000 ? 1 : 2) : 0, maxInstances(foliageTris(kind, getPerfTier()) / share, trisPerInstance)));
    seenTier.current = perfTierVersion();
    const dst = mesh.instanceMatrix.array as Float32Array;
    idx.forEach((src, k) => dst.set(all.current.subarray(src * 16, src * 16 + 16), k * 16));
    mesh.count = idx.length;
    mesh.instanceMatrix.needsUpdate = true;
    const far = farRef.current;
    if (far && isProxied(kind)) {
      const fidx = farProxies(items, cx, cz, idx, PROXY_RADIUS[kind], Math.min(items.length, PROXY_MAX[getPerfTier()]));
      const fd = far.instanceMatrix.array as Float32Array;
      fidx.forEach((src, k) => fd.set(all.current.subarray(src * 16, src * 16 + 16), k * 16));
      far.count = fidx.length;
      far.instanceMatrix.needsUpdate = true;
    }
    last.current = { x: cx, z: cz };
  };
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Float32Array(items.length * 16);
    items.forEach((p, i) => {
      tmp.position.set(p.x, p.y - 0.1, p.z);
      tmp.rotation.set(0, p.r, p.tilt ?? 0);
      tmp.scale.setScalar(p.s * scale);
      tmp.updateMatrix();
      tmp.matrix.toArray(m, i * 16);
    });
    all.current = m;
    mesh.count = 0; // nothing until the first camera-based selection (next frame)
    if (farRef.current) farRef.current.count = 0;
    last.current = { x: Infinity, z: Infinity };
    clock.current = 1; // select on the very next frame
  }, [items, scale]);
  useFrame(({ camera }, dt) => {
    clock.current += dt;
    if (clock.current < 0.25) return;
    clock.current = 0;
    const { x, z } = camera.position;
    if (!Number.isFinite(last.current.x) || seenTier.current !== perfTierVersion() || movedEnough(last.current.x, last.current.z, x, z)) select(x, z);
  });
  return <>
    <instancedMesh ref={ref} name={name} args={[part.geometry, part.material, Math.max(1, items.length)]} castShadow={shadows} receiveShadow frustumCulled={false} />
    {proxy && <instancedMesh ref={farRef} name={`${name}:far`} args={[proxy, farMaterial, Math.max(1, Math.min(items.length, PROXY_MAX.ULTRA))]} frustumCulled={false} />}
  </>;
}

const verified = new Map<string, boolean>();

/** Renders `items` as a Poly Haven species; calls onReady once visible so the caller can hide its fallback. */
export function PolyFoliage({ kind, items, scale = 1, onReady, onFail, shadows = true, height, sway, variants, radius }: { radius?: number; kind: FoliageKind; items: Placement[]; scale?: number; onReady?: () => void; onFail?: () => void; shadows?: boolean; height?: number; sway?: number; variants?: boolean }) {
  const url = FOLIAGE[kind];
  const [ok, setOk] = useState(verified.get(url) ?? false);
  const fail = useMemo(() => () => { reportAsset(`foliage:${kind}`, LABEL[kind], "failed"); onFail?.(); }, [kind, onFail]);
  useEffect(() => {
    reportAsset(`foliage:${kind}`, LABEL[kind], "loading");
    if (verified.has(url)) { if (verified.get(url)) setOk(true); else fail(); return; }
    fetch(url, { method: "HEAD" }).then((r) => { verified.set(url, r.ok); setOk(r.ok); if (!r.ok) fail(); }).catch(() => { verified.set(url, false); fail(); });
  }, [url, kind, fail]);
  const ready = useMemo(() => () => { reportAsset(`foliage:${kind}`, LABEL[kind], "ok"); onReady?.(); }, [kind, onReady]);
  if (!ok || !items.length) return null;
  return <Quiet onFail={fail}><Suspense fallback={null}><Instanced kind={kind} url={url} items={items} scale={scale} onReady={ready} shadows={shadows} height={height} sway={sway} variants={variants} radius={radius ?? CULL_RADIUS[kind]} /></Suspense></Quiet>;
}
