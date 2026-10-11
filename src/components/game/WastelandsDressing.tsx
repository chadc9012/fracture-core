import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { walkHeight } from "@/game/terrain";
import { billboards, fires, junkHeaps, pylons, ruins } from "@/game/waste-dressing";
import type { Prop } from "@/game/dressing-kit";
import { useInstances } from "./instancing";
import { softSprite } from "./softSprite";

type Ruin = ReturnType<typeof ruins>[number];

/** Wastelands dressing — ruined city outskirts: gutted concrete shells, leaning pylons with sagging cables, junk heaps,
 * tyre piles, rusted billboards and burning debris. Layout is pure (waste-dressing.ts); procedural and instanced. */
export function WastelandsDressing() {
  return <group><Ruins /><Pylons /><Junk /><Billboards />{fires().map((f, i) => <Smoke key={i} x={f.x} z={f.z} seed={i} />)}</group>;
}

/** Each ruin is built from instanced parts: per floor, four wall slabs with window gaps implied by pillars; upper
 * floors of a broken building are missing on one side; floor slabs; rebar sticking out of the broken top. */
function Ruins() {
  const rs = useMemo(() => ruins(), []);
  const parts = useMemo(() => {
    const walls: { x: number; y: number; z: number; w: number; h: number; t: number; yaw: number }[] = [];
    const slabs: { x: number; y: number; z: number; w: number; d: number; yaw: number; tilt: number }[] = [];
    const rebar: { x: number; y: number; z: number; yaw: number; lean: number }[] = [];
    const FH = 3.4;
    for (const r of rs) {
      const base = walkHeight(r.x, r.z) - 0.4, cos = Math.cos(r.r), sin = Math.sin(r.r);
      const at = (lx: number, lz: number) => ({ x: r.x + lx * cos + lz * sin, z: r.z - lx * sin + lz * cos });
      for (let f = 0; f < r.floors; f++) {
        const y = base + f * FH;
        // collapse: on broken buildings the top floors lose walls on one side, the very top loses most of them
        const top = f >= r.floors - 1, side = r.broken > 0.5 ? 1 : -1;
        const keep = (k: number) => !(r.broken > 0.35 && f > 0 && (top ? k !== 0 : k === (side > 0 ? 1 : 3) && f >= r.floors - 2));
        // walls are split into 3 piers per face, so the gaps read as blown-out windows
        const faces = [[0, r.d / 2, r.w, 0], [r.w / 2, 0, r.d, Math.PI / 2], [0, -r.d / 2, r.w, Math.PI], [-r.w / 2, 0, r.d, -Math.PI / 2]] as const;
        faces.forEach(([lx, lz, len, yaw], k) => {
          if (!keep(k)) return;
          for (let pier = 0; pier < 3; pier++) {
            const off = (pier - 1) * len / 3, px = lx + Math.cos(yaw) * off, pz = lz - Math.sin(yaw) * off;
            const p = at(px, pz);
            walls.push({ x: p.x, y: y + FH / 2, z: p.z, w: len / 3 * 0.62, h: f === 0 || pier !== 1 ? FH : FH * 0.45, t: 0.35, yaw: r.r + yaw });
          }
        });
        if (f > 0 && !(top && r.broken > 0.35)) { const p = at(0, 0); slabs.push({ x: p.x, y, z: p.z, w: r.w, d: r.d, yaw: r.r, tilt: 0 }); }
      }
      // a fallen slab leaning against the base of broken buildings, and rebar from the top
      if (r.broken > 0.35) {
        const p = at(r.w * 0.6 * (r.broken > 0.5 ? 1 : -1), 0);
        slabs.push({ x: p.x, y: walkHeight(p.x, p.z) + 1.6, z: p.z, w: r.w * 0.7, d: r.d * 0.6, yaw: r.r, tilt: 0.9 * (r.broken > 0.5 ? 1 : -1) });
        for (let k = 0; k < 6; k++) { const q = at((k / 5 - 0.5) * r.w * 0.9, r.d / 2); rebar.push({ x: q.x, y: base + (r.floors - 1) * FH + 1, z: q.z, yaw: r.r, lean: (k % 3 - 1) * 0.35 }); }
      }
    }
    return { walls, slabs, rebar };
  }, [rs]);
  const wRef = useRef<THREE.InstancedMesh>(null), sRef = useRef<THREE.InstancedMesh>(null), bRef = useRef<THREE.InstancedMesh>(null);
  useInstances<(typeof parts.walls)[number]>(wRef, parts.walls, (o, p) => { o.position.set(p.x, p.y, p.z); o.rotation.set(0, p.yaw, 0); o.scale.set(p.w, p.h, p.t); }, (_, i) => ["#8d877d", "#7b766d", "#9a9488", "#6f6a62"][i % 4]!);
  useInstances<(typeof parts.slabs)[number]>(sRef, parts.slabs, (o, p) => { o.position.set(p.x, p.y, p.z); o.rotation.set(0, p.yaw, p.tilt); o.scale.set(p.w, 0.3, p.d); });
  useInstances<(typeof parts.rebar)[number]>(bRef, parts.rebar, (o, p) => { o.position.set(p.x, p.y, p.z); o.rotation.set(p.lean, p.yaw, p.lean * 0.5); o.scale.set(0.05, 2.2, 0.05); });
  return <group>
    <instancedMesh ref={wRef} args={[undefined, undefined, parts.walls.length]} castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={0.95} /></instancedMesh>
    <instancedMesh ref={sRef} args={[undefined, undefined, parts.slabs.length]} castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#77726a" roughness={1} /></instancedMesh>
    <instancedMesh ref={bRef} args={[undefined, undefined, parts.rebar.length]}><cylinderGeometry args={[1, 1, 1, 4]} /><meshStandardMaterial color="#5a3a26" roughness={0.8} metalness={0.5} /></instancedMesh>
  </group>;
}

