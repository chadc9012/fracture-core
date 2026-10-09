import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import type { ClassId } from "@/game/loadout";

/** Authored (Meshy) operator models, served from /public. Only NYX exists so far; the other two keep
 * their procedural Operator until their files arrive. Static pose, no rig yet. */
export const OPERATOR_MODELS: Partial<Record<ClassId, string>> = { HUNTER: "/models/operators/nyx.glb" };

class Quiet extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Model({ url, height, feetY }: { url: string; height: number; feetY: number }) {
  const { scene } = useGLTF(url);
  const { object, scale, offset } = useMemo(() => {
    const object = scene.clone(true);
    object.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; m.frustumCulled = true; } });
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const scale = height / Math.max(size.y, 0.001);
    return { object, scale, offset: new THREE.Vector3(-centre.x * scale, feetY - box.min.y * scale, -centre.z * scale) };
  }, [scene, height, feetY]);
  return <primitive object={object} scale={scale} position={offset} />;
}

/** Draws the authored model for `classId` if one exists, else `fallback` (also while loading or on failure). */
export function OperatorModel({ classId, height, feetY, fallback }: { classId: ClassId; height: number; feetY: number; fallback: ReactNode }) {
  const url = OPERATOR_MODELS[classId];
  if (!url) return <>{fallback}</>;
  return <Quiet fallback={fallback}><Suspense fallback={fallback}><Model url={url} height={height} feetY={feetY} /></Suspense></Quiet>;
}
