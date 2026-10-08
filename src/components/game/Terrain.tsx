import { Instance, Instances } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import { REGIONS, WORLD_RADIUS, type Region } from "@/game/world";
import type { RenderTier } from "@/game/performance";
import { mulberry32 } from "@/game/useKeyboard";
import { clusterAround } from "@/game/foliage";
import { windSway } from "@/game/wind-sway";
import { WATER_LEVEL, colorAt, heightAt, slopeAt } from "@/game/terrain";
import { groundDetailTextures, propDetailTextures } from "@/game/detail-texture";
import { applySurfaceBlend, loadGroundSurfaces, surfaceWeights } from "@/game/region-materials";
import { RegionModels } from "./RegionModels";
import { organicCanopy, organicRock } from "@/game/organic-geometry";
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
  opts: { min?: number; max?: number; maxSlope?: number; inner?: number; keepSpawnLaneClear?: boolean } = {},
): Prop[] {
  const { min = WATER_LEVEL + 0.4, max = 999, maxSlope = 1, inner = 0, keepSpawnLaneClear = false } = opts;
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
    if (keepSpawnLaneClear && Math.hypot(x - region.x, z - (region.z + 12)) < 16) continue;
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
    const wA = new Float32Array(pos.count * 3);
    const wB = new Float32Array(pos.count * 3);
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
      const w = surfaceWeights(x, z);
      wA[i * 3] = w[0]!; wA[i * 3 + 1] = w[1]!; wA[i * 3 + 2] = w[2]!;
      wB[i * 3] = w[3]!; wB[i * 3 + 1] = w[4]!; wB[i * 3 + 2] = w[5]!;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("wA", new THREE.BufferAttribute(wA, 3));
    geo.setAttribute("wB", new THREE.BufferAttribute(wB, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  const { map, normalMap } = useMemo(() => groundDetailTextures(), []);
  // Poly Haven region surfaces; procedural grain stays if any texture fails to load.
  const [surfaces, setSurfaces] = useState<THREE.Texture[] | null>(null);
  useEffect(() => { let live = true; void loadGroundSurfaces().then((t) => { if (live) setSurfaces(t); }); return () => { live = false; }; }, []);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02, map: surfaces ? null : map, normalMap, normalScale: new THREE.Vector2(0.35, 0.35) });
    if (surfaces) applySurfaceBlend(m, surfaces);
    return m;
  }, [surfaces, map, normalMap]);

  return <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />;
}

