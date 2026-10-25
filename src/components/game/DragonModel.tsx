import { useMemo, type Ref } from "react";
import * as THREE from "three";
import { DRAGON_PALETTE, WYRMLING_MOODS, type DragonVariant, type WyrmlingMood } from "@/game/dragon-look";

/** Shared dragon body for Vyrak (boss) and its bonded Wyrmling. Authored in code so it always loads (no external GLB to fail):
 * curved tube neck/tail, real membrane wings with finger bones, a horned crown, overlapping ash scale plates along the spine,
 * and an ember chest core that doubles as the weak point. Unit size ≈ 1 = body length 4. Parents animate via the refs. */
export type DragonRefs = {
  wingL?: Ref<THREE.Group>; wingR?: Ref<THREE.Group>; head?: Ref<THREE.Group>; jaw?: Ref<THREE.Mesh>;
  core?: Ref<THREE.MeshStandardMaterial>; mouth?: Ref<THREE.MeshBasicMaterial>; weak?: Ref<THREE.Mesh>;
};

const BONE = "#e3d2b4", EMBER = "#ff6a1f";

/** Molten crack veins baked to a canvas (seeded, no external image): the glowing fissures across Vyrak's obsidian scale on the
 * owner's reference sheet. Used as the emissive map, so the veins glow in the current phase's fire colour. */
