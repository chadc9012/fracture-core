import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { enemyBodyScale } from "@/game/enemy-visuals";
import { MAX_SUMMONED, isSummoned } from "@/game/encounter-sim";
import type { WorldSim } from "@/game/sim";

/** Procedural bodies for the troops Astravore calls in (Void Reaver, Void Vanguard, Void Arcanist, Void Sentinel): void-violet
 *  armor with glowing seams, so they read as his spawn rather than as ordinary raiders. A fixed pool of MAX_SUMMONED stands in for
 *  the live summoned machines; each frame a pool entry is given a machine, shown as its profile's body, and moved with it. */
const VIOLET = "#b06cff", HOT = "#e6c8ff";
const armor = <meshStandardMaterial color="#1b1530" roughness={0.55} metalness={0.35} emissive="#3a2270" emissiveIntensity={1.0} />;
const plate = <meshStandardMaterial color="#2a2142" roughness={0.5} metalness={0.4} emissive="#4d2a90" emissiveIntensity={1.1} />;
const glow = (c: string = VIOLET, k = 1.5) => <meshStandardMaterial color={c} emissive={c} emissiveIntensity={k} toneMapped={false} />;
const Crack = ({ p, s, r = [0, 0, 0] }: { p: [number, number, number]; s: [number, number, number]; r?: [number, number, number] }) => <mesh position={p} rotation={r}><boxGeometry args={s} />{glow()}</mesh>;

