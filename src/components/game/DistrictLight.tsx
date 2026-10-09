import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/**
 * A point light that only exists for the renderer while the camera is near it. Every visible light is
 * evaluated for every lit pixel, so district lights that are far away cost a lot and show nothing.
 * Checked a few times a second with hysteresis (on inside `range`, off past `range * 1.25`), so the
 * light count only changes — and shaders only recompile — when you actually enter or leave a district.
 */
export function DistrictLight({ range = 90, ...props }: { range?: number } & JSX.IntrinsicElements["pointLight"]) {
  const light = useRef<THREE.PointLight>(null);
  const camera = useThree((s) => s.camera);
  const acc = useRef(Math.random() * 0.5);
  const world = useRef(new THREE.Vector3()).current;
  useFrame((_, dt) => {
    acc.current += dt;
    const l = light.current;
    if (!l || acc.current < 0.4) return;
    acc.current = 0;
    l.getWorldPosition(world);
    const d = world.distanceTo(camera.position);
    if (l.visible && d > range * 1.25) l.visible = false;
    else if (!l.visible && d < range) l.visible = true;
  });
  return <pointLight ref={light} visible={false} {...props} />;
}