function crackTexture(fire: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"); if (!g) return null;
  g.fillStyle = "#000"; g.fillRect(0, 0, 256, 256);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.lineCap = "round"; g.strokeStyle = fire;
  for (let i = 0; i < 26; i++) {
    let x = rnd() * 256, y = rnd() * 256, a = rnd() * Math.PI * 2;
    g.lineWidth = 0.8 + rnd() * 2.2; g.shadowColor = fire; g.shadowBlur = 5;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { a += (rnd() - 0.5) * 1.5; x += Math.cos(a) * (10 + rnd() * 22); y += Math.sin(a) * (10 + rnd() * 22); g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function curveTube(points: [number, number, number][], r0: number, r1: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, 24, 1, 10, false);
  // taper the radius along the length
  const pos = g.attributes["position"]!, n = 25, ring = 11, centre = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    curve.getPointAt(i / (n - 1), centre);
    const r = r0 + (r1 - r0) * (i / (n - 1));
    for (let j = 0; j < ring; j++) { const k = i * ring + j; v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(r).add(centre); pos.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return { g, curve };
}

function wingShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.6, 0.5); s.lineTo(2.6, 0.9); s.quadraticCurveTo(2.2, 0.2, 2.5, -0.4);
  s.quadraticCurveTo(1.8, -0.2, 1.8, -0.9); s.quadraticCurveTo(1.2, -0.5, 1.0, -1.1); s.quadraticCurveTo(0.6, -0.5, 0, -0.5); s.closePath();
  return new THREE.ShapeGeometry(s, 12);
}

function Wing({ side, gRef, membrane, fire, glow = 0.12, size = 1 }: { side: 1 | -1; gRef?: Ref<THREE.Group> | undefined; membrane: string; fire: string; glow?: number; size?: number }) {
  const geo = useMemo(wingShape, []);
  const fingers: [number, number][] = [[2.6, 0.9], [2.5, -0.4], [1.8, -0.9], [1.0, -1.1]];
  return <group ref={gRef ?? null} position={[side * 0.35, 0.55, 0.3]} scale={[side * size, size, size]}>
    <group rotation-x={-Math.PI / 2}>
      <mesh geometry={geo}><meshStandardMaterial color={membrane} roughness={0.7} side={THREE.DoubleSide} emissive={fire} emissiveIntensity={glow} transparent opacity={0.94} /></mesh>
      {fingers.map(([x, y], i) => { const len = Math.hypot(x - 0.6, y - 0.5); return (
        <mesh key={i} position={[(0.6 + x) / 2, (0.5 + y) / 2, 0.02]} rotation-z={Math.atan2(y - 0.5, x - 0.6) - Math.PI / 2}>
          <cylinderGeometry args={[0.025, 0.045, len, 6]} /><meshStandardMaterial color={BONE} roughness={0.5} />
        </mesh>); })}
      <mesh position={[0.3, 0.25, 0.02]} rotation-z={Math.atan2(0.5, 0.6) - Math.PI / 2}><cylinderGeometry args={[0.05, 0.06, 0.8, 6]} /><meshStandardMaterial color={BONE} /></mesh>
    </group>
  </group>;
}

type LookProps = { refs: DragonRefs; fire: string; glow: number; ember: number };

export function DragonModel({ variant = "vyrak", refs = {}, ember = 1, fire = EMBER, glow = 1, mood = "neutral" }: { variant?: DragonVariant; refs?: DragonRefs; ember?: number; fire?: string; glow?: number; mood?: WyrmlingMood }) {
  return variant === "wyrmling" ? <WyrmlingBody refs={refs} fire={fire} glow={glow} ember={ember} mood={mood} /> : <VyrakModel refs={refs} fire={fire} glow={glow} ember={ember} />;
}

/** Vyrak: obsidian ash-scale with glowing crack veins, swept-back horn crown, brow ridge, fanged jaw, shoulder and spine spikes. */
function VyrakModel({ refs, fire, glow, ember }: LookProps) {
  const pal = DRAGON_PALETTE.vyrak;
  const neck = useMemo(() => curveTube([[0, 0.55, 0.6], [0, 0.95, 1.1], [0, 1.35, 1.45]], 0.3, 0.16), []);
  const tail = useMemo(() => curveTube([[0, 0.5, -0.6], [0, 0.35, -1.4], [0.25, 0.2, -2.1], [0.6, 0.25, -2.7]], 0.28, 0.03), []);
  const plates = useMemo(() => {
    const out: { p: THREE.Vector3; s: number }[] = [];
    for (let i = 1; i < 9; i++) out.push({ p: tail.curve.getPointAt(i / 10), s: 0.2 * (1 - i / 11) });
    for (let i = 1; i < 5; i++) out.push({ p: neck.curve.getPointAt(i / 5), s: 0.17 });
    return out;
  }, [neck, tail]);
  const cracks = useMemo(() => crackTexture(fire), [fire]);
  const scaleMat = useMemo(() => <meshStandardMaterial color={pal.scale} metalness={0.4} roughness={0.5} emissive="#ffffff" emissiveMap={cracks} emissiveIntensity={0.9 * glow * ember} />, [pal.scale, cracks, glow, ember]);
  return <group>
    {/* torso */}
    <mesh position={[0, 0.55, 0]} scale={[0.62, 0.55, 1.05]} castShadow><sphereGeometry args={[0.7, 20, 14]} />{scaleMat}</mesh>
    <mesh position={[0, 0.32, 0.1]} scale={[0.5, 0.3, 0.9]}><sphereGeometry args={[0.7, 16, 10]} /><meshStandardMaterial color={pal.belly} roughness={0.7} /></mesh>
    {/* ember chest core — the weak point (exposed once the armour fractures in phase 2) */}
    <mesh position={[0, 0.48, 0.62]}><sphereGeometry args={[0.16, 14, 10]} /><meshStandardMaterial ref={refs.core ?? null} color="#ffb070" emissive={fire} emissiveIntensity={1.5 * ember * glow} toneMapped={false} /></mesh>
    <mesh ref={refs.weak ?? null} position={[0, 0.48, 0.66]} visible={false}><torusGeometry args={[0.3, 0.03, 8, 32]} /><meshBasicMaterial color="#9ffcff" toneMapped={false} /></mesh>
    <mesh geometry={neck.g} castShadow>{scaleMat}</mesh>
    <mesh geometry={tail.g} castShadow>{scaleMat}</mesh>
    {plates.map(({ p, s }, i) => <mesh key={i} position={[p.x, p.y + s * 0.9, p.z]} rotation-x={-0.4}><coneGeometry args={[s * 0.6, s * 2.2, 4]} /><meshStandardMaterial color="#120a08" metalness={0.55} roughness={0.4} emissive={fire} emissiveIntensity={0.3 * ember * glow} /></mesh>)}
    {/* torso spine and shoulder spikes */}
    {[-0.5, -0.2, 0.1, 0.4].map((z, i) => <mesh key={z} position={[0, 1.05 - Math.abs(z) * 0.1, z]} rotation-x={-0.25}><coneGeometry args={[0.07, 0.3 - i * 0.02, 4]} /><meshStandardMaterial color="#120a08" metalness={0.55} roughness={0.4} emissive={fire} emissiveIntensity={0.25 * ember * glow} /></mesh>)}
    {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.5, 0.95, 0.35]} rotation={[-0.5, 0, sd * -0.7]}><coneGeometry args={[0.09, 0.4, 5]} /><meshStandardMaterial color="#120a08" metalness={0.55} roughness={0.4} /></mesh>)}
    {/* tail blade */}
    <mesh position={[0.62, 0.25, -2.75]} rotation={[Math.PI / 2, 0, 0.6]}><coneGeometry args={[0.14, 0.55, 3]} /><meshStandardMaterial color={pal.horn} roughness={0.35} emissive={fire} emissiveIntensity={0.3 * glow} /></mesh>
    {/* head */}
    <group ref={refs.head ?? null} position={[0, 1.42, 1.5]}>
      <mesh scale={[0.34, 0.27, 0.47]} castShadow><sphereGeometry args={[1, 16, 12]} />{scaleMat}</mesh>
      <mesh position={[0, -0.02, 0.44]} scale={[0.21, 0.13, 0.34]}><boxGeometry args={[1, 1, 1]} />{scaleMat}</mesh>
      <mesh position={[0, 0.17, 0.2]} scale={[0.36, 0.05, 0.28]} rotation-x={0.15}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#120a08" metalness={0.5} roughness={0.4} /></mesh>
      <mesh ref={refs.jaw ?? null} position={[0, -0.12, 0.35]} scale={[0.18, 0.06, 0.34]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={pal.belly} roughness={0.6} /></mesh>
      {[-1, 1].flatMap((sd) => [0.28, 0.42, 0.56].map((z) => <mesh key={`${sd}${z}`} position={[sd * 0.09, -0.07, z]} rotation-x={Math.PI}><coneGeometry args={[0.015, 0.07, 4]} /><meshStandardMaterial color={BONE} roughness={0.35} /></mesh>))}
      <mesh position={[0, -0.07, 0.5]}><sphereGeometry args={[0.07, 10, 8]} /><meshBasicMaterial ref={refs.mouth ?? null} color={fire} toneMapped={false} transparent opacity={0.3} /></mesh>
      {[-1, 1].map((sd) => <group key={sd}>
        <mesh position={[sd * 0.15, 0.08, 0.22]}><sphereGeometry args={[0.04, 10, 8]} /><meshBasicMaterial color={pal.eye} toneMapped={false} /></mesh>
        {/* swept-back horn crown: main horns long and raked, a second shorter pair and cheek spikes */}
        <mesh position={[sd * 0.16, 0.26, -0.3]} rotation={[-1.25, 0, sd * 0.3]}><coneGeometry args={[0.06, 0.8, 6]} /><meshStandardMaterial color={pal.horn} roughness={0.4} /></mesh>
        <mesh position={[sd * 0.24, 0.14, -0.2]} rotation={[-1.3, 0, sd * 0.85]}><coneGeometry args={[0.045, 0.5, 6]} /><meshStandardMaterial color={pal.horn} roughness={0.4} /></mesh>
        <mesh position={[sd * 0.3, -0.04, 0]} rotation={[-0.4, 0, sd * 1.2]}><coneGeometry args={[0.03, 0.22, 5]} /><meshStandardMaterial color={pal.horn} roughness={0.4} /></mesh>
      </group>)}
    </group>
    {/* legs */}
    {[[0.38, 0.5], [-0.38, 0.5], [0.36, -0.45], [-0.36, -0.45]].map(([x, z], i) => <group key={i} position={[x!, 0.35, z!]}>
      <mesh position={[0, -0.12, 0]} scale={[0.15, 0.3, 0.17]}><sphereGeometry args={[1, 10, 8]} />{scaleMat}</mesh>
      {[-0.06, 0, 0.06].map((cx) => <mesh key={cx} position={[cx, -0.36, 0.1]} rotation-x={Math.PI / 2}><coneGeometry args={[0.028, 0.14, 5]} /><meshStandardMaterial color={BONE} /></mesh>)}
    </group>)}
    <Wing side={1} gRef={refs.wingL} membrane={pal.membrane} fire={fire} glow={0.18 * glow} />
    <Wing side={-1} gRef={refs.wingR} membrane={pal.membrane} fire={fire} glow={0.18 * glow} />
  </group>;
}

