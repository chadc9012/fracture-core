import { Instance, Instances } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

import { REGIONS, WORLD_RADIUS, type Region } from "@/game/world";
import { mulberry32 } from "@/game/useKeyboard";
import { WATER_LEVEL, colorAt, heightAt, slopeAt } from "@/game/terrain";

const SEG = 190;
const SIZE = WORLD_RADIUS * 2.1;

type Prop = { x: number; z: number; y: number; s: number; r: number };

/** scatter props inside a region, snapped to terrain and filtered by ground rules */
function scatter(
  region: Region,
  count: number,
  seed: number,
  opts: { min?: number; max?: number; maxSlope?: number; inner?: number } = {},
): Prop[] {
  const { min = WATER_LEVEL + 0.4, max = 999, maxSlope = 1, inner = 0 } = opts;
  const rnd = mulberry32(seed);
  const out: Prop[] = [];
  let guard = count * 12;
  while (out.length < count && guard-- > 0) {
    const a = rnd() * Math.PI * 2;
    const d = inner + Math.sqrt(rnd()) * (region.radius * 0.92 - inner);
    const x = region.x + Math.cos(a) * d;
    const z = region.z + Math.sin(a) * d;
    const y = heightAt(x, z);
    if (y < min || y > max) continue;
    if (slopeAt(x, z) > maxSlope) continue;
    out.push({ x, z, y, s: 0.7 + rnd() * 0.9, r: rnd() * Math.PI * 2 });
  }
  return out;
}

const byId = (id: string) => REGIONS.find((r) => r.id === id)!;

