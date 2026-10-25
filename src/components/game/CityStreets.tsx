import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NEON_POSTERS, NEXUS_POSTERS, posterTexture } from "./posters";
import { cityStreets, propsForTier, puddlesForTier, signalPhase, streetWalls, type Kerb, type Paint, type PaintKind, type PropKind, type Puddle, type Rect, type StreetCity, type StreetProp } from "@/game/city-streets";
import {
  NEON_PALETTE, NEXUS_PALETTE, benchGeometry, binGeometry, bollardGeometry, hydrantGeometry, planterFoliageGeometry, planterGeometry,
  shelterAdGeometry, shelterPosterGeometry, shelterGeometry, shelterGlassGeometry, signPostGeometry, signalHeadGeometry, signalMastGeometry, signalPoleGeometry,
} from "@/game/street-prop-geometry";
import { neonPlateauLevel, walkHeight } from "@/game/terrain";
import { clearWalls, setWalls } from "@/game/walls";
import { heavyShadows } from "@/game/perf-budget";
import type { RenderTier } from "@/game/performance";
import { lampLevel, worldLight } from "@/game/world-light";
import { streetTexture } from "./city-surface";
import { useInstances } from "./instancing";

/**
 * City street level (layout: src/game/city-streets.ts): dropped-kerb sidewalks, painted crossings, stop lines and (Neon)
 * lane lines, benches, bins, bollards, planters, hydrants, bus shelters, traffic signals that cycle and street-name signs,
 * plus Neon's rain puddles. Every paint stroke, kerb and slab is merged into one draped mesh per material, and every prop
 * kind is one InstancedMesh, so a whole city's street level is about twenty draw calls. Solid pieces collide as low walls.
 *
 * Heights: Nexus streets follow the terrain (walkHeight; the street shader mesh sits 8 cm above it), Neon City is one level
 * plateau (its asphalt disc sits 4 cm up; the sidewalk slabs here top out at 10 cm).
 */
type Look = { walk: number; paint: number; kerbTop: number; kerbLow: number; slab: boolean; kerb: string; kerbSide: string; paintGlow: number; colors: Record<PaintKind, string> };
const LOOK: Record<StreetCity, Look> = {
  nexus: { walk: 0.08, paint: 0.115, kerbTop: 0.22, kerbLow: 0.12, slab: false, kerb: "#a8a49a", kerbSide: "#7d7a72", paintGlow: 0,
    colors: { zebra: "#e8e4d8", stop: "#e8e4d8", centre: "#d9b23a", edge: "#e8e4d8", tactile: "#d4ad37" } },
  neon: { walk: 0.1, paint: 0.055, kerbTop: 0.2, kerbLow: 0.115, slab: true, kerb: "#5b606c", kerbSide: "#33363e", paintGlow: 0.12,
    colors: { zebra: "#dfe7f0", stop: "#dfe7f0", centre: "#e8b93a", edge: "#c9d3de", tactile: "#e2c23e" } },
};

const tmpC = new THREE.Color();
function pushQuad(pos: number[], nor: number[], colr: number[], idx: number[], pts: [number, number, number][], n: [number, number, number], c: THREE.Color, uv?: number[], uvs?: [number, number][]) {
  const b = pos.length / 3;
  for (const [i, p] of pts.entries()) { pos.push(...p); nor.push(...n); colr.push(c.r, c.g, c.b); if (uv && uvs) uv.push(...uvs[i]!); }
  idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
}
const geometry = (pos: number[], nor: number[], colr: number[], idx: number[], uv?: number[]) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colr, 3));
  if (uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
};

/** flat painted rectangles draped on the ground, corner by corner (so a crossing on a slope never floats or sinks) */
function paintGeometry(paint: readonly Paint[], look: Look, ground: (x: number, z: number) => number) {
  const pos: number[] = [], nor: number[] = [], colr: number[] = [], idx: number[] = [];
  const cols = Object.fromEntries(Object.entries(look.colors).map(([k, v]) => [k, new THREE.Color(v).convertSRGBToLinear()])) as Record<PaintKind, THREE.Color>;
  for (const p of paint) {
    const lift = p.kind === "tactile" ? look.walk + 0.018 : look.paint;
    const c = (sx: number, sz: number): [number, number, number] => { const x = p.x + sx * p.hx, z = p.z + sz * p.hz; return [x, ground(x, z) + lift, z]; };
    pushQuad(pos, nor, colr, idx, [c(-1, -1), c(1, -1), c(1, 1), c(-1, 1)], [0, 1, 0], cols[p.kind]);
  }
  return geometry(pos, nor, colr, idx);
}

