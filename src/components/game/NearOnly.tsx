import { useFrame } from "@react-three/fiber";
import { useRef, useState, type ReactNode } from "react";
import type * as THREE from "three";

/** Mounts its children only while the player is within `radius` of (x, z). District lights and meshes
 * far past the fog line are pure cost: every point light is paid for by every lit pixel, and each
 * mounted mesh is a draw call. Checked twice a second with a 15% hysteresis band so standing on the
 * edge never flickers. */
export function NearOnly({ playerRef, x, z, radius, children, name }: { name?: string; playerRef: React.RefObject<THREE.Object3D>; x: number; z: number; radius: number; children: ReactNode }) {
  const [near, setNear] = useState(false);
  const clock = useRef(0);
  const state = useRef(false);
  useFrame((_, dt) => {
    clock.current += dt;
    if (clock.current < 0.5) return;
    clock.current = 0;
    const p = playerRef.current;
    if (!p) return;
    const d = Math.hypot(p.position.x - x, p.position.z - z);
    const next = state.current ? d < radius * 1.15 : d < radius;
    if (next !== state.current) { state.current = next; setNear(next); }
  });
  return near ? <group name={name ?? ""}>{children}</group> : null;
}
