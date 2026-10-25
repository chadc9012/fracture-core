import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CITY, PIECE_SIZE, citySolids, reclaimedCity, towerPieces, towerVines, type PieceKey, type Tower } from "@/game/reclaimed-city";
import { addObstacle } from "@/game/obstacles";
import { walkHeight } from "@/game/terrain";
import { barkTrunk, canopyCluster, chippedBlock, organicRock } from "@/game/organic-geometry";
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";
import { InstancedFleet, type FleetInstance } from "./InstancedFleet";
import type { FleetModelId } from "@/game/fleet-models";

/** The jungle-reclaimed city block on Veridan's Ancient Ruins site (reclaimed-city.ts owns the layout). Concrete shells drawn as
 * one instanced batch per piece shape (five draws for the whole block), moss greening every upward face through vertex colour,
 * vine curtains down the facades, trees in the streets and on the roofs, rusted cars sunk in the old roadway. Scenery only:
 * the shells are solid (obstacle circles fill each footprint). */

/** moss on the tops: vertex colour from the face normal, concrete grey on the sides, green where the face looks up */
function mossy(g: THREE.BufferGeometry, seed: number): THREE.BufferGeometry {
  const n = g.attributes["normal"] as THREE.BufferAttribute, p = g.attributes["position"] as THREE.BufferAttribute, c = new Float32Array(n.count * 3);
  const moss = new THREE.Color("#5f7a3e"), stone = new THREE.Color("#d8d3c8"), tmp = new THREE.Color();
  for (let i = 0; i < n.count; i++) {
    const up = THREE.MathUtils.smoothstep(n.getY(i), 0.45, 0.85), grit = 0.86 + 0.14 * Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 2.3 + seed);
    tmp.copy(stone).multiplyScalar(grit).lerp(moss, up * 0.85);
    c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return g;
}

let vineTex: THREE.CanvasTexture | null = null;
/** hanging vines: leafy strands on a transparent canvas, cut out with alphaTest */
function vineTexture(): THREE.CanvasTexture | null {
  if (vineTex) return vineTex;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 128; c.height = 512;
  const g = c.getContext("2d"); if (!g) return null;
  let s = 977; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const greens = ["#3f5a2a", "#4d6b31", "#5b7a38", "#36502a", "#6a8640"];
  for (let i = 0; i < 26; i++) {
    const x = 4 + rnd() * 120, len = 140 + rnd() * 372, sway = (rnd() - 0.5) * 18;
    g.strokeStyle = "#3a4a26"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, 0);
    g.bezierCurveTo(x + sway, len * 0.35, x - sway, len * 0.7, x + sway * 0.4, len); g.stroke();
    // leaves along the strand, denser near the top
    for (let k = 0; k < len / 5; k++) {
      const t = k / (len / 5), y = t * len, bx = x + sway * (3 * t * (1 - t) * (1 - 2 * t)) + sway * 0.4 * t * t * t;
      if (rnd() > 1.15 - t * 0.6) continue;
      g.fillStyle = greens[Math.floor(rnd() * greens.length)]!;
      g.beginPath(); g.ellipse(bx + (rnd() - 0.5) * 9, y, 2.5 + rnd() * 3, 1.6 + rnd() * 2, rnd() * 3, 0, Math.PI * 2); g.fill();
    }
  }
  vineTex = new THREE.CanvasTexture(c); vineTex.colorSpace = THREE.SRGBColorSpace; vineTex.anisotropy = 4;
  return vineTex;
}

const WRECKS: FleetModelId[] = ["luxury-sedan", "muscle-car", "offroad-truck", "tuner"];
const RUST = ["#5a3b2a", "#4a3a30", "#6a4a30", "#3e3a32"];
const KEYS: PieceKey[] = ["slab", "column", "spandrel", "panel", "shard", "rubble"];

const towerMatrix = (t: Tower) => new THREE.Matrix4().compose(new THREE.Vector3(t.x, t.base, t.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(t.lean, t.yaw, 0, "YXZ")), new THREE.Vector3(1, 1, 1));

