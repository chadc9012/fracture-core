import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { movedEnough, nearIndices } from "@/game/foliage-cull";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { COVER_CULL_RADIUS, COVER_RESELECT_SECONDS, groundCover, type CoverItem, type CoverKind } from "@/game/ground-cover";
import { inReclaimedCity } from "@/game/reclaimed-city";
import { windSway } from "@/game/wind-sway";
import { organicDeform, organicRock } from "@/game/organic-geometry";

/** Reed blades on a transparent card (canvas, no asset). */
function reedTexture(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 64; c.height = 128;
  const g = c.getContext("2d"); if (!g) return null;
  let s = 77; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  // broad tapered leaves (filled, not hairline strokes, so they survive mipmapping), darker at the root
  for (let i = 0; i < 22; i++) {
    const x = 5 + rnd() * 54, tipX = x + (rnd() - 0.5) * 32, tipY = 8 + rnd() * 63, w = 1.3 + rnd() * 3.8;
    const grad = g.createLinearGradient(x, 128, tipX, tipY);
    grad.addColorStop(0, i % 3 === 0 ? "#354f26" : "#4e6d30");
    grad.addColorStop(0.6, i % 4 === 0 ? "#8c9c50" : "#718b40");
    grad.addColorStop(1, "#b9b77a");
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(x - w, 128);
    g.quadraticCurveTo(x - w * 0.6, 68, tipX, tipY); g.quadraticCurveTo(x + w * 0.8, 76, x + w, 128);
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** two crossed cards; their real plane normals are kept (double-sided, so the back faces light correctly) —
 * forced-up normals lit every reed like flat ground in full sun */
const cards = (w: number, h: number) => {
  const a = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), b = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0).rotateY(Math.PI / 2);
  const g = mergeGeometries([a, b])!;
  a.dispose(); b.dispose();
  return g;
};

/** a shrub as four leaf masses rather than one ball: same triangle count as the old single icosahedron (it is drawn ~1,200 times) */
function shrubCanopy(): THREE.BufferGeometry {
  const lobes: [number, number, number, number][] = [[0, 0.4, 0, 0.5], [-0.36, 0.3, 0.08, 0.34], [0.33, 0.32, -0.1, 0.36], [0.02, 0.56, -0.26, 0.32]];
  // detail-2 lobes, lumped with noise: rounded leaf masses instead of 20-face gems (≈4x the old triangles, still ~1k a bush)
  const parts = lobes.map(([x, y, z, r], i) => organicDeform(new THREE.IcosahedronGeometry(r, 2), 13 + i, r * 0.22, 3.2).scale(1.08, 0.74 + (i % 2) * 0.1, 1.04).rotateY(i * 1.3).translate(x, y, z));
  const g = mergeVertices(mergeGeometries(parts)!.deleteAttribute("normal").deleteAttribute("uv"));
  parts.forEach((p) => p.dispose());
  g.computeVertexNormals();
  return shade(g, 0.55, 1.05, 0, 0.85);
}

/** a five-petal flower head as one flat star (10 triangles, double-sided), centre darker through vertex colour */
function flowerHead(): THREE.BufferGeometry {
  const pos = [0, 0.365, 0], col = [0.55, 0.45, 0.2], idx: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.03 : 0.085, lift = i % 2 ? 0.355 : 0.375;
    pos.push(Math.sin(a) * r, lift, Math.cos(a) * r); col.push(1, 1, 1);
    idx.push(0, 1 + i, 1 + ((i + 1) % 10));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** gives geometry a dark-at-the-base vertex colour so bushes and flower heads are not flat blobs */
function shade(geo: THREE.BufferGeometry, lo: number, hi: number, minY: number, maxY: number) {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const t = THREE.MathUtils.clamp((pos.getY(i) - minY) / Math.max(1e-6, maxY - minY), 0, 1), v = lo + (hi - lo) * t; col.set([v, v, v], i * 3); }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Draws only the items within `radius` of the camera (ground-cover-cull.ts). Matrices and colours for the whole world are computed once;
 * the live instance buffer is refilled with the near ones when the camera has moved far enough. Instanced meshes otherwise draw every
 * instance in the world every frame (and again in the shadow pass): ~1M triangles of shrubs and rocks nobody could see. */
function Batch({ items, geometry, material, scale, yLift = 0, radius }: { items: CoverItem[]; geometry: THREE.BufferGeometry; material: THREE.Material; scale: (it: CoverItem) => [number, number, number]; yLift?: number; radius: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const camera = useThree((s) => s.camera);
  const all = useMemo(() => {
    const o = new THREE.Object3D(), c = new THREE.Color();
    const mats = new Float32Array(items.length * 16), cols = new Float32Array(items.length * 3);
    items.forEach((it, i) => {
      o.position.set(it.x, it.y + yLift - (it.sink ?? 0), it.z);
      o.rotation.set(0, it.r, 0);
      o.scale.set(...scale(it));
      o.updateMatrix();
      o.matrix.toArray(mats, i * 16);
      c.set(it.color).toArray(cols, i * 3);
    });
    return { mats, cols };
  }, [items, scale, yLift]);
  const last = useRef<{ x: number; z: number; t: number } | null>(null);
  const refill = (cx: number, cz: number) => {
    const m = ref.current; if (!m) return;
    const near = nearIndices(items, cx, cz, radius);
    const im = m.instanceMatrix.array as Float32Array, ic = m.instanceColor?.array as Float32Array | undefined;
    near.forEach((src, dst) => { im.set(all.mats.subarray(src * 16, src * 16 + 16), dst * 16); ic?.set(all.cols.subarray(src * 3, src * 3 + 3), dst * 3); });
    m.count = near.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  };
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    // make sure the colour attribute exists before the first refill (setColorAt allocates it)
    if (!m.instanceColor && items.length) m.setColorAt(0, new THREE.Color(1, 1, 1));
    last.current = { x: camera.position.x, z: camera.position.z, t: 0 };
    refill(camera.position.x, camera.position.z);
  }, [all]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((state) => {
    const l = last.current; if (!l) return;
    const t = state.clock.elapsedTime;
    if (t - l.t < COVER_RESELECT_SECONDS) return;
    l.t = t;
    const { x, z } = camera.position;
    if (!movedEnough(l.x, l.z, x, z)) return;
    l.x = x; l.z = z;
    refill(x, z);
  });
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} />;
}

