import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { heightAt, slopeAt, WATER_LEVEL } from "@/game/terrain";
import { mulberry32 } from "@/game/useKeyboard";
import { addObstacle, allObstacles, type Obstacle } from "@/game/obstacles";
import { clusterAround } from "@/game/foliage";
import { organicRock } from "@/game/organic-geometry";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  COVER, CRASH_SITE, DEBRIS, ENCOUNTER, FURROW, patchNoise, TRAIL_HALF_WIDTH, aroundScatter, forestScatter, furrowFrame, trailEdgeScatter, trailInfo, vegetationOk,
  type Floor, type Investigation,
} from "@/game/verdant";
import { grassCardTexture, hullDamageTexture, leafLitterTexture, mossTexture, scorchTexture, smokeTexture, soilTexture } from "./forest-textures";
import { REGIONS } from "@/game/world";
import { windSway, windUniforms } from "@/game/wind-sway";
import { DistrictLight } from "./DistrictLight";
import { PolyFoliage, type Placement } from "./PolyFoliage";
import { CrashedTransport, Crates, ScoutWreck, TrailWear } from "./CrashHull";
import { HULL_SOLIDS, SCOUT } from "@/game/crash-layout";

/* Verdant Forest upgrade (Phase 4.1): the authored layer on top of Terrain's scatter.
 *  - real Poly Haven GLBs (ferns, shrubs, mossy rocks, fallen logs) lining the trail and ringing the ambush clearing
 *  - collision for every solid piece through the existing obstacle grid (obstacles.ts)
 *  - the Fracture crash site (debris + blue energy + a scan ring that fills as you investigate)
 *  - drifting forest motes
 * Layout comes from game/verdant.ts. Each GLB species is verified/isolated by PolyFoliage, so a missing file
 * is reported through forest-assets.ts and the world keeps rendering. */

const forest = REGIONS.find((r) => r.id === "veridan")!;
const LOG_LENGTH = 5;

type Solid = { x: number; z: number; r: number; kind: "rock" | "tree" | "wreck"; hp: number; solidity: number };

const dry = (x: number, z: number) => heightAt(x, z) > WATER_LEVEL + 2 && slopeAt(x, z) < 0.6;
/** where low plants may root: dry, gentle (no floating on slopes), off the trail/clearings/crash pad/furrow */
const plantable = (x: number, z: number) => heightAt(x, z) > WATER_LEVEL + 2 && slopeAt(x, z) < 0.45 && vegetationOk(x, z);
const LEAF_TINTS = ["#ffffff", "#e8d2a8", "#c9b080", "#b6a070"];
const MOSS_TINTS = ["#ffffff", "#d8f0b0", "#b8d890"];
const FURROW_YAW = Math.atan2(FURROW.dz, -FURROW.dx); // log orientation (see lying()) that lies along the skid
const place = (f: Floor, lift = 0): Placement => ({ x: f.x, y: heightAt(f.x, f.z) + lift, z: f.z, s: f.s, r: f.r });

/** a log lying on its side, centred on (x, z) along `yaw` */
function lying(x: number, z: number, yaw: number, s: number): Placement {
  const half = (LOG_LENGTH * s) / 2;
  const bx = x + Math.cos(yaw) * half, bz = z - Math.sin(yaw) * half;
  return { x: bx, y: heightAt(x, z) + 0.45 * s, z: bz, s, r: yaw, tilt: Math.PI / 2 };
}

