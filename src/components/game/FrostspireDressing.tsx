import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { walkHeight } from "@/game/terrain";
import { camps, drifts, frozenFall, iceCrystals, pines } from "@/game/frost-dressing";
import type { Prop } from "@/game/dressing-kit";
import { useInstances } from "./instancing";
import { PolyFoliage } from "./PolyFoliage";

/** Frostspire dressing: snow-laden pines, ice crystal clusters, snow drifts, frozen survey camps and a frozen waterfall.
 * Layout is pure (frost-dressing.ts); procedural and instanced. */
export function FrostspireDressing() {
  return <group><Pines /><Crystals /><Drifts /><Camps /><FrozenFall /></group>;
}

/** pines: the authored conifer (scripts/build-trees.py, three variants) as GPU instances; the stacked-cone pine below
 * only stands in while it loads, or if it can't */
function Pines() {
  const ps = useMemo(() => pines(), []);
  const [ready, setReady] = useState(false);
  const items = useMemo(() => ps.map((p) => ({ x: p.x, y: walkHeight(p.x, p.z) - 0.2, z: p.z, s: (6 + p.s * 7) / 11, r: p.r })), [ps]);
  return <group>
    <PolyFoliage kind="fir" items={items} height={11} sway={0.25} variants onReady={() => setReady(true)} />
    {!ready && <ConePines />}
  </group>;
}

function ConePines() {
  const ps = useMemo(() => pines(), []);
  const tiers = useMemo(() => ps.flatMap((p) => [0, 1, 2].map((k) => ({ p, k }))), [ps]);
  const trunk = useRef<THREE.InstancedMesh>(null), needles = useRef<THREE.InstancedMesh>(null), snow = useRef<THREE.InstancedMesh>(null);
  const H = (p: Prop) => 6 + p.s * 7;
  useInstances<Prop>(trunk, ps, (o, p) => { o.position.set(p.x, walkHeight(p.x, p.z) + 1, p.z); o.scale.set(p.s, 2.4, p.s); });
  const tier = (o: THREE.Object3D, { p, k }: { p: Prop; k: number }, cap: boolean) => {
    const h = H(p), y = walkHeight(p.x, p.z) + 1.6 + k * h * 0.26 + (cap ? h * 0.06 : 0);
    const rad = (1 - k * 0.28) * (1.4 + p.s * 1.1) * (cap ? 0.82 : 1);
    o.position.set(p.x, y + h * 0.18, p.z); o.rotation.set(0, p.r + k, 0); o.scale.set(rad, h * (cap ? 0.2 : 0.36), rad);
  };
  useInstances<{ p: Prop; k: number }>(needles, tiers, (o, t) => tier(o, t, false), (_, i) => (i % 5 ? "#1f3a33" : "#26453b"));
  useInstances<{ p: Prop; k: number }>(snow, tiers, (o, t) => tier(o, t, true));
  return <group>
    <instancedMesh ref={trunk} args={[undefined, undefined, ps.length]} castShadow><cylinderGeometry args={[0.18, 0.28, 1, 6]} /><meshStandardMaterial color="#3b2c22" roughness={1} /></instancedMesh>
    <instancedMesh ref={needles} args={[undefined, undefined, tiers.length]} castShadow receiveShadow><coneGeometry args={[1, 1, 8]} /><meshStandardMaterial roughness={0.95} flatShading /></instancedMesh>
    <instancedMesh ref={snow} args={[undefined, undefined, tiers.length]}><coneGeometry args={[1, 1, 8, 1, true]} /><meshStandardMaterial color="#eef5fb" roughness={0.7} flatShading /></instancedMesh>
  </group>;
}

