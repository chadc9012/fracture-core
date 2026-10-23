import { Instance, Instances } from "@react-three/drei";
import { DistrictLight } from "./DistrictLight";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { REGIONS, WORLD_RADIUS, WORLD_SCALE, type Region } from "@/game/world";
import type { RenderTier } from "@/game/performance";
import { mulberry32 } from "@/game/rng";
import { clusterAround } from "@/game/foliage";
import { GROVE, growGroves } from "@/game/forest-density";
import { windSway } from "@/game/wind-sway";
import { WATER_LEVEL, HEIGHT_K, colorAt, heightAt, slopeAt, riverAt } from "@/game/terrain";
import { groundDetailTextures, propDetailTextures } from "@/game/detail-texture";
import { applySurfaceBlend, groundTime, loadGroundNormals, loadGroundSurfaces, surfaceWeights } from "@/game/region-materials";
import { getPerfTier } from "@/game/perf-budget";
import { RegionModels } from "./RegionModels";
import { PolyFoliage, type Placement } from "./PolyFoliage";
import { reportAsset } from "@/game/forest-assets";
import { isReserved, trailInfo, FOREST_SPAWN } from "@/game/verdant";
import { CHUNK, startChunkBuild, chunkKey, chunksNear, distanceToChunk, lodForDistance, planBuilds, type BuildRequest, type ChunkBuild, type ChunkMesh, type ChunkSamplers } from "@/game/terrain-chunks";
import { flowerClump, organicCanopy, organicRock, petalTint, saguaro } from "@/game/organic-geometry";
import type { FleetModelId } from "@/game/fleet-models";
import { InstancedFleet, type FleetInstance } from "./InstancedFleet";
import { WorldPiece } from "./WorldPiece";

const WRECK_CARS: FleetModelId[] = ["muscle-car", "offroad-truck", "luxury-sedan", "armored-muscle", "raider-buggy", "security-suv"];
const WRECK_RUST = ["#5a3b2a", "#6a4a30", "#4a3a30", "#3a3530", "#70503a"];
import { LANE_HALF_WIDTH, distanceToRoad } from "@/game/lanes";
import {
  addObstacle,
  resetObstacles,
  subscribeObstacles,
  type Obstacle,
  type ObstacleKind,
} from "@/game/obstacles";

/** caps for the non-culled instanced forest layers (see Terrain below) */
const UNDERSTORY_PARENT_CAP = 320;
const PROC_TREE_CAP = 500;

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
    // Verdant Forest: the mission trail, spawn clearing, ambush clearing and crash pad stay open (verdant.ts)
    if (region.id === "veridan" && isReserved(x, z, 1.5)) continue;
    // keep supply roads clear so convoys have a crash-free corridor
    if (distanceToRoad(x, z) < LANE_HALF_WIDTH) continue;
    // keep river channels and their banks open (rivers.ts)
    const rv = riverAt(x, z);
    if (rv && rv.dist < rv.w + 2) continue;
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

/** Chunked, distance-LOD heightmap (terrain-chunks.ts): each tile is built lazily at the resolution its distance needs, nearest first,
 * under a small per-frame time budget. Meshes are managed imperatively so no React re-render happens as the player moves. */
const GROUND_SAMPLERS: ChunkSamplers = { height: heightAt, color: colorAt, weights: surfaceWeights };
/** dev-only (?dev=1&tier=…): a software renderer draws ~2 frames a second, so screenshots would show unstreamed ground; give the
 * stream a big per-frame budget there instead */
const DEV_FAST_STREAM = typeof window !== "undefined" && (() => { const q = new URLSearchParams(window.location.search); return q.get("dev") === "1" && q.has("tier"); })();
const BUILD_BUDGET_MS = DEV_FAST_STREAM ? 250 : 4;
const WARMUP_BUDGET_MS = DEV_FAST_STREAM ? 250 : 14;
const WARMUP_FRAMES = 120;
const REPLAN_DISTANCE = 6;

function chunkGeometry(m: ChunkMesh): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(m.position, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(m.normal, 3));
  g.setAttribute("color", new THREE.BufferAttribute(m.color, 3));
  g.setAttribute("wA", new THREE.BufferAttribute(m.wA, 3));
  g.setAttribute("wB", new THREE.BufferAttribute(m.wB, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(m.uv, 2));
  g.setIndex(new THREE.BufferAttribute(m.index, 1));
  g.computeBoundingSphere();
  return g;
}

