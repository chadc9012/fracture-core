import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { wyrmlingOffset } from "@/game/dragon-covenant";
import { DragonModel } from "./DragonModel";

type Held = { current: { x: number; y: number; z: number; yaw: number; inVehicle?: boolean } };

/** Vyrak's bonded form (dragon-covenant.ts): a small floating wyrmling keeping station at the Operator's shoulder.
 * Presentation only — the bond itself lives in progression.earnedRewards; hidden while driving. Uses the shared
 * Vyrak DragonModel at small scale with slow wing beats. */
export function Wyrmling({ held }: { held: Held }) {
  const root = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const pos = useRef<THREE.Vector3 | null>(null);
  useFrame(({ clock }, delta) => {
    const s = held.current, g = root.current;
    if (!g) return;
    g.visible = !s.inVehicle;
    if (s.inVehicle) return;
    const t = clock.elapsedTime;
    const [ox, oy, oz] = wyrmlingOffset(t, s.yaw);
    const target = new THREE.Vector3(s.x + ox, s.y + oy, s.z + oz);
    if (!pos.current) pos.current = target.clone();
    pos.current.lerp(target, Math.min(1, delta * 4));
    g.position.copy(pos.current);
    g.rotation.y = s.yaw + Math.sin(t * 0.9) * 0.2;
    const flap = Math.sin(t * 5) * 0.55;
    if (wingL.current) wingL.current.rotation.z = flap;
    if (wingR.current) wingR.current.rotation.z = -flap;
  });
  return (
    <group ref={root} scale={0.32}>
      <DragonModel refs={{ wingL, wingR }} ember={1.3} />
      <pointLight position={[0, 0.4, 0.6]} color="#ff7a2e" intensity={2} distance={4} />
    </group>
  );
}
