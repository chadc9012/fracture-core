import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { enemyBodyScale } from "@/game/enemy-visuals";
import { MAX_SUMMONED, isSummoned } from "@/game/encounter-sim";
import type { WorldSim } from "@/game/sim";

/** Procedural bodies for the troops Astravore calls in (Void Hound, Dimensional Knight, Reality Mage, Star Sentinel): void-violet
 *  armor with glowing seams, so they read as his spawn rather than as ordinary raiders. A fixed pool of MAX_SUMMONED stands in for
 *  the live summoned machines; each frame a pool entry is given a machine, shown as its profile's body, and moved with it. */
const VIOLET = "#a463ff", CYAN = "#58d8ef";
const armor = <meshStandardMaterial color="#2b2340" roughness={0.6} metalness={0.3} emissive="#3b2466" emissiveIntensity={0.5} />;
const glow = (c: string, k = 2.2) => <meshStandardMaterial color={c} emissive={c} emissiveIntensity={k} toneMapped={false} />;

function Hound() {
  return <group name="Void Hound">
    <mesh position={[0, 0.75, 0]}><boxGeometry args={[0.7, 0.55, 1.7]} />{armor}</mesh>
    <mesh position={[0, 0.9, 1.1]} rotation={[0.25, 0, 0]}><boxGeometry args={[0.5, 0.42, 0.7]} />{armor}</mesh>
    {[-0.12, 0.12].map((x) => <mesh key={x} position={[x, 1.0, 1.46]}><boxGeometry args={[0.08, 0.06, 0.06]} />{glow(VIOLET, 4)}</mesh>)}
    <mesh position={[0, 1.08, 0]}><boxGeometry args={[0.1, 0.06, 1.5]} />{glow(VIOLET)}</mesh>
    {[[-0.38, 0.6], [0.38, 0.6], [-0.38, -0.6], [0.38, -0.6]].map(([x, z], i) => <mesh key={i} position={[x!, 0.35, z!]}><boxGeometry args={[0.18, 0.7, 0.2]} />{armor}</mesh>)}
  </group>;
}
function Knight() {
  return <group name="Dimensional Knight">
    <mesh position={[0, 1.0, 0]}><boxGeometry args={[0.9, 1.1, 0.5]} />{armor}</mesh>
    <mesh position={[0, 1.78, 0]}><boxGeometry args={[0.42, 0.45, 0.42]} />{armor}</mesh>
    <mesh position={[0, 1.8, 0.22]}><boxGeometry args={[0.34, 0.07, 0.04]} />{glow(CYAN, 4)}</mesh>
    {[-0.62, 0.62].map((x) => <mesh key={x} position={[x, 1.5, 0]}><boxGeometry args={[0.4, 0.3, 0.5]} />{armor}</mesh>)}
    <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.7, 0.8, 0.4]} />{armor}</mesh>
    <mesh position={[0.78, 1.05, 0.3]} rotation={[0.3, 0, 0]}><boxGeometry args={[0.1, 0.1, 1.9]} />{glow(CYAN)}</mesh>
    <mesh position={[0, 1.05, 0.27]}><boxGeometry args={[0.5, 0.08, 0.04]} />{glow(VIOLET)}</mesh>
  </group>;
}
function Mage() {
  return <group name="Reality Mage">
    <mesh position={[0, 0.9, 0]}><coneGeometry args={[0.6, 1.8, 8]} />{armor}</mesh>
    <mesh position={[0, 1.95, 0]}><sphereGeometry args={[0.24, 12, 10]} />{armor}</mesh>
    <mesh position={[0, 1.95, 0.18]}><boxGeometry args={[0.22, 0.05, 0.04]} />{glow(VIOLET, 4)}</mesh>
    <mesh name="orb" position={[0.7, 1.7, 0.3]}><icosahedronGeometry args={[0.22, 1]} />{glow(CYAN, 3)}</mesh>
    <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.8, 0.03, 6, 28]} />{glow(VIOLET, 2)}</mesh>
  </group>;
}
function Sentinel() {
  return <group name="Star Sentinel">
    <mesh position={[0, 1.4, 0]}><boxGeometry args={[1.2, 2.8, 0.9]} />{armor}</mesh>
    <mesh position={[0, 3.2, 0]}><octahedronGeometry args={[0.55, 0]} />{glow(CYAN, 3)}</mesh>
    <mesh name="halo" position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.95, 0.05, 6, 36]} />{glow(VIOLET, 3)}</mesh>
    <mesh position={[0, 1.6, 0.47]}><boxGeometry args={[0.16, 1.6, 0.04]} />{glow(VIOLET, 3)}</mesh>
    {[-0.85, 0.85].map((x) => <mesh key={x} position={[x, 1.8, 0]}><boxGeometry args={[0.45, 1.8, 0.6]} />{armor}</mesh>)}
  </group>;
}

export function SummonBodies({ sim }: { sim: WorldSim }) {
  const root = useRef<THREE.Group>(null!);
  const slots = useMemo(() => Array.from({ length: MAX_SUMMONED }, (_, i) => i), []);
  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    const live = sim.machines.filter(isSummoned);
    const t = state.clock.elapsedTime;
    slots.forEach((i) => {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) return;
      const m = live[i];
      node.visible = !!m;
      if (!m) return;
      for (const c of node.children) c.visible = c.name === m.profile;
      const s = enemyBodyScale(m.scale);
      node.position.set(m.x, m.y - 2.2 * m.scale, m.z);
      node.rotation.y = m.rot;
      node.scale.setScalar(s * 0.9);
      const body = node.children.find((c) => c.name === m.profile);
      const orb = body?.getObjectByName("orb"), halo = body?.getObjectByName("halo");
      if (orb) orb.position.y = 1.7 + Math.sin(t * 2 + i) * 0.12;
      if (halo) halo.rotation.z = t * 1.5;
      if (m.profile === "Void Hound") body!.position.y = Math.abs(Math.sin(t * 9 + i)) * 0.05;
    });
  });
  return <group ref={root}>{slots.map((i) => <group key={i} visible={false}><Hound /><Knight /><Mage /><Sentinel /></group>)}</group>;
}
