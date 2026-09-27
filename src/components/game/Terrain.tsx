import { Instance, Instances } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import { REGIONS, WORLD_RADIUS, type Region } from "@/game/world";
import { mulberry32 } from "@/game/useKeyboard";
import { WATER_LEVEL, colorAt, heightAt, slopeAt } from "@/game/terrain";
import { LANE_HALF_WIDTH, distanceToRoad } from "@/game/lanes";
import {
  addObstacle,
  resetObstacles,
  subscribeObstacles,
  type Obstacle,
  type ObstacleKind,
} from "@/game/obstacles";

const SEG = 160;
const SIZE = WORLD_RADIUS * 2.1;

type Prop = { x: number; z: number; y: number; s: number; r: number; o?: Obstacle };

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
    // Keep the first insertion and immediate aiming lanes free of giant canopies.
    if (region.id === "veridan" && count === 120 && Math.hypot(x - region.x, z - (region.z + 12)) < 16) continue;
    // keep supply roads clear so convoys have a crash-free corridor
    if (distanceToRoad(x, z) < LANE_HALF_WIDTH) continue;
    out.push({ x, z, y, s: 0.7 + rnd() * 0.9, r: rnd() * Math.PI * 2 });
  }
  return out;
}

const byId = (id: string) => REGIONS.find((r) => r.id === id)!;

