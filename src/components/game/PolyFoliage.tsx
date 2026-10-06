import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import fir from "@/assets/polyhaven/fir_sapling.glb.asset.json";
import broadleaf from "@/assets/polyhaven/island_tree_02.glb.asset.json";
import shrub from "@/assets/polyhaven/shrub_02.glb.asset.json";
import fern from "@/assets/polyhaven/fern_02.glb.asset.json";

/** Poly Haven (CC0) foliage, simplified + texture-resized offline, rendered as GPU instances
 * (one draw call per sub-mesh). Each species is verified and isolated: on failure the caller
 * keeps its procedural fallback, and the world scene never suspends. */
export const FOLIAGE = { fir: fir.url, broadleaf: broadleaf.url, shrub: shrub.url, fern: fern.url } as const;
export type FoliageKind = keyof typeof FOLIAGE;
export type Placement = { x: number; y: number; z: number; s: number; r: number };

class Quiet extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch() { this.props.onFail(); }
  override render() { return this.state.failed ? null : this.props.children; }
}

function Instanced({ url, items, scale, onReady, shadows }: { url: string; items: Placement[]; scale: number; onReady: () => void; shadows: boolean }) {
  const { scene } = useGLTF(url);
  // Poly Haven files ship several variants side by side; use the first one, recentred on its base.
  const parts = useMemo(() => {
    const variant = scene.children[0] ?? scene;
    variant.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(variant);
    const centre = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const out: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
    variant.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(centre, m.matrixWorld));
      const mat = (Array.isArray(m.material) ? m.material[0]! : m.material).clone() as THREE.MeshStandardMaterial;
      if (mat.map && mat.transparent) { mat.transparent = false; mat.alphaTest = 0.5; }
      mat.side = THREE.DoubleSide;
      out.push({ geometry: g, material: mat });
    });
    return out;
  }, [scene]);
  useEffect(() => { onReady(); }, [onReady]);
  return <>{parts.map((p, i) => <Mesh key={i} part={p} items={items} scale={scale} shadows={shadows} />)}</>;
}

const tmp = new THREE.Object3D();
function Mesh({ part, items, scale, shadows }: { part: { geometry: THREE.BufferGeometry; material: THREE.Material }; items: Placement[]; scale: number; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((p, i) => {
      tmp.position.set(p.x, p.y - 0.1, p.z);
      tmp.rotation.set(0, p.r, 0);
      tmp.scale.setScalar(p.s * scale);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, scale]);
  return <instancedMesh ref={ref} args={[part.geometry, part.material, Math.max(1, items.length)]} castShadow={shadows} receiveShadow frustumCulled={false} />;
}

const verified = new Map<string, boolean>();

/** Renders `items` as a Poly Haven species; calls onReady once visible so the caller can hide its fallback. */
export function PolyFoliage({ kind, items, scale = 1, onReady, onFail, shadows = true }: { kind: FoliageKind; items: Placement[]; scale?: number; onReady?: () => void; onFail?: () => void; shadows?: boolean }) {
  const url = FOLIAGE[kind];
  const [ok, setOk] = useState(verified.get(url) ?? false);
  useEffect(() => {
    if (verified.has(url)) { if (!verified.get(url)) onFail?.(); return; }
    fetch(url, { method: "HEAD" }).then((r) => { verified.set(url, r.ok); setOk(r.ok); if (!r.ok) onFail?.(); }).catch(() => { verified.set(url, false); onFail?.(); });
  }, [url, onFail]);
  const ready = useMemo(() => onReady ?? (() => {}), [onReady]);
  if (!ok || !items.length) return null;
  return <Quiet onFail={() => onFail?.()}><Suspense fallback={null}><Instanced url={url} items={items} scale={scale} onReady={ready} shadows={shadows} /></Suspense></Quiet>;
}