export function VerdantForest({ density, models, investigation }: { density: number; models: boolean; investigation: MutableRefObject<Investigation> }) {
  // like Terrain's other decorative GLBs: join the world a moment after first frame
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setReady(true), 4500); return () => window.clearTimeout(t); }, []);
  const d = (n: number) => Math.max(1, Math.round(n * density));

  const layout = useMemo(() => {
    const rnd = (n: number) => mulberry32(n);
    // Layered understory, built as natural patches rather than uniform dots: patch centres first, then children
    // clustered around them with varied scale and yaw (density falls off from each patch centre).
    const fernParents = [...forestScatter(d(24), rnd(201), plantable, 1), ...trailEdgeScatter(d(22), rnd(202), TRAIL_HALF_WIDTH + 1.5, TRAIL_HALF_WIDTH + 8, plantable)];
    const ferns = clusterAround(fernParents, 6, rnd(203), plantable, { minRadius: 0.4, maxRadius: 3.2, minScale: 0.55, maxScale: 1.3 }).map((f) => place(f, -0.05));
    const coverParents = forestScatter(d(10), rnd(211), plantable, 1.2);
    const lowShrubs = clusterAround(coverParents, 3, rnd(212), plantable, { minRadius: 0.8, maxRadius: 4, minScale: 0.6, maxScale: 1.1 }).map((f) => place(f, -0.05));
    const tallShrubs = [...trailEdgeScatter(d(28), rnd(104), TRAIL_HALF_WIDTH + 2.2, TRAIL_HALF_WIDTH + 10, plantable), ...forestScatter(d(22), rnd(105), plantable, 1.5)].map((f) => place(f, -0.05));
    const saplings = forestScatter(d(36), rnd(214), plantable, 1.5).map((f) => place(f, -0.1));
    // the wreck sits in a ring of growth that stops short of the hull, the approach trail and the skid
    const around = aroundScatter(d(26), rnd(301), 8.5, 14, plantable);
    const aroundFerns = around.slice(0, Math.ceil(around.length * 0.7)).map((f) => place(f, -0.05));
    const aroundShrubs = aroundScatter(d(9), rnd(302), 9.5, 15, plantable).map((f) => place(f, -0.05));

    // Grass: patchy meadows (patchNoise gates every blade, so bare duff shows between them), a short fringe that
    // feathers the trail edge into the forest floor, and a few tall clumps. Never inside the reserved ground.
    const grassOk = (x: number, z: number) => plantable(x, z) && patchNoise(x, z) > 0.4;
    const near = (x: number, z: number) => Math.hypot(x - ENCOUNTER.x, z - ENCOUNTER.z) < ENCOUNTER.radius + 12; // keep sightlines into the ambush clearing low
    const mk = (f: Floor, lo: number, hi: number, k: number): GrassItem => ({ ...f, w: 0.8 + f.s * 0.5, h: Math.min(near(f.x, f.z) ? 0.45 : 9, (lo + ((f.r * 7.31) % 1) * (hi - lo)) * (0.85 + k * 0.3)) });
    const meadow = clusterAround(forestScatter(d(34), rnd(701), grassOk, 0.8), 9, rnd(702), grassOk, { minRadius: 0.3, maxRadius: 3.6, minScale: 0.7, maxScale: 1.3 }).map((f) => mk(f, 0.4, 0.85, f.s));
    const fringe = trailEdgeScatter(d(140), rnd(703), TRAIL_HALF_WIDTH + 0.15, TRAIL_HALF_WIDTH + 2.4, grassOk).map((f) => mk(f, 0.18, 0.42, f.s));
    const tuft = clusterAround(forestScatter(d(10), rnd(704), grassOk, 2), 6, rnd(705), grassOk, { minRadius: 0.3, maxRadius: 2.4, minScale: 0.8, maxScale: 1.5 }).map((f) => mk(f, 0.8, 1.25, f.s));
    const grass = [...meadow, ...fringe, ...tuft];
    // small ground plants: young ferns, low to the floor, scattered through the grassy patches
    const seedlings = clusterAround(forestScatter(d(16), rnd(711), grassOk, 1.2), 3, rnd(712), plantable, { minRadius: 0.5, maxRadius: 2.6, minScale: 0.5, maxScale: 1 }).map((f) => place(f, -0.04));
    const rockSpots = trailEdgeScatter(d(9), rnd(107), TRAIL_HALF_WIDTH + 1.5, TRAIL_HALF_WIDTH + 8, plantable);
    const coverRocks = COVER.filter((c) => c.kind === "rock").map((c) => ({ x: c.x, z: c.z, s: c.r / 1.3, r: c.yaw }));
    const rocks = [...rockSpots, ...coverRocks].map((f) => place(f));
    const looseLogs = forestScatter(d(3), rnd(109), dry, 2);
    // two trees the craft knocked down on its way in, lying along the skid on either side
    const felled = [[6.5, 4.3, 0.1], [11, -4.6, -0.2]].map(([along, across, jitter]) => ({
      x: CRASH_SITE.x + FURROW.dx * along! - FURROW.dz * across!, z: CRASH_SITE.z + FURROW.dz * along! + FURROW.dx * across!, yaw: FURROW_YAW + jitter!, s: 1,
    }));
    const logs = [
      ...looseLogs.map((f) => ({ x: f.x, z: f.z, yaw: f.r, s: 0.85 + (f.s - 0.7) * 0.4 })),
      ...COVER.filter((c) => c.kind === "log").map((c) => ({ x: c.x, z: c.z, yaw: c.yaw, s: 1 })),
      ...felled,
    ];
    const solids: Solid[] = [
      ...rocks.map((p): Solid => ({ x: p.x, z: p.z, r: 1.3 * p.s, kind: "rock", hp: 200, solidity: 1.4 })),
      ...logs.flatMap((l): Solid[] => [-1, 0, 1].map((k) => ({
        x: l.x + Math.cos(l.yaw) * k * (LOG_LENGTH * l.s) / 3, z: l.z - Math.sin(l.yaw) * k * (LOG_LENGTH * l.s) / 3,
        r: 0.8 * l.s, kind: "rock", hp: 160, solidity: 1.2,
      }))),
      // the crashed transport, as circles down its length (see crash-layout.ts), and the scout wreck beside the road
      ...HULL_SOLIDS.map((h): Solid => ({ x: h.x, z: h.z, r: h.r, kind: "wreck", hp: 400, solidity: 1.3 })),
      ...(SCOUT ? [-1.4, 1.4].map((k): Solid => ({ x: SCOUT!.x + Math.cos(SCOUT!.yaw) * k, z: SCOUT!.z - Math.sin(SCOUT!.yaw) * k, r: 1.2, kind: "wreck", hp: 250, solidity: 1.2 })) : []),
    ];
    return {
      grass, seedlings, ferns: [...ferns, ...aroundFerns], lowShrubs, tallShrubs: [...tallShrubs, ...aroundShrubs], saplings, rocks,
      logs: logs.map((l) => lying(l.x, l.z, l.yaw, l.s)), solids, logSpots: logs,
    };
  }, [density]);

  // Tree bases (registered by Terrain) anchor roots, leaf litter and moss. Read once the world has settled.
  const trees = useMemo(() => {
    if (!ready) return [] as { x: number; z: number; r: number }[];
    return allObstacles().filter((o) => o.kind === "tree" && !o.broken && Math.hypot(o.x - forest.x, o.z - forest.z) < forest.radius).map((o) => ({ x: o.x, z: o.z, r: o.r }));
  }, [ready]);
  const ground = useMemo(() => {
    if (!trees.length) return null;
    const rnd = mulberry32(401);
    const parents = trees.map((t) => ({ x: t.x, z: t.z, s: 1 }));
    const flat = (x: number, z: number) => heightAt(x, z) > WATER_LEVEL + 2 && slopeAt(x, z) < 0.35 && vegetationOk(x, z);
    const leaves = [
      ...clusterAround(parents, d(2), rnd, flat, { minRadius: 0.6, maxRadius: 4.2, minScale: 1.3, maxScale: 2.8 }),
      ...trailEdgeScatter(d(34), mulberry32(402), TRAIL_HALF_WIDTH + 0.1, TRAIL_HALF_WIDTH + 3.5, flat).map((f) => ({ ...f, s: 1.1 + (f.s - 0.7) * 1.2 })),
    ];
    const moss = [
      ...layout.rocks.map((p) => ({ x: p.x, z: p.z, s: 2.2 + p.s * 0.7, r: p.r })),
      ...layout.logSpots.map((l) => ({ x: l.x, z: l.z, s: 2.4, r: l.yaw })),
      ...trees.filter((_, i) => i % 3 === 0).map((t, i) => ({ x: t.x, z: t.z, s: 2.2 + (i % 3) * 0.5, r: i * 1.9 })),
    ].filter((m) => vegetationOk(m.x, m.z));
    // exposed roots: on the trees nearest the trail and the ambush clearing, where the player actually looks
    const rooted = [...trees].map((t) => ({ t, k: trailInfo(t.x, t.z).dist })).filter((e) => e.k < 18).sort((a, b) => a.k - b.k).slice(0, d(16)).map((e) => e.t);
    return { leaves, moss, rooted };
  }, [trees, layout, density]);

  // Collision: register once per layout. Terrain resets the grid when its own scatter changes, so a re-run
  // first retires what this component added before (a re-registration never doubles up).
  const added = useRef<Obstacle[]>([]);
  useEffect(() => {
    for (const o of added.current) o.broken = true;
    added.current = layout.solids.map((s) => addObstacle(s.kind, s.x, s.z, s.r, s.hp, s.solidity));
  }, [layout]);

  return (
    <group>
      {ready && models && (
        <>
          <PolyFoliage kind="fern" items={layout.ferns} height={0.9} sway={0.12} shadows={false} variants />
          <PolyFoliage kind="fern" items={layout.seedlings} height={0.42} sway={0.07} shadows={false} variants />
          <PolyFoliage kind="shrub" items={layout.lowShrubs} height={0.75} sway={0.1} shadows={false} variants />
          <PolyFoliage kind="shrub" items={layout.tallShrubs} height={1.5} sway={0.16} shadows={false} variants />
          <PolyFoliage kind="fir" items={layout.saplings} height={2.4} sway={0.28} shadows={false} />
          <PolyFoliage kind="rock" items={layout.rocks} height={1.7} shadows variants />
          <PolyFoliage kind="log" items={layout.logs} height={LOG_LENGTH} shadows />
        </>
      )}
      <GrassCards items={layout.grass} />
      {ground && (
        <>
          <Decals items={ground.leaves} texture={leafLitterTexture()} lift={0.05} opacity={0.95} tints={LEAF_TINTS} />
          <Decals items={ground.moss} texture={mossTexture()} lift={0.07} opacity={0.9} tints={MOSS_TINTS} />
          <Roots trees={ground.rooted} />
        </>
      )}
      <CrashGround />
      <CrashedTransport />
      <ScoutWreck />
      <Crates />
      <TrailWear />
      <CrashSite investigation={investigation} />
      <ForestMotes count={d(90)} />
    </group>
  );
}

