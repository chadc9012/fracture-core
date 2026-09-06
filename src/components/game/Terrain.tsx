import { Instance, Instances } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

import { REGIONS, WORLD_RADIUS, ZONE_COLOR, type Region } from "@/game/world";
import { mulberry32 } from "@/game/useKeyboard";

type Prop = { x: number; z: number; s: number; r: number };

function scatter(region: Region, count: number, seed: number, inner = 0): Prop[] {
  const rnd = mulberry32(seed);
  const out: Prop[] = [];
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const d = inner + Math.sqrt(rnd()) * (region.radius * 0.92 - inner);
    out.push({
      x: region.x + Math.cos(a) * d,
      z: region.z + Math.sin(a) * d,
      s: 0.7 + rnd() * 0.9,
      r: rnd() * Math.PI * 2,
    });
  }
  return out;
}

function byId(id: string) {
  return REGIONS.find((r) => r.id === id)!;
}

/** Flat region discs + a ring marking the zone risk colour. */
function RegionFloor({ region }: { region: Region }) {
  return (
    <group position={[region.x, 0, region.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow>
        <circleGeometry args={[region.radius, 48]} />
        <meshStandardMaterial color={region.ground} roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
        <ringGeometry args={[region.radius - 0.9, region.radius, 64]} />
        <meshBasicMaterial color={ZONE_COLOR[region.kind]} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

export function Terrain() {
  const forest = byId("veridan");
  const frost = byId("frostspire");
  const ember = byId("ember");
  const waste = byId("wastelands");
  const solara = byId("solara");
  const swamp = byId("swamps");
  const nexus = byId("nexus");

  const trees = useMemo(() => scatter(forest, 90, 11), [forest]);
  const swampTrees = useMemo(() => scatter(swamp, 60, 12), [swamp]);
  const peaks = useMemo(() => scatter(frost, 26, 13), [frost]);
  const rocks = useMemo(() => [...scatter(waste, 40, 14), ...scatter(solara, 40, 15)], [waste, solara]);
  const cacti = useMemo(() => scatter(solara, 45, 16), [solara]);
  const pools = useMemo(() => scatter(swamp, 26, 17), [swamp]);
  const wrecks = useMemo(() => scatter(waste, 34, 18), [waste]);
  const towers = useMemo(() => scatter(nexus, 40, 19, 3), [nexus]);
  const flowers = useMemo(() => scatter(forest, 60, 20), [forest]);
  const emberRocks = useMemo(() => scatter(ember, 45, 21, 9), [ember]);

  return (
    <group>
      {/* ocean */}
      <mesh rotation-x={-Math.PI / 2} position-y={-1.4}>
        <circleGeometry args={[WORLD_RADIUS * 2.6, 64]} />
        <meshStandardMaterial color="#0d3f5c" roughness={0.15} metalness={0.5} />
      </mesh>

      {/* landmass */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[WORLD_RADIUS, 72]} />
        <meshStandardMaterial color="#9b8a63" roughness={1} />
      </mesh>

      {REGIONS.map((r) => (
        <RegionFloor key={r.id} region={r} />
      ))}

      {/* forest trees */}
      <Instances limit={trees.length} castShadow>
        <cylinderGeometry args={[0.35, 0.55, 4]} />
        <meshStandardMaterial color="#4a3524" roughness={1} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, 2 * t.s, t.z]} scale={[1, t.s, 1]} />
        ))}
      </Instances>
      <Instances limit={trees.length} castShadow>
        <coneGeometry args={[2.4, 7, 7]} />
        <meshStandardMaterial color="#2c7a41" roughness={0.9} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, 4.5 * t.s + 1.5, t.z]} scale={t.s} rotation-y={t.r} />
        ))}
      </Instances>

      {/* forest flowers */}
      <Instances limit={flowers.length}>
        <sphereGeometry args={[0.4, 6, 5]} />
        <meshStandardMaterial color="#e8639c" roughness={0.8} />
        {flowers.map((f, i) => (
          <Instance key={i} position={[f.x, 0.4, f.z]} scale={f.s} />
        ))}
      </Instances>

      {/* frostspire peaks */}
      <Instances limit={peaks.length} castShadow receiveShadow>
        <coneGeometry args={[9, 26, 5]} />
        <meshStandardMaterial color="#cfe0f2" roughness={0.7} />
        {peaks.map((p, i) => (
          <Instance key={i} position={[p.x, 12 * (0.6 + p.s), p.z]} scale={[1, 0.6 + p.s, 1]} rotation-y={p.r} />
        ))}
      </Instances>

      {/* ember peaks volcano */}
      <group position={[ember.x, 0, ember.z]}>
        <mesh castShadow>
          <coneGeometry args={[20, 26, 8]} />
          <meshStandardMaterial color="#2c1c18" roughness={1} />
        </mesh>
        <mesh position-y={22} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[6, 24]} />
          <meshStandardMaterial color="#ff5a12" emissive="#ff5a12" emissiveIntensity={2.4} />
        </mesh>
        <pointLight position={[0, 26, 0]} color="#ff6a1f" intensity={120} distance={90} decay={2} />
      </group>
      <Instances limit={emberRocks.length} castShadow>
        <dodecahedronGeometry args={[1.6]} />
        <meshStandardMaterial color="#3b2622" emissive="#ff3d00" emissiveIntensity={0.35} roughness={1} />
        {emberRocks.map((r, i) => (
          <Instance key={i} position={[r.x, 1.2 * r.s, r.z]} scale={r.s} rotation-y={r.r} />
        ))}
      </Instances>

      {/* rocks across war belt + desert */}
      <Instances limit={rocks.length} castShadow>
        <dodecahedronGeometry args={[2.2]} />
        <meshStandardMaterial color="#7c6a52" roughness={1} />
        {rocks.map((r, i) => (
          <Instance key={i} position={[r.x, 1.4 * r.s, r.z]} scale={r.s} rotation-y={r.r} />
        ))}
      </Instances>

      {/* convoy wrecks in the war belt */}
      <Instances limit={wrecks.length} castShadow>
        <boxGeometry args={[5, 2.2, 2.6]} />
        <meshStandardMaterial color="#5b4a3f" metalness={0.4} roughness={0.7} />
        {wrecks.map((w, i) => (
          <Instance key={i} position={[w.x, 1.1, w.z]} rotation-y={w.r} />
        ))}
      </Instances>

      {/* desert cacti */}
      <Instances limit={cacti.length} castShadow>
        <capsuleGeometry args={[0.7, 3.4, 4, 8]} />
        <meshStandardMaterial color="#4f7a45" roughness={0.9} />
        {cacti.map((c, i) => (
          <Instance key={i} position={[c.x, 2.4 * c.s, c.z]} scale={c.s} />
        ))}
      </Instances>

      {/* swamp pools + dead trees */}
      <Instances limit={pools.length}>
        <circleGeometry args={[4.5, 20]} />
        <meshStandardMaterial color="#123326" roughness={0.1} metalness={0.6} />
        {pools.map((p, i) => (
          <Instance key={i} position={[p.x, 0.08, p.z]} rotation-x={-Math.PI / 2} scale={p.s} />
        ))}
      </Instances>
      <Instances limit={swampTrees.length} castShadow>
        <cylinderGeometry args={[0.15, 0.5, 8, 6]} />
        <meshStandardMaterial color="#1d2b22" roughness={1} />
        {swampTrees.map((t, i) => (
          <Instance key={i} position={[t.x, 4 * t.s, t.z]} scale={[1, t.s, 1]} rotation-z={(t.r - 3) * 0.03} />
        ))}
      </Instances>

      {/* nexus city towers */}
      <Instances limit={towers.length} castShadow>
        <boxGeometry args={[3.4, 1, 3.4]} />
        <meshStandardMaterial color="#1d2836" metalness={0.6} roughness={0.35} />
        {towers.map((t, i) => (
          <Instance key={i} position={[t.x, (10 + t.s * 16) / 2, t.z]} scale={[1, 10 + t.s * 16, 1]} rotation-y={t.r} />
        ))}
      </Instances>
      <Instances limit={towers.length}>
        <boxGeometry args={[3.6, 0.5, 3.6]} />
        <meshStandardMaterial color="#66e0ff" emissive="#66e0ff" emissiveIntensity={2} toneMapped={false} />
        {towers.map((t, i) => (
          <Instance key={i} position={[t.x, 10 + t.s * 16, t.z]} rotation-y={t.r} />
        ))}
      </Instances>
      {/* hub pad */}
      <mesh position={[nexus.x, 0.12, nexus.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[3.4, 4.6, 32]} />
        <meshBasicMaterial color="#66e0ff" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
