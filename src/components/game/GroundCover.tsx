import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { groundCover, type CoverItem, type CoverKind } from "@/game/ground-cover";
import { windSway } from "@/game/wind-sway";
import { organicRock } from "@/game/organic-geometry";

/** Reed blades on a transparent card (canvas, no asset). */
function reedTexture(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 64; c.height = 128;
  const g = c.getContext("2d"); if (!g) return null;
  let s = 77; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 16; i++) {
    const x = 6 + rnd() * 52, lean = (rnd() - 0.5) * 22, top = 6 + rnd() * 40;
    const grad = g.createLinearGradient(0, 128, 0, top); grad.addColorStop(0, "#5c7a3a"); grad.addColorStop(1, "#d8e6a0");
    g.strokeStyle = grad; g.lineWidth = 1.4 + rnd() * 1.6; g.lineCap = "round";
    g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + lean * 0.3, 70, x + lean, top); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const cards = (w: number, h: number) => {
  const a = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), b = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0).rotateY(Math.PI / 2);
  const g = mergeGeometries([a, b])!;
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
};

/** gives geometry a dark-at-the-base vertex colour so bushes and flower heads are not flat blobs */
function shade(geo: THREE.BufferGeometry, lo: number, hi: number, minY: number, maxY: number) {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const t = THREE.MathUtils.clamp((pos.getY(i) - minY) / Math.max(1e-6, maxY - minY), 0, 1), v = lo + (hi - lo) * t; col.set([v, v, v], i * 3); }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

function Batch({ items, geometry, material, scale, yLift = 0 }: { items: CoverItem[]; geometry: THREE.BufferGeometry; material: THREE.Material; scale: (it: CoverItem) => [number, number, number]; yLift?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D(), c = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(it.x, it.y + yLift - (it.sink ?? 0), it.z);
      o.rotation.set(0, it.r, 0);
      o.scale.set(...scale(it));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(it.color));
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, scale, yLift]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} />;
}

/** Flowers, bushes, small rocks and reeds scattered by ground-cover.ts (flower meadows, thickets, rocky slopes, reed beds along rivers). Presentation only:
 * no collision, no gameplay state. Static instanced meshes (one draw call per kind), wind sway in the vertex shader, mounted a few seconds after the
 * terrain so it never competes with first-frame assets. */
export function GroundCover({ density }: { density: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setReady(true), 4500); return () => window.clearTimeout(t); }, []);
  const items = useMemo(() => (ready ? groundCover(density) : []), [ready, density]);
  const by = useMemo(() => { const m: Record<CoverKind, CoverItem[]> = { flower: [], bush: [], rock: [], reed: [] }; for (const i of items) m[i.kind].push(i); return m; }, [items]);

  const assets = useMemo(() => {
    const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.34, 3).translate(0, 0.17, 0);
    const head = new THREE.OctahedronGeometry(0.075, 0).scale(1, 0.55, 1).translate(0, 0.36, 0);
    const bush = shade(new THREE.IcosahedronGeometry(0.55, 1).scale(1, 0.72, 1).translate(0, 0.3, 0), 0.5, 1.05, -0.1, 0.7);
    const rock = shade(organicRock(0.5, 11, 1), 0.65, 1.0, -0.5, 0.5);
    const reed = cards(0.55, 1.5);
    const reedTex = reedTexture();
    return {
      stem, head, bush, rock, reed,
      stemMat: new THREE.MeshStandardMaterial({ color: "#4f7a3a", roughness: 1 }),
      headMat: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.08 }),
      bushMat: new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 1 }),
      rockMat: new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.95, flatShading: true }),
      reedMat: new THREE.MeshStandardMaterial({ map: reedTex, color: "#ffffff", alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 }),
    };
  }, []);
  useMemo(() => {
    assets.stemMat.onBeforeCompile = windSway(assets.stem, 0.5);
    assets.headMat.onBeforeCompile = windSway(assets.head, 0.55);
    assets.bushMat.onBeforeCompile = windSway(assets.bush, 0.15);
    assets.reedMat.onBeforeCompile = windSway(assets.reed, 0.3);
  }, [assets]);
  useEffect(() => () => { Object.values(assets).forEach((a) => (a as { dispose?: () => void }).dispose?.()); }, [assets]);

  const s1 = useMemo(() => (it: CoverItem): [number, number, number] => [it.s, it.s * (0.8 + (it.r % 1) * 0.5), it.s], []);
  const sRock = useMemo(() => (it: CoverItem): [number, number, number] => [it.s * (0.9 + (it.r % 1) * 0.5), it.s * (0.45 + ((it.r * 7) % 1) * 0.4), it.s * (0.9 + ((it.r * 3) % 1) * 0.5)], []);
  const sBush = useMemo(() => (it: CoverItem): [number, number, number] => [it.s * 1.3, it.s * 1.1, it.s * 1.3], []);
  if (!ready) return null;
  return (
    <group>
      <Batch items={by.flower} geometry={assets.stem} material={assets.stemMat} scale={s1} />
      <Batch items={by.flower} geometry={assets.head} material={assets.headMat} scale={s1} />
      <Batch items={by.bush} geometry={assets.bush} material={assets.bushMat} scale={sBush} />
      <Batch items={by.rock} geometry={assets.rock} material={assets.rockMat} scale={sRock} yLift={0.08} />
      <Batch items={by.reed} geometry={assets.reed} material={assets.reedMat} scale={s1} />
    </group>
  );
}