/** the heightmap mesh — vertex coloured by elevation and biome */
function Ground() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    const pos = geo.attributes["position"] as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      // plane is built in XY then rotated, so its local Y maps to world -Z
      const z = -pos.getY(i);
      const h = heightAt(x, z);
      pos.setZ(i, h);
      const [r, g, b] = colorAt(x, z, h);
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0.02} />
    </mesh>
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

  const trees = useMemo(() => scatter(forest, 120, 11, { min: 1.5, max: 26, maxSlope: 0.55 }), [forest]);
  const flowers = useMemo(() => scatter(forest, 70, 20, { min: 1.5, max: 20, maxSlope: 0.4 }), [forest]);
  const swampTrees = useMemo(() => scatter(swamp, 70, 12, { min: -2.5, max: 6 }), [swamp]);
  const boulders = useMemo(
    () => scatter(frost, 40, 13, { min: 18, maxSlope: 0.85 }),
    [frost],
  );
  const rocks = useMemo(
    () => [
      ...scatter(waste, 46, 14, { maxSlope: 0.7 }),
      ...scatter(solara, 40, 15, { maxSlope: 0.7 }),
    ],
    [waste, solara],
  );
  const cacti = useMemo(() => scatter(solara, 55, 16, { min: 2, maxSlope: 0.45 }), [solara]);
  const wrecks = useMemo(() => scatter(waste, 30, 18, { maxSlope: 0.4 }), [waste]);
  const towers = useMemo(
    () => scatter(nexus, 30, 19, { inner: 11, maxSlope: 0.5 }),
    [nexus],
  );
  const emberRocks = useMemo(() => scatter(ember, 55, 21, { inner: 9, maxSlope: 0.95 }), [ember]);
  const craterY = useMemo(() => heightAt(ember.x, ember.z), [ember]);

  return (
    <group>
      <Ground />

      {/* ocean / lake surface at water level */}
      <mesh rotation-x={-Math.PI / 2} position-y={WATER_LEVEL}>
        <planeGeometry args={[SIZE * 1.6, SIZE * 1.6]} />
        <meshStandardMaterial
          color="#12628c"
          transparent
          opacity={0.78}
          roughness={0.08}
          metalness={0.7}
        />
      </mesh>

      {/* forest */}
      <Instances limit={trees.length} castShadow>
        <cylinderGeometry args={[0.35, 0.55, 4]} />
        <meshStandardMaterial color="#4a3524" roughness={1} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, t.y + 2 * t.s, t.z]} scale={[1, t.s, 1]} />
        ))}
      </Instances>
      <Instances limit={trees.length} castShadow>
        <coneGeometry args={[2.4, 7, 7]} />
        <meshStandardMaterial color="#2c7a41" roughness={0.9} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, t.y + 4.5 * t.s + 1.5, t.z]} scale={t.s} rotation-y={t.r} />
        ))}
      </Instances>
      <Instances limit={flowers.length}>
        <sphereGeometry args={[0.4, 6, 5]} />
        <meshStandardMaterial color="#e8639c" roughness={0.8} />
        {flowers.map((f, i) => (
          <Instance key={i} position={[f.x, f.y + 0.4, f.z]} scale={f.s} />
        ))}
      </Instances>

      {/* frostspire boulders on the high slopes */}
      <Instances limit={boulders.length} castShadow>
        <dodecahedronGeometry args={[2.6]} />
        <meshStandardMaterial color="#c3d4e6" roughness={0.75} />
        {boulders.map((b, i) => (
          <Instance key={i} position={[b.x, b.y + 1.4 * b.s, b.z]} scale={b.s} rotation-y={b.r} />
        ))}
      </Instances>

      {/* volcano crater glow */}
      <group position={[ember.x, 0, ember.z]}>
        <mesh position-y={craterY - 1} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[7, 24]} />
          <meshStandardMaterial color="#ff5a12" emissive="#ff5a12" emissiveIntensity={2.6} toneMapped={false} />
        </mesh>
        <pointLight position={[0, craterY + 6, 0]} color="#ff6a1f" intensity={220} distance={120} decay={2} />
      </group>
      <Instances limit={emberRocks.length} castShadow>
        <dodecahedronGeometry args={[1.6]} />
        <meshStandardMaterial color="#3b2622" emissive="#ff3d00" emissiveIntensity={0.35} roughness={1} />
        {emberRocks.map((r, i) => (
          <Instance key={i} position={[r.x, r.y + 1.2 * r.s, r.z]} scale={r.s} rotation-y={r.r} />
        ))}
      </Instances>

      {/* rocks across the war belt and desert */}
      <Instances limit={rocks.length} castShadow>
        <dodecahedronGeometry args={[2.2]} />
        <meshStandardMaterial color="#7c6a52" roughness={1} />
        {rocks.map((r, i) => (
          <Instance key={i} position={[r.x, r.y + 1.2 * r.s, r.z]} scale={r.s} rotation-y={r.r} />
        ))}
      </Instances>
      <Instances limit={wrecks.length} castShadow>
        <boxGeometry args={[5, 2.2, 2.6]} />
        <meshStandardMaterial color="#5b4a3f" metalness={0.4} roughness={0.7} />
        {wrecks.map((w, i) => (
          <Instance key={i} position={[w.x, w.y + 1.1, w.z]} rotation-y={w.r} />
        ))}
      </Instances>

      {/* desert cacti */}
      <Instances limit={cacti.length} castShadow>
        <capsuleGeometry args={[0.7, 3.4, 4, 8]} />
        <meshStandardMaterial color="#4f7a45" roughness={0.9} />
        {cacti.map((c, i) => (
          <Instance key={i} position={[c.x, c.y + 2.4 * c.s, c.z]} scale={c.s} />
        ))}
      </Instances>

      {/* swamp dead trees */}
      <Instances limit={swampTrees.length} castShadow>
        <cylinderGeometry args={[0.15, 0.5, 8, 6]} />
        <meshStandardMaterial color="#1d2b22" roughness={1} />
        {swampTrees.map((t, i) => (
          <Instance key={i} position={[t.x, t.y + 4 * t.s, t.z]} scale={[1, t.s, 1]} rotation-z={(t.r - 3) * 0.03} />
        ))}
      </Instances>

      {/* nexus city */}
      <Instances limit={towers.length} castShadow>
        <boxGeometry args={[3.4, 1, 3.4]} />
        <meshStandardMaterial color="#4a5b70" metalness={0.55} roughness={0.4} />
        {towers.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, t.y + (10 + t.s * 16) / 2, t.z]}
            scale={[1, 10 + t.s * 16, 1]}
            rotation-y={t.r}
          />
        ))}
      </Instances>
      <Instances limit={towers.length}>
        <boxGeometry args={[3.6, 0.5, 3.6]} />
        <meshStandardMaterial color="#66e0ff" emissive="#66e0ff" emissiveIntensity={2} toneMapped={false} />
        {towers.map((t, i) => (
          <Instance key={i} position={[t.x, t.y + 10 + t.s * 16, t.z]} rotation-y={t.r} />
        ))}
      </Instances>
    </group>
  );
}
