import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Grid } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import { SCALE } from "@/game/visual-standard";

type Info = { size: [number, number, number]; meshes: number; skinned: boolean; materials: string[]; clips: string[] };

class Catch extends Component<{ children: ReactNode; onError: (e: string) => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(e: Error) { this.props.onError(e.message); }
  override render() { return this.state.failed ? null : this.props.children; }
}

function Model({ url, onInfo }: { url: string; onInfo: (i: Info) => void }) {
  const { scene, animations } = useGLTF(url);
  const info = useMemo<Info>(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const s = box.getSize(new THREE.Vector3());
    const mats = new Set<string>(); let meshes = 0, skinned = false;
    scene.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; meshes++; if ((m as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(`${x.name || "(unnamed)"} · ${x.type}`)); });
    return { size: [s.x, s.y, s.z], meshes, skinned, materials: [...mats], clips: animations.map((a) => `${a.name} (${a.duration.toFixed(1)}s)`) };
  }, [scene, animations]);
  useEffect(() => onInfo(info), [info, onInfo]);
  const k = SCALE.operator / Math.max(info.size[1], 1e-3);
  return <primitive object={scene} scale={k} />;
}

export default function AssetViewer({ url }: { url: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="relative h-screen">
      <Canvas camera={{ position: [3, 2, 4], fov: 45 }}>
        <hemisphereLight intensity={0.8} />
        <directionalLight position={[4, 6, 3]} intensity={1.6} />
        <Grid args={[10, 10]} cellSize={0.5} infiniteGrid fadeDistance={20} />
        <Catch onError={setError}><Suspense fallback={null}><Model url={url} onInfo={setInfo} /></Suspense></Catch>
        <OrbitControls target={[0, 0.9, 0]} />
      </Canvas>
      <div className="absolute right-3 top-3 max-w-sm space-y-1 rounded border border-border bg-card/90 p-3 font-mono text-xs">
        <div>{url}</div>
        {error && <div className="text-destructive">Load failed: {error}</div>}
        {info && <>
          <div>raw size (m): {info.size.map((v) => v.toFixed(2)).join(" × ")} — shown at {SCALE.operator} m tall</div>
          <div>meshes {info.meshes} · {info.skinned ? "skinned" : "static"}</div>
          <div>materials: {info.materials.join(", ") || "none"}</div>
          <div>clips: {info.clips.join(", ") || "none"}</div>
        </>}
      </div>
    </div>
  );
}
