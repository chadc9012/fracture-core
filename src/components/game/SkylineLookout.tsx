import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LEDGE, fissures, lookoutDeck, skylineLookout } from "@/game/skyline-lookout";
import { registerDeck } from "@/game/district-decks";
import { organicRock } from "@/game/organic-geometry";
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";

/** The trailer's cracked ledge over the skyline (skyline-lookout.ts): a weathered rock slab you can walk out onto above the Nexus
 * skyline, on a supporting boulder, with violet Fracture fissures pulsing across its top and a few fracture crystals at its root.
 * Scenery only; the slab top is a registered deck so walkHeight, the camera and vehicles all agree on it. */
export function SkylineLookout() {
  const l = useMemo(() => skylineLookout(), []);
  useEffect(() => { if (l) registerDeck(lookoutDeck(l)); }, [l]);
  const geo = useMemo(() => ({ slab: organicRock(1, 61, 2, 0.16), base: organicRock(1, 67, 1, 0.3), crystal: new THREE.OctahedronGeometry(0.35, 0).scale(0.6, 2.2, 0.6), crack: new THREE.BoxGeometry(1, 0.06, 0.1) }), []);
  const mats = useMemo(() => ({
    rock: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#6e655c", roughness: 0.95 }), weatheredConcreteTexture(), 3),
    crack: new THREE.MeshStandardMaterial({ color: "#2a1a4a", emissive: "#8a5cff", emissiveIntensity: 2.2, toneMapped: false }),
    crystal: new THREE.MeshStandardMaterial({ color: "#cdbdff", emissive: "#6a3cff", emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.2, toneMapped: false }),
  }), []);
  useEffect(() => () => { Object.values(geo).forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); }, [geo, mats]);
  const cracks = useMemo(() => fissures(), []);
  const t = useRef(0);
  useFrame((_, dt) => { t.current += dt; mats.crack.emissiveIntensity = 1.6 + 0.9 * (0.5 + 0.5 * Math.sin(t.current * 1.7)); });
  if (!l) return null;
  const yaw = Math.atan2(l.dirX, l.dirZ), top = l.y + LEDGE.lift;
  return (
    <group name="site:skyline-lookout" position={[l.x, 0, l.z]} rotation-y={yaw}>
      {/* the slab: long axis along the view, its top flush with the deck */}
      <mesh geometry={geo.slab} material={mats.rock} position={[0, top - 0.55, LEDGE.length / 2]} scale={[LEDGE.width / 2 + 0.25, 0.6, LEDGE.length / 2 + 0.4]} castShadow receiveShadow />
      {/* the boulder it rests on, sunk into the slope */}
      <mesh geometry={geo.base} material={mats.rock} position={[0.3, l.y - 1.6, 1.6]} scale={[3.2, 2.4, 3.6]} castShadow receiveShadow />
      {cracks.map((c, i) => {
        const [a0, c0] = c.a, [a1, c1] = c.b, len = Math.hypot(a1 - a0, c1 - c0);
        return <mesh key={i} geometry={geo.crack} material={mats.crack} position={[(c0 + c1) / 2, top + 0.09, LEDGE.length / 2 + (a0 + a1) / 2]} rotation-y={Math.atan2(-(a1 - a0), c1 - c0)} scale={[len, 1, 1]} />;
      })}
      {[[-1.1, 0.6, -12], [1.3, 1.1, 18], [-0.4, 1.6, 6]].map(([x, z, r], i) => (
        <mesh key={i} geometry={geo.crystal} material={mats.crystal} position={[x!, top + 0.3, z!]} rotation={[0.2 * (i - 1), (r! * Math.PI) / 180, 0.25 * (1 - i)]} />
      ))}
    </group>
  );
}
