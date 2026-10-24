import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { neonCorePools, neonStreetLightsWorld, type NeonLamp } from "@/game/neon-layout";
import { NEON_SITE } from "@/game/world";
import { neonPlateauLevel } from "@/game/terrain";
import { neonKeepOut } from "@/game/residences";
import { walkHeight } from "@/game/terrain";
import { lampLevel, worldLight } from "@/game/world-light";
import { useInstances } from "./instancing";
import { softSprite } from "./softSprite";

/** Neon City street lamps (neon-layout.ts neonStreetLights): a dark pole and arm, an LED head and a sign-coloured pool of light
 * on the wet asphalt. The pools are additive decals (one draw call for all of them); unlike Nexus they never fully switch off,
 * because the city's signage keeps its streets lit even by day, and they swell at night. */
export function NeonStreetLights() {
  const ls = useMemo(() => neonStreetLightsWorld(neonKeepOut()), []);
  // the core (market avenue and under the Grid deck) gets pools only: its stalls and pillars carry their own fixtures
  const core = useMemo(() => neonCorePools().map((l) => ({ ...l, x: l.x + NEON_SITE.x, z: l.z + NEON_SITE.z })), []);
  const corePool = useRef<THREE.InstancedMesh>(null);
  const plateau = useMemo(() => neonPlateauLevel(), []);
  useInstances<NeonLamp>(corePool, core, (o, l) => { o.position.set(l.x, plateau + 0.42, l.z); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.setScalar(8); }, (l) => l.glow);
  const pole = useRef<THREE.InstancedMesh>(null), arm = useRef<THREE.InstancedMesh>(null), head = useRef<THREE.InstancedMesh>(null), pool = useRef<THREE.InstancedMesh>(null);
  const y0 = (l: NeonLamp) => walkHeight(l.x, l.z);
  const tip = (l: NeonLamp) => ({ x: l.x + Math.sin(l.yaw) * 2.1, z: l.z + Math.cos(l.yaw) * 2.1 });
  useInstances<NeonLamp>(pole, ls, (o, l) => { o.position.set(l.x, y0(l) + 3.4, l.z); o.scale.set(0.09, 6.8, 0.09); });
  useInstances<NeonLamp>(arm, ls, (o, l) => { o.position.set(l.x + Math.sin(l.yaw) * 1.05, y0(l) + 6.7, l.z + Math.cos(l.yaw) * 1.05); o.rotation.set(0, l.yaw, 0); o.scale.set(0.07, 0.07, 2.1); });
  useInstances<NeonLamp>(head, ls, (o, l) => { const t = tip(l); o.position.set(t.x, y0(l) + 6.6, t.z); o.rotation.set(0, l.yaw, 0); o.scale.set(0.3, 0.07, 0.9); }, (l) => l.glow);
  useInstances<NeonLamp>(pool, ls, (o, l) => { const t = tip(l); o.position.set(t.x, walkHeight(t.x, t.z) + 0.1, t.z); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.setScalar(9); }, (l) => l.glow);
  const mats = useMemo(() => ({
    pole: new THREE.MeshStandardMaterial({ color: "#1a1d24", metalness: 0.85, roughness: 0.3 }),
    head: new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
    pool: new THREE.MeshBasicMaterial({ map: softSprite("dot") ?? null, color: "#ffffff", transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }),
  }), []);
  const seen = useRef(-1);
  useFrame(() => {
    const k = Math.round(lampLevel(worldLight.night) * 50) / 50;
    if (k === seen.current) return;
    seen.current = k;
    mats.pool.opacity = 0.16 + k * 0.4;
  });
  if (!ls.length) return null;
  return <group>
    <instancedMesh ref={pole} args={[undefined, undefined, ls.length]} material={mats.pole} castShadow><cylinderGeometry args={[1, 1.3, 1, 8]} /></instancedMesh>
    <instancedMesh ref={arm} args={[undefined, undefined, ls.length]} material={mats.pole}><boxGeometry args={[1, 1, 1]} /></instancedMesh>
    <instancedMesh ref={head} args={[undefined, undefined, ls.length]} material={mats.head}><boxGeometry args={[1, 1, 1]} /></instancedMesh>
    <instancedMesh ref={pool} args={[undefined, undefined, ls.length]} material={mats.pool} frustumCulled={false} renderOrder={2}><planeGeometry args={[1, 1]} /></instancedMesh>
    <instancedMesh ref={corePool} args={[undefined, undefined, core.length]} material={mats.pool} frustumCulled={false} renderOrder={2}><planeGeometry args={[1, 1]} /></instancedMesh>
  </group>;
}