/** lattice pylons (4 legs + cross arm) with cables sagging between neighbours */
function Pylons() {
  const ps = useMemo(() => pylons(), []);
  const H = 18;
  const legs = useMemo(() => ps.flatMap((p) => [0, 1, 2, 3].map((k) => ({ p, k }))), [ps]);
  const lRef = useRef<THREE.InstancedMesh>(null), aRef = useRef<THREE.InstancedMesh>(null);
  useInstances<{ p: Prop; k: number }>(lRef, legs, (o, { p, k }) => {
    const sx = k % 2 ? 1 : -1, sz = k < 2 ? 1 : -1, y = walkHeight(p.x, p.z);
    o.position.set(p.x + sx * 1.1, y + H / 2, p.z + sz * 1.1); o.rotation.set(-sz * 0.06 + p.tilt, 0, sx * 0.06); o.scale.set(0.12, H, 0.12);
  });
  useInstances<Prop>(aRef, ps, (o, p) => { o.position.set(p.x, walkHeight(p.x, p.z) + H - 1, p.z); o.rotation.set(0, p.r, p.tilt * 0.5); o.scale.set(8, 0.3, 0.3); });
  const cables = useMemo(() => {
    const geo = new THREE.BufferGeometry(), pts: number[] = [];
    for (let i = 0; i + 1 < ps.length; i++) {
      const a = ps[i]!, b = ps[i + 1]!;
      if (Math.hypot(a.x - b.x, a.z - b.z) > 40) continue;
      for (const side of [-3.5, 0, 3.5]) {
        const ox = Math.cos(a.r) * side, oz = -Math.sin(a.r) * side;
        const ya = walkHeight(a.x, a.z) + H - 1.3, yb = walkHeight(b.x, b.z) + H - 1.3;
        for (let s = 0; s < 12; s++) for (const t of [s / 12, (s + 1) / 12]) {
          const sag = Math.sin(t * Math.PI) * 3.2;
          pts.push(a.x + (b.x - a.x) * t + ox, ya + (yb - ya) * t - sag, a.z + (b.z - a.z) * t + oz);
        }
      }
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [ps]);
  return <group>
    <instancedMesh ref={lRef} args={[undefined, undefined, legs.length]} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#4b4a48" metalness={0.6} roughness={0.6} /></instancedMesh>
    <instancedMesh ref={aRef} args={[undefined, undefined, ps.length]} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#4b4a48" metalness={0.6} roughness={0.6} /></instancedMesh>
    <lineSegments geometry={cables}><lineBasicMaterial color="#1a1a1a" /></lineSegments>
  </group>;
}

/** junk heaps: crushed panels, barrels and tyre stacks in a tight cluster */
function Junk() {
  const items = useMemo(() => junkHeaps().flat(), []);
  const panels = useMemo(() => items.filter((_, i) => i % 3 === 0), [items]);
  const barrels = useMemo(() => items.filter((_, i) => i % 3 === 1), [items]);
  const tyres = useMemo(() => items.filter((_, i) => i % 3 === 2).flatMap((p) => [0, 1, 2].map((k) => ({ p, k }))), [items]);
  const pRef = useRef<THREE.InstancedMesh>(null), bRef = useRef<THREE.InstancedMesh>(null), tRef = useRef<THREE.InstancedMesh>(null);
  useInstances<Prop>(pRef, panels, (o, p) => { o.position.set(p.x, walkHeight(p.x, p.z) + 0.5, p.z); o.rotation.set(p.tilt * 4, p.r, 0.5 + p.tilt * 3); o.scale.set(2.4 * p.s, 0.12, 1.6 * p.s); }, (_, i) => ["#6b4a33", "#5c5f5e", "#7a3f2a"][i % 3]!);
  useInstances<Prop>(bRef, barrels, (o, p, i) => { const down = i % 3 === 0; o.position.set(p.x, walkHeight(p.x, p.z) + (down ? 0.4 : 0.6), p.z); o.rotation.set(down ? Math.PI / 2 : 0, p.r, 0); o.scale.setScalar(0.85); }, (_, i) => (i % 2 ? "#8a3b22" : "#3f5240"));
  useInstances<{ p: Prop; k: number }>(tRef, tyres, (o, { p, k }) => { o.position.set(p.x, walkHeight(p.x, p.z) + 0.22 + k * 0.38, p.z); o.rotation.set(Math.PI / 2, 0, p.r + k); o.scale.setScalar(0.85); });
  return <group>
    <instancedMesh ref={pRef} args={[undefined, undefined, panels.length]} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={0.8} metalness={0.4} /></instancedMesh>
    <instancedMesh ref={bRef} args={[undefined, undefined, barrels.length]} castShadow><cylinderGeometry args={[0.38, 0.38, 1.1, 10]} /><meshStandardMaterial roughness={0.7} metalness={0.4} /></instancedMesh>
    <instancedMesh ref={tRef} args={[undefined, undefined, tyres.length]} castShadow><torusGeometry args={[0.45, 0.18, 6, 14]} /><meshStandardMaterial color="#141414" roughness={1} /></instancedMesh>
  </group>;
}

/** billboards on two posts, faded panels with a torn corner */
function Billboards() {
  const bs = useMemo(() => billboards(), []);
  return <group>{bs.map((b, i) => {
    const y = walkHeight(b.x, b.z);
    return <group key={i} position={[b.x, y, b.z]} rotation-y={b.r}>
      {[-3.4, 3.4].map((x) => <mesh key={x} castShadow position={[x, 4, 0]}><cylinderGeometry args={[0.18, 0.22, 8, 6]} /><meshStandardMaterial color="#3d3b38" metalness={0.6} roughness={0.6} /></mesh>)}
      <mesh castShadow position={[0, 9, 0]} rotation-z={b.tilt * 0.6}><boxGeometry args={[10, 4.5, 0.2]} /><meshStandardMaterial color={["#a8623a", "#3f6f7a", "#9a8a4a"][i % 3]} roughness={0.9} /></mesh>
      <mesh position={[-1.5, 9.2, 0.12]}><planeGeometry args={[5, 1.2]} /><meshStandardMaterial color="#e8dcc0" roughness={1} /></mesh>
    </group>;
  })}</group>;
}

/** burning debris: low flicker glow and a dark smoke column */
function Smoke({ x, z, seed }: { x: number; z: number; seed: number }) {
  const ref = useRef<THREE.Group>(null), light = useRef<THREE.PointLight>(null);
  const tex = useMemo(() => softSprite("dot"), []);
  const base = useMemo(() => walkHeight(x, z) + 1, [x, z]);
  const N = 12;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 3.3, g = ref.current;
    if (light.current) light.current.intensity = 5 + 3 * Math.sin(t * 11) * Math.sin(t * 6.1);
    g?.children.forEach((c, i) => {
      const k = (t * 0.06 + i / N) % 1, s = 1.4 + k * 8;
      c.position.set(Math.sin(i * 2.1 + t * 0.2) * k * 2 + k * k * 5, k * 22, Math.cos(i * 1.3) * k * 1.5);
      c.scale.set(s, s, 1);
      ((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.min(1, k * 8) * (1 - k) * 0.55;
    });
  });
  return <group position={[x, base, z]}>
    <pointLight ref={light} color="#ff7a2a" distance={12} decay={2} />
    <group ref={ref}>{Array.from({ length: N }, (_, i) => <sprite key={i}><spriteMaterial map={tex ?? null} color="#2a2624" transparent depthWrite={false} fog /></sprite>)}</group>
  </group>;
}