/** coarse chunks (this LOD and up) are merged in SUPER x SUPER tiles */
const MERGE_LOD = 2;
const SUPER = 4;
const superKey = (cx: number, cz: number) => `${Math.floor(cx / SUPER)},${Math.floor(cz / SUPER)}`;

function Ground() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const group = useRef<THREE.Group>(null);
  const state = useRef({ meshes: new Map<string, { lod: number; mesh: THREE.Mesh }>(), queue: [] as BuildRequest[], active: null as { req: BuildRequest; build: ChunkBuild } | null, fx: NaN, fz: NaN, frames: 0,
    // far chunks merged into SUPER x SUPER tiles: one draw per tile instead of one per chunk
    merged: new Map<string, { mesh: THREE.Mesh; members: string[] }>(), mergeDirty: false, lastMerge: 0 });

  const { map, normalMap } = useMemo(() => groundDetailTextures(), []);
  // ground is mostly seen at a grazing angle: anisotropic filtering keeps it sharp toward the horizon. 8x on HIGH and
  // ULTRA, 4x below (each extra tap is paid on every ground pixel), never above what the GPU offers.
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const aniso = Math.max(1, Math.min(maxAniso, getPerfTier() === "HIGH" || getPerfTier() === "ULTRA" ? 8 : 4));
  useEffect(() => { for (const t of [map, normalMap]) { t.anisotropy = aniso; t.needsUpdate = true; } }, [map, normalMap, aniso]);
  // Poly Haven region surfaces; procedural grain stays if any texture fails to load.
  const [surfaces, setSurfaces] = useState<THREE.Texture[] | null>(null);
  const [normals, setNormals] = useState<THREE.Texture[] | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([loadGroundSurfaces(), loadGroundNormals()]).then(([t, n]) => {
      if (!live || !t) return;
      for (const tex of [...t, ...(n ?? [])]) if (tex.anisotropy !== aniso) { tex.anisotropy = aniso; tex.needsUpdate = true; }
      setSurfaces(t); setNormals(n);
    });
    return () => { live = false; };
  }, [aniso]);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02, map: surfaces ? null : map, normalMap, normalScale: new THREE.Vector2(0.35, 0.35) });
    if (surfaces) applySurfaceBlend(m, surfaces, normals);
    return m;
  }, [surfaces, normals, map, normalMap]);
  // existing chunk meshes pick up a replaced material (textures finishing) without rebuilding any geometry
  useEffect(() => {
    for (const { mesh } of state.current.meshes.values()) mesh.material = material;
    for (const { mesh } of state.current.merged.values()) mesh.material = material;
  }, [material]);
  // A terrain texture swap creates a new GPU material. Dispose the old one
  // after the chunk meshes have been rebound to avoid leaking shader programs.
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const st = state.current;
    return () => {
      for (const { mesh } of st.meshes.values()) { group.current?.remove(mesh); mesh.geometry.dispose(); }
      for (const { mesh } of st.merged.values()) { group.current?.remove(mesh); mesh.geometry.dispose(); }
      st.meshes.clear(); st.merged.clear(); st.queue = []; st.active = null; st.fx = NaN;
    };
  }, []);

  /** split a merged tile back into its chunks (a member is being replaced or dropped) */
  const unmergeChunk = (key: string) => {
    const st = state.current;
    const [cx, cz] = key.split(",").map(Number) as [number, number];
    const tk = superKey(cx, cz);
    const t = st.merged.get(tk);
    if (!t) return;
    group.current?.remove(t.mesh); t.mesh.geometry.dispose(); st.merged.delete(tk);
    for (const m of t.members) { const e = st.meshes.get(m); if (e) e.mesh.visible = true; }
    st.mergeDirty = true;
  };
  /** returns true when every coarse tile is settled (nothing skipped for a pending rebuild) */
  const mergeFar = (): boolean => {
    const st = state.current, g = group.current;
    if (!g) return false;
    const pending = new Set(st.queue.map((q) => superKey(q.cx, q.cz)));
    let settled = true;
    const tiles = new Map<string, string[]>();
    for (const [key, e] of st.meshes) {
      if (e.lod < MERGE_LOD) continue;
      const [cx, cz] = key.split(",").map(Number) as [number, number];
      const tk = superKey(cx, cz);
      const list = tiles.get(tk) ?? []; list.push(key); tiles.set(tk, list);
    }
    for (const [tk, members] of tiles) {
      if (pending.has(tk)) { settled = false; continue; }
      const had = st.merged.get(tk);
      if (had) {
        // unchanged tile: keep it; a chunk joined since: rebuild it with the newcomer
        if (had.members.length === members.length && members.every((m) => had.members.includes(m))) continue;
        g.remove(had.mesh); had.mesh.geometry.dispose(); st.merged.delete(tk);
        for (const m of had.members) { const e = st.meshes.get(m); if (e) e.mesh.visible = true; }
      }
      if (members.length < 2) continue;
      const geos = members.map((k) => st.meshes.get(k)!.mesh.geometry);
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      mesh.name = `ground:tile:${tk}`;
      g.add(mesh);
      for (const k of members) st.meshes.get(k)!.mesh.visible = false;
      st.merged.set(tk, { mesh, members });
    }
    return settled;
  };

  // a throw inside a frame callback would stall the whole render loop, so a failed chunk build is logged once and skipped instead
  const failed = useRef(false);
  useEffect(() => {
    const st = state.current;
    const w = window as unknown as { __terrainChunks?: () => unknown };
    w.__terrainChunks = () => {
      const lods = [0, 0, 0, 0]; let tris = 0;
      for (const { lod, mesh } of st.meshes.values()) { lods[lod]!++; tris += (mesh.geometry.index?.count ?? 0) / 3; }
      return { chunks: st.meshes.size, byLod: lods, triangles: tris, mergedTiles: st.merged.size, mergedChunks: [...st.merged.values()].reduce((n, t) => n + t.members.length, 0), queued: st.queue.length, building: !!st.active, failed: failed.current };
    };
    return () => { delete w.__terrainChunks; };
  }, []);

  useFrame(({ clock }) => {
    groundTime.value = clock.elapsedTime % 3600; // seabed caustics (region-materials.ts); wrapped so float precision holds
    if (failed.current) return;
    try {
      const g = group.current;
      if (!g) return;
      const st = state.current;
      const px = camera.position.x, pz = camera.position.z;
      // pocket-dimension interiors sit far outside the map: keep the streamed ground as it is so leaving one is instant
      if (Math.hypot(px, pz) > WORLD_RADIUS * 1.4) return;
      if (!Number.isFinite(st.fx) || Math.hypot(px - st.fx, pz - st.fz) >= REPLAN_DISTANCE) {
        st.fx = px; st.fz = pz;
        const fog = scene.fog instanceof THREE.Fog ? scene.fog.far : 600;
        const reach = Math.min(1100, Math.max(450, fog * 1.25 + CHUNK));
        const wanted = chunksNear(px, pz, reach, WORLD_RADIUS).map((c) => {
          const dist = distanceToChunk(c, px, pz);
          return { ...c, dist, lod: lodForDistance(dist, st.meshes.get(chunkKey(c.cx, c.cz))?.lod) };
        });
        const keep = new Set(wanted.map((w) => chunkKey(w.cx, w.cz)));
        for (const [key, e] of st.meshes) if (!keep.has(key)) { unmergeChunk(key); g.remove(e.mesh); e.mesh.geometry.dispose(); st.meshes.delete(key); }
        st.queue = planBuilds(wanted, (k) => st.meshes.get(k)?.lod, new Set(st.active ? [`${chunkKey(st.active.req.cx, st.active.req.cz)}@${st.active.req.lod}`] : []));
        if (st.active && !keep.has(chunkKey(st.active.req.cx, st.active.req.cz))) st.active = null;
      }
      if (!st.queue.length && !st.active) {
        // streaming has settled: fold the last builds into their merged tiles
        if (st.mergeDirty && performance.now() - st.lastMerge > 800) { st.lastMerge = performance.now(); st.mergeDirty = !mergeFar(); }
        return;
      }
      st.frames++;
      const budget = st.frames < WARMUP_FRAMES ? WARMUP_BUDGET_MS : BUILD_BUDGET_MS;
      const t0 = performance.now();
      // a chunk build is resumable (rows), so one big near tile never costs more than the frame budget
      while (performance.now() - t0 < budget) {
        if (!st.active) {
          const req = st.queue.shift();
          if (!req) break;
          st.active = { req, build: startChunkBuild(req, req.lod, GROUND_SAMPLERS) };
        }
        const remaining = budget - (performance.now() - t0);
        if (!st.active.build.step(Math.max(0.5, remaining))) break;
        const { req, build } = st.active;
        st.active = null;
        const key = chunkKey(req.cx, req.cz);
        const mesh = new THREE.Mesh(chunkGeometry(build.result()), material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        mesh.name = `ground:${key}@${req.lod}`;
        const old = st.meshes.get(key);
        if (old) { unmergeChunk(key); g.remove(old.mesh); old.mesh.geometry.dispose(); }
        g.add(mesh);
        st.meshes.set(key, { lod: req.lod, mesh });
        st.mergeDirty = true;
      }
      // once streaming settles, fold coarse chunks into merged tiles (rebuilt only when their members change)
      // (also while streaming continues: tiles with a chunk still waiting to rebuild are skipped and picked up next time)
      if (!st.active && st.mergeDirty && performance.now() - st.lastMerge > 800) { st.lastMerge = performance.now(); st.mergeDirty = !mergeFar(); }
    } catch (error) {
      failed.current = true;
      console.error("[terrain] chunk streaming failed; ground stops updating", error);
    }
  });

  return <group ref={group} name="ground-chunks" />;
}

