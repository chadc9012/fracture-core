import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { equipmentCase } from "@/game/camp-geometry";
import { isTouchDevice } from "@/game/client-input";
import { arenaParapets, fractureAt, shifterLift, surfaceAt, type KillboxArena as Arena } from "@/game/killbox-arenas";
import { sandstoneFormation } from "@/game/organic-geometry";
import type { PvpState } from "@/game/pvp";
import { antennaMast, hvacUnit, latticePylon, waterTank } from "@/game/street-geometry";
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";
import { floorStrip, hazardTexture, jerseyBarrier, shippingContainer, slab } from "./arena-parts";

/** Solara Outpost (killbox-arenas.ts SOLARA_OUTPOST), after the owner's PvP maps board: the first day map — a solar relay outpost
 * on a sandstone mesa in the Solara desert under a hot blue sky. It brings its own sky (the arena hangs in its own airspace) and a
 * high white sun. A sandy yard with concrete pads and painted lines; the relay deck is a steel platform with hazard edges and
 * ramps; the habs are white prefab modules with an orange band and lit windows; solar panel arrays on posts, a water tank, a
 * generator, a tan container, crates and barriers. Beyond the edge: the mesa's banded cliffs, a desert floor with buttes and
 * spires, a relay pylon and a dish mast, and a solar tower with its mirror field. In the Solar Flare the sky burns white, the
 * panels fold flat on their hinges and silver heat shields rise out of the yard. */

const SKY = { top: "#2f6db8", mid: "#8fbde2", low: "#f0d7ad", sun: "#fff3d6" } as const;
const SUN_DIR = new THREE.Vector3(0.35, 0.78, -0.5).normalize();
const DESERT = 60; // the desert floor lies this far below the arena base
const FORMATIONS: readonly [number, number, "butte" | "mesa" | "spire", number, number][] = [
  [-150, 120, "butte", 40, 70], [-60, 190, "mesa", 70, 55], [110, 170, "spire", 18, 85], [190, 40, "butte", 45, 75],
  [150, -130, "mesa", 65, 60], [40, -200, "spire", 20, 90], [-130, -160, "butte", 38, 65], [-210, -30, "mesa", 60, 50],
];
const MIRRORS = 140; // heliostats round the solar tower