/* ---------------- grass ---------------- */

type GrassItem = Floor & { w: number; h: number };
const GRASS_TINTS = ["#ffffff", "#d9e8a6", "#bcd57e", "#e6ecb8", "#a9c870"];

/** Two crossed alpha-tested cards per clump (pivot at the base, normals straight up so lighting matches the ground),
 * one shared material and one draw call for the whole forest. Blades come from a generated clump texture because the
 * project ships no grass model; wind phase comes from each clump's position, so neighbours never sway together. */
function GrassCards({ items }: { items: GrassItem[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tex = useMemo(() => grassCardTexture(), []);
  const geometry = useMemo(() => {
    const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const b = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY(Math.PI / 2);
    const g = mergeGeometries([a, b])!;
    const n = g.getAttribute("normal") as THREE.BufferAttribute;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    return g;
  }, []);
  const sway = useMemo(() => windSway(geometry, 0.2), [geometry]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D(), col = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(it.x, heightAt(it.x, it.z) - 0.03, it.z);
      o.rotation.set(0, it.r, 0);
      o.scale.set(it.w, it.h, it.w);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.set(GRASS_TINTS[(i * 5) % GRASS_TINTS.length]!));
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  if (!tex || !items.length) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} frustumCulled={false} receiveShadow>
      <meshStandardMaterial map={tex} alphaTest={0.4} side={THREE.DoubleSide} roughness={1} metalness={0} onBeforeCompile={sway} />
    </instancedMesh>
  );
}

