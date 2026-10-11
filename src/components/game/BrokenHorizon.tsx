import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { brokenHorizon, type HorizonIsland } from "@/game/broken-horizon";
import { useInstances } from "./instancing";

/** Aerial perspective: emissive slate-blue tints so they read as far away against the sky instead of black cut-outs (live check).
 * Floating shards of the old world on the horizon (layout: broken-horizon.ts). Three instanced draws (rock, towers, debris) plus one for
 * lit towers; fog-free and tinted toward the sky so they read as far away. Follows the player like the sky dome, so it is never reached.
 * Presentation only, no collision. */
export function BrokenHorizon({ playerRef }: { playerRef: React.RefObject<THREE.Object3D | null> }) {
  const islands = useMemo(() => brokenHorizon(), []);
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
  useFrame(() => { const p = playerRef.current?.position; if (root.current && p) root.current.position.set(p.x, Math.max(0, p.y), p.z); });
  return (
    <group ref={root}>
      <instancedMesh ref={rock} args={[undefined, undefined, islands.length]} frustumCulled={false}>
        <coneGeometry args={[1, 1, 7, 3]} />
        <meshStandardMaterial color="#7a8798" emissive="#4f5b6c" emissiveIntensity={0.55} roughness={0.95} fog={false} flatShading />
      </instancedMesh>
      <instancedMesh ref={cap} args={[undefined, undefined, islands.length]} frustumCulled={false}>
        <cylinderGeometry args={[1, 0.92, 1, 9]} />
        <meshStandardMaterial color="#87958a" emissive="#4f5c55" emissiveIntensity={0.5} roughness={1} fog={false} flatShading />
      </instancedMesh>
      <instancedMesh ref={towers} args={[undefined, undefined, Math.max(1, dark.length)]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#748094" emissive="#47515f" emissiveIntensity={0.5} roughness={0.8} fog={false} />
      </instancedMesh>
      <instancedMesh ref={lit} args={[undefined, undefined, Math.max(1, bright.length)]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#748094" roughness={0.8} emissive="#d9a070" emissiveIntensity={0.45} fog={false} />
      </instancedMesh>
      <instancedMesh ref={debris} args={[undefined, undefined, Math.max(1, chunks.length)]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#7a8798" emissive="#4f5b6c" emissiveIntensity={0.55} roughness={0.95} fog={false} flatShading />
      </instancedMesh>
    </group>
  );
}
