import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
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

export function Model({
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
export function Car({
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