/** deterministic per-instance color variance so instanced props don't all read as one identical stamped-out mesh */
const jitterColor = new THREE.Color();
function jitter(hex: string, seed: number, hueAmt = 0.02, lightAmt = 0.08): THREE.Color {
  const rnd = mulberry32(Math.floor(seed * 977) + 1);
  jitterColor.set(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  jitterColor.getHSL(hsl);
  jitterColor.setHSL(
    (hsl.h + (rnd() - 0.5) * hueAmt + 1) % 1,
    THREE.MathUtils.clamp(hsl.s + (rnd() - 0.5) * 0.08, 0, 1),
    THREE.MathUtils.clamp(hsl.l + (rnd() - 0.5) * lightAmt, 0, 1),
  );
  return jitterColor.clone();
}

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
  const emberRocks = useMemo(() => scatter(ember, 55, 21, { inner: 9, maxSlope: 0.95 }), [ember]);
  const [, bump] = useState(0);
  useEffect(() => {
    const off = subscribeObstacles(() => bump((n) => n + 1));
    return () => {
      off();
    };
  }, []);

  // register every solid prop in the collision grid
  useMemo(() => {
    resetObstacles();
    const reg = (list: Prop[], kind: ObstacleKind, r: number, hp: number, solidity: number) => {
      for (const p of list) p.o = addObstacle(kind, p.x, p.z, r * (p.s || 1), hp, solidity);
    };
    reg(trees, "tree", 1.1, 22, 0.7);
    reg(swampTrees, "tree", 0.9, 16, 0.6);
    reg(boulders, "rock", 2.6, 120, 1.4);
    reg(rocks, "rock", 2.2, 90, 1.2);
    reg(emberRocks, "rock", 1.6, 70, 1.1);
    reg(cacti, "cactus", 0.9, 8, 0.4);
    reg(wrecks, "wreck", 2.6, 55, 1);
    // Note: Nexus buildings are no longer scattered here — they're real GLB models
    // placed by NexusCity.tsx's CityBuildings, which registers its own obstacles.
    // Rendering primitive box "towers" here too used to double up on top of them.
  }, [trees, swampTrees, boulders, rocks, emberRocks, cacti, wrecks]);

  const alive = (list: Prop[]) => list.filter((p) => !p.o?.broken);
  const liveTrees = alive(trees);
  const liveSwamp = alive(swampTrees);
  const liveBoulders = alive(boulders);
  const liveRocks = alive(rocks);
  const liveEmber = alive(emberRocks);
  const liveCacti = alive(cacti);
  const liveWrecks = alive(wrecks);

  const craterY = useMemo(() => heightAt(ember.x, ember.z), [ember]);

  return (
    <group>
      <Ground />

      {/* forest: trunk + two staggered canopy layers, hue-jittered per instance so the
          treeline reads as a forest instead of one stamped-out cone repeated 120 times */}
      <Instances limit={liveTrees.length} castShadow>
        <cylinderGeometry args={[0.32, 0.55, 4, 7]} />
        <meshStandardMaterial color="#4a3524" roughness={0.95} />
        {liveTrees.map((t, i) => (
          <Instance key={i} position={[t.x, t.y + 2 * t.s, t.z]} scale={[1, t.s, 1]} color={jitter("#4a3524", i, 0.02, 0.1)} />
        ))}
      </Instances>
      <Instances limit={liveTrees.length} castShadow>
        <coneGeometry args={[2.7, 5, 8]} />
        <meshStandardMaterial color="#2c7a41" roughness={0.9} />
        {liveTrees.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, t.y + 3.6 * t.s + 1.1, t.z]}
            scale={[t.s * (0.94 + (i % 5) * 0.02), t.s * 1.05, t.s * (0.94 + (i % 3) * 0.03)]}
            rotation-y={t.r}
            color={jitter("#2c7a41", i, 0.035, 0.12)}
          />
        ))}
      </Instances>
      <Instances limit={liveTrees.length} castShadow>
        <coneGeometry args={[1.7, 4.2, 7]} />
        <meshStandardMaterial color="#3a8f4d" roughness={0.9} />
        {liveTrees.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, t.y + 5.9 * t.s + 1.6, t.z]}
            scale={[t.s * (0.9 + (i % 4) * 0.03), t.s * 0.95, t.s * (0.9 + (i % 6) * 0.02)]}
            rotation-y={t.r + 0.6}
            color={jitter("#3a8f4d", i + 41, 0.035, 0.12)}
          />
        ))}
      </Instances>
      <Instances limit={flowers.length}>
        <sphereGeometry args={[0.4, 6, 5]} />
        <meshStandardMaterial color="#e8639c" roughness={0.8} />
        {flowers.map((f, i) => {
          const palette = ["#e8639c", "#f0d24a", "#f4f4f4", "#b478e0"];
          return <Instance key={i} position={[f.x, f.y + 0.4, f.z]} scale={f.s * 0.7} color={palette[i % palette.length]!} />;
        })}
      </Instances>

      {/* frostspire boulders on the high slopes — mixed silhouettes + per-instance grey jitter */}
      <Instances limit={liveBoulders.length} castShadow>
        <icosahedronGeometry args={[2.6, 0]} />
        <meshStandardMaterial color="#c3d4e6" roughness={0.7} />
        {liveBoulders.map((b, i) =>
          i % 2 === 0 ? (
            <Instance
              key={i}
              position={[b.x, b.y + 1.3 * b.s, b.z]}
              scale={[b.s * 0.95, b.s * (0.85 + (i % 3) * 0.1), b.s]}
              rotation-y={b.r}
              color={jitter("#c3d4e6", i, 0.02, 0.1)}
            />
          ) : null,
        )}
      </Instances>
      <Instances limit={liveBoulders.length} castShadow>
        <dodecahedronGeometry args={[2.6, 0]} />
        <meshStandardMaterial color="#c3d4e6" roughness={0.75} />
        {liveBoulders.map((b, i) =>
          i % 2 === 1 ? (
            <Instance
              key={i}
              position={[b.x, b.y + 1.4 * b.s, b.z]}
              scale={[b.s, b.s * (0.85 + (i % 4) * 0.08), b.s * 0.92]}
              rotation-y={b.r}
              color={jitter("#c3d4e6", i, 0.02, 0.1)}
            />
          ) : null,
        )}
      </Instances>

      {/* volcano crater glow */}
      <group position={[ember.x, 0, ember.z]}>
        <mesh position-y={craterY - 1} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[7, 24]} />
          <meshStandardMaterial color="#ff5a12" emissive="#ff5a12" emissiveIntensity={2.6} toneMapped={false} />
        </mesh>
        <pointLight position={[0, craterY + 6, 0]} color="#ff6a1f" intensity={220} distance={120} decay={2} />
      </group>
      <Instances limit={liveEmber.length} castShadow>
        <dodecahedronGeometry args={[1.6, 0]} />
        <meshStandardMaterial color="#3b2622" emissive="#ff3d00" emissiveIntensity={0.35} roughness={1} />
        {liveEmber.map((r, i) => (
          <Instance
            key={i}
            position={[r.x, r.y + 1.2 * r.s, r.z]}
            scale={[r.s * (0.9 + (i % 4) * 0.06), r.s * (0.85 + (i % 3) * 0.1), r.s * (0.9 + (i % 5) * 0.05)]}
            rotation-y={r.r}
            color={jitter("#3b2622", i, 0.03, 0.12)}
          />
        ))}
      </Instances>

      {/* rocks across the war belt and desert — split silhouettes + jittered grey/tan tones */}
      <Instances limit={liveRocks.length} castShadow>
        <icosahedronGeometry args={[2.2, 0]} />
        <meshStandardMaterial color="#7c6a52" roughness={0.95} />
        {liveRocks.map((r, i) =>
          i % 2 === 0 ? (
            <Instance
              key={i}
              position={[r.x, r.y + 1.1 * r.s, r.z]}
              scale={[r.s * 0.9, r.s * (0.8 + (i % 3) * 0.12), r.s]}
              rotation-y={r.r}
              color={jitter("#7c6a52", i, 0.03, 0.14)}
            />
          ) : null,
        )}
      </Instances>
      <Instances limit={liveRocks.length} castShadow>
        <dodecahedronGeometry args={[2.2, 0]} />
        <meshStandardMaterial color="#7c6a52" roughness={1} />
        {liveRocks.map((r, i) =>
          i % 2 === 1 ? (
            <Instance
              key={i}
              position={[r.x, r.y + 1.2 * r.s, r.z]}
              scale={[r.s, r.s * (0.8 + (i % 4) * 0.1), r.s * 0.9]}
              rotation-y={r.r}
              color={jitter("#7c6a52", i, 0.03, 0.14)}
            />
          ) : null,
        )}
      </Instances>
      <Instances limit={liveWrecks.length} castShadow>
        <boxGeometry args={[5, 2.2, 2.6]} />
        <meshStandardMaterial color="#5b4a3f" metalness={0.4} roughness={0.65} />
        {liveWrecks.map((w, i) => (
          <Instance key={i} position={[w.x, w.y + 1.1, w.z]} rotation-y={w.r} color={jitter("#5b4a3f", i, 0.02, 0.12)} />
        ))}
      </Instances>

      {/* desert cacti */}
      <Instances limit={liveCacti.length} castShadow>
        <capsuleGeometry args={[0.7, 3.4, 4, 8]} />
        <meshStandardMaterial color="#4f7a45" roughness={0.9} />
        {liveCacti.map((c, i) => (
          <Instance key={i} position={[c.x, c.y + 2.4 * c.s, c.z]} scale={c.s} />
        ))}
      </Instances>

      {/* swamp dead trees */}
      <Instances limit={liveSwamp.length} castShadow>
        <cylinderGeometry args={[0.15, 0.5, 8, 6]} />
        <meshStandardMaterial color="#1d2b22" roughness={1} />
        {liveSwamp.map((t, i) => (
          <Instance key={i} position={[t.x, t.y + 4 * t.s, t.z]} scale={[1, t.s, 1]} rotation-z={(t.r - 3) * 0.03} />
        ))}
      </Instances>

    </group>
  );
}
