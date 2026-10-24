import { useEffect, useMemo, useRef } from "react";
import { addObstacle } from "@/game/obstacles";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { barkTrunk, canopyCluster } from "@/game/organic-geometry";
import { walkHeight, WATER_LEVEL } from "@/game/terrain";
import { boardwalks, cypress, fungusPatches, glowAnchors, lilyPads, logs } from "@/game/swamp-dressing";
import { waterSurface, type Prop } from "@/game/dressing-kit";
import { useInstances } from "./instancing";
import { softSprite } from "./softSprite";
import { boardwalkSection, fallenLog, lilyPad, lotusBloom, mushroomCap, mushroomStem } from "@/game/wild-geometry";

const WG = { log: fallenLog(2), stem: mushroomStem(), cap: mushroomCap(), pad: lilyPad(), bloom: lotusBloom(), deck: boardwalkSection(4) };

/** Swamps dressing: moss-hung cypress with flared roots, lily pads and floating logs, glowing fungus, plank boardwalks
 * from the Airboat Hub, and fireflies. Layout is pure (swamp-dressing.ts); procedural and instanced. */
export function SwampDressing() {
  return <group><Cypress /><Lilies /><Logs /><Fungus /><Boardwalks /><Fireflies /></group>;
}

/** where a prop stands: on the ground, or on the water surface when the ground is below it */
const surface = (x: number, z: number) => Math.max(walkHeight(x, z), waterSurface(x, z) ?? -Infinity);

function Cypress() {
  const ts = useMemo(() => cypress(), []);
  const roots = useMemo(() => ts.flatMap((t) => Array.from({ length: 5 }, (_, k) => ({ t, k }))), [ts]);
  const moss = useMemo(() => ts.flatMap((t) => Array.from({ length: 4 }, (_, k) => ({ t, k }))), [ts]);
  const trunk = useRef<THREE.InstancedMesh>(null), root = useRef<THREE.InstancedMesh>(null), crown = useRef<THREE.InstancedMesh>(null), beard = useRef<THREE.InstancedMesh>(null);
  const H = (p: Prop) => 8 + p.s * 8;
  // bark-furrowed, buttressed trunk; tapered roots; a clumped crown (organic-geometry.ts) instead of tube + ball
  const trunkGeo = useMemo(() => barkTrunk(41, 0.35, 0.75, 0.6), []), rootGeo = useMemo(() => barkTrunk(43, 0.12, 0.45, 0), []), crownGeo = useMemo(() => canopyCluster(47), []);
  // cypress trunks are solid (the player, vehicles and the third-person camera stop at them instead of passing through)
  useEffect(() => { for (const t of ts) addObstacle("tree", t.x, t.z, 0.35 + 0.55 * t.s, 60, 0.8); }, [ts]);
  useInstances<Prop>(trunk, ts, (o, p) => { const h = H(p); o.position.set(p.x, walkHeight(p.x, p.z) + h / 2, p.z); o.rotation.set(p.tilt * 0.4, p.r, p.tilt * 0.3); o.scale.set(p.s, h, p.s); });
  // buttress roots flare out into the water
  useInstances<{ t: Prop; k: number }>(root, roots, (o, { t, k }) => { const a = t.r + k * 1.26; o.position.set(t.x + Math.cos(a) * 0.8 * t.s, walkHeight(t.x, t.z) + 0.6, t.z + Math.sin(a) * 0.8 * t.s); o.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); o.scale.set(t.s * 0.5, 2.2 * t.s, t.s * 0.5); });
  // flat, spreading canopy
  useInstances<Prop>(crown, ts, (o, p) => { const h = H(p); o.position.set(p.x, walkHeight(p.x, p.z) + h, p.z); o.rotation.set(0, p.r, 0); o.scale.set(3.2 + p.s * 2, 1.4 + p.s * 0.6, 3 + p.s * 2); }, (_, i) => (i % 3 ? "#2f4a2a" : "#3a5530"));
  // hanging moss beards under the canopy rim
  useInstances<{ t: Prop; k: number }>(beard, moss, (o, { t, k }) => { const h = H(t), a = t.r + k * 1.57, rr = 2.4 + t.s * 1.5; o.position.set(t.x + Math.cos(a) * rr, walkHeight(t.x, t.z) + h - 2.4, t.z + Math.sin(a) * rr); o.rotation.set(0, a, 0); o.scale.set(1.2, 3.5 + (k % 2) * 1.5, 1); });
  return <group>
    <instancedMesh ref={trunk} args={[undefined, undefined, ts.length]} castShadow geometry={trunkGeo}><meshStandardMaterial color="#4a3f33" roughness={1} /></instancedMesh>
    <instancedMesh ref={root} args={[undefined, undefined, roots.length]} castShadow geometry={rootGeo}><meshStandardMaterial color="#43382d" roughness={1} /></instancedMesh>
    <instancedMesh ref={crown} args={[undefined, undefined, ts.length]} castShadow geometry={crownGeo}><meshStandardMaterial roughness={0.95} /></instancedMesh>
    <instancedMesh ref={beard} args={[undefined, undefined, moss.length]}><planeGeometry args={[1, 1, 1, 3]} /><meshStandardMaterial color="#7c8a5a" roughness={1} side={THREE.DoubleSide} transparent opacity={0.85} /></instancedMesh>
  </group>;
}

