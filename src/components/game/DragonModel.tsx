import { useMemo, type Ref } from "react";
import * as THREE from "three";

/** Shared dragon body for Vyrak (boss) and its bonded Wyrmling. Authored in code so it always loads (no external GLB to fail):
 * curved tube neck/tail, real membrane wings with finger bones, a horned crown, overlapping ash scale plates along the spine,
 * and an ember chest core that doubles as the weak point. Unit size ≈ 1 = body length 4. Parents animate via the refs. */
export type DragonRefs = {
  wingL?: Ref<THREE.Group>; wingR?: Ref<THREE.Group>; head?: Ref<THREE.Group>; jaw?: Ref<THREE.Mesh>;
  core?: Ref<THREE.MeshStandardMaterial>; mouth?: Ref<THREE.MeshBasicMaterial>; weak?: Ref<THREE.Mesh>;
};

const SCALE = "#3a1d16", BELLY = "#7a4a2e", BONE = "#e3d2b4", EMBER = "#ff6a1f";

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

function Wing({ side, gRef }: { side: 1 | -1; gRef?: Ref<THREE.Group> | undefined }) {
  const geo = useMemo(wingShape, []);
  const fingers: [number, number][] = [[2.6, 0.9], [2.5, -0.4], [1.8, -0.9], [1.0, -1.1]];
  return <group ref={gRef ?? null} position={[side * 0.35, 0.55, 0.3]} scale={[side, 1, 1]}>
    <group rotation-x={-Math.PI / 2}>
      <mesh geometry={geo}><meshStandardMaterial color="#5a1f14" roughness={0.7} side={THREE.DoubleSide} emissive={EMBER} emissiveIntensity={0.12} transparent opacity={0.94} /></mesh>
      {fingers.map(([x, y], i) => { const len = Math.hypot(x - 0.6, y - 0.5); return (
        <mesh key={i} position={[(0.6 + x) / 2, (0.5 + y) / 2, 0.02]} rotation-z={Math.atan2(y - 0.5, x - 0.6) - Math.PI / 2}>
          <cylinderGeometry args={[0.025, 0.045, len, 6]} /><meshStandardMaterial color={BONE} roughness={0.5} />
        </mesh>); })}
      <mesh position={[0.3, 0.25, 0.02]} rotation-z={Math.atan2(0.5, 0.6) - Math.PI / 2}><cylinderGeometry args={[0.05, 0.06, 0.8, 6]} /><meshStandardMaterial color={BONE} /></mesh>
    </group>
  </group>;
}

