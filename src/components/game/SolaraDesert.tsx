import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { walkHeight } from "@/game/terrain";
import { devilAt, dustDevils, hoodoos, mesas, oasis, pillars, ribcage, type Palm, type Prop } from "@/game/solara-dressing";
import { windUniforms } from "@/game/wind-sway";
import { softSprite } from "./softSprite";
import { InstancedGlb } from "./InstancedGlb";

/** Solara Desert dressing: sandstone mesas and hoodoos, a palm oasis, a giant ribcage, half-buried arcology pillars and
 * wandering dust devils. Layout is pure (solara-dressing.ts); everything is procedural and instanced. */
export function SolaraDesert() {
  return (
    <group>
      <Mesas />
      <Hoodoos />
      <Oasis />
      <Ribcage />
      <Pillars />
      <DustDevils />
    </group>
  );
}

const tmp = new THREE.Object3D();
function useInstances<T>(ref: React.RefObject<THREE.InstancedMesh | null>, items: readonly T[], place: (o: THREE.Object3D, p: T, i: number) => void, color?: (p: T, i: number) => string) {
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    const c = new THREE.Color();
    items.forEach((p, i) => {
      tmp.position.set(0, 0, 0); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1);
      place(tmp, p, i); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix);
      if (color) m.setColorAt(i, c.set(color(p, i)));
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
}

/** strata: banded sandstone colours, darker low, pale cap */
const STRATA = ["#9a5a34", "#b8743f", "#c98b58", "#a8653a", "#d7a46d", "#e2bd88"];

/** mesas: 4–6 stacked, slightly stepped tiers per mesa, each tier its own stratum colour */
function Mesas() {
  const ms = useMemo(() => mesas(), []);
  const tiers = useMemo(() => ms.flatMap((m, k) => {
    const n = 4 + (k % 3), out: { x: number; z: number; y: number; rad: number; h: number; r: number; band: number }[] = [];
    let y = walkHeight(m.x, m.z) - 2, rad = (16 + m.s * 12) * 1.0;
    for (let i = 0; i < n; i++) {
      const h = 4 + ((k + i) % 3) * 2.5;
      out.push({ x: m.x, z: m.z, y: y + h / 2, rad, h, r: m.r + i * 0.4, band: (k + i) % STRATA.length });
      y += h; rad *= i === n - 2 ? 0.97 : 0.9;
    }
    return out;
  }), [ms]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances<{ x: number; z: number; y: number; rad: number; h: number; r: number; band: number }>(ref, tiers, (o, t) => { o.position.set(t.x, t.y, t.z); o.rotation.set(0, t.r, 0); o.scale.set(t.rad, t.h, t.rad * 0.8); }, (t) => STRATA[t.band]!);
  return <instancedMesh ref={ref} args={[undefined, undefined, tiers.length]} castShadow receiveShadow>
    <cylinderGeometry args={[0.92, 1, 1, 9, 1]} />
    <meshStandardMaterial roughness={0.95} flatShading />
  </instancedMesh>;
}

/** hoodoos: a tall eroded column with a darker caprock balanced on top */
function Hoodoos() {
  const hs = useMemo(() => hoodoos(), []);
  const col = useRef<THREE.InstancedMesh>(null), cap = useRef<THREE.InstancedMesh>(null);
  const height = (p: Prop) => 5 + p.s * 7;
  useInstances<Prop>(col, hs, (o, p) => { const h = height(p); o.position.set(p.x, walkHeight(p.x, p.z) + h / 2 - 0.5, p.z); o.rotation.set(p.tilt, p.r, p.tilt); o.scale.set(p.s * 1.1, h, p.s * 1.1); }, (_, i) => STRATA[i % 4]!);
  useInstances<Prop>(cap, hs, (o, p) => { const h = height(p); o.position.set(p.x + p.tilt * h, walkHeight(p.x, p.z) + h - 0.3, p.z); o.rotation.set(0, p.r, 0); o.scale.set(p.s * 1.9, p.s * 0.9, p.s * 1.6); });
  return <group>
    <instancedMesh ref={col} args={[undefined, undefined, hs.length]} castShadow><cylinderGeometry args={[0.55, 1, 1, 7]} /><meshStandardMaterial roughness={1} flatShading /></instancedMesh>
    <instancedMesh ref={cap} args={[undefined, undefined, hs.length]} castShadow><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#6e4027" roughness={1} flatShading /></instancedMesh>
  </group>;
}

function Oasis() {
  const o = useMemo(() => oasis(), []);
  const water = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (water.current) water.current.opacity = 0.78 + 0.05 * Math.sin(clock.elapsedTime * 1.3); });
  if (!o) return null;
  const y = walkHeight(o.x, o.z);
  return <group>
    {/* damp sand rim, then the pool */}
    <mesh position={[o.x, y + 0.06, o.z]} rotation-x={-Math.PI / 2} receiveShadow><circleGeometry args={[o.pool + 6, 40]} /><meshStandardMaterial color="#8a6a3e" roughness={1} polygonOffset polygonOffsetFactor={-1} /></mesh>
    <mesh position={[o.x, y + 0.12, o.z]} rotation-x={-Math.PI / 2}><circleGeometry args={[o.pool, 40]} /><meshStandardMaterial ref={water} color="#1f7f86" roughness={0.05} metalness={0.2} transparent opacity={0.8} polygonOffset polygonOffsetFactor={-2} /></mesh>
    <Palms palms={o.palms} />
    <Scrub cx={o.x} cz={o.z} r={o.pool + 4} />
  </group>;
}

