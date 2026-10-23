import { useLayoutEffect, useMemo, useRef } from "react";
import { DistrictLight } from "./DistrictLight";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { barkTrunk } from "@/game/organic-geometry";
import { walkHeight } from "@/game/terrain";
import { basaltClusters, deadTrees, lavaFlows, obsidianSpires, vents, type FlowPoint } from "@/game/ember-dressing";
import { softSprite } from "./softSprite";

/** Ember Peaks dressing: glowing lava flows down the cone, basalt columns, obsidian spires, burnt trees and fumaroles.
 * Layout is pure (ember-dressing.ts); everything here is procedural and instanced, so it can never fail to load. */
export function EmberPeaks() {
  return (
    <group>
      <LavaFlows />
      <Basalt />
      <Obsidian />
      <DeadTrees />
      {vents().map((v, i) => <Plume key={i} x={v.x} z={v.z} big={v.big} seed={i} />)}
    </group>
  );
}

/** A glowing ribbon that hugs the ground along a flow, with a dark cooling crust on both edges. */
function ribbon(pts: FlowPoint[], widthK: number, lift: number): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  pts.forEach((p, i) => {
    const q = pts[Math.min(i + 1, pts.length - 1)]!, o = pts[Math.max(i - 1, 0)]!;
    let dx = q.x - o.x, dz = q.z - o.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const w = p.w * widthK * (i === pts.length - 1 ? 0.2 : 1);
    for (const side of [-1, 1]) {
      const x = p.x - dz * w * side, z = p.z + dx * w * side;
      pos.push(x, walkHeight(x, z) + lift, z); uv.push((side + 1) / 2, i / (pts.length - 1));
    }
    if (i < pts.length - 1) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function LavaFlows() {
  const geos = useMemo(() => lavaFlows().map((f) => ({ crust: ribbon(f, 1.9, 0.1), lava: ribbon(f, 0.9, 0.16), head: f[0]! })), []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    // flowing bright cracks over a deep orange body; edges fade into the crust; cooler (redder) toward the tip
    fragmentShader: `uniform float t; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        float flow = n(vec2(vUv.x * 4.0, vUv.y * 60.0 - t * 1.6)) * 0.6 + n(vec2(vUv.x * 9.0, vUv.y * 140.0 - t * 2.4)) * 0.4;
        float cool = vUv.y;
        vec3 hot = mix(vec3(1.0, 0.55, 0.12), vec3(1.0, 0.86, 0.45), smoothstep(0.55, 0.9, flow));
        vec3 col = mix(hot, vec3(0.55, 0.08, 0.02), cool * 0.7) * (1.6 - cool * 0.6);
        gl_FragColor = vec4(col, edge * (0.75 + 0.25 * flow));
      }`,
  }), []);
  useFrame((_, dt) => { mat.uniforms["t"]!.value += dt; });
  return (
    <group>
      {geos.map((g, i) => (
        <group key={i}>
          <mesh geometry={g.crust} receiveShadow><meshStandardMaterial color="#161010" emissive="#5a1204" emissiveIntensity={0.6} roughness={1} polygonOffset polygonOffsetFactor={-2} /></mesh>
          <mesh geometry={g.lava} material={mat} renderOrder={2} />
          <DistrictLight range={100} position={[g.head.x, walkHeight(g.head.x, g.head.z) + 3, g.head.z]} color="#ff5a1a" intensity={25} distance={30} decay={2} />
        </group>
      ))}
    </group>
  );
}

