import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Component, Suspense, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { MODELS, type ModelKey } from "@/game/models";

/** deep clone of a loaded GLB so the same asset can appear many times */
export function useModel(key: ModelKey) {
  const { scene } = useGLTF(MODELS[key]);
  return useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return root;
  }, [scene]);
}

/**
 * A missing or unreachable GLB must never take the world down (src/game/AGENTS.md): every Model and Car waits and
 * fails on its own. A prop that cannot load is skipped; a car that cannot load keeps a plain procedural hull so
 * the player can still see and drive it.
 */
export class QuietModel extends Component<{ children: ReactNode; fallback: ReactNode; url: string }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(error: unknown) { console.warn(`[model] ${this.props.url} unavailable, using fallback:`, error); }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function Model(props: Parameters<typeof ModelBody>[0]) {
  return (
    <QuietModel url={MODELS[props.modelKey]} fallback={null}>
      <Suspense fallback={null}><ModelBody {...props} /></Suspense>
    </QuietModel>
  );
}

function ModelBody({
  modelKey,
  position,
  rotation,
  scale,
}: {
  modelKey: ModelKey;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}) {
  const object = useModel(modelKey);
  return <primitive object={object} position={position} rotation={rotation} scale={scale} />;
}

const WHEEL_OFFSETS: [number, number, number][] = [
  [-0.62, 0, 0.9],
  [0.62, 0, 0.9],
  [-0.62, 0, -0.9],
  [0.62, 0, -0.9],
];

/**
 * A complete CC0 vehicle: body shell plus four wheels that roll with speed.
 * `speed` is world units / second, used for wheel spin only.
 */
function FallbackHull({ lights }: { lights: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow><boxGeometry args={[1.3, 0.5, 2.4]} /><meshStandardMaterial color="#2b3440" metalness={0.6} roughness={0.45} /></mesh>
      <mesh position={[0, 0.8, -0.15]} castShadow><boxGeometry args={[1.05, 0.35, 1.2]} /><meshStandardMaterial color="#14202b" metalness={0.3} roughness={0.2} /></mesh>
      {WHEEL_OFFSETS.map((o, i) => (
        <mesh key={i} position={[o[0], 0.3, o[2]]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.3, 0.3, 0.22, 14]} /><meshStandardMaterial color="#111" roughness={0.9} /></mesh>
      ))}
      {lights && <pointLight position={[0, 0.5, 1.6]} color="#bfeaff" intensity={6} distance={18} decay={2} />}
    </group>
  );
}

export function Car(props: Parameters<typeof CarBody>[0]) {
  const scale = props.scale ?? 2.4, lights = props.lights ?? true;
  const fallback = <group scale={scale}><FallbackHull lights={lights} /></group>;
  return (
    <QuietModel url={MODELS[props.body]} fallback={fallback}>
      <Suspense fallback={fallback}><CarBody {...props} /></Suspense>
    </QuietModel>
  );
}

function CarBody({
  body,
  scale = 2.4,
  speedRef,
  steerRef,
  lights = true,
}: {
  body: ModelKey;
  scale?: number;
  speedRef?: React.MutableRefObject<number>;
  steerRef?: React.MutableRefObject<number>;
  lights?: boolean;
}) {
  const shell = useModel(body);
  const wheelSrc = useModel("wheel");
  const wheels = useMemo(() => WHEEL_OFFSETS.map(() => wheelSrc.clone(true)), [wheelSrc]);
  const group = useRef<THREE.Group>(null!);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const spin = ((speedRef?.current ?? 0) / (0.3 * scale)) * dt;
    const steer = THREE.MathUtils.clamp(steerRef?.current ?? 0, -0.5, 0.5);
    const g = group.current;
    if (!g) return;
    g.children.forEach((w, i) => {
      w.rotation.x -= spin;
      if (i < 2) w.rotation.y = steer;
    });
  });

  return (
    <group scale={scale}>
      <primitive object={shell} />
      <group ref={group}>
        {wheels.map((w, i) => (
          <primitive key={i} object={w} position={WHEEL_OFFSETS[i]} />
        ))}
      </group>
      {lights && (
        <pointLight position={[0, 0.5, 1.6]} color="#bfeaff" intensity={6} distance={18} decay={2} />
      )}
    </group>
  );
}

Object.values(MODELS).forEach((url) => useGLTF.preload(url));
