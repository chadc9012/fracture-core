import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VehicleCondition } from "@/game/vehicle-condition";
import { damageLook, type DamageLook } from "@/game/vehicle-damage-render";

/**
 * Visible body damage that stays on the vehicle (VehicleDamageFx handles smoke/fire/sparks): dented panels, a cracked
 * windscreen, dead headlights, a hanging front bumper and hood soot. All derived from the one real condition through
 * vehicle-damage-render.ts, so repairing the car clears it and nothing else tracks health.
 * Frame: the vehicle group (front +z, ground y 0), placed on the real body box from `bounds` when it is known.
 * Cheap on purpose: shared geometry and materials, the layout is rebuilt only when `look.key` changes (a few times per
 * crash, never per frame), and there is no light and no per-frame allocation.
 */
const FALLBACK = new THREE.Box3(new THREE.Vector3(-1.45, 0, -2.4), new THREE.Vector3(1.45, 1.8, 2.4));
const CRACK_COLOR = "#dfe9ee";

export function VehicleBodyDamage({ condition, seed, bounds }: { condition: { current: VehicleCondition }; seed: number; bounds?: { current: THREE.Box3 | null } }) {
  const [look, setLook] = useState<DamageLook>(() => damageLook(condition.current, seed));
  const lastKey = useRef(look.key);
  const [box, setBox] = useState<THREE.Box3>(FALLBACK);
  const lastBox = useRef("");
  const dish = useMemo(() => new THREE.CircleGeometry(1, 14), []);
  const bar = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const dentMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1b1c1f", roughness: 0.95, metalness: 0.3, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }), []);
  const rimMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8c949a", roughness: 0.5, metalness: 0.85, polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide }), []);
  const crackMat = useMemo(() => new THREE.MeshBasicMaterial({ color: CRACK_COLOR, transparent: true, opacity: 0.85, toneMapped: false }), []);
  const deadMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#07080a", roughness: 0.4, metalness: 0.6 }), []);
  const sootMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#050505", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), []);

  useFrame(() => {
    const next = damageLook(condition.current, seed);
    if (next.key !== lastKey.current) { lastKey.current = next.key; setLook(next); }
    const b = bounds?.current;
    if (b && !b.isEmpty()) {
      const k = `${b.min.x.toFixed(1)},${b.min.y.toFixed(1)},${b.min.z.toFixed(1)},${b.max.x.toFixed(1)},${b.max.y.toFixed(1)},${b.max.z.toFixed(1)}`;
      if (k !== lastBox.current) { lastBox.current = k; setBox(b.clone()); }
    }
  });

  if (look.dentTier === 0 && look.glass === 0 && look.headlightsOut === 0 && look.bumperHang === 0 && look.soot === 0) return null;
  const w = box.max.x - box.min.x, h = box.max.y - box.min.y, l = box.max.z - box.min.z, cx = (box.min.x + box.max.x) / 2;
  sootMat.opacity = look.soot * 0.7;
  const glassY = box.min.y + h * 0.78, glassZ = box.max.z - l * 0.36;

  return <group>
    {look.dents.map((d, i) => {
      const r = d.r * h, depth = 0.02 + d.depth * 0.03, y = box.min.y + d.v * h;
      const flank = d.face === "L" || d.face === "R";
      const pos: [number, number, number] = flank ? [d.face === "L" ? box.min.x - depth : box.max.x + depth, y, box.min.z + d.u * l] : [cx - w / 2 + d.u * w, y, d.face === "F" ? box.max.z + depth : box.min.z - depth];
      const rotY = d.face === "L" ? -Math.PI / 2 : d.face === "R" ? Math.PI / 2 : d.face === "F" ? 0 : Math.PI;
      return <group key={i} position={pos} rotation={[0, rotY, 0]}>
        <mesh geometry={dish} material={dentMat} scale={[r * 1.25, r, 1]} />
        <mesh geometry={dish} material={rimMat} scale={[r * 0.45, r * 0.3, 1]} position={[r * 0.35, r * 0.28, depth * 0.5]} rotation={[0, 0, 0.6]} />
      </group>;
    })}
    {look.glass > 0 && <group position={[cx, glassY, glassZ]} rotation={[-0.45, 0, 0]}>
      {look.cracks.map((c, i) => {
        const len = c.length * w * 0.34;
        return <mesh key={i} geometry={bar} material={crackMat} scale={[len, 0.012, 0.006]} position={[Math.cos(c.angle) * len * 0.5, Math.sin(c.angle) * len * 0.5 * 0.5, 0]} rotation={[0, 0, c.angle]} />;
      })}
    </group>}
    {look.headlightsOut > 0 && ([-1, 1] as const).map((side, i) => (look.headlightsOut === 2 || i === 0) && (
      <mesh key={side} geometry={dish} material={deadMat} scale={[w * 0.07, w * 0.07, 1]} position={[cx + side * w * 0.33, box.min.y + h * 0.42, box.max.z + 0.03]} />
    ))}
    {look.bumperHang > 0 && <mesh geometry={bar} material={rimMat} scale={[w * 0.82, h * 0.08, 0.22]} position={[cx, box.min.y + h * 0.2 - look.bumperHang * h * 0.08, box.max.z + 0.05 + look.bumperHang * 0.12]} rotation={[look.bumperHang * 0.7, 0, look.bumperHang * 0.08]} />}
    {look.soot > 0 && <mesh geometry={bar} material={sootMat} scale={[w * 0.7, 0.01, l * 0.28]} position={[cx, box.min.y + h * 0.63, box.max.z - l * 0.22]} />}
  </group>;
}