export function Terrain({ renderTier = "HIGH" }: { renderTier?: RenderTier } = {}) {
  // ~13 MB of decorative Poly Haven GLBs would compete with the ground textures and first frames, so they join the world a few seconds after it appears
  const [modelsReady, setModelsReady] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setModelsReady(true), 4000); return () => window.clearTimeout(t); }, []);
  const forest = byId("veridan");
  const frost = byId("frostspire");
  const ember = byId("ember");
  const waste = byId("wastelands");
  const solara = byId("solara");
  const swamp = byId("swamps");

  // Prop density and shadow detail both scale down on the lighter tiers — fewer instanced
  // trees/rocks to submit and fewer small shadow casters to run through the depth pass, on top
  // of the dpr/shadow/post-processing scaling RENDER_PRESETS already does at the Canvas level.
  const density = renderTier === "LOW" ? 0.5 : renderTier === "MEDIUM" ? 0.75 : 1;
  const fineShadows = renderTier === "HIGH" || renderTier === "ULTRA";
  const d = (n: number) => Math.max(1, Math.round(n * density));

  const trees = useMemo(() => scatter(forest, d(120), 11, { min: 1.5, max: 26, maxSlope: 0.55, keepSpawnLaneClear: true }), [forest, density]);
  // undergrowth clusters around each tree: saplings and low brush, kept off roads, water and steep ground
  const undergrowth = useMemo(() => clusterAround(trees, d(3), mulberry32(61), (x, z) => {
    const y = heightAt(x, z);
    return y > 1.8 && y < 24 && slopeAt(x, z) < 0.5 && distanceToRoad(x, z) > LANE_HALF_WIDTH + 1 && Math.hypot(x - forest.x, z - (forest.z + 12)) > 12;
  }, { minScale: 0.45, maxScale: 1 }), [trees, density]);
  const flowers = useMemo(() => scatter(forest, d(70), 20, { min: 1.5, max: 20, maxSlope: 0.4 }), [forest, density]);
  const swampTrees = useMemo(() => scatter(swamp, d(70), 12, { min: -2.5, max: 6 }), [swamp, density]);
  const boulders = useMemo(
    () => scatter(frost, d(40), 13, { min: 18, maxSlope: 0.85 }),
    [frost, density],
  );
  const rocks = useMemo(
    () => [
      ...scatter(waste, d(46), 14, { maxSlope: 0.7 }),
      ...scatter(solara, d(40), 15, { maxSlope: 0.7 }),
    ],
    [waste, solara, density],
  );
  const cacti = useMemo(() => scatter(solara, d(55), 16, { min: 2, maxSlope: 0.45 }), [solara, density]);
  const wrecks = useMemo(() => scatter(waste, d(30), 18, { maxSlope: 0.4 }), [waste, density]);
  const emberRocks = useMemo(() => scatter(ember, d(55), 21, { inner: 9, maxSlope: 0.95 }), [ember, density]);
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
  const rockDetail = useMemo(() => propDetailTextures(3), []);
  const barkDetail = useMemo(() => propDetailTextures(2), []);
  const leafDetail = useMemo(() => propDetailTextures(5), []);

  // Organic, noise-deformed shared geometries — one lumpy variant per shape family, instanced
  // many times with the existing per-instance scale/rotation/color jitter so no two props read
  // identically, without the faceted "boxy" look of a bare icosahedron/dodecahedron/cone.
  const canopyLow = useMemo(() => organicCanopy(2.7, 1.3, 7), []);
  const canopyHigh = useMemo(() => organicCanopy(1.9, 1.5, 19), []);
  const boulderA = useMemo(() => organicRock(2.6, 3, 1, 0.75), []);
  const boulderB = useMemo(() => organicRock(2.6, 8, 1, 0.75), []);
  const rockA = useMemo(() => organicRock(2.2, 23, 1, 0.65), []);
  const rockB = useMemo(() => organicRock(2.2, 31, 1, 0.65), []);
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.32, 0.55, 4, 7), []);
  const deadTrunkGeo = useMemo(() => new THREE.CylinderGeometry(0.15, 0.5, 8, 6), []);
  const grassGeo = useMemo(() => new THREE.ConeGeometry(0.28, 1.1, 5, 1, true).translate(0, 0.55, 0), []);
  const reedGeo = useMemo(() => new THREE.CylinderGeometry(0.03, 0.07, 2.2, 4, 1, true).translate(0, 1.1, 0), []);
  const swayTrunk = useMemo(() => windSway(trunkGeo, 0.18), [trunkGeo]);
  const swayDeadTrunk = useMemo(() => windSway(deadTrunkGeo, 0.1), [deadTrunkGeo]);
  const swayCanopyLow = useMemo(() => windSway(canopyLow, 0.55), [canopyLow]);
  const swayCanopyHigh = useMemo(() => windSway(canopyHigh, 0.8), [canopyHigh]);
  const swayGrass = useMemo(() => windSway(grassGeo, 0.7), [grassGeo]);
  const swayReed = useMemo(() => windSway(reedGeo, 0.5), [reedGeo]);
  const grass = useMemo(() => scatter(forest, d(420), 31, { min: 1.8, max: 20, maxSlope: 0.45, keepSpawnLaneClear: true }), [forest, density]);
  const reeds = useMemo(() => scatter(swamp, d(240), 33, { min: -2.2, max: 3.5, maxSlope: 0.5 }), [swamp, density]);
  const emberRockGeo = useMemo(() => organicRock(1.6, 44, 1, 0.5), []);

  return (
    <group>
      <Ground />
      {renderTier !== "LOW" && modelsReady && <RegionModels />}

      {/* forest: trunk + two staggered canopy layers, hue-jittered per instance so the
          treeline reads as a forest instead of one stamped-out cone repeated 120 times */}
      <Instances limit={liveTrees.length} castShadow receiveShadow>
        <primitive object={trunkGeo} attach="geometry" />
        <meshStandardMaterial onBeforeCompile={swayTrunk} color="#4a3524" roughness={0.95} map={barkDetail.map} normalMap={barkDetail.normalMap} normalScale={new THREE.Vector2(0.6, 0.6)} />
        {liveTrees.map((t, i) => (
          <Instance key={i} position={[t.x, t.y + 2 * t.s, t.z]} scale={[1, t.s, 1]} color={jitter("#4a3524", i, 0.02, 0.1)} />
        ))}
      </Instances>
      <Instances limit={liveTrees.length} castShadow={fineShadows} receiveShadow geometry={canopyLow}>
        <meshStandardMaterial onBeforeCompile={swayCanopyLow} color="#2c7a41" roughness={0.9} map={leafDetail.map} normalMap={leafDetail.normalMap} normalScale={new THREE.Vector2(0.4, 0.4)} />
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
      <Instances limit={liveTrees.length} castShadow={fineShadows} receiveShadow geometry={canopyHigh}>
        <meshStandardMaterial onBeforeCompile={swayCanopyHigh} color="#3a8f4d" roughness={0.9} map={leafDetail.map} normalMap={leafDetail.normalMap} normalScale={new THREE.Vector2(0.4, 0.4)} />
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
      {/* undergrowth: saplings (tall) and brush (low, wide) clustered around the parent trees */}
      <Instances limit={Math.max(1, undergrowth.length)} castShadow={false} receiveShadow geometry={canopyHigh}>
        <meshStandardMaterial onBeforeCompile={swayCanopyHigh} color="#3f9a4f" roughness={0.9} map={leafDetail.map} normalMap={leafDetail.normalMap} normalScale={new THREE.Vector2(0.4, 0.4)} />
        {undergrowth.map((u, i) => {
          const sapling = i % 3 !== 0;
          const y = heightAt(u.x, u.z);
          return <Instance key={i} position={[u.x, y + (sapling ? 0.9 : 0.35) * u.s, u.z]} scale={sapling ? [0.3 * u.s, 0.42 * u.s, 0.3 * u.s] : [0.38 * u.s, 0.2 * u.s, 0.38 * u.s]} rotation-y={u.r} color={jitter(sapling ? "#3f9a4f" : "#2a6b3a", i + 7, 0.04, 0.14)} />;
        })}
      </Instances>
      <Instances limit={flowers.length}>
        <sphereGeometry args={[0.4, 6, 5]} />
        <meshStandardMaterial color="#e8639c" roughness={0.8} />
        {flowers.map((f, i) => {
          const palette = ["#e8639c", "#f0d24a", "#f4f4f4", "#b478e0"];
          return <Instance key={i} position={[f.x, f.y + 0.4, f.z]} scale={f.s * 0.7} color={palette[i % palette.length] ?? "#f4f4f4"} />;
        })}
      </Instances>

      {/* frostspire boulders on the high slopes — mixed silhouettes + per-instance grey jitter */}
      <Instances limit={liveBoulders.length} castShadow receiveShadow geometry={boulderA}>
        <meshStandardMaterial color="#c3d4e6" roughness={0.7} map={rockDetail.map} normalMap={rockDetail.normalMap} normalScale={new THREE.Vector2(0.5, 0.5)} />
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
      <Instances limit={liveBoulders.length} castShadow receiveShadow geometry={boulderB}>
        <meshStandardMaterial color="#c3d4e6" roughness={0.75} map={rockDetail.map} normalMap={rockDetail.normalMap} normalScale={new THREE.Vector2(0.5, 0.5)} />
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
      <Instances limit={liveEmber.length} castShadow receiveShadow geometry={emberRockGeo}>
        <meshStandardMaterial color="#3b2622" emissive="#ff3d00" emissiveIntensity={0.35} roughness={1} map={rockDetail.map} normalMap={rockDetail.normalMap} normalScale={new THREE.Vector2(0.4, 0.4)} />
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
      <Instances limit={liveRocks.length} castShadow receiveShadow geometry={rockA}>
        <meshStandardMaterial color="#7c6a52" roughness={0.95} map={rockDetail.map} normalMap={rockDetail.normalMap} normalScale={new THREE.Vector2(0.5, 0.5)} />
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
      <Instances limit={liveRocks.length} castShadow receiveShadow geometry={rockB}>
        <meshStandardMaterial color="#7c6a52" roughness={1} map={rockDetail.map} normalMap={rockDetail.normalMap} normalScale={new THREE.Vector2(0.5, 0.5)} />
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
      <Instances limit={liveWrecks.length} castShadow receiveShadow>
        <boxGeometry args={[5, 2.2, 2.6]} />
        <meshStandardMaterial color="#5b4a3f" metalness={0.4} roughness={0.65} map={rockDetail.map} normalMap={rockDetail.normalMap} normalScale={new THREE.Vector2(0.5, 0.5)} />
        {liveWrecks.map((w, i) => (
          <Instance key={i} position={[w.x, w.y + 1.1, w.z]} rotation-y={w.r} color={jitter("#5b4a3f", i, 0.02, 0.12)} />
        ))}
      </Instances>

      {/* desert cacti */}
      <Instances limit={liveCacti.length} castShadow receiveShadow>
        <capsuleGeometry args={[0.7, 3.4, 4, 8]} />
        <meshStandardMaterial color="#4f7a45" roughness={0.9} map={leafDetail.map} normalMap={leafDetail.normalMap} normalScale={new THREE.Vector2(0.5, 0.5)} />
        {liveCacti.map((c, i) => (
          <Instance key={i} position={[c.x, c.y + 2.4 * c.s, c.z]} scale={c.s} />
        ))}
      </Instances>

      {/* swamp dead trees */}
      <Instances limit={liveSwamp.length} castShadow receiveShadow>
        <primitive object={deadTrunkGeo} attach="geometry" />
        <meshStandardMaterial onBeforeCompile={swayDeadTrunk} color="#1d2b22" roughness={1} map={barkDetail.map} normalMap={barkDetail.normalMap} normalScale={new THREE.Vector2(0.6, 0.6)} />
        {liveSwamp.map((t, i) => (
          <Instance key={i} position={[t.x, t.y + 4 * t.s, t.z]} scale={[1, t.s, 1]} rotation-z={(t.r - 3) * 0.03} />
        ))}
      </Instances>

      {/* grass tufts and swamp reeds: thin open cones/stalks that bend hardest at the tip */}
      <Instances limit={Math.max(1, grass.length)} receiveShadow geometry={grassGeo}>
        <meshStandardMaterial onBeforeCompile={swayGrass} color="#5fae4f" roughness={1} side={THREE.DoubleSide} />
        {grass.map((g, i) => <Instance key={i} position={[g.x, g.y, g.z]} scale={[0.8 + (i % 4) * 0.2, 0.7 + g.s * 0.7, 0.8 + (i % 3) * 0.25]} rotation-y={g.r} color={jitter("#5fae4f", i + 90, 0.05, 0.16)} />)}
      </Instances>
      <Instances limit={Math.max(1, reeds.length)} receiveShadow geometry={reedGeo}>
        <meshStandardMaterial onBeforeCompile={swayReed} color="#5e7a4a" roughness={1} side={THREE.DoubleSide} />
        {reeds.map((g, i) => <Instance key={i} position={[g.x, Math.max(g.y, WATER_LEVEL + 0.1), g.z]} scale={[1, 0.6 + g.s * 0.8, 1]} rotation-y={g.r} color={jitter("#5e7a4a", i + 120, 0.04, 0.14)} />)}
      </Instances>
    </group>
  );
}