/** boxes whose top and bottom follow the ground at each corner: kerb stones and (Neon) sidewalk slabs */
function draped(rects: readonly (Rect & { top: number })[], ground: (x: number, z: number) => number, top: string, side: string, withUv = false) {
  const pos: number[] = [], nor: number[] = [], colr: number[] = [], idx: number[] = [], uv: number[] = [];
  const ct = new THREE.Color(top).convertSRGBToLinear(), cs = new THREE.Color(side).convertSRGBToLinear();
  for (const r of rects) {
    const xs = [r.x - r.hx, r.x + r.hx], zs = [r.z - r.hz, r.z + r.hz];
    const g = (i: number, k: number) => ground(xs[i]!, zs[k]!);
    const T = (i: number, k: number): [number, number, number] => [xs[i]!, g(i, k) + r.top, zs[k]!];
    const B = (i: number, k: number): [number, number, number] => [xs[i]!, g(i, k) - 0.12, zs[k]!];
    const tuv = (i: number, k: number): [number, number] => [xs[i]! / 4, zs[k]! / 4];
    pushQuad(pos, nor, colr, idx, [T(0, 0), T(1, 0), T(1, 1), T(0, 1)], [0, 1, 0], ct, withUv ? uv : undefined, [tuv(0, 0), tuv(1, 0), tuv(1, 1), tuv(0, 1)]);
    const suv: [number, number][] = [[0, 0], [1, 0], [1, 0.05], [0, 0.05]];
    // sides, wound to face outward: -z, +x, +z, -x
    pushQuad(pos, nor, colr, idx, [B(0, 0), B(1, 0), T(1, 0), T(0, 0)], [0, 0, -1], cs, withUv ? uv : undefined, suv);
    pushQuad(pos, nor, colr, idx, [B(1, 0), B(1, 1), T(1, 1), T(1, 0)], [1, 0, 0], cs, withUv ? uv : undefined, suv);
    pushQuad(pos, nor, colr, idx, [B(1, 1), B(0, 1), T(0, 1), T(1, 1)], [0, 0, 1], cs, withUv ? uv : undefined, suv);
    pushQuad(pos, nor, colr, idx, [B(0, 1), B(0, 0), T(0, 0), T(0, 1)], [-1, 0, 0], cs, withUv ? uv : undefined, suv);
  }
  return geometry(pos, nor, colr, idx, withUv ? uv : undefined);
}

/** soft irregular puddle mask (a cluster of overlapping blobs) */
let puddleTex: THREE.CanvasTexture | null | undefined;
function puddleMask(): THREE.CanvasTexture | null {
  if (puddleTex !== undefined) return puddleTex;
  if (typeof document === "undefined") return (puddleTex = null);
  const S = 128, cv = document.createElement("canvas"); cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
  let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 9; k++) {
    const x = S * (0.3 + r() * 0.4), y = S * (0.3 + r() * 0.4), rad = S * (0.12 + r() * 0.16);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.7, "rgba(255,255,255,0.75)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }
  puddleTex = new THREE.CanvasTexture(cv);
  return puddleTex;
}

