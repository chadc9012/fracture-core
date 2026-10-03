import { Component, Suspense, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";

import type { ModelKey } from "@/game/models";
import { Model } from "./Vehicle";
import "@/game/webgl-support";

/**
 * Live 3D skyline behind the title screen, replacing the old static horizon image with a slow
 * Destiny-style camera drift toward a lit silhouette. Reuses the same block/tower GLBs Vehicle.tsx
 * already preloads for the open world, so this adds no new network cost.
 *
 * Isolated behind its own error boundary: a render failure here must never block New Game — it
 * just falls back to nothing, leaving the static horizon image underneath (TitleScreen.tsx) as
 * the background, exactly like before this existed.
 */
class BackdropBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  override state: { crashed: boolean } = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn("[world-fracture] title backdrop failed to render, falling back to static art:", error);
  }
  override render() {
    return this.state.crashed ? null : this.props.children;
  }
}

const SKYLINE: { key: ModelKey; x: number; z: number; scale: number; rot: number }[] = [
  { key: "tower_a", x: -14, z: -34, scale: 3.2, rot: 0.4 },
  { key: "tower_b", x: 10, z: -42, scale: 3.8, rot: -0.2 },
  { key: "block_a", x: -26, z: -28, scale: 2.4, rot: 1.1 },
  { key: "block_b", x: 22, z: -30, scale: 2.6, rot: -0.8 },
  { key: "tower_a", x: 2, z: -52, scale: 4.4, rot: 0.9 },
  { key: "tower_b", x: -34, z: -48, scale: 3, rot: -1.3 },
];

function Skyline() {
  return (
    <>
      {SKYLINE.map((b, i) => (
        <Model key={i} modelKey={b.key} position={[b.x, 0, b.z]} scale={b.scale} rotation={[0, b.rot, 0]} />
      ))}
    </>
  );
}

/** Slow forward push toward the skyline; holds still for viewers who prefer reduced motion. */
function CameraDrift() {
  const reduced = useRef(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useFrame((state, delta) => {
    if (reduced.current) return;
    state.camera.position.z = Math.max(state.camera.position.z - delta * 0.3, -6);
    state.camera.position.y = 3 + Math.sin(state.clock.elapsedTime * 0.1) * 0.25;
    state.camera.lookAt(0, 2.5, -40);
  });
  return null;
}

export function TitleBackdrop() {
  return (
    <BackdropBoundary>
      <Canvas
        className="!absolute inset-0 title-backdrop-canvas"
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 3, 9], fov: 45, near: 0.5, far: 200 }}
      >
        <color attach="background" args={["#05070d"]} />
        <fog attach="fog" args={["#05070d", 16, 75]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[12, 22, 6]} intensity={1.1} color="#9fd6ff" />
        <pointLight position={[-14, 6, -22]} color="#ff2ea6" intensity={34} distance={60} decay={2} />
        <pointLight position={[16, 9, -38]} color="#38e8ff" intensity={28} distance={60} decay={2} />
        <Suspense fallback={null}>
          <Skyline />
        </Suspense>
        <CameraDrift />
      </Canvas>
    </BackdropBoundary>
  );
}