/** Flowers, bushes, small rocks and reeds scattered by ground-cover.ts (flower meadows, thickets, rocky slopes, reed beds along rivers). Presentation only:
 * no collision, no gameplay state. Static instanced meshes (one draw call per kind), wind sway in the vertex shader, mounted a few seconds after the
 * terrain so it never competes with first-frame assets. */
export function GroundCover({ density }: { density: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setReady(true), 4500); return () => window.clearTimeout(t); }, []);
  // nothing grows through the reclaimed city's concrete shells (reclaimed-city.ts imports ground-cover, so the filter lives here)
  const items = useMemo(() => (ready ? groundCover(density).filter((i) => !inReclaimedCity(i.x, i.z, 0.5)) : []), [ready, density]);
  const by = useMemo(() => { const m: Record<CoverKind, CoverItem[]> = { flower: [], bush: [], rock: [], reed: [] }; for (const i of items) m[i.kind].push(i); return m; }, [items]);

  const assets = useMemo(() => {
    const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.34, 3).translate(0, 0.17, 0);
    const head = flowerHead();
    const bush = shrubCanopy();
    // weathered rather than faceted: weld the boulder's vertices so its normals smooth across faces
    const rockRaw = organicRock(0.5, 11, 1);
    const rock = mergeVertices(rockRaw.deleteAttribute("normal").deleteAttribute("uv"));
    rockRaw.dispose();
    rock.computeVertexNormals();
    shade(rock, 0.65, 1.0, -0.5, 0.5);
    const reed = cards(0.55, 1.5);
    const reedTex = reedTexture();
    return {
      stem, head, bush, rock, reed,
      stemMat: new THREE.MeshStandardMaterial({ color: "#4f7a3a", roughness: 1 }),
      headMat: new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
      bushMat: new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 1 }),
      rockMat: new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.95 }),
      reedMat: new THREE.MeshStandardMaterial({ map: reedTex, color: "#ffffff", alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 }),
    };
  }, []);
  useMemo(() => {
    assets.stemMat.onBeforeCompile = windSway(assets.stem, 0.5);
    assets.headMat.onBeforeCompile = windSway(assets.head, 0.55);
    assets.bushMat.onBeforeCompile = windSway(assets.bush, 0.15, { dew: 0.7 });    assets.reedMat.onBeforeCompile = windSway(assets.reed, 0.3);
  }, [assets]);
  useEffect(() => () => { Object.values(assets).forEach((a) => (a as { dispose?: () => void }).dispose?.()); }, [assets]);

  const s1 = useMemo(() => (it: CoverItem): [number, number, number] => [it.s, it.s * (0.8 + (it.r % 1) * 0.5), it.s], []);
  const sRock = useMemo(() => (it: CoverItem): [number, number, number] => [it.s * (0.9 + (it.r % 1) * 0.5), it.s * (0.45 + ((it.r * 7) % 1) * 0.4), it.s * (0.9 + ((it.r * 3) % 1) * 0.5)], []);
  const sBush = useMemo(() => (it: CoverItem): [number, number, number] => [it.s * 1.3, it.s * 1.1, it.s * 1.3], []);
  if (!ready) return null;
  return (
    <group>
      <Batch items={by.flower} geometry={assets.stem} material={assets.stemMat} scale={s1} radius={COVER_CULL_RADIUS.flower} />
      <Batch items={by.flower} geometry={assets.head} material={assets.headMat} scale={s1} radius={COVER_CULL_RADIUS.flower} />
      <Batch items={by.bush} geometry={assets.bush} material={assets.bushMat} scale={sBush} radius={COVER_CULL_RADIUS.bush} />
      <Batch items={by.rock} geometry={assets.rock} material={assets.rockMat} scale={sRock} yLift={0.08} radius={COVER_CULL_RADIUS.rock} />
      <Batch items={by.reed} geometry={assets.reed} material={assets.reedMat} scale={s1} radius={COVER_CULL_RADIUS.reed} />
    </group>
  );
}