/** street-name blades: every name drawn once into a canvas atlas, each blade's two faces mapped to its row */
function signAtlas(names: readonly string[], neon: boolean) {
  if (typeof document === "undefined") return null;
  const cols = 2, RW = 512, RH = 98, rows = Math.ceil((names.length + 1) / cols);
  const cv = document.createElement("canvas"); cv.width = RW * cols; cv.height = RH * rows;
  const g = cv.getContext("2d")!;
  const cells = new Map<string, [number, number, number, number]>();
  const all = [...names, "\u0000"];
  all.forEach((n, i) => {
    const cx = (i % cols) * RW, cy = Math.floor(i / cols) * RH;
    g.fillStyle = neon ? "#07080d" : "#1d5a3b"; g.fillRect(cx, cy, RW, RH);
    if (n !== "\u0000") {
      g.strokeStyle = neon ? (i % 2 ? "#ff3fb4" : "#38e8ff") : "#f2f2ea"; g.lineWidth = 5; g.strokeRect(cx + 8, cy + 8, RW - 16, RH - 16);
      g.fillStyle = neon ? (i % 2 ? "#ff7fd0" : "#8ff3ff") : "#f4f4ee";
      g.font = "bold 52px 'Arial Narrow', Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(n, cx + RW / 2, cy + RH / 2 + 2, RW - 40);
    }
    // uv rect (u0, v0, u1, v1); canvas y runs down, texture v runs up
    cells.set(n, [cx / cv.width, 1 - (cy + RH) / cv.height, (cx + RW) / cv.width, 1 - cy / cv.height]);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, cells, blank: cells.get("\u0000")! };
}

function bladeGeometry(signs: readonly StreetProp[], y0: (p: StreetProp) => number, atlas: NonNullable<ReturnType<typeof signAtlas>>) {
  const geos: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const s of signs) for (const [k, name] of (s.names ?? []).entries()) {
    const g = new THREE.BoxGeometry(1.3, 0.25, 0.035);
    const uv = g.attributes["uv"] as THREE.BufferAttribute, [u0, v0, u1, v1] = atlas.cells.get(name) ?? atlas.blank, [b0, c0, b1, c1] = atlas.blank;
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z (four vertices each); the two big faces carry the name
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
      const i = f * 4 + v, su = uv.getX(i), sv = uv.getY(i);
      if (f === 4) uv.setXY(i, u0 + (u1 - u0) * su, v0 + (v1 - v0) * sv);
      else if (f === 5) uv.setXY(i, u0 + (u1 - u0) * su, v0 + (v1 - v0) * sv);
      else uv.setXY(i, (b0 + b1) / 2, (c0 + c1) / 2);
    }
    // blade 0 names the street running along x, so it lies along x; blade 1 along z, a little higher
    q.setFromAxisAngle(up, k === 0 ? 0 : Math.PI / 2);
    m.compose(new THREE.Vector3(s.x + (k === 0 ? 0.5 : 0), y0(s) + 2.92 + k * 0.27, s.z + (k === 0 ? 0 : 0.5)), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m); geos.push(g);
  }
  if (!geos.length) return null;
  const pos: number[] = [], nor: number[] = [], uvs: number[] = [], idx: number[] = [];
  for (const g of geos) {
    const b = pos.length / 3;
    pos.push(...(g.attributes["position"]!.array as Float32Array)); nor.push(...(g.attributes["normal"]!.array as Float32Array)); uvs.push(...(g.attributes["uv"]!.array as Float32Array));
    for (const i of g.index!.array as ArrayLike<number> as number[]) idx.push(b + i);
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  out.setIndex(idx); out.computeBoundingSphere();
  return out;
}