export function DragonModel({ refs = {}, ember = 1 }: { refs?: DragonRefs; ember?: number }) {
  const neck = useMemo(() => curveTube([[0, 0.55, 0.6], [0, 0.95, 1.1], [0, 1.35, 1.45]], 0.3, 0.16), []);
  const tail = useMemo(() => curveTube([[0, 0.5, -0.6], [0, 0.35, -1.4], [0.25, 0.2, -2.1], [0.6, 0.25, -2.7]], 0.28, 0.03), []);
  const plates = useMemo(() => {
    const out: { p: THREE.Vector3; s: number }[] = [];
    for (let i = 1; i < 9; i++) out.push({ p: tail.curve.getPointAt(i / 10), s: 0.18 * (1 - i / 11) });
    for (let i = 1; i < 5; i++) out.push({ p: neck.curve.getPointAt(i / 5), s: 0.14 });
    return out;
  }, [neck, tail]);
  return <group>
    {/* torso */}
    <mesh position={[0, 0.55, 0]} scale={[0.62, 0.55, 1.05]} castShadow><sphereGeometry args={[0.7, 20, 14]} /><meshStandardMaterial color={SCALE} metalness={0.35} roughness={0.55} /></mesh>
    <mesh position={[0, 0.32, 0.1]} scale={[0.5, 0.3, 0.9]}><sphereGeometry args={[0.7, 16, 10]} /><meshStandardMaterial color={BELLY} roughness={0.7} /></mesh>
    {/* ember chest core — the weak point */}
    <mesh position={[0, 0.48, 0.62]}><sphereGeometry args={[0.16, 14, 10]} /><meshStandardMaterial ref={refs.core ?? null} color="#ffb070" emissive={EMBER} emissiveIntensity={1.5 * ember} toneMapped={false} /></mesh>
    <mesh ref={refs.weak ?? null} position={[0, 0.48, 0.66]} visible={false}><torusGeometry args={[0.3, 0.03, 8, 32]} /><meshBasicMaterial color="#9ffcff" toneMapped={false} /></mesh>
    <mesh geometry={neck.g} castShadow><meshStandardMaterial color={SCALE} metalness={0.35} roughness={0.55} /></mesh>
    <mesh geometry={tail.g} castShadow><meshStandardMaterial color={SCALE} metalness={0.35} roughness={0.55} /></mesh>
    {plates.map(({ p, s }, i) => <mesh key={i} position={[p.x, p.y + s * 0.9, p.z]} rotation-x={-0.4}><coneGeometry args={[s * 0.6, s * 1.8, 4]} /><meshStandardMaterial color="#1f0f0c" metalness={0.5} roughness={0.4} emissive={EMBER} emissiveIntensity={0.2 * ember} /></mesh>)}
    {/* tail blade */}
    <mesh position={[0.62, 0.25, -2.75]} rotation={[Math.PI / 2, 0, 0.6]}><coneGeometry args={[0.12, 0.45, 3]} /><meshStandardMaterial color={BONE} roughness={0.35} /></mesh>
    {/* head */}
    <group ref={refs.head ?? null} position={[0, 1.42, 1.5]}>
      <mesh scale={[0.32, 0.26, 0.45]} castShadow><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color={SCALE} metalness={0.35} roughness={0.5} /></mesh>
      <mesh position={[0, -0.02, 0.42]} scale={[0.2, 0.13, 0.32]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={SCALE} roughness={0.5} /></mesh>
      <mesh ref={refs.jaw ?? null} position={[0, -0.12, 0.35]} scale={[0.18, 0.06, 0.34]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={BELLY} roughness={0.6} /></mesh>
      <mesh position={[0, -0.07, 0.5]}><sphereGeometry args={[0.07, 10, 8]} /><meshBasicMaterial ref={refs.mouth ?? null} color={EMBER} toneMapped={false} transparent opacity={0.3} /></mesh>
      {[-1, 1].map((s) => <group key={s}>
        <mesh position={[s * 0.15, 0.08, 0.22]}><sphereGeometry args={[0.04, 10, 8]} /><meshBasicMaterial color="#ffd27a" toneMapped={false} /></mesh>
        <mesh position={[s * 0.16, 0.22, -0.18]} rotation={[-0.9, 0, s * 0.35]}><coneGeometry args={[0.05, 0.55, 6]} /><meshStandardMaterial color={BONE} roughness={0.35} /></mesh>
        <mesh position={[s * 0.26, 0.08, -0.12]} rotation={[-1.2, 0, s * 0.9]}><coneGeometry args={[0.035, 0.32, 6]} /><meshStandardMaterial color={BONE} roughness={0.35} /></mesh>
      </group>)}
    </group>
    {/* legs */}
    {[[0.38, 0.5], [-0.38, 0.5], [0.36, -0.45], [-0.36, -0.45]].map(([x, z], i) => <group key={i} position={[x!, 0.35, z!]}>
      <mesh position={[0, -0.12, 0]} scale={[0.14, 0.3, 0.16]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color={SCALE} roughness={0.55} /></mesh>
      {[-0.06, 0, 0.06].map((cx) => <mesh key={cx} position={[cx, -0.36, 0.1]} rotation-x={Math.PI / 2}><coneGeometry args={[0.025, 0.12, 5]} /><meshStandardMaterial color={BONE} /></mesh>)}
    </group>)}
    <Wing side={1} gRef={refs.wingL} />
    <Wing side={-1} gRef={refs.wingR} />
  </group>;
}