function Lilies() {
  const ls = useMemo(() => lilyPads(), []);
  const pad = useRef<THREE.InstancedMesh>(null), bloom = useRef<THREE.InstancedMesh>(null);
  const flowers = useMemo(() => ls.filter((_, i) => i % 7 === 0), [ls]);
  useInstances<Prop>(pad, ls, (o, p) => { o.position.set(p.x, (waterSurface(p.x, p.z) ?? WATER_LEVEL) + 0.03, p.z); o.rotation.set(-Math.PI / 2, 0, p.r); o.scale.setScalar(0.5 + p.s * 0.5); }, (_, i) => (i % 4 ? "#3a5a28" : "#4d6a30"));
  useInstances<Prop>(bloom, flowers, (o, p) => { o.position.set(p.x, (waterSurface(p.x, p.z) ?? WATER_LEVEL) + 0.04, p.z); o.scale.setScalar(0.3); }, (_, i) => (i % 2 ? "#d9b8cc" : "#e8ddd2"));
  return <group>
    {/* a circle with a notch reads as a lily pad */}
    <instancedMesh ref={pad} args={[WG.pad, undefined, ls.length]} receiveShadow><meshStandardMaterial roughness={0.6} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} /></instancedMesh>
    <instancedMesh ref={bloom} args={[WG.bloom, undefined, flowers.length]}><meshStandardMaterial roughness={0.6} /></instancedMesh>
  </group>;
}