/** sand with drift ripples, for the yard (world triplanar) */
function sandTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#cfae7c"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) { const v = 150 + Math.random() * 80; x.fillStyle = `rgba(${v},${v * 0.82},${v * 0.6},0.35)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1); }
  x.globalAlpha = 0.18; x.strokeStyle = "#8a6a44"; x.lineWidth = 2;
  for (let y = 0; y < 256; y += 14) { x.beginPath(); for (let k = 0; k <= 256; k += 8) x.lineTo(k, y + Math.sin(k / 22 + y) * 3); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
/** a solar panel face: dark blue cells in a silver grid */
function cellTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#c8ccd4"; x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 12; i++) for (let j = 0; j < 6; j++) { const g = x.createLinearGradient(0, j * 21, 0, j * 21 + 20); g.addColorStop(0, "#1d3f78"); g.addColorStop(1, "#0d2148"); x.fillStyle = g; x.fillRect(i * 21.3 + 1, j * 21.3 + 1, 19.5, 19.5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function SolaraOutpostView({ arena: a, state }: { arena: Arena; state: PvpState }) {
  const { x: sx, z: sz } = a.site, B = a.base;
  const phone = useMemo(() => isTouchDevice(), []);
  const plain = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k); return n; };

  const geo = useMemo(() => {
    const W = (dx: number, dz: number) => ({ x: sx + dx, z: sz + dz });
    const yard = a.roofs.find((r) => r.id === "yard")!, deck = a.roofs.find((r) => r.id === "relay-deck")!, habs = a.roofs.filter((r) => r.id.startsWith("hab"));
    // the mesa: a banded sandstone table under the yard, its cap just below the yard so the sand carries on past the parapets
    // the mesa: banded sandstone terraces stepping out as they go down to the desert, so the yard's edges stand on rock all round
    const strata: THREE.BufferGeometry[][] = [[], []];
    const layers = 6, lh = (DESERT + 20) / layers;
    for (let i = 0; i < layers; i++) {
      const grow = i * 3.5 + (i ? 2 : 0.5), top = B + 20 - 0.05 - i * lh;
      strata[i % 2]!.push(slab(sx, top - lh / 2, sz, yard.x1 - yard.x0 + grow * 2, lh, yard.z1 - yard.z0 + grow * 2));
    }
    const mesa = mergeGeometries(strata[0]!)!, cliff = mergeGeometries(strata[1]!)!;
    const formations = mergeGeometries(FORMATIONS.map(([dx, dz, kind, r, h], i) => sandstoneFormation(11 + i * 3, kind).scale(r, h, r * 0.8).rotateY(i).translate(sx + dx, B - DESERT - 2, sz + dz)))!;
    const sand = mergeGeometries([new THREE.PlaneGeometry(yard.x1 - yard.x0, yard.z1 - yard.z0).rotateX(-Math.PI / 2).translate(sx, B + yard.top + 0.01, sz)])!;
    const desert = new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2).translate(sx, B - DESERT, sz);
    // concrete pads under the deck, the habs and each spawn, and painted guide lines
    const pads: THREE.BufferGeometry[] = [];
    for (const [x0, x1, z0, z1] of [[-14, 14, -12, 12], [-33, -17, 2, 23], [17, 33, -23, -2], [-10, 10, 23, 29], [-10, 10, -29, -23]] as const) { const c = W((x0 + x1) / 2, (z0 + z1) / 2); pads.push(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate(c.x, B + 20.02, c.z)); }
    const lines: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) { lines.push(floorStrip(sx - 13.5, sz + s * 11.5, sx + 13.5, sz + s * 11.5, 0.15, B + 20.03)); lines.push(floorStrip(sx + s * 13.5, sz - 11.5, sx + s * 13.5, sz + 11.5, 0.15, B + 20.03)); }
    // the relay deck: a steel platform on legs, a plate top, hazard stripes round its lip
    const steel: THREE.BufferGeometry[] = [];
    const dc = W(0, 0), dw = deck.x1 - deck.x0, dd = deck.z1 - deck.z0, dh = deck.top - yard.top;
    steel.push(plain(slab(dc.x, B + deck.top - 0.25, dc.z, dw, 0.5, dd)));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]] as const) steel.push(plain(slab(dc.x + x * (dw / 2 - 0.3), B + yard.top + (dh - 0.5) / 2, dc.z + z * (dd / 2 - 0.3), 0.4, dh - 0.5, 0.4)));
    for (const s of [-1, 1]) steel.push(plain(slab(dc.x, B + yard.top + dh * 0.45, dc.z + s * (dd / 2 - 0.3), dw - 0.6, 0.2, 0.2)), plain(slab(dc.x + s * (dw / 2 - 0.3), B + yard.top + dh * 0.45, dc.z, 0.2, 0.2, dd - 0.6)));
    const deckTop = new THREE.PlaneGeometry(dw, dd).rotateX(-Math.PI / 2).translate(dc.x, B + deck.top + 0.01, dc.z);
    const stripes: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) { stripes.push(floorStrip(dc.x - dw / 2, dc.z + s * (dd / 2 - 0.3), dc.x + dw / 2, dc.z + s * (dd / 2 - 0.3), 0.5, B + deck.top + 0.02)); stripes.push(floorStrip(dc.x + s * (dw / 2 - 0.3), dc.z - dd / 2 + 0.6, dc.x + s * (dw / 2 - 0.3), dc.z + dd / 2 - 0.6, 0.5, B + deck.top + 0.02)); }
    // ramps and stairs: sloped plates with tread strips, steel steps, handrails
    const rails: THREE.BufferGeometry[] = [];
    for (const k of a.walks) {
      const c = W(k.x, k.z), rise = k.topB - k.top, ax = k.along === "x", lo = Math.min(k.top, k.topB), stair = k.width < 3.5;
      if (stair) {
        const n = Math.max(2, Math.round(Math.abs(rise) / 0.25)), run = k.length / n;
        for (let i = 0; i < n; i++) { const s = -k.length / 2 + (i + 0.5) * run, h = k.top + rise * ((i + 1) / n); steel.push(plain(slab(c.x + (ax ? s : 0), B + lo + (h - lo) / 2, c.z + (ax ? 0 : s), ax ? run + 0.01 : k.width, Math.max(0.05, h - lo), ax ? k.width : run + 0.01))); }
      } else {
        const len = Math.hypot(k.length, rise), tilt = Math.atan2(rise, k.length), plate = new THREE.BoxGeometry(ax ? len : k.width, 0.2, ax ? k.width : len);
        if (ax) plate.rotateZ(tilt); else plate.rotateX(-tilt);
        steel.push(plain(plate.translate(c.x, B + (k.top + k.topB) / 2 - 0.1, c.z)));
        const legs = 3;
        for (let i = 1; i <= legs; i++) { const s = -k.length / 2 + (i / (legs + 1)) * k.length, h = k.top + rise * (i / (legs + 1)) - yard.top; for (const side of [-1, 1]) steel.push(plain(slab(c.x + (ax ? s : side * (k.width / 2 - 0.2)), B + yard.top + h / 2, c.z + (ax ? side * (k.width / 2 - 0.2) : s), 0.25, h, 0.25))); }
      }
      for (const side of [-1, 1]) {
        const ox = ax ? 0 : side * (k.width / 2 - 0.08), oz = ax ? side * (k.width / 2 - 0.08) : 0, len = Math.hypot(k.length, rise), tilt = Math.atan2(rise, k.length);
        const tube = new THREE.BoxGeometry(ax ? len : 0.06, 0.06, ax ? 0.06 : len);
        if (ax) tube.rotateZ(tilt); else tube.rotateX(-tilt);
        rails.push(plain(tube.translate(c.x + ox, B + (k.top + k.topB) / 2 + 1, c.z + oz)));
        for (let i = 0; i <= 4; i++) { const s = -k.length / 2 + (i / 4) * k.length, h = k.top + rise * (i / 4); rails.push(plain(slab(c.x + ox + (ax ? s : 0), B + h + 0.5, c.z + oz + (ax ? 0 : s), 0.06, 1, 0.06))); }
      }
    }
    // the habs: white prefab modules up to their roofs, an orange band, a window strip on the long walls and a door by the stair
    const habBody: THREE.BufferGeometry[] = [], band: THREE.BufferGeometry[] = [], windows: THREE.BufferGeometry[] = [];
    for (const r of habs) {
      const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), w = r.x1 - r.x0, d = r.z1 - r.z0, h = r.top - yard.top;
      habBody.push(plain(slab(c.x, B + yard.top + h / 2, c.z, w, h, d)), plain(slab(c.x, B + r.top + 0.12, c.z, w + 0.3, 0.24, d + 0.3)));
      band.push(plain(slab(c.x, B + yard.top + h * 0.72, c.z, w + 0.04, 0.35, d + 0.04)));
      for (const s of [-1, 1]) windows.push(plain(slab(c.x + s * (w / 2 + 0.02), B + yard.top + h * 0.45, c.z, 0.02, 0.9, d * 0.7)));
    }
    // parapets: a low tan concrete wall with a steel rail on top
    const parapets = arenaParapets(a);
    const wall = mergeGeometries(parapets.map((p) => { const len = Math.hypot(p.bx - p.ax, p.bz - p.az), yaw = Math.atan2(p.bx - p.ax, p.bz - p.az); return new THREE.BoxGeometry(0.4, 0.7, len).rotateY(yaw).translate((p.ax + p.bx) / 2, p.base + 0.5 + 0.35, (p.az + p.bz) / 2); }))!;
    for (const p of parapets) {
      const len = Math.hypot(p.bx - p.ax, p.bz - p.az), yaw = Math.atan2(p.bx - p.ax, p.bz - p.az), n = Math.max(1, Math.round(len / 3));
      rails.push(plain(new THREE.BoxGeometry(0.06, 0.06, len).rotateY(yaw).translate((p.ax + p.bx) / 2, p.base + 0.5 + 1.1, (p.az + p.bz) / 2)));
      for (let i = 0; i <= n; i++) { const t = i / n; rails.push(plain(slab(p.ax + (p.bx - p.ax) * t, p.base + 0.5 + 0.9, p.az + (p.bz - p.az) * t, 0.06, 0.4, 0.06))); }
    }
    // beyond the edge: a relay pylon and a dish mast on the mesa's shoulders, the solar tower and its mirror field on the desert floor
    const towers: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) { const p = W(s * 48, -s * 6); towers.push(plain(latticePylon(26).rotateY(Math.PI / 2).translate(p.x, B + 19.6, p.z))); const q = W(-s * 44, s * 24); towers.push(plain(antennaMast(16).translate(q.x, B + 19.6, q.z))); }
    const st = W(-90, -330);
    towers.push(plain(new THREE.CylinderGeometry(4, 6, 150, 24).translate(st.x, B - DESERT + 75, st.z)), plain(new THREE.CylinderGeometry(7, 7, 14, 24).translate(st.x, B - DESERT + 150, st.z)));
    const receiver = new THREE.CylinderGeometry(6.2, 6.2, 10, 24).translate(st.x, B - DESERT + 150, st.z);
    const mirrors: THREE.BufferGeometry[] = [];
    for (let i = 0; i < MIRRORS; i++) {
      const ring = 30 + Math.floor(i / 20) * 14, ang = (i % 20) / 20 * Math.PI * 2 + ring, mx = st.x + Math.cos(ang) * ring, mz = st.z + Math.sin(ang) * ring;
      mirrors.push(plain(new THREE.BoxGeometry(5, 0.12, 4).rotateX(-0.6).rotateY(Math.atan2(st.x - mx, st.z - mz)).translate(mx, B - DESERT + 3, mz)), plain(slab(mx, B - DESERT + 1.4, mz, 0.2, 2.8, 0.2)));
    }
    const sky = new THREE.SphereGeometry(900, 32, 16).translate(sx, B, sz);
    return {
      mesa, cliff, formations, sand, desert, pads: mergeGeometries(pads)!, lines: mergeGeometries(lines)!, steel: mergeGeometries(steel)!, deckTop, stripes: mergeGeometries(stripes)!,
      rails: mergeGeometries(rails)!, habBody: mergeGeometries(habBody)!, band: mergeGeometries(band)!, windows: mergeGeometries(windows)!, wall, towers: mergeGeometries(towers)!, receiver,
      mirrors: mergeGeometries(mirrors)!, sky, box: new THREE.BoxGeometry(1, 1, 1), plane: new THREE.PlaneGeometry(1, 1),
      tank: waterTank(), hvac: hvacUnit(), container: shippingContainer(), crate: equipmentCase(), barrier: jerseyBarrier(),
    };
  }, [a, sx, sz, B]); // eslint-disable-line react-hooks/exhaustive-deps

  const mats = useMemo(() => {
    const concrete = weatheredConcreteTexture(), hazard = hazardTexture(), sandTex = sandTexture(), cells = cellTexture();
    const sky = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(SKY.top) }, mid: { value: new THREE.Color(SKY.mid) }, low: { value: new THREE.Color(SKY.low) }, sun: { value: new THREE.Color(SKY.sun) }, sunDir: { value: SUN_DIR.clone() }, flare: { value: 0 } },
      vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position - cameraPosition); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }",
      fragmentShader: `uniform vec3 top, mid, low, sun; uniform vec3 sunDir; uniform float flare; varying vec3 vDir;
        void main() { float h = vDir.y; vec3 c = mix(mix(low, mid, smoothstep(-0.05, 0.25, h)), top, smoothstep(0.2, 0.9, h));
          float s = max(dot(normalize(vDir), sunDir), 0.0); c += sun * (pow(s, 900.0) * 3.0 + pow(s, 24.0) * (0.25 + flare * 1.5) + pow(s, 3.0) * flare * 0.8);
          c = mix(c, vec3(1.0, 0.97, 0.9), flare * 0.55); gl_FragColor = vec4(c, 1.0); }`,
    });
    return {
      sky,
      mesa: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
      cliff: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#b8754a", roughness: 0.95 }), concrete, 6),
      cliffB: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#c98f5e", roughness: 0.95 }), concrete, 6),
      sand: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#d9c09a", roughness: 0.95 }), sandTex, 6),
      desert: new THREE.MeshStandardMaterial({ color: "#c9a06a", roughness: 1 }),
      pad: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#b5ada0", roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1 }), concrete, 3),
      line: new THREE.MeshStandardMaterial({ color: "#e8c23a", roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
      steel: new THREE.MeshStandardMaterial({ color: "#7d8590", roughness: 0.45, metalness: 0.75 }),
      deckTop: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#6e747c", roughness: 0.55, metalness: 0.6 }), concrete, 1.5),
      stripe: new THREE.MeshStandardMaterial({ color: "#ffffff", map: hazard, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
      rail: new THREE.MeshStandardMaterial({ color: "#d9dde3", roughness: 0.4, metalness: 0.7 }),
      hab: new THREE.MeshStandardMaterial({ color: "#cfcac0", roughness: 0.6, metalness: 0.1 }),
      band: new THREE.MeshStandardMaterial({ color: "#e0672a", roughness: 0.5 }),
      window: new THREE.MeshStandardMaterial({ color: "#1a2a36", emissive: "#7fd8ff", emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.6 }),
      wall: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#c8b496", roughness: 0.9 }), concrete, 2),
      tower: new THREE.MeshStandardMaterial({ color: "#c6c8cc", roughness: 0.5, metalness: 0.5 }),
      receiver: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#fff2c8", emissiveIntensity: 3, toneMapped: false }),
      mirror: new THREE.MeshStandardMaterial({ color: "#a8c4e0", roughness: 0.05, metalness: 1 }),
      tank: new THREE.MeshStandardMaterial({ color: "#d8d2c4", roughness: 0.5, metalness: 0.4 }),
      hvac: new THREE.MeshStandardMaterial({ color: "#a8aca8", roughness: 0.5, metalness: 0.5 }),
      container: new THREE.MeshStandardMaterial({ color: "#b98a4e", roughness: 0.6, metalness: 0.4 }),
      crate: new THREE.MeshStandardMaterial({ color: "#6a5c40", roughness: 0.7, metalness: 0.3 }),
      barrier: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#c9c2b4", roughness: 0.85 }), concrete, 2),
      cells: new THREE.MeshStandardMaterial({ color: "#ffffff", map: cells, roughness: 0.15, metalness: 0.6, side: THREE.DoubleSide }),
      shield: new THREE.MeshStandardMaterial({ color: "#e6e8ec", emissive: "#ff9a3a", emissiveIntensity: 0, roughness: 0.12, metalness: 1 }),
      slot: new THREE.MeshStandardMaterial({ color: "#3a3630", roughness: 0.6, metalness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
  }, []);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose());
    for (const m of Object.values(mats)) { const s = m as THREE.MeshStandardMaterial; s.map?.dispose(); s.dispose(); }
  }, [geo, mats]);

  const props = useMemo(() => a.cover.map((k) => ({ k, x: sx + k.x, y: B + surfaceAt(a, k.x, k.z), z: sz + k.z })), [a, sx, sz, B]);
  const shifters = useMemo(() => a.shifters.map((k) => ({ k, x: sx + k.x, y: B + surfaceAt(a, k.x, k.z), z: sz + k.z, panel: k.phase === "up" })), [a, sx, sz, B]);

  const moving = useRef<(THREE.Group | null)[]>([]), sun = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const t = state.clock, ev = fractureAt(a, t);
    shifters.forEach(({ k, panel }, i) => {
      const g = moving.current[i]; if (!g) return;
      const lift = shifterLift(a, k, t);
      // panels fold down on their hinge (standing tilted toward the sun, flat in the flare); heat shields rise out of their slots
      if (panel) g.rotation.x = -(0.3 + (1 - lift) * 1.26); else { g.position.y = (lift - 1) * (k.h + 0.05); g.visible = lift > 0.01; }
    });
    const flare = ev.active ? ev.strength : ev.warning ? 0.08 + 0.08 * Math.sin(performance.now() / 120) : 0;
    (mats.sky.uniforms["flare"] as { value: number }).value = flare;
    if (sun.current) sun.current.intensity = 1.7 + flare * 3;
    mats.shield.emissiveIntensity = flare * 0.8;
  });

  const sunTarget = useMemo(() => { const o = new THREE.Object3D(); o.position.set(sx, B, sz); return o; }, [sx, sz, B]);
  const sunPos = SUN_DIR.clone().multiplyScalar(300);
  return (
    <group name="killbox-arena:solara-outpost">
      {/* drawn at the far plane after the world's own sky, so the outpost's day sky wins wherever no geometry stands in front */}
      <mesh geometry={geo.sky} material={mats.sky} renderOrder={1} frustumCulled={false} />
      <primitive object={sunTarget} />
      <directionalLight ref={sun} position={[sx + sunPos.x, B + sunPos.y, sz + sunPos.z]} target={sunTarget} color="#fff1d8" intensity={1.7} />
      <hemisphereLight args={["#bcd8ff", "#a0784a", phone ? 0.9 : 0.6]} />
      <mesh geometry={geo.desert} material={mats.desert} />
      <mesh geometry={geo.formations} material={mats.mesa} />
      <mesh geometry={geo.mesa} material={mats.cliffB} receiveShadow />
      <mesh geometry={geo.cliff} material={mats.cliff} />
      <mesh geometry={geo.sand} material={mats.sand} receiveShadow />
      <mesh geometry={geo.pads} material={mats.pad} receiveShadow />
      <mesh geometry={geo.lines} material={mats.line} />
      <mesh geometry={geo.steel} material={mats.steel} castShadow receiveShadow />
      <mesh geometry={geo.deckTop} material={mats.deckTop} receiveShadow />
      <mesh geometry={geo.stripes} material={mats.stripe} />
      <mesh geometry={geo.rails} material={mats.rail} castShadow />
      <mesh geometry={geo.habBody} material={mats.hab} castShadow receiveShadow />
      <mesh geometry={geo.band} material={mats.band} />
      <mesh geometry={geo.windows} material={mats.window} />
      <mesh geometry={geo.wall} material={mats.wall} castShadow receiveShadow />
      <mesh geometry={geo.towers} material={mats.tower} castShadow />
      <mesh geometry={geo.receiver} material={mats.receiver} />
      <mesh geometry={geo.mirrors} material={mats.mirror} />
      {props.map(({ k, x, y, z }) => {
        if (k.kind === "tank") return <mesh key={k.id} geometry={geo.tank} material={mats.tank} position={[x, y + k.h / 2, z]} scale={[k.w / 2, k.h, k.d / 2]} castShadow receiveShadow />;
        if (k.kind === "hvac") return <mesh key={k.id} geometry={geo.hvac} material={mats.hvac} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />;
        if (k.kind === "container") return <mesh key={k.id} geometry={geo.container} material={mats.container} position={[x, y, z]} rotation-y={k.w > k.d ? Math.PI / 2 : 0} scale={[Math.min(k.w, k.d), k.h, Math.max(k.w, k.d)]} castShadow receiveShadow />;
        if (k.kind === "crate") return <mesh key={k.id} geometry={geo.crate} material={mats.crate} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />;
        return <mesh key={k.id} geometry={geo.barrier} material={mats.barrier} position={[x, y, z]} rotation-y={k.d > k.w ? 0 : Math.PI / 2} scale={[Math.min(k.w, k.d), k.h, Math.max(k.w, k.d)]} castShadow receiveShadow />;
      })}
      {shifters.filter((s) => !s.panel).map(({ k, x, y, z }) => <mesh key={`slot:${k.id}`} geometry={geo.box} material={mats.slot} position={[x, y + 0.012, z]} scale={[k.w + 0.2, 0.02, k.d + 0.2]} />)}
      {shifters.map(({ k, x, y, z, panel }, i) => {
        const wide = k.w >= k.d, len = Math.max(k.w, k.d), thick = Math.min(k.w, k.d);
        return (
          <group key={k.id} position={[x, y, z]} rotation-y={wide ? 0 : Math.PI / 2}>
            {panel ? (<>
              {/* a solar array: posts and a hinge rail, the panel tilting on it (moving group) */}
              {[-1, 0, 1].map((s) => <mesh key={s} geometry={geo.box} material={mats.steel} position={[s * (len / 2 - 0.3), 0.2, 0]} scale={[0.12, 0.4, 0.12]} />)}
              <mesh geometry={geo.box} material={mats.steel} position-y={0.4} scale={[len, 0.1, 0.1]} />
              <group position-y={0.4} ref={(g) => { moving.current[i] = g; }}>
                <mesh geometry={geo.box} material={mats.cells} position={[0, (k.h - 0.4) / 2, 0]} scale={[len - 0.1, k.h - 0.4, 0.06]} castShadow receiveShadow />
                <mesh geometry={geo.box} material={mats.rail} position={[0, k.h - 0.42, 0]} scale={[len, 0.06, 0.1]} />
              </group>
            </>) : (
              <group ref={(g) => { moving.current[i] = g; }}>
                {/* a heat shield: a mirrored panel in a steel frame */}
                <mesh geometry={geo.box} material={mats.shield} position-y={k.h / 2} scale={[len - 0.2, k.h - 0.1, thick * 0.3]} castShadow receiveShadow />
                {[-1, 1].map((s) => <mesh key={s} geometry={geo.box} material={mats.steel} position={[s * (len / 2 - 0.08), k.h / 2, 0]} scale={[0.16, k.h, thick * 0.5]} />)}
                <mesh geometry={geo.box} material={mats.steel} position-y={k.h - 0.04} scale={[len, 0.1, thick * 0.5]} />
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}