const tmp = new THREE.Object3D();
function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, items: { x: number; z: number; s: number; r: number; tilt: number }[], place: (o: THREE.Object3D, p: (typeof items)[number], i: number) => void) {
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    items.forEach((p, i) => { tmp.rotation.set(0, 0, 0); tmp.position.set(0, 0, 0); tmp.scale.set(1, 1, 1); place(tmp, p, i); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
}

/** basalt: each cluster is 7 hexagonal columns of stepped heights */
function Basalt() {
  const clusters = useMemo(() => basaltClusters(), []);
  const cols = useMemo(() => clusters.flatMap((c, k) => Array.from({ length: 7 }, (_, j) => {
    const a = (j / 6) * Math.PI * 2 + c.r, d = j === 0 ? 0 : 1.5 * c.s;
    const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
    return { x, z, s: c.s * (0.8 + ((k * 7 + j) % 5) * 0.12) * (j === 0 ? 1.5 : 1), r: a, tilt: c.tilt * 0.3 };
  })), [clusters]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances(ref, cols, (o, p) => { const h = 3 + p.s * 4; o.position.set(p.x, walkHeight(p.x, p.z) + h / 2 - 0.6, p.z); o.rotation.set(p.tilt, p.r, 0); o.scale.set(p.s, h, p.s); });
  return <instancedMesh ref={ref} args={[undefined, undefined, cols.length]} castShadow receiveShadow>
    <cylinderGeometry args={[0.8, 0.85, 1, 6]} />
    <meshStandardMaterial color="#242226" roughness={0.9} metalness={0.1} flatShading />
  </instancedMesh>;
}

function Obsidian() {
  const spires = useMemo(() => obsidianSpires(), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances(ref, spires, (o, p) => { const h = 2.5 + p.s * 5; o.position.set(p.x, walkHeight(p.x, p.z) + h / 2 - 0.4, p.z); o.rotation.set(p.tilt, p.r, p.tilt * 0.6); o.scale.set(p.s * 0.9, h, p.s * 0.7); });
  return <instancedMesh ref={ref} args={[undefined, undefined, spires.length]} castShadow>
    <coneGeometry args={[0.9, 1, 5]} />
    <meshStandardMaterial color="#0d0b12" roughness={0.08} metalness={0.6} emissive="#3a0f5a" emissiveIntensity={0.25} flatShading />
  </instancedMesh>;
}

/** burnt trees: a charred trunk plus two broken limbs, all instanced */
function DeadTrees() {
  const trees = useMemo(() => deadTrees(), []);
  const trunk = useRef<THREE.InstancedMesh>(null), limb = useRef<THREE.InstancedMesh>(null);
  const limbs = useMemo(() => trees.flatMap((t) => [0, 1].map((k) => ({ ...t, r: t.r + k * 2.4, tilt: k }))), [trees]);
  const geo = useMemo(() => ({ trunk: barkTrunk(61, 0.12, 0.28, 0.5), limb: barkTrunk(67, 0.035, 0.12, 0) }), []);
  useInstances(trunk, trees, (o, p) => { const h = 4 + p.s * 4; o.position.set(p.x, walkHeight(p.x, p.z) + h / 2 - 0.3, p.z); o.rotation.set(p.tilt * 0.5, p.r, p.tilt * 0.4); o.scale.set(p.s, h, p.s); });
  useInstances(limb, limbs, (o, p) => { const h = 4 + p.s * 4; o.position.set(p.x, walkHeight(p.x, p.z) + h * (0.55 + p.tilt * 0.2), p.z); o.rotation.set(0, p.r, 0.9 + p.tilt * 0.3); o.scale.set(p.s * 0.6, 1.8 + p.s, p.s * 0.6); o.translateY(0.6); });
  return <group>
    <instancedMesh ref={trunk} args={[undefined, undefined, trees.length]} castShadow geometry={geo.trunk}><meshStandardMaterial color="#151110" roughness={1} emissive="#2a0800" emissiveIntensity={0.3} /></instancedMesh>
    <instancedMesh ref={limb} args={[undefined, undefined, limbs.length]} castShadow geometry={geo.limb}><meshStandardMaterial color="#151110" roughness={1} /></instancedMesh>
  </group>;
}

/** smoke/steam column from soft sprites recycled bottom→top; the crater plume is dark ash lit orange from below */
function Plume({ x, z, big, seed }: { x: number; z: number; big: boolean; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  const tex = useMemo(() => softSprite("dot"), []);
  const base = useMemo(() => walkHeight(x, z) + (big ? 2 : 0.5), [x, z, big]);
  const n = big ? 22 : 9, height = big ? 140 : 18, spread = big ? 40 : 5;
  useFrame(({ clock }) => {
    const g = ref.current; if (!g) return;
    const t = clock.elapsedTime + seed * 4.7;
    g.children.forEach((c, i) => {
      const k = (t * (big ? 0.025 : 0.08) + i / n) % 1;
      const s = (big ? 10 : 1.5) + k * spread;
      c.position.set(Math.sin(i * 2.1 + t * 0.1) * k * spread * 0.3 + k * k * spread * 0.6, k * height, Math.cos(i * 1.3) * k * spread * 0.2);
      c.scale.set(s, s, 1);
      const m = (c as THREE.Sprite).material as THREE.SpriteMaterial;
      m.opacity = Math.min(1, k * 6) * (1 - k) * (big ? 0.7 : 0.4);
      if (big) m.color.setRGB(0.28 + (1 - k) * 0.35 * (k < 0.25 ? 1 : 0), 0.2 + (k < 0.2 ? 0.08 : 0), 0.18);
      else m.color.setRGB(0.75, 0.74, 0.72);
    });
  });
  return <group ref={ref} position={[x, base, z]}>
    {Array.from({ length: n }, (_, i) => <sprite key={i}><spriteMaterial map={tex ?? null} transparent depthWrite={false} fog /></sprite>)}
  </group>;
}