/** soft radial contact-shadow texture, shared by every blob shadow */
let blobTex: THREE.Texture | null = null;
function blobTexture(): THREE.Texture {
  if (blobTex) return blobTex;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(0,0,0,0.55)"); r.addColorStop(0.55, "rgba(0,0,0,0.32)"); r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

/** On tiers where trees cast no real shadows (LOW/MEDIUM), a soft dark disc under each crown grounds the forest for
 * two triangles a tree instead of a shadow-map pass. */
function BlobShadows({ items }: { items: (Placement & { r0: number })[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), []);
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    const o = new THREE.Object3D();
    items.forEach((t, i) => { const r = t.r0 * t.s; o.position.set(t.x, heightAt(t.x, t.z) + 0.06, t.z); o.rotation.set(0, t.r, 0); o.scale.set(r, 1, r); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.count = items.length; m.instanceMatrix.needsUpdate = true;
  }, [items]);
  return <instancedMesh ref={ref} args={[geo, mat, Math.max(1, items.length)]} frustumCulled={false} renderOrder={1} />;
}

export function Terrain({ renderTier = "HIGH" }: { renderTier?: RenderTier } = {}) {
  // ~13 MB of decorative Poly Haven GLBs would compete with the ground textures and first frames, so they join the world a few seconds after it appears
  const [modelsReady, setModelsReady] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setModelsReady(true), 4000); return () => window.clearTimeout(t); }, []);
  // real Poly Haven trees replace the procedural ones species-by-species as each GLB finishes loading;
  // until then (or if a file is missing) the procedural trees keep the forest populated
  const [polyReady, setPolyReady] = useState({ fir: false, broadleaf: false, rock: false, log: false, shrub: false, fern: false });
  // the authored trees (public/models/foliage, ~1.5-2k tris each) are light enough for every tier, so even LOW gets real
  // trees; the heavier Poly Haven rocks, logs, shrubs and ferns stay procedural on LOW
  const realTrees = true;
  const realHeavy = renderTier !== "LOW";
  useEffect(() => {
    // announce everything the forest will want, so the loading readout shows a total from the first frame
    const wanted = realHeavy ? ([["fir", "Fir tree"], ["broadleaf", "Broadleaf tree"], ["fern", "Fern"], ["shrub", "Shrub"], ["rock", "Mossy rock"], ["log", "Fallen log"]] as const) : ([["fir", "Fir tree"], ["broadleaf", "Broadleaf tree"]] as const);
    for (const [id, label] of wanted) reportAsset(`foliage:${id}`, label, "loading");
  }, [realHeavy]);
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
  // The map is WORLD_SCALE times wider (16x the area at 4x). Forest tree counts follow the area at half density (the real GLB
  // forest is distance-culled and tri-budgeted, so only CPU placement grows); the plain instanced props of the other regions grow with
  // sqrt(scale) because they have no distance culling. Every tier now draws real (culled, budgeted) trees.
  const forestK = Math.max(1, (WORLD_SCALE * WORLD_SCALE) / 2);
  const otherK = Math.max(1, Math.sqrt(WORLD_SCALE));
  const dF = (n: number) => Math.max(1, Math.round(n * density * forestK));
  const dO = (n: number) => Math.max(1, Math.round(n * density * otherK));
  const bigWorld = WORLD_SCALE > 1;
  const treeMax = 26 * HEIGHT_K;
  const firHeight = bigWorld ? 20 : 8;
  const broadHeight = bigWorld ? 14 : 9;
  const craterScale = Math.max(1, WORLD_SCALE);

  const baseTrees = useMemo(() => scatter(forest, dF(120), 11, { min: 1.5, max: treeMax, maxSlope: 0.55, keepSpawnLaneClear: true }), [forest, density]);
  // clustered groves on top of the uniform scatter: thick stands with open gaps between, instead of an evenly spread park
  const groveTrees = useMemo<Prop[]>(() => {
    const centres = scatter(forest, dF(GROVE.centres), 17, { min: 1.5, max: treeMax, maxSlope: 0.55, keepSpawnLaneClear: true });
    const accept = (x: number, z: number) => {
      if (Math.hypot(x - forest.x, z - forest.z) > forest.radius * 0.95) return false;
      const y = heightAt(x, z);
      if (y < 1.5 || y > treeMax || slopeAt(x, z) > 0.55) return false;
      if (Math.hypot(x - forest.x, z - (forest.z + 12)) < 16 || isReserved(x, z, 1.5) || distanceToRoad(x, z) < LANE_HALF_WIDTH) return false;
      const rv = riverAt(x, z);
      return !(rv && rv.dist < rv.w + 2);
    };
    return growGroves(centres, baseTrees, mulberry32(23), accept, Math.round(d(GROVE.perGrove) * (bigWorld ? 1.5 : 1))).map((t) => ({ ...t, y: heightAt(t.x, t.z) }));
  }, [forest, baseTrees, density]);
  const trees = useMemo(() => [...baseTrees, ...groveTrees], [baseTrees, groveTrees]);
  // undergrowth clusters around each tree: saplings and low brush, kept off roads, water and steep ground
  // (drawn without distance culling, so on the big forest only the trees nearest the route get companions)
  const understoryParents = useMemo(() => (trees.length <= UNDERSTORY_PARENT_CAP ? trees : trees.map((t) => ({ t, d: trailInfo(t.x, t.z).dist })).sort((a, b) => a.d - b.d).slice(0, UNDERSTORY_PARENT_CAP).map((e) => e.t)), [trees]);
  const undergrowth = useMemo(() => clusterAround(understoryParents, d(3), mulberry32(61), (x, z) => {
    const y = heightAt(x, z);
    return y > 1.8 && y < treeMax - 2 && slopeAt(x, z) < 0.5 && distanceToRoad(x, z) > LANE_HALF_WIDTH + 1 && Math.hypot(x - forest.x, z - (forest.z + 12)) > 12 && !isReserved(x, z, 0.5);
  }, { minScale: 0.45, maxScale: 1 }), [understoryParents, density]);
  const flowers = useMemo(() => scatter(forest, dF(70), 20, { min: 1.5, max: treeMax - 6, maxSlope: 0.4 }), [forest, density]);
  const swampTrees = useMemo(() => scatter(swamp, dO(70), 12, { min: -2.5, max: 6 }), [swamp, density]);
  const boulders = useMemo(
    () => scatter(frost, dO(40), 13, { min: 18, maxSlope: 0.85 }),
    [frost, density],
  );
  const rocks = useMemo(
    () => [
      ...scatter(waste, dO(46), 14, { maxSlope: 0.7 }),
      ...scatter(solara, dO(40), 15, { maxSlope: 0.7 }),
    ],
    [waste, solara, density],
  );
  const cacti = useMemo(() => scatter(solara, dO(55), 16, { min: 2, maxSlope: 0.45 }), [solara, density]);
  const wrecks = useMemo(() => scatter(waste, dO(30), 18, { maxSlope: 0.4 }), [waste, density]);
  const emberRocks = useMemo(() => scatter(ember, dO(55), 21, { inner: 9, maxSlope: 0.95 }), [ember, density]);
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
  const treeIndex = useMemo(() => new Map(trees.map((t, i) => [t, i] as const)), [trees]);
  const liveTrees = alive(trees);
  // even-indexed trees are firs, odd are broadleaf (parity of the original index, so felling one never reshuffles the rest);
  // a species is hidden from the procedural pass once its GLB is on screen
  // The procedural stand-ins are drawn without distance culling, so they are capped to the trees nearest the spawn (the first seconds, or if a GLB fails to load).
  const procTrees = liveTrees.filter((t) => !((treeIndex.get(t) ?? 0) % 2 === 0 ? polyReady.fir : polyReady.broadleaf))
    .map((t) => ({ t, d: Math.hypot(t.x - FOREST_SPAWN.x, t.z - FOREST_SPAWN.z) })).sort((a, b) => a.d - b.d).slice(0, PROC_TREE_CAP).map((e) => e.t);
  const asPlacement = (t: Prop): Placement => ({ x: t.x, y: t.y, z: t.z, s: t.s, r: t.r });
  const firs: Placement[] = liveTrees.filter((t) => (treeIndex.get(t) ?? 0) % 2 === 0).map(asPlacement);
  const broadleafs: Placement[] = liveTrees.filter((t) => (treeIndex.get(t) ?? 0) % 2 === 1).map(asPlacement);
  const readyFir = useMemo(() => () => setPolyReady((p) => (p.fir ? p : { ...p, fir: true })), []);
  const readyBroad = useMemo(() => () => setPolyReady((p) => (p.broadleaf ? p : { ...p, broadleaf: true })), []);
  const readyRock = useMemo(() => () => setPolyReady((p) => (p.rock ? p : { ...p, rock: true })), []);
  const readyLog = useMemo(() => () => setPolyReady((p) => (p.log ? p : { ...p, log: true })), []);
  const readyShrub = useMemo(() => () => setPolyReady((p) => (p.shrub ? p : { ...p, shrub: true })), []);
  const readyFern = useMemo(() => () => setPolyReady((p) => (p.fern ? p : { ...p, fern: true })), []);
  // Real Poly Haven models take over these props as each GLB finishes loading (near ones in detail, far ones as cheap silhouettes,
  // see PolyFoliage); the procedural shapes below only draw while a model is loading or if it fails, and on the LOW tier.
  const realProps = realHeavy && modelsReady;
  const liveSwampAll = alive(swampTrees);
  const liveBouldersAll = alive(boulders);
  const liveSwamp = realProps && polyReady.log ? [] : liveSwampAll;
  const liveBoulders = realProps && polyReady.rock ? [] : liveBouldersAll;
  const swampTrunks: Placement[] = liveSwampAll.map((t) => ({ x: t.x, y: t.y, z: t.z, s: t.s, r: t.r, tilt: (t.r - 3) * 0.03 }));
  const boulderItems: Placement[] = liveBouldersAll.map(asPlacement);
  const saplingItems: Placement[] = undergrowth.filter((_, i) => i % 3 !== 0).map((u) => ({ x: u.x, y: heightAt(u.x, u.z), z: u.z, s: u.s, r: u.r }));
  const brushItems: Placement[] = undergrowth.filter((_, i) => i % 3 === 0).map((u) => ({ x: u.x, y: heightAt(u.x, u.z), z: u.z, s: u.s, r: u.r }));
  const procUndergrowth = undergrowth.map((u, i) => ({ u, i })).filter(({ i }) => !(realProps && (i % 3 !== 0 ? polyReady.shrub : polyReady.fern)));
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
  const reedGeo = useMemo(() => new THREE.CylinderGeometry(0.03, 0.07, 2.2, 4, 1, true).translate(0, 1.1, 0), []);
  const swayTrunk = useMemo(() => windSway(trunkGeo, 0.18), [trunkGeo]);
  const swayDeadTrunk = useMemo(() => windSway(deadTrunkGeo, 0.1), [deadTrunkGeo]);
  const swayCanopyLow = useMemo(() => windSway(canopyLow, 0.55), [canopyLow]);
  const swayCanopyHigh = useMemo(() => windSway(canopyHigh, 0.8), [canopyHigh]);
  const swayReed = useMemo(() => windSway(reedGeo, 0.5), [reedGeo]);
  const reeds = useMemo(() => scatter(swamp, dO(240), 33, { min: -2.2, max: 3.5, maxSlope: 0.5 }), [swamp, density]);
  const emberRockGeo = useMemo(() => organicRock(1.6, 44, 1, 0.5), []);
  const flowerGeo = useMemo(() => flowerClump(5), []);
  const cactusGeo = useMemo(() => saguaro(3), []);
  const wreckCars = useMemo<FleetInstance[]>(() => liveWrecks.map((w, i) => ({ model: WRECK_CARS[i % WRECK_CARS.length]!, x: w.x, y: w.y - 0.15, z: w.z, yaw: w.r, paint: WRECK_RUST[i % WRECK_RUST.length]! })), [liveWrecks.map((w) => `${w.x | 0},${w.z | 0}`).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group>
      <Ground />
      {renderTier !== "LOW" && modelsReady && <RegionModels />}
      {realTrees && modelsReady && (
        <>
          {!fineShadows && <BlobShadows items={[...firs.map((t) => ({ ...t, r0: firHeight * 0.2 })), ...broadleafs.map((t) => ({ ...t, r0: broadHeight * 0.36 }))]} />}
          <PolyFoliage kind="fir" items={firs} height={firHeight} sway={0.35} shadows={fineShadows} variants onReady={readyFir} />
          <PolyFoliage kind="broadleaf" items={broadleafs} height={broadHeight} sway={0.4} shadows={fineShadows} variants onReady={readyBroad} />
          {realHeavy && <>
            <PolyFoliage kind="rock" items={boulderItems} height={3.4} shadows={fineShadows} variants onReady={readyRock} />
            <PolyFoliage kind="log" items={swampTrunks} height={8} shadows={fineShadows} onReady={readyLog} />
            <PolyFoliage kind="shrub" items={saplingItems} height={1.5} sway={0.14} shadows={false} variants onReady={readyShrub} />
            <PolyFoliage kind="fern" items={brushItems} height={0.8} sway={0.1} shadows={false} variants onReady={readyFern} />
          </>}
        </>
      )}

      {/* forest: trunk + two staggered canopy layers, hue-jittered per instance so the
          treeline reads as a forest instead of one stamped-out cone repeated 120 times */}
      <Instances limit={Math.max(1, liveTrees.length)} castShadow receiveShadow>
        <primitive object={trunkGeo} attach="geometry" />
        <meshStandardMaterial onBeforeCompile={swayTrunk} color="#4a3524" roughness={0.95} map={barkDetail.map} normalMap={barkDetail.normalMap} normalScale={new THREE.Vector2(0.6, 0.6)} />
        {procTrees.map((t, i) => (
          <Instance key={i} position={[t.x, t.y + 2 * t.s, t.z]} scale={[1, t.s, 1]} color={jitter("#4a3524", i, 0.02, 0.1)} />
        ))}
      </Instances>
      <Instances limit={liveTrees.length} castShadow={fineShadows} receiveShadow geometry={canopyLow}>
        <meshStandardMaterial onBeforeCompile={swayCanopyLow} color="#2c7a41" roughness={0.9} map={leafDetail.map} normalMap={leafDetail.normalMap} normalScale={new THREE.Vector2(0.4, 0.4)} />
        {procTrees.map((t, i) => (
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
        {procTrees.map((t, i) => (
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
      <Instances limit={Math.max(1, procUndergrowth.length)} castShadow={false} receiveShadow geometry={canopyHigh}>
        <meshStandardMaterial onBeforeCompile={swayCanopyHigh} color="#3f9a4f" roughness={0.9} map={leafDetail.map} normalMap={leafDetail.normalMap} normalScale={new THREE.Vector2(0.4, 0.4)} />
        {procUndergrowth.map(({ u, i }) => {
          const sapling = i % 3 !== 0;
          const y = heightAt(u.x, u.z);
          return <Instance key={i} position={[u.x, y + (sapling ? 0.9 : 0.35) * u.s, u.z]} scale={sapling ? [0.3 * u.s, 0.42 * u.s, 0.3 * u.s] : [0.38 * u.s, 0.2 * u.s, 0.38 * u.s]} rotation-y={u.r} color={jitter(sapling ? "#3f9a4f" : "#2a6b3a", i + 7, 0.04, 0.14)} />;
        })}
      </Instances>
      {/* wildflower clumps: stems + star heads (organic-geometry.ts flowerClump), muted wild colours */}
      <Instances limit={Math.max(1, flowers.length)} geometry={flowerGeo}>
        <meshStandardMaterial vertexColors roughness={0.85} side={THREE.DoubleSide} onBeforeCompile={petalTint} />
        {flowers.map((f, i) => {
          const palette = ["#c9587e", "#d8b84a", "#e8e4da", "#9a72b8", "#c8743e"];
          return <Instance key={i} position={[f.x, f.y - 0.02, f.z]} scale={1.4 + f.s * 0.9} rotation-y={i * 2.4} color={palette[i % palette.length] ?? "#e8e4da"} />;
        })}
      </Instances>

      {/* frostspire boulders on the high slopes — mixed silhouettes + per-instance grey jitter */}
      <Instances limit={Math.max(1, liveBoulders.length)} castShadow receiveShadow geometry={boulderA}>
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
      <Instances limit={Math.max(1, liveBoulders.length)} castShadow receiveShadow geometry={boulderB}>
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
          <circleGeometry args={[7 * craterScale, 32]} />
          <meshStandardMaterial color="#ff5a12" emissive="#ff5a12" emissiveIntensity={2.6} toneMapped={false} />
        </mesh>
        <DistrictLight range={170 * Math.max(1, craterScale / 2)} position={[0, craterY + 6, 0]} color="#ff6a1f" intensity={220} distance={120 * Math.max(1, craterScale / 2)} decay={2} />
      </group>
      <Instances limit={liveEmber.length} castShadow receiveShadow geometry={emberRockGeo}>
        <meshStandardMaterial color="#332a28" emissive="#ff3d00" emissiveIntensity={0.07} roughness={0.95} map={rockDetail.map} normalMap={rockDetail.normalMap} normalScale={new THREE.Vector2(0.4, 0.4)} />
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
      {/* wasteland wrecks: rusted authored cars (fleet models), not boxes */}
      <WorldPiece name="wasteland wrecks"><InstancedFleet items={wreckCars} shadows={false} /></WorldPiece>

      {/* desert cacti */}
      <Instances limit={Math.max(1, liveCacti.length)} castShadow receiveShadow geometry={cactusGeo}>
        <meshStandardMaterial color="#4f7a45" roughness={0.9} map={leafDetail.map} normalMap={leafDetail.normalMap} normalScale={new THREE.Vector2(0.5, 0.5)} />
        {liveCacti.map((c, i) => (
          <Instance key={i} position={[c.x, c.y - 0.15, c.z]} scale={c.s * 1.05} rotation-y={i * 1.7} color={jitter("#5f7f4c", i, 0.02, 0.1)} />
        ))}
      </Instances>

      {/* swamp dead trees */}
      <Instances limit={Math.max(1, liveSwamp.length)} castShadow receiveShadow>
        <primitive object={deadTrunkGeo} attach="geometry" />
        <meshStandardMaterial onBeforeCompile={swayDeadTrunk} color="#1d2b22" roughness={1} map={barkDetail.map} normalMap={barkDetail.normalMap} normalScale={new THREE.Vector2(0.6, 0.6)} />
        {liveSwamp.map((t, i) => (
          <Instance key={i} position={[t.x, t.y + 4 * t.s, t.z]} scale={[1, t.s, 1]} rotation-z={(t.r - 3) * 0.03} />
        ))}
      </Instances>

      {/* forest grass now lives in VerdantForest (GrassCards); swamp reeds stay here: thin stalks that bend hardest at the tip */}
      <Instances limit={Math.max(1, reeds.length)} receiveShadow geometry={reedGeo}>
        <meshStandardMaterial onBeforeCompile={swayReed} color="#5e7a4a" roughness={1} side={THREE.DoubleSide} />
        {reeds.map((g, i) => <Instance key={i} position={[g.x, Math.max(g.y, WATER_LEVEL + 0.1), g.z]} scale={[1, 0.6 + g.s * 0.8, 1]} rotation-y={g.r} color={jitter("#5e7a4a", i + 120, 0.04, 0.14)} />)}
      </Instances>
    </group>
  );
}
