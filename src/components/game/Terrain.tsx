import { Instance, Instances } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";

import { REGIONS, WORLD_RADIUS, type Region } from "@/game/world";
import { mulberry32 } from "@/game/useKeyboard";
import { WATER_LEVEL, colorAt, heightAt, slopeAt } from "@/game/terrain";
import { groundDetailTextures } from "@/game/detail-texture";
import { useInstancedModel } from "@/game/nature-models";
import type { ModelKey } from "@/game/models";
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

// First-pass scale multipliers for the real GLB nature-kit models, tuned against the primitive
// geometry they replace (trees vs. the old ~3-unit cone canopies, rocks/boulders vs. the old
// 2.2-2.6 radius icosahedra/dodecahedra). These models' native size in the source file is unknown
// from this sandbox (no way to render/inspect the GLB visually here) — if trees or rocks come out
// too small/huge in the live preview, these are the numbers to tune.
const NATURE_MODEL_SCALE = {
  tree: 1.8,
  rockLarge: 2.4,
  rockMedium: 1.9,
  boulder: 2.6,
  deadTree: 1.6,
  // Poly Haven's rocks are real-world photogrammetry scans (reported in meters), a different
  // native scale than the stylized nature-kit pack above — these are a separate first-pass
  // estimate for the same reason: no way to render/measure the mesh from this sandbox.
  rockLargePbr: 2.1,
  rockMediumPbr: 1.7,
  boulderPbr: 2.3,
};

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

  const { map, normalMap } = useMemo(() => groundDetailTextures(), []);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.95}
        metalness={0.02}
        map={map}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(0.35, 0.35)}
      />
    </mesh>
  );
}

/** Renders one species/parity-slice of an instanced rock/tree model. A null return from
 * useInstancedModel (e.g. the GLTF had no meshes) is a soft no-op; a genuine load failure
 * (network error, CORS block) throws, which is caught by the RockErrorBoundary below rather
 * than crashing the whole world via the top-level WorldErrorBoundary. */
function InstancedRockSet({
  modelKey,
  scale,
  items,
  parity,
}: {
  modelKey: ModelKey;
  scale: number;
  items: Prop[];
  parity: 0 | 1;
}) {
  const model = useInstancedModel(modelKey);
  if (!model) return null;
  return (
    <Instances limit={items.length} castShadow receiveShadow geometry={model.geometry} material={model.material}>
      {items.map((p, i) =>
        i % 2 === parity ? <Instance key={i} position={[p.x, p.y, p.z]} scale={p.s * scale} rotation-y={p.r} /> : null,
      )}
    </Instances>
  );
}

class RockErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state: { failed: boolean } = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(err: unknown) {
    console.warn("[world-fracture] realistic PBR rock model failed to load — falling back to the stylized rock:", err);
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** A real-world-scanned PBR rock (Poly Haven) is the preferred look; if that CDN is ever
 * unreachable for a given player the error boundary swaps in the already-proven stylized
 * nature-kit rock instead of crashing or going blank. */
function RockField({
  pbrKey,
  fallbackKey,
  pbrScale,
  fallbackScale,
  items,
  parity,
}: {
  pbrKey: ModelKey;
  fallbackKey: ModelKey;
  pbrScale: number;
  fallbackScale: number;
  items: Prop[];
  parity: 0 | 1;
}) {
  return (
    <Suspense fallback={null}>
      <RockErrorBoundary
        fallback={<InstancedRockSet modelKey={fallbackKey} scale={fallbackScale} items={items} parity={parity} />}
      >
        <InstancedRockSet modelKey={pbrKey} scale={pbrScale} items={items} parity={parity} />
      </RockErrorBoundary>
    </Suspense>
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

  // Real low-poly nature models (nature-models.ts) replacing bare primitive geometry — same
  // <Instances> pipeline, so a whole forest/rockfield is still one draw call per species.
  const pineModel = useInstancedModel("tree_pine");
  const oakModel = useInstancedModel("tree_oak");
  const birchModel = useInstancedModel("tree_birch");
  const deadTreeModel = useInstancedModel("tree_dead");

  // Rocks are rendered further down via <RockField> — each one tries a real-world-scanned PBR
  // model (Poly Haven) first and falls back to the stylized nature-kit rock on a load failure.

  return (
    <group>
      <Ground />

      {/* forest: real low-poly tree models (Pine/Oak/Birch), split by index so the treeline reads as
          a mixed forest instead of one repeated shape. NATURE_MODEL_SCALE below is a first-pass
          estimate of these models' native size vs. the old cone trees — if trees come out too
          small/huge in the live preview, that's the one number to tune. */}
      {[
        { model: pineModel, species: 0 },
        { model: oakModel, species: 1 },
        { model: birchModel, species: 2 },
      ].map(({ model, species }) =>
        model && (
          <Instances key={species} limit={liveTrees.length} castShadow receiveShadow geometry={model.geometry} material={model.material}>
            {liveTrees.filter((_, i) => i % 3 === species).map((t, i) => (
              <Instance
                key={i}
                position={[t.x, t.y, t.z]}
                scale={t.s * NATURE_MODEL_SCALE.tree}
                rotation-y={t.r}
              />
            ))}
          </Instances>
        ),
      )}
      <Instances limit={flowers.length}>
        <sphereGeometry args={[0.4, 6, 5]} />
        <meshStandardMaterial color="#e8639c" roughness={0.8} />
        {flowers.map((f, i) => {
          const palette = ["#e8639c", "#f0d24a", "#f4f4f4", "#b478e0"];
          return <Instance key={i} position={[f.x, f.y + 0.4, f.z]} scale={f.s * 0.7} color={palette[i % palette.length] ?? "#f4f4f4"} />;
        })}
      </Instances>

      {/* frostspire boulders on the high slopes — real-world-scanned PBR rock models (Poly Haven),
          falling back to the stylized nature-kit rock if that CDN doesn't load; split by index so
          the field doesn't read as one repeated shape */}
      <RockField
        pbrKey="rock_large_pbr"
        fallbackKey="rock_large"
        pbrScale={NATURE_MODEL_SCALE.rockLargePbr}
        fallbackScale={NATURE_MODEL_SCALE.rockLarge}
        items={liveBoulders}
        parity={0}
      />
      <RockField
        pbrKey="boulder_cluster_pbr"
        fallbackKey="boulder_cluster"
        pbrScale={NATURE_MODEL_SCALE.boulderPbr}
        fallbackScale={NATURE_MODEL_SCALE.boulder}
        items={liveBoulders}
        parity={1}
      />

      {/* volcano crater glow */}
      <group position={[ember.x, 0, ember.z]}>
        <mesh position-y={craterY - 1} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[7, 24]} />
          <meshStandardMaterial color="#ff5a12" emissive="#ff5a12" emissiveIntensity={2.6} toneMapped={false} />
        </mesh>
        <pointLight position={[0, craterY + 6, 0]} color="#ff6a1f" intensity={220} distance={120} decay={2} />
      </group>
      <Instances limit={liveEmber.length} castShadow receiveShadow>
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

      {/* rocks across the war belt and desert — real-world-scanned PBR rock models, same
          fallback-to-stylized behavior as the frostspire boulders above */}
      <RockField
        pbrKey="rock_medium_pbr"
        fallbackKey="rock_medium"
        pbrScale={NATURE_MODEL_SCALE.rockMediumPbr}
        fallbackScale={NATURE_MODEL_SCALE.rockMedium}
        items={liveRocks}
        parity={0}
      />
      <RockField
        pbrKey="rock_large_pbr"
        fallbackKey="rock_large"
        pbrScale={NATURE_MODEL_SCALE.rockLargePbr}
        fallbackScale={NATURE_MODEL_SCALE.rockLarge}
        items={liveRocks}
        parity={1}
      />
      <Instances limit={liveWrecks.length} castShadow receiveShadow>
        <boxGeometry args={[5, 2.2, 2.6]} />
        <meshStandardMaterial color="#5b4a3f" metalness={0.4} roughness={0.65} />
        {liveWrecks.map((w, i) => (
          <Instance key={i} position={[w.x, w.y + 1.1, w.z]} rotation-y={w.r} color={jitter("#5b4a3f", i, 0.02, 0.12)} />
        ))}
      </Instances>

      {/* desert cacti */}
      <Instances limit={liveCacti.length} castShadow receiveShadow>
        <capsuleGeometry args={[0.7, 3.4, 4, 8]} />
        <meshStandardMaterial color="#4f7a45" roughness={0.9} />
        {liveCacti.map((c, i) => (
          <Instance key={i} position={[c.x, c.y + 2.4 * c.s, c.z]} scale={c.s} />
        ))}
      </Instances>

      {/* swamp dead trees — real dead-tree GLB model */}
      {deadTreeModel && (
        <Instances limit={liveSwamp.length} castShadow receiveShadow geometry={deadTreeModel.geometry} material={deadTreeModel.material}>
          {liveSwamp.map((t, i) => (
            <Instance
              key={i}
              position={[t.x, t.y, t.z]}
              scale={t.s * NATURE_MODEL_SCALE.deadTree}
              rotation-y={t.r}
            />
          ))}
        </Instances>
      )}

    </group>
  );
}
