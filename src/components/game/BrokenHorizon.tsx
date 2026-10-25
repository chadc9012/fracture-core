import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { brokenHorizon, type HorizonIsland } from "@/game/broken-horizon";
import { useInstances } from "./instancing";
import { worldLight } from "@/game/world-light";
import { brokenTower, craggyCone, islandCap, organicRock } from "@/game/organic-geometry";

/** Aerial perspective: emissive slate-blue tints so they read as far away against the sky instead of black cut-outs (live check).
 * Floating shards of the old world on the horizon (layout: broken-horizon.ts). Three instanced draws (rock, towers, debris) plus one for
 * lit towers; fog-free and tinted toward the sky so they read as far away. Follows the player like the sky dome, so it is never reached.
 * Presentation only, no collision. */
export function BrokenHorizon({ playerRef }: { playerRef: React.RefObject<THREE.Object3D | null> }) {
  const islands = useMemo(() => brokenHorizon(), []);
  // craggy rock undersides, eroded tops, broken-crowned towers and real rock debris (organic-geometry.ts)
  const geo = useMemo(() => ({ rock: craggyCone(17), cap: islandCap(19), tower: brokenTower(23), debris: organicRock(1, 29, 1, 0.3) }), []);
  const root = useRef<THREE.Group>(null);
  const rock = useRef<THREE.InstancedMesh>(null), cap = useRef<THREE.InstancedMesh>(null);
  const towers = useRef<THREE.InstancedMesh>(null), lit = useRef<THREE.InstancedMesh>(null), debris = useRef<THREE.InstancedMesh>(null);
  const allTowers = useMemo(() => islands.flatMap((i) => i.towers.map((t) => ({ i, t }))), [islands]);
  const dark = useMemo(() => allTowers.filter((e) => !e.t.lit), [allTowers]);
  const bright = useMemo(() => allTowers.filter((e) => e.t.lit), [allTowers]);
  const chunks = useMemo<{ i: HorizonIsland; d: HorizonIsland["debris"][number] }[]>(() => islands.flatMap((i) => i.debris.map((d) => ({ i, d }))), [islands]);
  useInstances(rock, islands, (o, i) => { o.position.set(i.x, i.y - i.depth / 2, i.z); o.rotation.set(Math.PI, i.phase, 0); o.scale.set(i.r, i.depth, i.r); });
  useInstances(cap, islands, (o, i) => { o.position.set(i.x, i.y, i.z); o.rotation.set(0, i.phase, 0); o.scale.set(i.r * 1.02, i.r * 0.12, i.r * 1.02); });
  const placeTower = (o: THREE.Object3D, e: { i: (typeof islands)[number]; t: (typeof islands)[number]["towers"][number] }) => {
    const { i, t } = e;
    const sign = i.inverted ? -1 : 1;
    o.position.set(i.x + t.dx, i.y + (i.inverted ? -i.depth * 0.25 : 0) + sign * t.h / 2, i.z + t.dz);
    o.rotation.set(i.inverted ? Math.PI : 0, i.phase + t.dx * 0.01, 0);
    o.scale.set(t.w, t.h, t.d);
  };
  useInstances(towers, dark, placeTower);
  useInstances(lit, bright, placeTower);
  useInstances<{ i: HorizonIsland; d: HorizonIsland["debris"][number] }>(debris, chunks, (o, { i, d }) => { o.position.set(i.x + d.dx, i.y + d.dy, i.z + d.dz); o.rotation.set(d.dx, d.dz, d.dy); o.scale.setScalar(d.s); });
  // sunlit sandstone with grassy tops (owner's target frame "wilds by day"), hazed toward the live horizon colour so they sit in the
  // sky's air instead of reading as flat slate cut-outs (the old fixed blue-grey emissive)
  const mats = useMemo(() => ({
    rock: new THREE.MeshStandardMaterial({ color: "#a08f7a", emissive: "#000000", roughness: 0.95, fog: false, flatShading: true }),
    cap: new THREE.MeshStandardMaterial({ color: "#6f8c4e", emissive: "#000000", roughness: 1, fog: false }),
    tower: new THREE.MeshStandardMaterial({ color: "#8c8a86", emissive: "#000000", roughness: 0.8, fog: false }),
    lit: new THREE.MeshStandardMaterial({ color: "#8c8a86", emissive: "#d9a070", emissiveIntensity: 0.45, roughness: 0.8, fog: false }),
  }), []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const haze = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const p = playerRef.current?.position; if (root.current && p) root.current.position.set(p.x, Math.max(0, p.y), p.z);
    const [r, g, b] = worldLight.horizon;
    haze.setRGB(r, g, b);
    for (const m of [mats.rock, mats.cap, mats.tower]) { m.emissive.copy(haze).multiplyScalar(0.42); }
    mats.lit.emissiveIntensity = 0.2 + worldLight.night * 0.9;
  });
  return (
    <group ref={root}>
      <instancedMesh ref={rock} args={[undefined, undefined, islands.length]} frustumCulled={false} geometry={geo.rock} material={mats.rock} />
      <instancedMesh ref={cap} args={[undefined, undefined, islands.length]} frustumCulled={false} geometry={geo.cap} material={mats.cap} />
      <instancedMesh ref={towers} args={[undefined, undefined, Math.max(1, dark.length)]} frustumCulled={false} geometry={geo.tower} material={mats.tower} />
      <instancedMesh ref={lit} args={[undefined, undefined, Math.max(1, bright.length)]} frustumCulled={false} geometry={geo.tower} material={mats.lit} />
      <instancedMesh ref={debris} args={[undefined, undefined, Math.max(1, chunks.length)]} frustumCulled={false} geometry={geo.debris} material={mats.rock} />
    </group>
  );
}
