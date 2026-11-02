import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";

/** A group drawn only while the camera is within `radius` metres of (x, y, z) (checked a few times a second). The pocket rooms
 * all hang at INTERIOR_ALTITUDE a few hundred metres apart, and their people are full skinned GLB models that are never
 * frustum-culled: without this every shop, venue and residence floor drew all its people every frame, from anywhere (play-test
 * Nov 2: ~400k triangles of NPCs drawn while standing in Apartment 12-04). */
export function CameraNear({ x, y, z, radius, children, name }: { x: number; y: number; z: number; radius: number; children: ReactNode; name?: string }) {
  const g = useRef<THREE.Group>(null);
  const t = useRef(1);
  useFrame(({ camera }, dt) => {
    t.current += dt;
    if (t.current < 0.25 || !g.current) return;
    t.current = 0;
    const p = camera.position, on = (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2 < radius * radius;
    if (g.current.visible !== on) g.current.visible = on;
  });
  return <group ref={g} name={name ?? ""}>{children}</group>;
}
