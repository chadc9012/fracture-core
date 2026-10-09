import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { heightAt, slopeAt, WATER_LEVEL } from "@/game/terrain";
import { mulberry32 } from "@/game/useKeyboard";
import { addObstacle, type Obstacle } from "@/game/obstacles";
import {
  COVER, CRASH_SITE, DEBRIS, TRAIL_HALF_WIDTH, forestScatter, trailEdgeScatter,
  type Floor, type Investigation,
} from "@/game/verdant";
import { REGIONS } from "@/game/world";
import { windUniforms } from "@/game/wind-sway";
import { DistrictLight } from "./DistrictLight";
import { PolyFoliage, type Placement } from "./PolyFoliage";

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
    const ferns = trailEdgeScatter(d(70), mulberry32(101), TRAIL_HALF_WIDTH + 0.4, TRAIL_HALF_WIDTH + 7, dry).map((f) => place(f, -0.05));
    const shrubs = [
      ...trailEdgeScatter(d(30), mulberry32(103), TRAIL_HALF_WIDTH + 2, TRAIL_HALF_WIDTH + 10, dry),
      ...forestScatter(d(26), mulberry32(104), dry, 1),
    ].map((f) => place(f));
    const rockSpots = trailEdgeScatter(d(9), mulberry32(107), TRAIL_HALF_WIDTH + 1.5, TRAIL_HALF_WIDTH + 8, dry);
    const coverRocks = COVER.filter((c) => c.kind === "rock").map((c) => ({ x: c.x, z: c.z, s: c.r / 1.3, r: c.yaw }));
    const rocks = [...rockSpots, ...coverRocks].map((f) => place(f));
    const looseLogs = forestScatter(d(3), mulberry32(109), dry, 2);
    const logs = [
      ...looseLogs.map((f) => ({ x: f.x, z: f.z, yaw: f.r, s: 0.85 + (f.s - 0.7) * 0.4 })),
      ...COVER.filter((c) => c.kind === "log").map((c) => ({ x: c.x, z: c.z, yaw: c.yaw, s: 1 })),
    ];
    const solids: Solid[] = [
      ...rocks.map((p): Solid => ({ x: p.x, z: p.z, r: 1.3 * p.s, kind: "rock", hp: 200, solidity: 1.4 })),
      ...logs.flatMap((l): Solid[] => [-1, 0, 1].map((k) => ({
        x: l.x + Math.cos(l.yaw) * k * (LOG_LENGTH * l.s) / 3, z: l.z - Math.sin(l.yaw) * k * (LOG_LENGTH * l.s) / 3,
        r: 0.8 * l.s, kind: "rock", hp: 160, solidity: 1.2,
      }))),
      // the three heaviest hull sections of the crashed craft
      ...DEBRIS.slice(0, 3).map((b): Solid => ({ x: CRASH_SITE.x + b.dx, z: CRASH_SITE.z + b.dz, r: Math.max(b.w, b.d) * 0.45, kind: "wreck", hp: 400, solidity: 1.3 })),
    ];
    return { ferns, shrubs, rocks, logs: logs.map((l) => lying(l.x, l.z, l.yaw, l.s)), solids };
  }, [density]);

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
          <PolyFoliage kind="fern" items={layout.ferns} height={0.9} sway={0.12} shadows={false} />
          <PolyFoliage kind="shrub" items={layout.shrubs} height={1.3} sway={0.15} shadows={false} />
          <PolyFoliage kind="rock" items={layout.rocks} height={1.7} shadows />
          <PolyFoliage kind="log" items={layout.logs} height={LOG_LENGTH} shadows />
        </>
      )}
      <CrashSite investigation={investigation} />
      <ForestMotes count={d(90)} />
    </group>
  );
}

/* ---------------- Fracture crash site ---------------- */

const hullMat = new THREE.MeshStandardMaterial({ color: "#262b34", metalness: 0.85, roughness: 0.42 });
const seamMat = new THREE.MeshStandardMaterial({ color: "#1a6fae", emissive: "#39b6ff", emissiveIntensity: 2.4, roughness: 0.3 });
const crystalMat = new THREE.MeshStandardMaterial({ color: "#6fd0ff", emissive: "#39b6ff", emissiveIntensity: 3, transparent: true, opacity: 0.85, roughness: 0.15 });

/** Stand-in wreckage: angular hull plates with glowing seams. A real crashed-craft GLB can replace this
 * group (see the asset list in the Phase 4.1 report) — the scan ring, beam, sparks and collision stay. */
function CrashSite({ investigation }: { investigation: MutableRefObject<Investigation> }) {
  const baseY = useMemo(() => heightAt(CRASH_SITE.x, CRASH_SITE.z), []);
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
      {DEBRIS.map((b, i) => {
        const y = heightAt(CRASH_SITE.x + b.dx, CRASH_SITE.z + b.dz) - baseY;
        return (
          <group key={i} position={[b.dx, y + b.h * 0.4, b.dz]} rotation={[b.tilt, b.yaw, b.tilt * 0.5]}>
            <mesh castShadow receiveShadow material={hullMat}><boxGeometry args={[b.w, b.h, b.d]} /></mesh>
            <mesh material={seamMat} position={[0, b.h * 0.51, 0]}><boxGeometry args={[b.w * 0.82, 0.06, 0.1]} /></mesh>
          </group>
        );
      })}
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