function Logs() {
  const ls = useMemo(() => logs(), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances<Prop>(ref, ls, (o, p) => { o.position.set(p.x, surface(p.x, p.z) + 0.15, p.z); o.rotation.set(Math.PI / 2, 0, p.r); o.scale.set(0.45 * p.s, 5 + p.s * 4, 0.45 * p.s); });
  return <instancedMesh ref={ref} args={[WG.log, undefined, ls.length]} castShadow receiveShadow><meshStandardMaterial color="#3a3026" roughness={1} /></instancedMesh>;
}

/** bioluminescent mushrooms: pale stems, glowing caps that pulse slowly */
function Fungus() {
  const ps = useMemo(() => fungusPatches().flat(), []);
  const stem = useRef<THREE.InstancedMesh>(null), cap = useRef<THREE.InstancedMesh>(null), mat = useRef<THREE.MeshStandardMaterial>(null);
  useInstances<Prop>(stem, ps, (o, p) => { const h = 0.4 + p.s * 0.9; o.position.set(p.x, walkHeight(p.x, p.z) + h / 2, p.z); o.scale.set(0.12 * p.s, h, 0.12 * p.s); });
  useInstances<Prop>(cap, ps, (o, p) => { const h = 0.4 + p.s * 0.9; o.position.set(p.x, walkHeight(p.x, p.z) + h, p.z); o.scale.set(0.45 * p.s, 0.25 * p.s, 0.45 * p.s); }, (_, i) => (i % 3 ? "#57e0c6" : "#b07cff"));
  useFrame(({ clock }) => { if (mat.current) mat.current.emissiveIntensity = 0.9 + 0.4 * Math.sin(clock.elapsedTime * 0.8); });
  return <group>
    <instancedMesh ref={stem} args={[WG.stem, undefined, ps.length]}><meshStandardMaterial color="#d8d2c0" roughness={0.8} /></instancedMesh>
    <instancedMesh ref={cap} args={[WG.cap, undefined, ps.length]}><meshStandardMaterial ref={mat} color="#ffffff" emissive="#3fbfa8" emissiveIntensity={1} roughness={0.5} toneMapped={false} /></instancedMesh>
  </group>;
}

/** boardwalks: planks across stilts, slightly uneven, a lantern post every few sections */
function Boardwalks() {
  const runs = useMemo(() => boardwalks(), []);
  const planks = useMemo(() => runs.flat(), [runs]);
  const posts = useMemo(() => planks.filter((_, i) => i % 2 === 0).flatMap((p) => [-1, 1].map((side) => ({ p, side }))), [planks]);
  const lamps = useMemo(() => planks.filter((_, i) => i % 5 === 2), [planks]);
  const deck = useRef<THREE.InstancedMesh>(null), post = useRef<THREE.InstancedMesh>(null);
  const deckY = (x: number, z: number) => surface(x, z) + 0.8;
  useInstances<{ x: number; z: number; yaw: number }>(deck, planks, (o, p, i) => { o.position.set(p.x, deckY(p.x, p.z), p.z); o.rotation.set((i % 3 - 1) * 0.02, p.yaw, (i % 2 ? 1 : -1) * 0.015); o.scale.set(2.2, 0.12, 2.5); }, (_, i) => (i % 4 ? "#6a5440" : "#5a4636"));
  useInstances<{ p: { x: number; z: number; yaw: number }; side: number }>(post, posts, (o, { p, side }) => { const x = p.x + Math.cos(p.yaw) * side, z = p.z - Math.sin(p.yaw) * side, top = deckY(p.x, p.z); const bot = walkHeight(x, z) - 0.5; o.position.set(x, (top + bot) / 2, z); o.scale.set(0.12, Math.max(0.5, top - bot), 0.12); });
  return <group>
    <instancedMesh ref={deck} args={[WG.deck, undefined, planks.length]} castShadow receiveShadow><meshStandardMaterial roughness={1} /></instancedMesh>
    <instancedMesh ref={post} args={[undefined, undefined, posts.length]} castShadow><cylinderGeometry args={[1, 0.85, 1, 7]} /><meshStandardMaterial color="#3e3127" roughness={1} /></instancedMesh>
    {lamps.map((p, i) => (
      <group key={i} position={[p.x + Math.cos(p.yaw) * 1.1, deckY(p.x, p.z), p.z - Math.sin(p.yaw) * 1.1]}>
        <mesh position-y={1}><cylinderGeometry args={[0.05, 0.06, 2, 7]} /><meshStandardMaterial color="#2c2620" roughness={0.9} /></mesh>
        <mesh position={[0, 2.02, 0.12]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.02, 0.02, 0.26, 5]} /><meshStandardMaterial color="#2c2620" /></mesh>
        {/* hanging storm lantern: cage, glass, cap */}
        <group position={[0, 1.8, 0.24]}><mesh><cylinderGeometry args={[0.09, 0.09, 0.2, 8]} /><meshBasicMaterial color="#ffc870" toneMapped={false} /></mesh><mesh position-y={0.13}><coneGeometry args={[0.12, 0.08, 8]} /><meshStandardMaterial color="#2c2620" metalness={0.5} roughness={0.6} /></mesh><mesh position-y={-0.11}><cylinderGeometry args={[0.1, 0.1, 0.03, 8]} /><meshStandardMaterial color="#2c2620" metalness={0.5} roughness={0.6} /></mesh></group>
      </group>
    ))}
  </group>;
}

/** fireflies: soft green-gold motes looping around a few anchors */
function Fireflies() {
  const as = useMemo(() => glowAnchors(), []);
  const tex = useMemo(() => softSprite("dot"), []);
  const ref = useRef<THREE.Group>(null);
  const N = 14;
  useFrame(({ clock }) => {
    const g = ref.current; if (!g) return;
    const t = clock.elapsedTime;
    g.children.forEach((grp, k) => {
      const a = as[k]!; grp.position.set(a.x, surface(a.x, a.z) + 1.2, a.z);
      grp.children.forEach((c, i) => {
        const ph = i * 1.7 + k;
        c.position.set(Math.sin(t * 0.4 + ph) * 6, 0.5 + Math.sin(t * 0.9 + ph * 2) * 1.2, Math.cos(t * 0.33 + ph) * 6);
        ((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.3 + ph * 3));
      });
    });
  });
  return <group ref={ref}>{as.map((_, k) => <group key={k}>{Array.from({ length: N }, (_, i) => <sprite key={i} scale={[0.35, 0.35, 1]}><spriteMaterial map={tex ?? null} color="#d6ff7a" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></sprite>)}</group>)}</group>;
}