/** oasis palms: the authored palm models (public/models/foliage/palm-a/b/c.glb, scripts/build-palms.py), one instanced
 * batch per variant, sized to each palm's height and leaning the way the layout says */
const PALM_URLS = ["/models/foliage/palm-a.glb", "/models/foliage/palm-b.glb", "/models/foliage/palm-c.glb"] as const;
const PALM_H = [10.6, 13.1, 8.6];
function Palms({ palms }: { palms: readonly Palm[] }) {
  const byVariant = useMemo(() => PALM_URLS.map((_, v) => palms.map((p, i) => ({ p, i })).filter(({ i }) => i % 3 === v)
    .map(({ p }) => ({ x: p.x, y: walkHeight(p.x, p.z) - 0.1, z: p.z, yaw: p.r, scale: p.h / PALM_H[v]! }))), [palms]);
  return <group>{byVariant.map((items, v) => <InstancedGlb key={v} url={PALM_URLS[v]!} items={items} />)}</group>;
}

function Scrub({ cx, cz, r }: { cx: number; cz: number; r: number }) {
  const items = useMemo(() => Array.from({ length: 26 }, (_, i) => { const a = i * 2.39996, d = r + (i % 5) * 1.6; return { x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, s: 0.6 + (i % 4) * 0.25 }; }), [cx, cz, r]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances<{ x: number; z: number; s: number }>(ref, items, (o, p) => { o.position.set(p.x, walkHeight(p.x, p.z) + 0.3 * p.s, p.z); o.scale.set(p.s * 1.3, p.s * 0.8, p.s * 1.3); }, (_, i) => (i % 3 ? "#5f8a34" : "#7a9a3c"));
  return <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial roughness={0.9} flatShading /></instancedMesh>;
}

/** a spine half-buried along the dune and 11 pairs of curved ribs arching over it, plus a skull at one end */
function Ribcage() {
  const rc = useMemo(() => ribcage(), []);
  const ribs = useMemo(() => {
    if (!rc) return [];
    const out: { x: number; z: number; side: number; k: number }[] = [];
    for (let i = 0; i < 11; i++) for (const side of [-1, 1]) {
      const a = (i / 10 - 0.5) * rc.length;
      out.push({ x: rc.x + Math.sin(rc.yaw) * a, z: rc.z + Math.cos(rc.yaw) * a, side, k: 1 - Math.abs(i / 10 - 0.45) * 0.9 });
    }
    return out;
  }, [rc]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances<{ x: number; z: number; side: number; k: number }>(ref, ribs, (o, b) => {
    o.position.set(b.x, walkHeight(b.x, b.z) - 1.5, b.z);
    o.rotation.set(0, rc!.yaw, 0);
    o.scale.set(b.side * (7 + 9 * b.k), 6 + 12 * b.k, 1);
  });
  if (!rc) return null;
  const bone = <meshStandardMaterial color="#e8dcc0" roughness={0.75} />;
  const y = walkHeight(rc.x, rc.z);
  const hy = walkHeight(rc.x + Math.sin(rc.yaw) * rc.length * 0.62, rc.z + Math.cos(rc.yaw) * rc.length * 0.62);
  return <group>
    {/* each rib is an arc of a torus, mirrored per side by a negative x scale, its plane facing along the spine */}
    <instancedMesh ref={ref} args={[undefined, undefined, ribs.length]} castShadow><torusGeometry args={[1, 0.035, 6, 14, Math.PI * 0.62]} />{bone}</instancedMesh>
    <group position={[rc.x, y, rc.z]} rotation-y={rc.yaw}>
      <mesh castShadow position-y={0.3} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.9, 0.7, rc.length * 1.2, 8]} />{bone}</mesh>
      <mesh castShadow position={[0, hy - y + 2, rc.length * 0.62]} rotation={[0.2, 0, 0.15]} scale={[4, 3, 6.5]}><dodecahedronGeometry args={[1, 1]} />{bone}</mesh>
      <mesh castShadow position={[0, 0, -rc.length * 0.66]} rotation-x={-Math.PI / 2 + 0.1}><coneGeometry args={[0.7, 10, 7]} />{bone}</mesh>
    </group>
  </group>;
}