/** one prop kind: `cap` instances allocated once (the kind's full count), only the near `items` drawn */
function Props({ items, cap, geo, mat, y, shadow, glass }: { items: readonly StreetProp[]; cap: number; geo: THREE.BufferGeometry; mat: THREE.Material; y: (p: StreetProp) => number; shadow: boolean; glass?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances<StreetProp>(ref, items, (o, p) => { o.position.set(p.x, y(p), p.z); o.rotation.set(0, p.yaw, 0); });
  if (!cap) return null;
  return <instancedMesh ref={ref} args={[geo, mat, cap]} castShadow={shadow} receiveShadow={!glass} />;
}

/** furniture is drawn only this close to the camera (m); instanced meshes otherwise draw every copy in the city */
const PROP_REACH: Record<RenderTier, number> = { LOW: 65, MEDIUM: 95, HIGH: 130, ULTRA: 170 };
const KINDS: readonly PropKind[] = ["bench", "bin", "bollard", "planter", "hydrant", "shelter", "signal", "sign"];
const byKindOf = (list: readonly StreetProp[]) => {
  const m = Object.fromEntries(KINDS.map((k) => [k, [] as StreetProp[]])) as Record<PropKind, StreetProp[]>;
  for (const p of list) m[p.kind].push(p);
  return m;
};

export function CityStreets({ city, tier }: { city: StreetCity; tier: RenderTier }) {
  const s = useMemo(() => cityStreets(city), [city]);
  const look = LOOK[city], neon = city === "neon";
  const level = useMemo(() => (neon ? neonPlateauLevel() : 0), [neon]);
  const ground = useMemo(() => (neon ? () => level : walkHeight), [neon, level]);
  const baseY = (p: { x: number; z: number }) => ground(p.x, p.z) + look.walk;
  const shadow = heavyShadows(tier);
  const props = useMemo(() => propsForTier(s.props, tier), [s, tier]);
  const all = useMemo(() => byKindOf(props), [props]);
  // re-pick the near furniture when the camera has moved 10 m (checked a few times a second)
  const [eye, setEye] = useState<{ x: number; z: number } | null>(null);
  const eyeClock = useRef(1);
  useFrame(({ camera }, dt) => {
    eyeClock.current += dt;
    if (eyeClock.current < 0.4) return;
    eyeClock.current = 0;
    const c = camera.position;
    setEye((e) => (e && Math.hypot(c.x - e.x, c.z - e.z) < 10 ? e : { x: c.x, z: c.z }));
  });
  const reach = PROP_REACH[tier];
  const byKind = useMemo(() => byKindOf(eye ? props.filter((p) => Math.hypot(p.x - eye.x, p.z - eye.z) < reach) : []), [props, eye, reach]);
  const puddles = useMemo(() => puddlesForTier(s.puddles, tier), [s, tier]);

  // solid furniture collides as low walls while the street level is mounted
  useEffect(() => {
    const owner = `city-streets:${city}`;
    setWalls(owner, streetWalls(s.props, (x, z) => ground(x, z) + look.walk));
    return () => clearWalls(owner);
  }, [s, city, ground, look.walk]);

  const pal = neon ? NEON_PALETTE : NEXUS_PALETTE;
  const geo = useMemo(() => ({
    bench: benchGeometry(pal), bin: binGeometry(pal), bollard: bollardGeometry(pal), planter: planterGeometry(pal), foliage: planterFoliageGeometry(),
    hydrant: hydrantGeometry(pal), shelter: shelterGeometry(pal), glass: shelterGlassGeometry(), ad: shelterAdGeometry(), poster: shelterPosterGeometry(),
    pole: signalPoleGeometry(pal), mast: signalMastGeometry(pal), head: signalHeadGeometry(pal), lens: new THREE.CircleGeometry(0.1, 20),
    post: signPostGeometry(pal), ring: new THREE.CylinderGeometry(0.103, 0.103, 0.05, 20, 1, true),
    paint: paintGeometry(s.paint, look, ground),
    kerbs: draped(s.kerbs.map((k: Kerb) => ({ ...k, top: k.low ? look.kerbLow : look.kerbTop })), ground, look.kerb, look.kerbSide),
    slabs: look.slab ? draped(s.slabs.map((r) => ({ ...r, top: look.walk })), ground, "#ffffff", "#9a9aa2", true) : null,
  }), [s, pal, look, ground]);
  useEffect(() => () => { for (const g of Object.values(geo)) g?.dispose(); }, [geo]);

  const mat = useMemo(() => {
    const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
    const pav = streetTexture("/textures/pavers_col.jpg", true), pavN = streetTexture("/textures/pavers_nrm.jpg", false);
    return {
      iron: std({ roughness: neon ? 0.38 : 0.55, metalness: neon ? 0.7 : 0.45 }),
      furniture: std({ roughness: 0.62, metalness: 0.2 }),
      concrete: std({ roughness: neon ? 0.55 : 0.9, metalness: 0.02 }),
      foliage: std({ roughness: 0.9, metalness: 0 }),
      paint: std({ roughness: neon ? 0.35 : 0.62, metalness: 0, emissive: new THREE.Color("#ffffff"), emissiveIntensity: look.paintGlow, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
      kerb: std({ roughness: neon ? 0.45 : 0.85, metalness: neon ? 0.15 : 0.02 }),
      slab: new THREE.MeshStandardMaterial({ color: "#7d808c", map: pav ?? null, normalMap: pavN ?? null, roughness: 0.42, metalness: 0.18, polygonOffset: true, polygonOffsetFactor: -1 }),
      glass: new THREE.MeshStandardMaterial({ color: neon ? "#6a7c99" : "#b9d3df", transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide }),
      ad: new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
      lens: new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color("#38e8ff").multiplyScalar(1.6), toneMapped: false }),
      puddle: new THREE.MeshStandardMaterial({ color: "#1b1d26", roughness: 0.04, metalness: 0.92, envMapIntensity: 1.6, alphaMap: puddleMask() ?? null, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }),
    };
  }, [neon, look.paintGlow]);
  useEffect(() => () => { for (const m of Object.values(mat)) m.dispose(); }, [mat]);

  // signals: mast arms, hanging heads and the one lit lens per head
  const signals = byKind.signal, poles = useMemo(() => signals.filter((p) => !p.onPole), [signals]);
  const allPoles = useMemo(() => all.signal.filter((p) => !p.onPole).length, [all]);
  const nSignals = all.signal.length;
  const mast = useRef<THREE.InstancedMesh>(null), head = useRef<THREE.InstancedMesh>(null), lens = useRef<THREE.InstancedMesh>(null);
  const mastY = (p: StreetProp) => baseY(p) + (p.onPole ? 5.9 : 5.55);
  const tip = (p: StreetProp) => ({ x: p.x + Math.cos(p.yaw) * (p.reach ?? 3), z: p.z - Math.sin(p.yaw) * (p.reach ?? 3) });
  useInstances<StreetProp>(mast, signals, (o, p) => { o.position.set(p.x, mastY(p), p.z); o.rotation.set(0, p.yaw, 0); o.scale.set(p.reach ?? 3, 1, 1); });
  useInstances<StreetProp>(head, signals, (o, p) => { const t = tip(p); o.position.set(t.x, mastY(p) - 0.78, t.z); o.rotation.set(0, p.yaw, 0); });
  const phase = useRef("");
  useEffect(() => { phase.current = ""; }, [signals]);
  const tmpO = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const m = lens.current;
    if (!m) return;
    const ph = signalPhase(clock.elapsedTime), key = `${ph.green}${ph.amber}`;
    if (key === phase.current) return;
    phase.current = key;
    signals.forEach((p, i) => {
      const go = ph.green === p.axis, slot = go ? (ph.amber ? 0 : -0.32) : 0.32;
      const t = tip(p);
      tmpO.position.set(t.x + Math.sin(p.yaw) * 0.14, mastY(p) - 0.78 + slot, t.z + Math.cos(p.yaw) * 0.14);
      tmpO.rotation.set(0, p.yaw, 0); tmpO.scale.set(1, 1, 1); tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
      m.setColorAt(i, tmpC.set(go ? (ph.amber ? "#ffb21e" : "#3dff8a") : "#ff2a1e").multiplyScalar(2.2));
    });
    m.count = signals.length; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere();
  });

  // printed posters on both faces of each shelter advert (owner's Neon target frame), one design per shelter, stable by position
  const posterMats = useMemo(() => (neon ? NEON_POSTERS : NEXUS_POSTERS).map((d) => new THREE.MeshBasicMaterial({ map: posterTexture(d), toneMapped: false })), [neon]);
  useEffect(() => () => { for (const m of posterMats) m.dispose(); }, [posterMats]);
  const posterSets = useMemo(() => posterMats.map((_, k) => byKind.shelter.filter((p) => Math.abs(Math.round(p.x * 7.3 + p.z * 3.1)) % posterMats.length === k)), [byKind.shelter, posterMats]);
  // shelter adverts glow a little brighter at night
  const ad = useRef<THREE.InstancedMesh>(null);
  const adTints = neon ? ["#ff3fb4", "#38e8ff", "#b968ff", "#ff7a3a"] : ["#fff1d6", "#dff3ff", "#ffe3c4"];
  useInstances<StreetProp>(ad, byKind.shelter, (o, p) => { o.position.set(p.x, baseY(p), p.z); o.rotation.set(0, p.yaw, 0); }, (_, i) => adTints[i % adTints.length]!);
  const seen = useRef(-1);
  useFrame(() => {
    const k = Math.round(lampLevel(worldLight.night) * 20) / 20;
    if (k === seen.current) return;
    seen.current = k;
    mat.ad.color.setScalar(neon ? 0.3 + k * 0.6 : 0.45 + k * 0.5);
    for (const m of posterMats) m.color.setScalar(0.55 + k * 0.85); // posters glow past white at night so the bloom catches them
  });

  // Neon bollards carry a lit ring
  const ring = useRef<THREE.InstancedMesh>(null);
  const ringItems = useMemo(() => (neon ? byKind.bollard : []), [neon, byKind.bollard]);
  useInstances<StreetProp>(ring, ringItems, (o, p) => { o.position.set(p.x, baseY(p) + 0.72, p.z); });

  const puddle = useRef<THREE.InstancedMesh>(null);
  useInstances<Puddle>(puddle, puddles, (o, p) => { o.position.set(p.x, ground(p.x, p.z) + 0.065, p.z); o.rotation.set(-Math.PI / 2, 0, p.yaw); o.scale.set(p.sx * 2, p.sz * 2, 1); });

  const atlas = useMemo(() => signAtlas([...new Set(all.sign.flatMap((p) => p.names ?? []))], neon), [all.sign, neon]);
  const blades = useMemo(() => (atlas ? bladeGeometry(byKind.sign, baseY, atlas) : null), [atlas, byKind.sign]); // eslint-disable-line react-hooks/exhaustive-deps
  const bladeMat = useMemo(() => atlas ? new THREE.MeshStandardMaterial({ map: atlas.tex, emissiveMap: atlas.tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: neon ? 0.9 : 0.22, roughness: 0.45, metalness: 0.25 }) : null, [atlas, neon]);
  useEffect(() => () => { blades?.dispose(); bladeMat?.dispose(); atlas?.tex.dispose(); }, [blades, bladeMat, atlas]);

  return (
    <group name={`city-streets:${city}`}>
      <mesh geometry={geo.paint} material={mat.paint} receiveShadow renderOrder={1} />
      <mesh geometry={geo.kerbs} material={mat.kerb} receiveShadow />
      {geo.slabs && <mesh geometry={geo.slabs} material={mat.slab} receiveShadow />}
      {puddles.length > 0 && <instancedMesh ref={puddle} args={[undefined, undefined, puddles.length]} material={mat.puddle} renderOrder={2}><planeGeometry args={[1, 1]} /></instancedMesh>}
      <Props items={byKind.bench} cap={all.bench.length} geo={geo.bench} mat={mat.furniture} y={baseY} shadow={shadow} />
      <Props items={byKind.bin} cap={all.bin.length} geo={geo.bin} mat={mat.iron} y={baseY} shadow={false} />
      <Props items={byKind.bollard} cap={all.bollard.length} geo={geo.bollard} mat={mat.iron} y={baseY} shadow={false} />
      <Props items={byKind.planter} cap={all.planter.length} geo={geo.planter} mat={mat.concrete} y={baseY} shadow={shadow} />
      <Props items={byKind.planter} cap={all.planter.length} geo={geo.foliage} mat={mat.foliage} y={baseY} shadow={shadow} />
      <Props items={byKind.hydrant} cap={all.hydrant.length} geo={geo.hydrant} mat={mat.iron} y={baseY} shadow={false} />
      <Props items={byKind.shelter} cap={all.shelter.length} geo={geo.shelter} mat={mat.iron} y={baseY} shadow={shadow} />
      <Props items={byKind.shelter} cap={all.shelter.length} geo={geo.glass} mat={mat.glass} y={baseY} shadow={false} glass />
      {all.shelter.length > 0 && <instancedMesh ref={ad} args={[geo.ad, mat.ad, all.shelter.length]} />}
      {all.shelter.length > 0 && posterMats.map((m, k) => <Props key={`poster${k}`} items={posterSets[k]!} cap={all.shelter.length} geo={geo.poster} mat={m} y={baseY} shadow={false} />)}
      <Props items={poles} cap={allPoles} geo={geo.pole} mat={mat.iron} y={baseY} shadow={shadow} />
      {nSignals > 0 && <>
        <instancedMesh ref={mast} args={[geo.mast, mat.iron, nSignals]} castShadow={shadow} />
        <instancedMesh ref={head} args={[geo.head, mat.iron, nSignals]} castShadow={shadow} />
        <instancedMesh ref={lens} args={[geo.lens, mat.lens, nSignals]} />
      </>}
      <Props items={byKind.sign} cap={all.sign.length} geo={geo.post} mat={mat.iron} y={baseY} shadow={false} />
      {blades && bladeMat && <mesh geometry={blades} material={bladeMat} />}
      {neon && all.bollard.length > 0 && <instancedMesh ref={ring} args={[geo.ring, mat.glow, all.bollard.length]} />}
    </group>
  );
}
