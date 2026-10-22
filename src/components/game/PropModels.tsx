import { useGLTF } from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { prepareWorldAsset } from "@/game/asset-render-quality";
import { QuietModel } from "./Vehicle";

/** Authored world props (scripts/build-props.py). Each waits and fails on its own, keeping the old primitive. */
export const PROP_URLS = { crate: "/models/props/crate.glb", coverWall: "/models/props/cover-wall.glb" } as const;

function meshesOf(scene: THREE.Object3D) {
  const out: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
  prepareWorldAsset(scene);
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    out.push({ geometry: g, material: Array.isArray(m.material) ? m.material[0]! : m.material });
  });
  return out;
}

function Guard({ url, fallback, children }: { url: string; fallback: ReactNode; children: ReactNode }) {
  return <QuietModel url={url} fallback={fallback}><Suspense fallback={fallback}>{children}</Suspense></QuietModel>;
}

function CoverWallModel({ position }: { position: [number, number, number] }) {
  const { scene } = useGLTF(PROP_URLS.coverWall);
  const parts = useMemo(() => meshesOf(scene), [scene]);
  return <group position={position}>{parts.map((p, i) => <mesh key={i} geometry={p.geometry} material={p.material} castShadow receiveShadow />)}</group>;
}

/** Fortified concrete cover slab, 4.5 x 3 x 1.3 m, centred at `position` like the box it replaces. */
export function CoverWall({ position }: { position: [number, number, number] }) {
  const fallback = <mesh position={position} castShadow><boxGeometry args={[4.5, 3, 1.3]} /><meshStandardMaterial color="#46515a" metalness={0.65} roughness={0.55} /></mesh>;
  return <Guard url={PROP_URLS.coverWall} fallback={fallback}><CoverWallModel position={position} /></Guard>;
}

function CrateInstances({ matrices }: { matrices: THREE.Matrix4[] }) {
  const { scene } = useGLTF(PROP_URLS.crate);
  const parts = useMemo(() => meshesOf(scene), [scene]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    refs.current.forEach((m) => {
      if (!m) return;
      matrices.forEach((mat, i) => m.setMatrixAt(i, mat));
      m.count = matrices.length;
      m.instanceMatrix.needsUpdate = true;
    });
  }, [matrices, parts]);
  return <>{parts.map((p, i) => <instancedMesh key={i} ref={(m) => { refs.current[i] = m; }} args={[p.geometry, p.material, Math.max(1, matrices.length)]} castShadow receiveShadow frustumCulled={false} />)}</>;
}

/** Supply crates as instances of the authored unit-size crate; `fallback` is the old primitive version. */
export function CrateModels({ matrices, fallback }: { matrices: THREE.Matrix4[]; fallback: ReactNode }) {
  return <Guard url={PROP_URLS.crate} fallback={fallback}><CrateInstances matrices={matrices} /></Guard>;
}