/** fluted pillars from the Sunken Arcology colonnade: some standing and sunk, most toppled into the sand */
function Pillars() {
  const ps = useMemo(() => pillars(), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances<Prop>(ref, ps, (o, p, i) => {
    const fallen = i % 3 !== 0, len = 6 + p.s * 5;
    if (fallen) { o.position.set(p.x, walkHeight(p.x, p.z) + 0.5, p.z); o.rotation.set(Math.PI / 2 + p.tilt, p.r, 0); }
    else { o.position.set(p.x, walkHeight(p.x, p.z) + len / 2 - 2.5, p.z); o.rotation.set(p.tilt, p.r, p.tilt); }
    o.scale.set(p.s * 1.2, len, p.s * 1.2);
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, ps.length]} castShadow receiveShadow><cylinderGeometry args={[0.9, 1, 1, 12]} /><meshStandardMaterial color="#d9c6a0" roughness={0.85} flatShading /></instancedMesh>;
}

/** dust devils: a spinning funnel of soft sand sprites that wanders its dune field */
function DustDevils() {
  const ds = useMemo(() => dustDevils(), []);
  const tex = useMemo(() => softSprite("dot"), []);
  const ref = useRef<THREE.Group>(null);
  const N = 18;
  useFrame(({ clock }) => {
    const g = ref.current; if (!g) return;
    const t = clock.elapsedTime;
    ds.forEach((d, k) => {
      const col = g.children[k] as THREE.Group; if (!col) return;
      const p = devilAt(d, t);
      col.position.set(p.x, walkHeight(p.x, p.z), p.z);
      col.children.forEach((c, i) => {
        const f = ((i / N) + t * 0.15) % 1, a = t * 3 + i * 2.1;
        const rad = 0.6 + f * f * 6;
        c.position.set(Math.cos(a) * rad, f * d.h, Math.sin(a) * rad);
        const s = 1.5 + f * 4; c.scale.set(s, s, 1);
        ((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.min(1, f * 5) * (1 - f) * 0.45;
      });
    });
  });
  return <group ref={ref}>
    {ds.map((_, k) => <group key={k}>{Array.from({ length: N }, (_, i) => <sprite key={i}><spriteMaterial map={tex ?? null} color="#d9b27a" transparent depthWrite={false} fog /></sprite>)}</group>)}
  </group>;
}
