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
import { reportAsset } from "@/game/forest-assets";

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

function Instanced({ url, items, scale, onReady, shadows, height, sway }: { url: string; items: Placement[]; scale: number; onReady: () => void; shadows: boolean; height?: number | undefined; sway?: number | undefined }) {
  const { scene } = useGLTF(url);
  // Poly Haven files ship several variants side by side; use the first one, recentred on its base.
  const [parts, norm] = useMemo(() => {
    const variant = scene.children[0] ?? scene;
    variant.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(variant);
    const centre = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const out: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
    // normalise to a target height in metres, so the model's authored scale can't break the scene
    const norm = height ? height / Math.max(0.01, box.max.y - box.min.y) : 1;
    variant.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(centre, m.matrixWorld));
      const mat = (Array.isArray(m.material) ? m.material[0]! : m.material).clone() as THREE.MeshStandardMaterial;
      if (mat.map && mat.transparent) { mat.transparent = false; mat.alphaTest = 0.5; }
      mat.side = THREE.DoubleSide;
      if (sway) mat.onBeforeCompile = windSway(g, sway / Math.max(0.01, norm));
      out.push({ geometry: g, material: mat });
    });
    return [out, norm] as const;
  }, [scene, height, sway]);
  useEffect(() => { onReady(); }, [onReady]);
  return <>{parts.map((p, i) => <Mesh key={i} part={p} items={items} scale={scale * norm} shadows={shadows} />)}</>;
}

const tmp = new THREE.Object3D();
tmp.rotation.order = "YXZ"; // yaw after tilt, so a laid-down log can still be turned to face any way
function Mesh({ part, items, scale, shadows }: { part: { geometry: THREE.BufferGeometry; material: THREE.Material }; items: Placement[]; scale: number; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((p, i) => {
      tmp.position.set(p.x, p.y - 0.1, p.z);
      tmp.rotation.set(0, p.r, p.tilt ?? 0);
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
export function PolyFoliage({ kind, items, scale = 1, onReady, onFail, shadows = true, height, sway }: { kind: FoliageKind; items: Placement[]; scale?: number; onReady?: () => void; onFail?: () => void; shadows?: boolean; height?: number; sway?: number }) {
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
  return <Quiet onFail={fail}><Suspense fallback={null}><Instanced url={url} items={items} scale={scale} onReady={ready} shadows={shadows} height={height} sway={sway} /></Suspense></Quiet>;
}