/* ---------------- ground layer: decals, roots, scorch ---------------- */

function groundNormal(x: number, z: number, out: THREE.Vector3) {
  const e = 0.6;
  return out.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
}

const UP = new THREE.Vector3(0, 0, 1);
/** textured quads laid on the ground, tilted to the slope under each one; one draw call per layer */
function Decals({ items, texture, lift, opacity, tints }: { items: Floor[]; texture: THREE.Texture | null; lift: number; opacity: number; tints: string[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const n = new THREE.Vector3(), q = new THREE.Quaternion(), spin = new THREE.Quaternion(), mat = new THREE.Matrix4(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    items.forEach((it, i) => {
      groundNormal(it.x, it.z, n);
      q.setFromUnitVectors(UP, n);
      q.multiply(spin.setFromAxisAngle(UP, it.r)); // spin about the quad's own normal
      pos.set(it.x, heightAt(it.x, it.z) + lift + (i % 5) * 0.004, it.z); // tiny per-instance offsets stop overlapping quads z-fighting
      sc.set(it.s, it.s, 1);
      m.setMatrixAt(i, mat.compose(pos, q, sc));
      m.setColorAt(i, col.set(tints[(i * 7) % tints.length]!));
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, lift, tints]);
  if (!texture || !items.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} frustumCulled={false} receiveShadow renderOrder={1}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial map={texture} transparent opacity={opacity} depthWrite={false} roughness={1} metalness={0} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </instancedMesh>
  );
}

/** Exposed roots: curved tubes snaking out of each trunk base and diving into the soil, merged into one mesh.
 * Procedural stand-ins — no root model exists in the project. */
function Roots({ trees }: { trees: { x: number; z: number; r: number }[] }) {
  const geometry = useMemo(() => {
    if (!trees.length) return null;
    const rnd = mulberry32(501);
    const tubes: THREE.BufferGeometry[] = [];
    trees.forEach((t) => {
      const n = 4 + Math.floor(rnd() * 2), start = rnd() * 6.28;
      for (let k = 0; k < n; k++) {
        const a = start + (k / n) * 6.28 + (rnd() - 0.5) * 0.6, len = 1.5 + rnd() * 1.5, r0 = t.r * 0.3;
        const pt = (u: number, up: number) => { const d = r0 + len * u; const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d; return new THREE.Vector3(x, heightAt(x, z) + up, z); };
        tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([pt(0, 0.7), pt(0.25, 0.34), pt(0.6, 0.1), pt(1, -0.14)]), 8, 0.1 + rnd() * 0.07, 5, false));
      }
    });
    return mergeGeometries(tubes);
  }, [trees]);
  if (!geometry) return null;
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color="#3f2f22" roughness={0.97} metalness={0} /></mesh>;
}

