import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/** Camera-local marine sediment. Kept pooled and hidden outside a dive. */
export function UnderwaterAtmosphere({ playerRef, divingRef }: { playerRef: React.RefObject<THREE.Object3D>; divingRef: React.MutableRefObject<boolean> }) {
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const positions = new Float32Array(780);
    let seed = 741;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (random() - 0.5) * 48;
      positions[i + 1] = (random() - 0.5) * 24;
      positions[i + 2] = (random() - 0.5) * 48;
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return next;
  }, []);
  useFrame(({ clock }, delta) => {
    const node = points.current;
    if (!node) return;
    node.visible = divingRef.current;
    if (!node.visible || !playerRef.current) return;
    node.position.copy(playerRef.current.position);
    node.position.y += Math.sin(clock.elapsedTime * 0.35) * 0.4;
    node.rotation.y += Math.min(delta, 0.05) * 0.025;
  });
  return <points ref={points} geometry={geometry} visible={false} frustumCulled={false}><pointsMaterial color="#8ed9df" size={0.12} transparent opacity={0.42} depthWrite={false} fog /></points>;
}