/** Void Vanguard: hulking frontline brute, horned helm, broad pauldrons and a curved shield slab */
function Vanguard() {
  return <group name="Void Vanguard">
    <mesh position={[0, 1.1, 0]}><boxGeometry args={[1.5, 1.3, 0.9]} />{armor}</mesh>
    <mesh position={[0, 2.0, 0.1]}><boxGeometry args={[0.55, 0.55, 0.55]} />{plate}</mesh>
    {[-0.2, 0.2].map((x) => <mesh key={x} position={[x * 1.6, 2.5, 0.05]} rotation={[0, 0, x * 1.5]}><coneGeometry args={[0.1, 0.55, 5]} />{plate}</mesh>)}
    <Crack p={[0, 2.0, 0.3]} s={[0.36, 0.06, 0.04]} />
    {[-1, 1].map((x) => <mesh key={x} position={[x * 1.05, 1.75, 0]} rotation={[0, 0, x * -0.35]}><boxGeometry args={[0.9, 0.35, 1.0]} />{plate}</mesh>)}
    {[-0.55, 0.55].map((x) => <mesh key={x} position={[x, 0.35, 0]}><boxGeometry args={[0.6, 0.9, 0.7]} />{armor}</mesh>)}
    <mesh position={[-1.25, 1.2, 0.35]} rotation={[0, 0.25, 0.1]}><boxGeometry args={[0.2, 2.1, 1.1]} />{plate}</mesh>
    <Crack p={[-1.34, 1.2, 0.35]} s={[0.05, 1.9, 0.08]} />
    <Crack p={[0, 1.2, 0.46]} s={[0.1, 0.9, 0.04]} />
    <Crack p={[0.45, 1.0, 0.46]} s={[0.5, 0.05, 0.04]} r={[0, 0, 0.5]} />
    <Crack p={[1.25, 0.9, 0.1]} s={[0.1, 0.1, 1.4]} />
  </group>;
}
/** Void Reaver: lean, hooded assassin on a forward lean carrying two long curved blades */
function Reaver() {
  return <group name="Void Reaver">
    <group rotation={[0.35, 0, 0]}>
      <mesh position={[0, 1.15, 0]}><boxGeometry args={[0.6, 1.0, 0.4]} />{armor}</mesh>
      <mesh position={[0, 1.9, 0.12]}><coneGeometry args={[0.32, 0.6, 6]} />{armor}</mesh>
      <Crack p={[0, 1.78, 0.34]} s={[0.2, 0.06, 0.04]} />
      <Crack p={[0, 1.15, 0.22]} s={[0.06, 0.8, 0.04]} />
      {[-1, 1].map((x) => <group key={x} position={[x * 0.55, 1.05, 0.3]} rotation={[0.3, 0, x * 0.5]}>
        <mesh><boxGeometry args={[0.12, 0.7, 0.12]} />{armor}</mesh>
        <mesh position={[0, -0.1, 0.5]} rotation={[0.9, 0, 0]}><torusGeometry args={[0.7, 0.05, 5, 18, 2.2]} />{glow(HOT, 2)}</mesh>
      </group>)}
    </group>
    {[-0.22, 0.22].map((x) => <mesh key={x} position={[x, 0.45, x > 0 ? 0.25 : -0.2]} rotation={[x > 0 ? 0.5 : -0.4, 0, 0]}><boxGeometry args={[0.2, 0.95, 0.22]} />{armor}</mesh>)}
  </group>;
}
/** Void Arcanist: tall caster in a tattered robe, crescent-horned crown, a black orb ringed in violet in each raised hand */
function Arcanist() {
  return <group name="Void Arcanist">
    <mesh position={[0, 0.95, 0]}><coneGeometry args={[0.55, 1.9, 8]} />{armor}</mesh>
    <mesh position={[0, 1.7, 0]}><boxGeometry args={[0.5, 0.8, 0.35]} />{plate}</mesh>
    <mesh position={[0, 2.25, 0]}><sphereGeometry args={[0.2, 10, 8]} />{armor}</mesh>
    <Crack p={[0, 2.25, 0.17]} s={[0.2, 0.05, 0.04]} />
    {[-1, 1].map((x) => <mesh key={x} position={[x * 0.32, 2.65, 0]} rotation={[0, 0, x * -0.3]}><torusGeometry args={[0.38, 0.045, 5, 16, 3.3]} />{plate}</mesh>)}
    <Crack p={[0, 1.7, 0.19]} s={[0.06, 0.6, 0.04]} />
    {[-1, 1].map((x) => <group key={x} name="orb" position={[x * 0.95, 1.75, 0.35]}>
      <mesh><sphereGeometry args={[0.24, 12, 10]} /><meshStandardMaterial color="#05020b" roughness={0.2} /></mesh>
      <mesh rotation={[1.2, 0, x * 0.6]}><torusGeometry args={[0.36, 0.025, 5, 24]} />{glow(VIOLET, 1.8)}</mesh>
    </group>)}
    {[-1, 1].map((x) => <mesh key={x} position={[x * 0.6, 1.8, 0.2]} rotation={[0.6, 0, x * -1.0]}><boxGeometry args={[0.1, 0.8, 0.1]} />{armor}</mesh>)}
  </group>;
}
/** Void Sentinel: six-legged war-frame with a heavy cannon and a single glowing eye */
function Sentinel() {
  return <group name="Void Sentinel">
    <mesh position={[0, 1.7, 0]}><boxGeometry args={[1.5, 0.9, 2.0]} />{armor}</mesh>
    <mesh position={[0, 2.25, -0.1]}><boxGeometry args={[1.0, 0.4, 1.3]} />{plate}</mesh>
    <mesh position={[0, 1.8, 1.05]}><sphereGeometry args={[0.28, 10, 8]} />{glow(HOT, 2)}</mesh>
    <mesh position={[0.95, 1.9, 0.5]}><boxGeometry args={[0.35, 0.35, 2.2]} />{plate}</mesh>
    <mesh position={[0.95, 1.9, 1.6]}><boxGeometry args={[0.2, 0.2, 0.15]} />{glow(HOT, 2)}</mesh>
    <Crack p={[0, 2.12, 0.5]} s={[0.08, 0.04, 1.2]} />
    {[-1, 1].flatMap((x) => [-0.8, 0, 0.8].map((z) => <group key={`${x}${z}`} position={[x * 0.75, 1.5, z]} rotation={[0, 0, x * -0.9]}>
      <mesh position={[0, -0.5, 0]}><boxGeometry args={[0.14, 1.4, 0.16]} />{armor}</mesh>
      <mesh position={[0, -1.15, 0]} rotation={[0, 0, x * 0.9]}><coneGeometry args={[0.1, 0.8, 4]} />{glow(VIOLET, 1.6)}</mesh>
    </group>))}
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
      const orbs = body?.children.filter((c) => c.name === "orb") ?? [];
      orbs.forEach((o, k) => { o.position.y = 1.75 + Math.sin(t * 2 + i + k * 2) * 0.1; });
      if (m.profile === "Void Reaver") body!.position.y = Math.abs(Math.sin(t * 9 + i)) * 0.05;
    });
  });
  return <group ref={root}>{slots.map((i) => <group key={i} visible={false}><Vanguard /><Reaver /><Arcanist /><Sentinel /></group>)}</group>;
}