/** a flat patch of the terrain re-meshed at ground height, so a big decal hugs the crater and slopes instead of floating */
function conformingPatch(cx: number, cz: number, len: number, wid: number, yaw: number, segU: number, segV: number, lift: number) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (let iv = 0; iv <= segV; iv++) for (let iu = 0; iu <= segU; iu++) {
    const u = (iu / segU - 0.5) * len, v = (iv / segV - 0.5) * wid;
    const x = cx + u * c - v * s, z = cz + u * s + v * c;
    pos.push(x, heightAt(x, z) + lift, z); uv.push(iu / segU, iv / segV);
  }
  for (let iv = 0; iv < segV; iv++) for (let iu = 0; iu < segU; iu++) {
    const a = iv * (segU + 1) + iu, b = a + 1, d = a + segU + 1, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Scorched earth around the hull, the churned skid it cut, and the soil berms it pushed aside. */
function CrashGround() {
  const parts = useMemo(() => {
    const scorch = conformingPatch(CRASH_SITE.x, CRASH_SITE.z, 22, 22, 0.4, 16, 16, 0.08);
    const mid = FURROW.length / 2 - 1;
    const furrow = conformingPatch(CRASH_SITE.x + FURROW.dx * mid, CRASH_SITE.z + FURROW.dz * mid, FURROW.length + 2, FURROW.width * 1.7, Math.atan2(FURROW.dz, FURROW.dx), 20, 6, 0.1);
    // berms: lumpy soil mounds heaped along both edges of the skid
    const rnd = mulberry32(601);
    const berms: { x: number; z: number; sx: number; sy: number; sz: number; r: number }[] = [];
    for (let along = 2.5; along < FURROW.length - 1; along += 1.6 + rnd() * 1.2) for (const side of [-1, 1]) {
      const across = side * (FURROW.width / 2 + 0.3 + rnd() * 0.5);
      berms.push({ x: CRASH_SITE.x + FURROW.dx * along - FURROW.dz * across, z: CRASH_SITE.z + FURROW.dz * along + FURROW.dx * across, sx: 1.1 + rnd() * 0.9, sy: 0.35 + rnd() * 0.3, sz: 0.8 + rnd() * 0.6, r: rnd() * 6.28 });
    }
    return { scorch, furrow, berms, rock: organicRock(1, 77, 1, 0.3) };
  }, []);
  const bermRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = bermRef.current;
    if (!m) return;
    const o = new THREE.Object3D(), col = new THREE.Color();
    parts.berms.forEach((b, i) => {
      o.position.set(b.x, heightAt(b.x, b.z) + b.sy * 0.15, b.z);
      o.rotation.set(0, b.r, 0); o.scale.set(b.sx, b.sy, b.sz); o.updateMatrix();
      m.setMatrixAt(i, o.matrix); m.setColorAt(i, col.setHSL(0.07, 0.34, 0.2 + (i % 4) * 0.025));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [parts]);
  const scorchTex = scorchTexture(), soilTex = soilTexture();
  return (
    <group>
      {scorchTex && <mesh geometry={parts.scorch} renderOrder={1} receiveShadow><meshStandardMaterial map={scorchTex} transparent depthWrite={false} roughness={1} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} side={THREE.DoubleSide} /></mesh>}
      {soilTex && <mesh geometry={parts.furrow} renderOrder={2} receiveShadow><meshStandardMaterial map={soilTex} transparent depthWrite={false} roughness={1} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} side={THREE.DoubleSide} /></mesh>}
      <instancedMesh ref={bermRef} args={[parts.rock, undefined, parts.berms.length]} castShadow receiveShadow frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
      </instancedMesh>
    </group>
  );
}