export function ReclaimedCity() {
  const city = useMemo(() => reclaimedCity(), []);
  useEffect(() => {
    const added = citySolids(city).map((s) => addObstacle("tower", s.x, s.z, s.r, 1e9, 1));
    return () => { for (const o of added) o.broken = true; };
  }, [city]);

  const geos = useMemo(() => {
    const sz = PIECE_SIZE;
    return {
      slab: mossy(chippedBlock(...sz.slab, 3), 1), column: mossy(chippedBlock(...sz.column, 5), 2), spandrel: mossy(chippedBlock(...sz.spandrel, 7), 3), panel: mossy(chippedBlock(...sz.panel, 9), 6),
      shard: mossy(chippedBlock(...sz.shard, 11), 4), rubble: mossy(organicRock(0.6, 13, 1), 5),
      vine: new THREE.PlaneGeometry(1, 1, 1, 4).translate(0, -0.5, 0), trunk: barkTrunk(71, 0.3, 0.7, 0.55), crown: canopyCluster(73),
    } as const;
  }, []);
  const mats = useMemo(() => ({
    stone: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#a29e94", roughness: 0.95, vertexColors: true }), weatheredConcreteTexture(), 3),
    vine: new THREE.MeshStandardMaterial({ map: vineTexture(), color: "#ffffff", roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.4 }),
    trunk: new THREE.MeshStandardMaterial({ color: "#5a4c3c", roughness: 1 }),
    crown: new THREE.MeshStandardMaterial({ roughness: 0.95 }),
  }), []);
  useEffect(() => () => { Object.values(geos).forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); }, [geos, mats]);

  // world matrices of every stone piece, by shape, and of every vine
  const batches = useMemo(() => {
    const by = new Map<PieceKey, THREE.Matrix4[]>(KEYS.map((k) => [k, []]));
    const vines: THREE.Matrix4[] = [];
    if (!city) return { by, vines };
    const local = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    for (const t of city.towers) {
      const tm = towerMatrix(t);
      for (const p of towerPieces(t)) {
        local.compose(v.set(p.x, p.y, p.z), q.setFromEuler(e.set(p.rx, p.ry, p.rz)), s.set(p.sx, p.sy, p.sz));
        by.get(p.g)!.push(tm.clone().multiply(local));
      }
      for (const vn of towerVines(t)) {
        local.compose(v.set(vn.x, vn.y, vn.z), q.setFromEuler(e.set(0, vn.yaw, 0)), s.set(vn.w, vn.len, 1));
        vines.push(tm.clone().multiply(local));
      }
    }
    return { by, vines };
  }, [city]);

  const trees = city?.trees ?? [];
  const wrecks = useMemo<FleetInstance[]>(() => (city?.wrecks ?? []).map((w, i) => ({ model: WRECKS[i % WRECKS.length]!, x: w.x, y: walkHeight(w.x, w.z) - 0.35, z: w.z, yaw: w.yaw, paint: RUST[i % RUST.length]! })), [city]);
  if (!city) return null;
  return (
    <group name="site:reclaimed-city">
      {KEYS.map((k) => <Batch key={k} geo={geos[k]} mat={mats.stone} ms={batches.by.get(k)!} shadow={k !== "rubble"} />)}
      <Batch geo={geos.vine} mat={mats.vine} ms={batches.vines} shadow={false} />
      <Trees trees={trees} trunk={geos.trunk} crown={geos.crown} mats={mats} />
      <InstancedFleet items={wrecks} shadows={false} />
    </group>
  );
}

function Batch({ geo, mat, ms, shadow }: { geo: THREE.BufferGeometry; mat: THREE.Material; ms: THREE.Matrix4[]; shadow: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    ms.forEach((x, i) => m.setMatrixAt(i, x));
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  }, [ms]);
  if (!ms.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, ms.length]} castShadow={shadow} receiveShadow />;
}

function Trees({ trees, trunk, crown, mats }: { trees: { x: number; y: number; z: number; s: number; r: number; roof: boolean }[]; trunk: THREE.BufferGeometry; crown: THREE.BufferGeometry; mats: { trunk: THREE.Material; crown: THREE.Material } }) {
  const tr = useRef<THREE.InstancedMesh>(null), cr = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const a = tr.current, b = cr.current; if (!a || !b) return;
    const o = new THREE.Object3D(), col = new THREE.Color();
    // two leaf masses a tree, the second smaller, lower and off to one side, so crowns read as foliage, not a parasol
    trees.forEach((t, i) => {
      const h = (t.roof ? 7 : 9) * t.s + (t.roof ? 0 : CITY.storey * 0.5);
      o.position.set(t.x, t.y + h / 2 - 0.3, t.z); o.rotation.set(0, t.r, 0); o.scale.set(t.s * 1.1, h, t.s * 1.1); o.updateMatrix(); a.setMatrixAt(i, o.matrix);
      o.position.set(t.x, t.y + h, t.z); o.scale.set(5.2 * t.s, 3.6 * t.s, 5 * t.s); o.updateMatrix(); b.setMatrixAt(i * 2, o.matrix);
      o.position.set(t.x + Math.cos(t.r) * 2.6 * t.s, t.y + h - 1.6 * t.s, t.z + Math.sin(t.r) * 2.6 * t.s); o.rotation.set(0, t.r + 1.3, 0); o.scale.set(3.4 * t.s, 2.6 * t.s, 3.2 * t.s); o.updateMatrix(); b.setMatrixAt(i * 2 + 1, o.matrix);
      b.setColorAt(i * 2, col.set(i % 3 ? "#4f6a36" : "#5c7840")); b.setColorAt(i * 2 + 1, col.set(i % 2 ? "#47622f" : "#55703a"));
    });
    for (const m of [a, b]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
    if (b.instanceColor) b.instanceColor.needsUpdate = true;
  }, [trees]);
  if (!trees.length) return null;
  return <group>
    <instancedMesh ref={tr} args={[trunk, mats.trunk, trees.length]} castShadow />
    <instancedMesh ref={cr} args={[crown, mats.crown, trees.length * 2]} castShadow />
  </group>;
}
