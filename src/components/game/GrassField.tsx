import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GRASS_REACH, chunkClumps, chunkOf, chunksAround, type Clump } from "@/game/grass-field";
import { windSway } from "@/game/wind-sway";
import { groundLitFragment } from "@/game/ground-lit";
import type { RenderTier } from "@/game/performance";

/** Grass blades on a transparent card (canvas, no asset): many thin tapered blades, dark at the root and sun-bleached at the tips,
 * left near-white so each clump's region colour (grass-field.ts) tints it. */
function bladeTexture(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const g = c.getContext("2d"); if (!g) return null;
  let s = 91; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 46; i++) {
    const x = 8 + rnd() * 112, tipX = x + (rnd() - 0.5) * 40, tipY = 4 + rnd() * 70, w = 1.4 + rnd() * 2.6;
    const grad = g.createLinearGradient(x, 128, tipX, tipY);
    const v = 0.78 + rnd() * 0.22;
    grad.addColorStop(0, `rgb(${Math.round(70 * v)},${Math.round(84 * v)},${Math.round(60 * v)})`);
    grad.addColorStop(0.55, `rgb(${Math.round(205 * v)},${Math.round(220 * v)},${Math.round(190 * v)})`);
    grad.addColorStop(1, `rgb(${Math.round(248 * v)},${Math.round(246 * v)},${Math.round(220 * v)})`);
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(x - w, 128);
    g.quadraticCurveTo(x - w * 0.5, 70, tipX, tipY); g.quadraticCurveTo(x + w * 0.6, 76, x + w, 128);
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** three cards crossed at 60 degrees, base at y=0, 1 m wide and tall (scaled per clump). Normals point up so the grass lights like
 * the ground it grows from instead of showing dark card backs. */
function clumpGeometry(): THREE.BufferGeometry {
  const parts = [0, 1, 2].map((k) => new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY((k * Math.PI) / 3));
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

const MAX_PER_CHUNK = 190;
const GEN_PER_FRAME = 2; // chunk generation is ~4 ms; two per frame keeps streaming hitch-free
const key = (cx: number, cz: number) => `${cx},${cz}`;

/** The near grass field (grass-field.ts): dense region-coloured grass in 16 m chunks around the camera, streamed in a couple of
 * chunks per frame and swaying in the wind. One instanced draw call. Off on LOW. */
export function GrassField({ tier }: { tier: RenderTier }) {
  const reach = GRASS_REACH[tier];
  const capacity = (2 * reach.chunks + 1) ** 2 * Math.ceil(MAX_PER_CHUNK * reach.density);
  const geometry = useMemo(() => clumpGeometry(), []);
  const texture = useMemo(() => bladeTexture(), []);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: texture, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95 });
    const sway = windSway(geometry, 0.18);
    // normals point up on both faces (ground-lit.ts): without this every card seen from behind rendered near-black
    m.onBeforeCompile = (shader) => { sway(shader); shader.fragmentShader = groundLitFragment(shader.fragmentShader, THREE.ShaderChunk.normal_fragment_begin); };
    return m;
  }, [geometry, texture]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); texture?.dispose(); }, [geometry, material, texture]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const cache = useRef(new Map<string, Clump[]>());
  const state = useRef({ cx: Infinity, cz: Infinity, drawn: "" });
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);

  useFrame(({ camera }) => {
    const m = mesh.current;
    if (!m || !reach.chunks) return;
    const { cx, cz } = chunkOf(camera.position.x, camera.position.z);
    const wanted = chunksAround(camera.position.x, camera.position.z, reach.chunks);
    // generate a couple of missing chunks, nearest first
    let made = 0;
    for (const c of wanted) {
      if (made >= GEN_PER_FRAME) break;
      const k = key(c.cx, c.cz);
      if (!cache.current.has(k)) { cache.current.set(k, chunkClumps(c.cx, c.cz, reach.density)); made++; }
    }
    // forget chunks well out of reach
    if (cache.current.size > wanted.length * 2) for (const k of cache.current.keys()) {
      const [a, b] = k.split(",").map(Number);
      if (Math.abs(a! - cx) > reach.chunks + 2 || Math.abs(b! - cz) > reach.chunks + 2) cache.current.delete(k);
    }
    const ready = wanted.filter((c) => cache.current.has(key(c.cx, c.cz)));
    const sig = `${cx},${cz}:${ready.length}`;
    if (sig === state.current.drawn) return;
    state.current = { cx, cz, drawn: sig };
    let n = 0;
    for (const c of ready) for (const cl of cache.current.get(key(c.cx, c.cz))!) {
      if (n >= capacity) break;
      tmp.position.set(cl.x, cl.y - 0.06, cl.z); tmp.rotation.set(0, cl.r, 0); tmp.scale.set(cl.w, cl.h, cl.w); tmp.updateMatrix();
      m.setMatrixAt(n, tmp.matrix); m.setColorAt(n, col.set(cl.color)); n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  if (!reach.chunks) return null;
  return <instancedMesh ref={mesh} name="grass-field" args={[geometry, material, capacity]} frustumCulled={false} receiveShadow />;
}