/* ---------------- Fracture crash site ---------------- */

// materials that need a canvas texture are built inside the component (client only); these two need none
const seamMat = new THREE.MeshStandardMaterial({ color: "#1a6fae", emissive: "#39b6ff", emissiveIntensity: 2.4, roughness: 0.3 });
const crystalMat = new THREE.MeshStandardMaterial({ color: "#6fd0ff", emissive: "#39b6ff", emissiveIntensity: 3, transparent: true, opacity: 0.85, roughness: 0.15 });

const TORN = (() => {
  const r = mulberry32(88);
  return Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * 6.28 + r() * 0.5, d = 4.5 + r() * 3.5;
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, w: 0.5 + r() * 1.6, h: 0.08 + r() * 0.12, d: 0.4 + r() * 1.1, rx: (r() - 0.5) * 0.9, ry: r() * 6.28, rz: (r() - 0.5) * 0.9 };
  }).filter((p) => !furrowFrame(CRASH_SITE.x + p.x, CRASH_SITE.z + p.z) && trailInfo(CRASH_SITE.x + p.x, CRASH_SITE.z + p.z).dist > TRAIL_HALF_WIDTH + 0.5 && !HULL_SOLIDS.some((h) => Math.hypot(h.x - CRASH_SITE.x - p.x, h.z - CRASH_SITE.z - p.z) < h.r + 0.8));
})();

/** Stand-in wreckage: angular hull plates with glowing seams. A real crashed-craft GLB can replace this
 * group (see the asset list in the Phase 4.1 report) — the scan ring, beam, sparks and collision stay. */