/** ice crystals: clusters of 5 angled hexagonal prisms, translucent blue with a faint inner glow */
function Crystals() {
  const cs = useMemo(() => iceCrystals(), []);
  const shards = useMemo(() => cs.flatMap((c) => Array.from({ length: 5 }, (_, j) => ({ c, j }))), [cs]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances<{ c: Prop; j: number }>(ref, shards, (o, { c, j }) => {
    const a = c.r + j * 1.26, d = j === 0 ? 0 : 0.9 * c.s, h = (j === 0 ? 7 : 3 + (j % 3) * 1.5) * c.s;
    o.position.set(c.x + Math.cos(a) * d, walkHeight(c.x, c.z) + h * 0.4, c.z + Math.sin(a) * d);
    o.rotation.set(Math.cos(a) * (j ? 0.45 : 0.08), a, Math.sin(a) * (j ? 0.45 : 0.08));
    o.scale.set(0.5 * c.s, h, 0.5 * c.s);
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, shards.length]} castShadow>
    <cylinderGeometry args={[0.55, 0.8, 1, 6]} />
    <meshPhysicalMaterial color="#9fdcff" emissive="#2a7fb8" emissiveIntensity={0.35} roughness={0.1} metalness={0} transmission={0.4} thickness={1} transparent opacity={0.85} flatShading />
  </instancedMesh>;
}

/** snow drifts: wind-stretched low mounds, all leaning the same way */
function Drifts() {
  const ds = useMemo(() => drifts(), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances<Prop>(ref, ds, (o, p) => { o.position.set(p.x, walkHeight(p.x, p.z) - 0.4, p.z); o.rotation.set(0, 0.6 + p.tilt, 0); o.scale.set(3 + p.s * 4, 0.9 + p.s * 0.6, 1.5 + p.s * 1.5); });
  return <instancedMesh ref={ref} args={[undefined, undefined, ds.length]} receiveShadow><sphereGeometry args={[1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#f1f6fa" roughness={0.85} /></instancedMesh>;
}

/** camps: A-frame tents, crates and sleds around a dead beacon mast whose red light still blinks */
function Camps() {
  const cs = useMemo(() => camps(), []);
  const items = useMemo(() => cs.flatMap((c) => c.items.map((p, i) => ({ p, kind: i % 3 }))), [cs]);
  const tents = useMemo(() => items.filter((i) => i.kind === 0).map((i) => i.p), [items]);
  const crates = useMemo(() => items.filter((i) => i.kind === 1).map((i) => i.p), [items]);
  const sleds = useMemo(() => items.filter((i) => i.kind === 2).map((i) => i.p), [items]);
  const tRef = useRef<THREE.InstancedMesh>(null), cRef = useRef<THREE.InstancedMesh>(null), sRef = useRef<THREE.InstancedMesh>(null);
  useInstances<Prop>(tRef, tents, (o, p) => { o.position.set(p.x, walkHeight(p.x, p.z) + 0.9, p.z); o.rotation.set(0, p.r, 0); o.scale.set(1.6, 1.8, 2.4); }, (_, i) => (i % 2 ? "#b8462e" : "#c98a2e"));
  useInstances<Prop>(cRef, crates, (o, p) => { o.position.set(p.x, walkHeight(p.x, p.z) + 0.45 * p.s, p.z); o.rotation.set(0, p.r, 0); o.scale.setScalar(0.9 * p.s); });
  useInstances<Prop>(sRef, sleds, (o, p) => { o.position.set(p.x, walkHeight(p.x, p.z) + 0.25, p.z); o.rotation.set(0, p.r, p.tilt); o.scale.set(0.9, 0.3, 2.4); });
  const blink = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { if (blink.current) blink.current.opacity = clock.elapsedTime % 2 < 0.25 ? 1 : 0.1; });
  return <group>
    {/* a three-sided cone reads as an A-frame tent */}
    <instancedMesh ref={tRef} args={[undefined, undefined, tents.length]} castShadow><coneGeometry args={[1, 1, 3]} /><meshStandardMaterial roughness={0.9} /></instancedMesh>
    <instancedMesh ref={cRef} args={[undefined, undefined, crates.length]} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#4c5562" roughness={0.7} metalness={0.3} /></instancedMesh>
    <instancedMesh ref={sRef} args={[undefined, undefined, sleds.length]} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#6d4b2f" roughness={0.9} /></instancedMesh>
    {cs.map((c, i) => (
      <group key={i} position={[c.at.x, walkHeight(c.at.x, c.at.z), c.at.z]}>
        <mesh castShadow position-y={4}><cylinderGeometry args={[0.1, 0.16, 8, 6]} /><meshStandardMaterial color="#5a6470" metalness={0.6} roughness={0.5} /></mesh>
        <mesh position-y={8.1}><sphereGeometry args={[0.22, 8, 6]} /><meshBasicMaterial ref={i === 0 ? blink : null} color="#ff2a2a" transparent toneMapped={false} /></mesh>
      </group>
    ))}
  </group>;
}

/** a ribbon of blue ice poured down the steepest face, with an icicle fringe and a frozen pool at its foot */
function FrozenFall() {
  const f = useMemo(() => frozenFall(), []);
  if (!f) return null;
  const h = Math.max(6, f.top - f.bottom);
  return <group position={[f.x, (f.top + f.bottom) / 2, f.z]} rotation-y={f.yaw}>
    <mesh castShadow rotation-x={0.25}><boxGeometry args={[6, h * 1.15, 1.2, 4, 10, 1]} /><meshPhysicalMaterial color="#bfe8ff" roughness={0.15} transmission={0.3} thickness={1.5} transparent opacity={0.9} emissive="#3d8fc4" emissiveIntensity={0.2} /></mesh>
    {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[-2.6 + i * 0.65, h * 0.55, -0.7]} rotation-x={Math.PI}><coneGeometry args={[0.18, 1.2 + (i % 3) * 0.8, 5]} /><meshStandardMaterial color="#d8f1ff" roughness={0.2} /></mesh>)}
    <mesh position={[0, -h / 2 - 0.3, -3]} rotation-x={-Math.PI / 2}><circleGeometry args={[5, 24]} /><meshStandardMaterial color="#a8d8f0" roughness={0.05} metalness={0.2} /></mesh>
  </group>;
}