/** Wyrmling: the reference sheet's small bonded dragon — big head, huge amber eyes, cream horns and belly, orange wing membranes,
 * short thick tail. Its mood (neutral / happy / alert / aggressive) drives the eyes, brows, jaw and wings. */
function WyrmlingBody({ refs, fire, glow, ember, mood }: LookProps & { mood: WyrmlingMood }) {
  const pal = DRAGON_PALETTE.wyrmling, m = WYRMLING_MOODS[mood];
  const tail = useMemo(() => curveTube([[0, 0.4, -0.45], [0, 0.3, -0.9], [0.2, 0.28, -1.3], [0.45, 0.4, -1.55]], 0.2, 0.05), []);
  const scaleMat = <meshStandardMaterial color={pal.scale} metalness={0.3} roughness={0.55} emissive={fire} emissiveIntensity={0.12 * glow} />;
  return <group>
    <mesh position={[0, 0.5, 0]} scale={[0.6, 0.55, 0.72]} castShadow><sphereGeometry args={[0.7, 20, 14]} />{scaleMat}</mesh>
    <mesh position={[0, 0.42, 0.22]} scale={[0.46, 0.45, 0.5]}><sphereGeometry args={[0.7, 16, 12]} /><meshStandardMaterial color={pal.belly} roughness={0.75} /></mesh>
    <mesh position={[0, 0.5, 0.55]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial ref={refs.core ?? null} color="#ffc680" emissive={fire} emissiveIntensity={1.2 * ember} toneMapped={false} /></mesh>
    <mesh ref={refs.weak ?? null} visible={false} position={[0, 0.5, 0.6]}><torusGeometry args={[0.15, 0.02, 6, 20]} /><meshBasicMaterial color="#9ffcff" toneMapped={false} /></mesh>
    <mesh geometry={tail.g} castShadow>{scaleMat}</mesh>
    <mesh position={[0.46, 0.41, -1.6]} rotation={[Math.PI / 2, 0, 0.5]}><coneGeometry args={[0.12, 0.3, 3]} /><meshStandardMaterial color={pal.horn} roughness={0.4} /></mesh>
    {[0.15, 0.3, 0.45, 0.6].map((t) => { const p = tail.curve.getPointAt(t); return <mesh key={t} position={[p.x, p.y + 0.16, p.z]} rotation-x={-0.4}><coneGeometry args={[0.05, 0.14, 4]} /><meshStandardMaterial color={pal.horn} roughness={0.4} /></mesh>; })}
    {/* oversized head: the sheet's chibi proportions */}
    <group ref={refs.head ?? null} position={[0, 1.05, 0.6]}>
      <mesh scale={[0.5, 0.44, 0.46]} castShadow><sphereGeometry args={[1, 20, 14]} />{scaleMat}</mesh>
      <mesh position={[0, -0.12, 0.38]} scale={[0.26, 0.15, 0.2]}><sphereGeometry args={[1, 14, 10]} />{scaleMat}</mesh>
      <mesh ref={refs.jaw ?? null} position={[0, -0.24, 0.3]} rotation-x={m.jaw} scale={[0.22, 0.06, 0.24]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={pal.belly} roughness={0.6} /></mesh>
      <mesh position={[0, -0.18, 0.46]}><sphereGeometry args={[0.07, 10, 8]} /><meshBasicMaterial ref={refs.mouth ?? null} color={fire} toneMapped={false} transparent opacity={0.1 + m.ember * 0.8} /></mesh>
      {[-1, 1].map((sd) => <group key={sd}>
        <group position={[sd * 0.24, 0.06, 0.36]} scale={m.eye}>
          <mesh><sphereGeometry args={[0.14, 14, 12]} /><meshBasicMaterial color={pal.eye} toneMapped={false} /></mesh>
          <mesh position={[0, 0, 0.08]} scale={[0.55, 1, 0.5]}><sphereGeometry args={[0.07, 10, 8]} /><meshBasicMaterial color="#120805" /></mesh>
          <mesh position={[sd * -0.03, 0.04, 0.12]}><sphereGeometry args={[0.02, 6, 6]} /><meshBasicMaterial color="#fff" /></mesh>
        </group>
        <mesh position={[sd * 0.24, 0.24, 0.38]} rotation-z={sd * -m.brow} scale={[0.17, 0.035, 0.1]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#120a08" roughness={0.5} /></mesh>
        <mesh position={[sd * 0.22, 0.4, -0.12]} rotation={[-1.0, 0, sd * 0.4]}><coneGeometry args={[0.07, 0.5, 6]} /><meshStandardMaterial color={pal.horn} roughness={0.4} /></mesh>
        <mesh position={[sd * 0.36, 0.26, -0.1]} rotation={[-1.1, 0, sd * 0.95]}><coneGeometry args={[0.045, 0.28, 6]} /><meshStandardMaterial color={pal.horn} roughness={0.4} /></mesh>
        <mesh position={[sd * 0.44, -0.04, 0.1]} rotation={[-0.2, 0, sd * 1.3]}><coneGeometry args={[0.035, 0.16, 5]} /><meshStandardMaterial color={pal.horn} roughness={0.4} /></mesh>
      </group>)}
    </group>
    {[[0.3, 0.3], [-0.3, 0.3], [0.28, -0.3], [-0.28, -0.3]].map(([x, z], i) => <group key={i} position={[x!, 0.28, z!]}>
      <mesh position={[0, -0.1, 0]} scale={[0.14, 0.2, 0.15]}><sphereGeometry args={[1, 10, 8]} />{scaleMat}</mesh>
      {[-0.05, 0, 0.05].map((cx) => <mesh key={cx} position={[cx, -0.27, 0.08]} rotation-x={Math.PI / 2}><coneGeometry args={[0.022, 0.1, 5]} /><meshStandardMaterial color={pal.horn} /></mesh>)}
    </group>)}
    <group rotation-z={0}>
      <Wing side={1} gRef={refs.wingL} membrane={pal.membrane} fire={fire} glow={0.3 * glow} size={0.75} />
      <Wing side={-1} gRef={refs.wingR} membrane={pal.membrane} fire={fire} glow={0.3 * glow} size={0.75} />
    </group>
  </group>;
}