function CrashSite({ investigation }: { investigation: MutableRefObject<Investigation> }) {
  // the scan ring lies on the average ground around the scan radius, not in the impact pit at the centre
  const baseY = useMemo(() => { let sum = 0; for (let i = 0; i < 12; i++) sum += heightAt(CRASH_SITE.x + Math.cos(i * 0.5236) * CRASH_SITE.scanRadius, CRASH_SITE.z + Math.sin(i * 0.5236) * CRASH_SITE.scanRadius); return sum / 12; }, []);
  // damaged plating: soot, scratches, rust burn-through and panel seams, darker and rougher than clean metal
  const hullMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d8dde6", map: hullDamageTexture(), metalness: 0.7, roughness: 0.62 }), []);
  const smoke = useRef<THREE.Group>(null);
  const smokeTex = useMemo(() => smokeTexture(), []);
  const group = useRef<THREE.Group>(null);
  const disc = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const crystals = useRef<THREE.Group>(null);
  const sparks = useRef<THREE.Points>(null);
  const spark = useMemo(() => {
    const n = 48, rnd = mulberry32(7);
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { seed[i] = rnd(); pos[i * 3] = (rnd() - 0.5) * 7; pos[i * 3 + 2] = (rnd() - 0.5) * 7; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { g, seed };
  }, []);
  const tint = useRef(new THREE.Color("#39b6ff")).current;
  const done = useRef(new THREE.Color("#7dffca")).current;
  useFrame(({ camera, clock }) => {
    const g = group.current;
    if (!g) return;
    // nothing here is animated unless the camera can actually see the site
    const near = Math.hypot(camera.position.x - CRASH_SITE.x, camera.position.z - CRASH_SITE.z) < 90;
    if (g.visible !== near) g.visible = near;
    if (!near) return;
    const t = clock.elapsedTime;
    const inv = investigation.current;
    if (disc.current) {
      disc.current.scale.setScalar(Math.max(0.001, inv.scan));
      (disc.current.material as THREE.MeshBasicMaterial).color.copy(inv.done ? done : tint);
    }
    if (beam.current) {
      (beam.current.material as THREE.MeshBasicMaterial).opacity = (inv.done ? 0.18 : 0.32) + Math.sin(t * 2.2) * 0.08;
      (beam.current.material as THREE.MeshBasicMaterial).color.copy(inv.done ? done : tint);
    }
    smoke.current?.children.forEach((c, i) => {
      const ph = (t * 0.1 + i / 7) % 1, w = windUniforms.uWindDir.value, ws = 2 + windUniforms.uWindStrength.value * 6;
      c.position.set(Math.sin(i * 2.1) * 1.2 + w.x * ws * ph, 1.4 + ph * 9, Math.cos(i * 1.7) * 1.2 + w.y * ws * ph);
      c.scale.setScalar(2.2 + ph * 5.5);
      ((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = 0.34 * (1 - ph) * Math.min(1, ph * 6);
    });
    crystals.current?.children.forEach((c, i) => { c.position.y = 1.6 + Math.sin(t * 1.4 + i * 1.7) * 0.25; c.rotation.y = t * 0.6 + i; });
    const s = sparks.current;
    if (s) {
      const p = spark.g.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) p.setY(i, ((t * 0.9 + spark.seed[i]! * 6) % 6) + 0.3);
      p.needsUpdate = true;
    }
  });
  const ring = CRASH_SITE.scanRadius;
  return (
    <group ref={group} position={[CRASH_SITE.x, baseY, CRASH_SITE.z]}>
      {DEBRIS.slice(3).map((b, i) => { // the three heavy sections are now the real hull (CrashedTransport)
        const y = heightAt(CRASH_SITE.x + b.dx, CRASH_SITE.z + b.dz) - baseY;
        return (
          <group key={i} position={[b.dx, y + b.h * 0.4, b.dz]} rotation={[b.tilt, b.yaw, b.tilt * 0.5]}>
            <mesh castShadow receiveShadow material={hullMat}><boxGeometry args={[b.w, b.h, b.d]} /></mesh>
            <mesh material={seamMat} position={[0, b.h * 0.51, 0]}><boxGeometry args={[b.w * 0.82, 0.06, 0.1]} /></mesh>
          </group>
        );
      })}
      {/* torn plates and broken struts thrown off the hull */}
      {TORN.map((p, i) => (
        <mesh key={i} position={[p.x, heightAt(CRASH_SITE.x + p.x, CRASH_SITE.z + p.z) - baseY + p.h * 0.45, p.z]} rotation={[p.rx, p.ry, p.rz]} material={hullMat} castShadow receiveShadow><boxGeometry args={[p.w, p.h, p.d]} /></mesh>
      ))}
      {smokeTex && (
        <group ref={smoke}>
          {Array.from({ length: 7 }, (_, i) => <sprite key={i}><spriteMaterial map={smokeTex} transparent depthWrite={false} opacity={0} color="#9aa0aa" /></sprite>)}
        </group>
      )}
      <group ref={crystals}>
        {[[-2.2, 2.4], [2.8, 1.2], [0.8, -2.6], [-3.2, -1.6]].map(([x, z], i) => (
          <mesh key={i} position={[x!, 1.6, z!]} scale={[0.35, 0.8 + (i % 2) * 0.4, 0.35]} material={crystalMat}><octahedronGeometry args={[1, 0]} /></mesh>
        ))}
      </group>
      <mesh ref={beam} position={[0, 22, 0]}><cylinderGeometry args={[0.18, 0.5, 44, 10, 1, true]} /><meshBasicMaterial color="#39b6ff" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} /></mesh>
      <points ref={sparks} geometry={spark.g}><pointsMaterial color="#8fdcff" size={0.18} transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation /></points>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.35, 0]}><ringGeometry args={[ring - 0.35, ring, 56]} /><meshBasicMaterial color="#39b6ff" transparent opacity={0.55} depthWrite={false} /></mesh>
      <mesh ref={disc} rotation-x={-Math.PI / 2} position={[0, 0.3, 0]} scale={0.001}><circleGeometry args={[ring - 0.35, 48]} /><meshBasicMaterial color="#39b6ff" transparent opacity={0.22} depthWrite={false} /></mesh>
      <DistrictLight position={[0, 3, 0]} color="#39b6ff" intensity={14} distance={26} decay={2} range={70} />
    </group>
  );
}

