import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { venueLots, type VenueLot } from "@/game/nightlife";
import { neonTowersWorld } from "@/game/neon-layout";
import { neonKeepOut } from "@/game/residences";
import { neonPlateauLevel } from "@/game/terrain";
import { addObstacle } from "@/game/obstacles";
import { Text } from "./SafeText";
import { DistrictLight } from "./DistrictLight";

/**
 * Pulse Array, Afterglow, Velvet Circuit and Crown Casino (nightlife.ts) on the lots they take over from towers: a dark
 * hall with neon-outlined facade, a lit marquee with the venue's name, a bulb-lined canopy over glass doors, a red
 * carpet between gold rope posts, a holo panel down one side, and warm light spilling onto the street. Exterior only.
 */
export function useVenueLots() {
  return useMemo(() => venueLots(neonTowersWorld(neonKeepOut())), []);
}

const mat = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, ...o });

function VenueHall({ lot, y }: { lot: VenueLot; y: number }) {
  const { venue: v, hx, hz } = lot;
  const W = hx * 2 - 1.2, D = hz * 2 - 1.2, H = v.kind === "casino" ? 16 : 11;
  const m = useMemo(() => ({
    wall: mat("#141219", { metalness: 0.55, roughness: 0.32 }),
    trim: new THREE.MeshBasicMaterial({ color: new THREE.Color(v.color).multiplyScalar(2.2), toneMapped: false }),
    accent: new THREE.MeshBasicMaterial({ color: new THREE.Color(v.accent).multiplyScalar(1.6), toneMapped: false }),
    sign: mat("#07070c", { emissive: v.color, emissiveIntensity: 0.35, roughness: 0.4 }),
    glass: mat("#1a1028", { emissive: v.accent, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.4 }),
    canopy: mat("#0c0c12", { metalness: 0.7, roughness: 0.3 }),
    bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd9a0").multiplyScalar(2), toneMapped: false }),
    carpet: mat(v.kind === "casino" ? "#6a0f18" : "#3a0a20", { roughness: 0.95 }),
    gold: mat("#d4a94a", { metalness: 1, roughness: 0.25 }),
    holo: new THREE.MeshBasicMaterial({ color: new THREE.Color(v.accent).multiplyScalar(1.2), transparent: true, opacity: 0.75, toneMapped: false, side: THREE.DoubleSide }),
  }), [v.color, v.accent, v.kind]);
  const front = D / 2;
  return (
    <group position={[lot.x, y, lot.z]} rotation-y={(lot.rot * Math.PI) / 2}>
      <mesh position={[0, H / 2, 0]} material={m.wall} castShadow receiveShadow><boxGeometry args={[W, H, D]} /></mesh>
      <mesh position={[0, H + 0.4, 0]} material={m.canopy} castShadow><boxGeometry args={[W + 0.6, 0.8, D + 0.6]} /></mesh>
      {/* neon outline of the front face and the roof edge */}
      {[[0, H - 0.2, W, 0.16], [0, 0.25, W, 0.12]].map(([x, yy, w, t], i) => <mesh key={`h${i}`} position={[x!, yy!, front + 0.06]} material={m.trim}><boxGeometry args={[w!, t!, 0.08]} /></mesh>)}
      {[-1, 1].map((s) => <mesh key={`v${s}`} position={[s * (W / 2 - 0.05), H / 2, front + 0.06]} material={m.trim}><boxGeometry args={[0.16, H, 0.08]} /></mesh>)}
      {[-1, 1].map((s) => <mesh key={`r${s}`} position={[s * (W / 2 + 0.3), H + 0.82, 0]} material={m.accent}><boxGeometry args={[0.1, 0.1, D + 0.6]} /></mesh>)}
      {/* marquee with the name */}
      <mesh position={[0, H * 0.72, front + 0.35]} material={m.sign}><boxGeometry args={[W * 0.86, 2.6, 0.5]} /></mesh>
      <Text position={[0, H * 0.72 + 0.25, front + 0.62]} fontSize={Math.min(1.5, (W * 0.8) / (v.name.length * 0.62))} color="#ffffff" outlineWidth={0.06} outlineColor={v.color} anchorX="center" anchorY="middle">{v.name}</Text>
      <Text position={[0, H * 0.72 - 0.85, front + 0.62]} fontSize={0.42} color={v.color} anchorX="center" anchorY="middle">{v.sub}</Text>
      {v.kind === "casino" && <group position={[0, H + 2.4, front - 0.6]}>
        <mesh material={m.gold} castShadow><torusGeometry args={[1.6, 0.16, 8, 32]} /></mesh>
        {[-1.1, 0, 1.1].map((x, i) => <mesh key={i} position={[x, 1.1 + (i === 1 ? 0.4 : 0), 0]} material={m.gold}><coneGeometry args={[0.35, 1.4 + (i === 1 ? 0.6 : 0), 6]} /></mesh>)}
      </group>}
      {/* glass doors, canopy with bulbs, red carpet and rope line */}
      <mesh position={[0, 1.6, front + 0.03]} material={m.glass}><boxGeometry args={[W * 0.36, 3.2, 0.06]} /></mesh>
      <mesh position={[0, 3.6, front + 1.6]} material={m.canopy} castShadow><boxGeometry args={[W * 0.5, 0.3, 3.2]} /></mesh>
      {Array.from({ length: 12 }, (_, i) => <mesh key={`b${i}`} position={[-W * 0.24 + (i * W * 0.48) / 11, 3.4, front + 3.2]} material={m.bulb}><sphereGeometry args={[0.09, 6, 4]} /></mesh>)}
      <mesh position={[0, 0.03, front + 3]} rotation-x={-Math.PI / 2} material={m.carpet} receiveShadow><planeGeometry args={[2.2, 6]} /></mesh>
      {[-1, 1].map((s) => [0, 1, 2, 3].map((k) => <mesh key={`p${s}${k}`} position={[s * 1.5, 0.5, front + 0.8 + k * 1.6]} material={m.gold} castShadow><cylinderGeometry args={[0.06, 0.09, 1, 8]} /></mesh>))}
      {/* holo panel down one side */}
      <mesh position={[W / 2 + 0.25, H * 0.55, front - D * 0.3]} rotation-y={Math.PI / 2} material={m.holo}><planeGeometry args={[D * 0.4, H * 0.6]} /></mesh>
      <DistrictLight position={[0, 3, front + 4]} color={v.color} intensity={14} distance={22} decay={2} />
    </group>
  );
}

export function NeonVenues() {
  const lots = useVenueLots();
  const y = useMemo(() => neonPlateauLevel(), []);
  useEffect(() => { for (const l of lots) addObstacle("tower", l.x, l.z, Math.max(l.hx, l.hz) * 0.95, 400, 2); }, [lots]);
  return <group name="neon-venues">{lots.map((l) => <VenueHall key={l.venue.id} lot={l} y={y} />)}</group>;
}