/* ---------------- drifting forest motes ---------------- */

/** Pollen and spores drifting on the same wind the foliage sways to. A small box of points follows the camera
 * and wraps, so a few dozen points cover the whole forest. Hidden outside the forest region. */
function ForestMotes({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const rnd = mulberry32(31);
    const pos = new Float32Array(count * 3), ph = new Float32Array(count);
    for (let i = 0; i < count; i++) { pos[i * 3] = (rnd() - 0.5) * 60; pos[i * 3 + 1] = rnd() * 9; pos[i * 3 + 2] = (rnd() - 0.5) * 60; ph[i] = rnd() * 6.28; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { g, ph, local: pos };
  }, [count]);
  useFrame(({ camera, clock }, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const inside = Math.hypot(camera.position.x - forest.x, camera.position.z - forest.z) < forest.radius + 14;
    if (pts.visible !== inside) pts.visible = inside;
    if (!inside) return;
    const t = clock.elapsedTime, w = windUniforms.uWindDir.value, ws = 0.4 + windUniforms.uWindStrength.value * 2.5;
    const p = data.g.getAttribute("position") as THREE.BufferAttribute;
    const a = data.local;
    const ground = heightAt(camera.position.x, camera.position.z); // one lookup per frame; motes ride the ground near the camera
    for (let i = 0; i < p.count; i++) {
      a[i * 3]! += (w.x * ws + Math.sin(t * 0.5 + data.ph[i]!) * 0.35) * dt;
      a[i * 3 + 1]! += Math.sin(t * 0.7 + data.ph[i]! * 2) * 0.12 * dt;
      a[i * 3 + 2]! += (w.y * ws + Math.cos(t * 0.45 + data.ph[i]!) * 0.35) * dt;
      // wrap inside a 60 m box around the camera
      const dx = a[i * 3]! - camera.position.x, dz = a[i * 3 + 2]! - camera.position.z;
      if (dx > 30) a[i * 3]! -= 60; else if (dx < -30) a[i * 3]! += 60;
      if (dz > 30) a[i * 3 + 2]! -= 60; else if (dz < -30) a[i * 3 + 2]! += 60;
      const y = a[i * 3 + 1]!;
      if (y < ground + 0.3) a[i * 3 + 1] = ground + 6; else if (y > ground + 11) a[i * 3 + 1] = ground + 0.6;
      p.setXYZ(i, a[i * 3]!, a[i * 3 + 1]!, a[i * 3 + 2]!);
    }
    p.needsUpdate = true;
  });
  return <points ref={ref} geometry={data.g} frustumCulled={false}><pointsMaterial color="#e6f2b0" size={0.14} transparent opacity={0.5} depthWrite={false} sizeAttenuation /></points>;
}

