import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { equipmentCase } from "@/game/camp-geometry";
import { isTouchDevice } from "@/game/client-input";
import { arenaParapets, fractureAt, shifterLift, surfaceAt, type KillboxArena as Arena } from "@/game/killbox-arenas";
import { organicRock } from "@/game/organic-geometry";
import type { PvpState } from "@/game/pvp";
import { applyWorldTriplanar } from "@/game/weathered-surface";
import { ArenaWeather } from "./ArenaWeather";
import { floorStrip, jerseyBarrier, slab } from "./arena-parts";

/** Thalassia Dome (killbox-arenas.ts THALASSIA_DOME), after the owner's PvP maps board: an undersea research dome on the Thalassia
 * seabed. It brings its own ocean (a deep-water dome lit from the surface far above, light shafts slanting down). A ribbed glass dome
 * stands over white lab tile with teal guide lines and drifting caustics; the moon pool glows in the middle under its bridge; the
 * galleries are steel with glass balustrades and porthole lights; outside the glass: sand, coral heads, swaying kelp and schools of
 * fish circling the dome. Cover: lab benches with screens, a specimen tank of glowing fluid, columns, crates, barriers. In the
 * Pressure Breach the lights go alarm red and pulse, bubbles stream up through the labs, bulkheads rise out of the floor and the
 * glass partitions sink away. */

const DOME_R = 52; // the dome's radius at the floor (it is squashed to DOME_H tall)
const DOME_H = 34;
const POOL = 15; // the moon pool's water, m above the arena base
const FISH = 160;
const KELP = 70;
const CORAL: readonly [number, number, number, string][] = [
  [-62, 30, 4, "#ff7a6a"], [-48, 55, 3, "#ffb04a"], [20, 66, 5, "#c86aff"], [58, 38, 3.5, "#ff6aa8"], [66, -12, 4, "#4affd2"],
  [44, -52, 3, "#ffb04a"], [-14, -66, 5, "#ff7a6a"], [-58, -36, 4, "#c86aff"], [-70, 2, 3, "#4affd2"], [8, 74, 3, "#ff6aa8"],
];

/** moving light on the floor: a cell pattern of bright caustic lines */
function causticTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#000"; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "#ffffff"; x.lineCap = "round";
  for (let i = 0; i < 60; i++) {
    x.globalAlpha = 0.2 + Math.random() * 0.35; x.lineWidth = 1 + Math.random() * 2.5;
    const cx = Math.random() * 256, cy = Math.random() * 256, r = 10 + Math.random() * 22;
    x.beginPath(); for (let k = 0; k <= 7; k++) { const a = (k / 7) * Math.PI * 2, rr = r * (0.7 + Math.random() * 0.5); x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); return t;
}
/** lab tile: white 1 m squares with grout */
function tileTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#8a949c"; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const v = 214 + Math.random() * 20; x.fillStyle = `rgb(${v},${v + 4},${v + 6})`; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
/** a lab screen: readouts and a waveform */
function screenTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#03141c"; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = "#4affd2"; x.lineWidth = 3; x.beginPath(); for (let k = 0; k <= 256; k += 4) x.lineTo(k, 70 + Math.sin(k / 14) * 18 + Math.sin(k / 5) * 5); x.stroke();
  x.fillStyle = "#7fe8ff"; for (let i = 0; i < 6; i++) x.fillRect(12, 10 + i * 7, 30 + Math.random() * 60, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function ThalassiaDomeView({ arena: a, state }: { arena: Arena; state: PvpState }) {
  const { x: sx, z: sz } = a.site, B = a.base;
  const phone = useMemo(() => isTouchDevice(), []);
  const plain = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k); return n; };

  const geo = useMemo(() => {
    const W = (dx: number, dz: number) => ({ x: sx + dx, z: sz + dz });
    const floors = a.roofs.filter((r) => r.id.endsWith("floor")), galleries = a.roofs.filter((r) => r.id.endsWith("gallery"));
    // the floor slab (a 2 m plinth under the whole dome) and the walking surfaces
    const plinth = mergeGeometries(floors.map((r) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return plain(slab(c.x, B + 19, c.z, r.x1 - r.x0, 2, r.z1 - r.z0)); }))!;
    const tiles = mergeGeometries(floors.map((r) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(-Math.PI / 2).translate(c.x, B + r.top + 0.01, c.z); }))!;
    const ring = new THREE.RingGeometry(36, DOME_R + 2, 96, 1).rotateX(-Math.PI / 2).translate(sx, B + 19.98, sz);
    // teal guide lines round the pool and down the lanes
    const lines: THREE.BufferGeometry[] = [];
    for (const r of [7.5, 9.5]) for (const [ax, az, bx, bz] of [[-r, -r, r, -r], [r, -r, r, r], [r, r, -r, r], [-r, r, -r, -r]] as const) lines.push(floorStrip(sx + ax, sz + az, sx + bx, sz + bz, 0.1, B + 20.02));
    for (const s of [-1, 1]) lines.push(floorStrip(sx - 22, sz + s * 18, sx + 22, sz + s * 18, 0.08, B + 20.02));
    // the moon pool: its shaft walls down to the water, the water itself
    const pool: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) { pool.push(new THREE.PlaneGeometry(12, 5).rotateY(s > 0 ? Math.PI : 0).translate(sx, B + 17.5, sz + s * 6), new THREE.PlaneGeometry(12, 5).rotateY(s > 0 ? -Math.PI / 2 : Math.PI / 2).translate(sx + s * 6, B + 17.5, sz)); }
    const water = new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2).translate(sx, B + POOL, sz);
    // galleries: steel bodies up to their decks, porthole lights along their faces, stairs, glass balustrades
    const steel: THREE.BufferGeometry[] = [], lights: THREE.BufferGeometry[] = [], rails: THREE.BufferGeometry[] = [], glass: THREE.BufferGeometry[] = [];
    for (const r of galleries) {
      const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), w = r.x1 - r.x0, d = r.z1 - r.z0, h = r.top - 20, face = r.x0 < 0 ? r.x1 : r.x0;
      steel.push(plain(slab(c.x, B + 20 + h / 2, c.z, w, h, d)), plain(slab(c.x, B + r.top - 0.1, c.z, w + 0.2, 0.2, d + 0.2)));
      for (let z = r.z0 + 3; z <= r.z1 - 3; z += 4) lights.push(plain(new THREE.CircleGeometry(0.45, 32).rotateY(r.x0 < 0 ? Math.PI / 2 : -Math.PI / 2).translate(sx + face + (r.x0 < 0 ? 0.02 : -0.02), B + 20 + h * 0.55, sz + z)));
    }
    const deckTops = mergeGeometries(galleries.map((r) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(-Math.PI / 2).translate(c.x, B + r.top + 0.01, c.z); }))!;
    for (const k of a.walks) {
      const c = W(k.x, k.z), ax = k.along === "x", rise = k.topB - k.top, lo = Math.min(k.top, k.topB);
      if (rise === 0) steel.push(plain(slab(c.x, B + k.top - 0.25, c.z, ax ? k.length - 1 : k.width, 0.5, ax ? k.width : k.length - 1)));
      else {
        const n = Math.max(2, Math.round(Math.abs(rise) / 0.25)), run = k.length / n;
        for (let i = 0; i < n; i++) { const s = -k.length / 2 + (i + 0.5) * run, h = k.top + rise * ((i + 1) / n); steel.push(plain(slab(c.x + (ax ? s : 0), B + lo + (h - lo) / 2, c.z + (ax ? 0 : s), ax ? run + 0.01 : k.width, Math.max(0.05, h - lo), ax ? k.width : run + 0.01))); }
      }
      for (const side of [-1, 1]) {
        const ox = ax ? 0 : side * (k.width / 2 - 0.06), oz = ax ? side * (k.width / 2 - 0.06) : 0, len = Math.hypot(k.length, rise), tilt = Math.atan2(rise, k.length);
        const tube = new THREE.BoxGeometry(ax ? len : 0.06, 0.06, ax ? 0.06 : len); if (ax) tube.rotateZ(tilt); else tube.rotateX(-tilt);
        rails.push(plain(tube.translate(c.x + ox, B + (k.top + k.topB) / 2 + 1.05, c.z + oz)));
        const pane = new THREE.BoxGeometry(ax ? len : 0.03, 0.9, ax ? 0.03 : len); if (ax) pane.rotateZ(tilt); else pane.rotateX(-tilt);
        glass.push(plain(pane.translate(c.x + ox, B + (k.top + k.topB) / 2 + 0.55, c.z + oz)));
      }
    }
    for (const p of arenaParapets(a)) {
      const len = Math.hypot(p.bx - p.ax, p.bz - p.az), yaw = Math.atan2(p.bx - p.ax, p.bz - p.az), n = Math.max(1, Math.round(len / 2)), floor = p.base + 0.5;
      for (let i = 0; i <= n; i++) { const t = i / n; rails.push(plain(slab(p.ax + (p.bx - p.ax) * t, floor + 0.55, p.az + (p.bz - p.az) * t, 0.06, 1.1, 0.06))); }
      rails.push(plain(new THREE.BoxGeometry(0.08, 0.06, len).rotateY(yaw).translate((p.ax + p.bx) / 2, floor + 1.1, (p.az + p.bz) / 2)));
      glass.push(plain(new THREE.BoxGeometry(0.03, 0.95, len).rotateY(yaw).translate((p.ax + p.bx) / 2, floor + 0.55, (p.az + p.bz) / 2)));
    }
    // the dome: a squashed glass hemisphere with meridian and latitude ribs
    const dome = new THREE.SphereGeometry(DOME_R, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, DOME_H / DOME_R, 1).translate(sx, B + 19.8, sz);
    const ribs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 16; i++) ribs.push(plain(new THREE.TorusGeometry(DOME_R, 0.28, 8, 64, Math.PI).rotateY((i / 16) * Math.PI).scale(1, DOME_H / DOME_R, 1).translate(sx, B + 19.8, sz)));
    for (const f of [0.3, 0.6, 0.85]) { const y = DOME_H * f, r = DOME_R * Math.sqrt(1 - f * f); ribs.push(plain(new THREE.TorusGeometry(r, 0.25, 8, 96).rotateX(Math.PI / 2).translate(sx, B + 19.8 + y, sz))); }
    ribs.push(plain(new THREE.TorusGeometry(DOME_R, 0.6, 8, 96).rotateX(Math.PI / 2).translate(sx, B + 20, sz)));
    // outside: the seabed, coral heads, kelp
    const seabed = new THREE.PlaneGeometry(1400, 1400, 1, 1).rotateX(-Math.PI / 2).translate(sx, B + 19.6, sz);
    const coral = CORAL.map(([dx, dz, r], i) => plain(organicRock(1, 50 + i * 7, 2).scale(r, r * 0.8, r).translate(sx + dx, B + 19.6 + r * 0.3, sz + dz)));
    const kelp: THREE.BufferGeometry[] = [];
    for (let i = 0; i < KELP; i++) {
      const ang = i * 2.39996, rad = 58 + ((i * 53) % 40), h = 8 + ((i * 29) % 14);
      kelp.push(new THREE.PlaneGeometry(0.7, h, 1, 8).translate(0, h / 2, 0).rotateY(i).translate(sx + Math.cos(ang) * rad, B + 19.6, sz + Math.sin(ang) * rad));
    }
    const ocean = new THREE.SphereGeometry(900, 32, 16).translate(sx, B, sz);
    const shaft = new THREE.PlaneGeometry(10, 120).translate(0, 60, 0);
    const fish = new THREE.ConeGeometry(0.22, 0.9, 8).rotateX(Math.PI / 2);
    return {
      plinth, tiles, ring, lines: mergeGeometries(lines)!, pool: mergeGeometries(pool)!, water, steel: mergeGeometries(steel)!, lights: mergeGeometries(lights)!, deckTops,
      rails: mergeGeometries(rails)!, glass: mergeGeometries(glass)!, dome, ribs: mergeGeometries(ribs)!, seabed, coral, kelp: mergeGeometries(kelp)!, ocean, shaft, fish,
      box: new THREE.BoxGeometry(1, 1, 1), plane: new THREE.PlaneGeometry(1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 40), crate: equipmentCase(), barrier: jerseyBarrier(),
    };
  }, [a, sx, sz, B]); // eslint-disable-line react-hooks/exhaustive-deps

  const mats = useMemo(() => {
    const caustic = causticTexture(), tile = tileTexture(), screen = screenTexture();
    const ocean = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { alarm: { value: 0 } },
      vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position - cameraPosition); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }",
      fragmentShader: `uniform float alarm; varying vec3 vDir;
        void main() { float h = normalize(vDir).y; vec3 deep = vec3(0.004, 0.03, 0.06), mid = vec3(0.02, 0.17, 0.25), top = vec3(0.25, 0.62, 0.7);
          vec3 c = mix(mix(deep, mid, smoothstep(-0.3, 0.15, h)), top, smoothstep(0.3, 1.0, h)); c += vec3(0.6, 0.85, 0.8) * pow(max(h, 0.0), 12.0) * 0.6;
          c = mix(c, c * vec3(1.6, 0.4, 0.4), alarm * 0.5); gl_FragColor = vec4(c, 1.0); }`,
    });
    return {
      ocean,
      plinth: new THREE.MeshStandardMaterial({ color: "#3a4650", roughness: 0.5, metalness: 0.6 }),
      tile: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3, metalness: 0.05 }), tile, 2),
      caustic: new THREE.MeshBasicMaterial({ color: "#5fd8e8", map: caustic, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 }),
      line: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#2affd0", emissiveIntensity: 2, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      pool: new THREE.MeshStandardMaterial({ color: "#20303a", roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }),
      water: new THREE.MeshStandardMaterial({ color: "#062a3a", emissive: "#1aa8c8", emissiveMap: caustic, emissiveIntensity: 1.4, roughness: 0.05, metalness: 0.7 }),
      steel: new THREE.MeshStandardMaterial({ color: "#7c8894", roughness: 0.4, metalness: 0.75 }),
      deck: new THREE.MeshStandardMaterial({ color: "#5a6670", roughness: 0.45, metalness: 0.7 }),
      porthole: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#9ff4ff", emissiveIntensity: 2.2, toneMapped: false }),
      rail: new THREE.MeshStandardMaterial({ color: "#c8d2da", roughness: 0.3, metalness: 0.8 }),
      glass: new THREE.MeshStandardMaterial({ color: "#a8f0ff", roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.22, depthWrite: false }),
      dome: new THREE.MeshStandardMaterial({ color: "#7fd8e8", emissive: "#0a3848", emissiveIntensity: 0.4, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
      rib: new THREE.MeshStandardMaterial({ color: "#5c6874", roughness: 0.4, metalness: 0.8 }),
      seabed: new THREE.MeshStandardMaterial({ color: "#5e6a58", roughness: 1 }),
      kelp: new THREE.MeshStandardMaterial({ color: "#3a6a2a", roughness: 0.8, side: THREE.DoubleSide, emissive: "#0a2010" }),
      corals: CORAL.map(([, , , c]) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, emissive: c, emissiveIntensity: 0.15 })),
      shaft: new THREE.MeshBasicMaterial({ color: "#8ff0ff", transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
      fish: new THREE.MeshStandardMaterial({ color: "#c8d8e0", roughness: 0.3, metalness: 0.6 }),
      bench: new THREE.MeshStandardMaterial({ color: "#d8dde2", roughness: 0.4, metalness: 0.3 }),
      screen: new THREE.MeshStandardMaterial({ color: "#000", map: screen, emissive: "#ffffff", emissiveMap: screen, emissiveIntensity: 1.6, toneMapped: false }),
      tankGlass: new THREE.MeshStandardMaterial({ color: "#a8f0ff", roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.3, depthWrite: false }),
      fluid: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#4affa0", emissiveIntensity: 1.3, transparent: true, opacity: 0.75, toneMapped: false }),
      pillar: new THREE.MeshStandardMaterial({ color: "#c8ced4", roughness: 0.35, metalness: 0.5 }),
      crate: new THREE.MeshStandardMaterial({ color: "#d8a83a", roughness: 0.6, metalness: 0.3 }),
      barrier: new THREE.MeshStandardMaterial({ color: "#b8c0c8", roughness: 0.6, metalness: 0.2 }),
      partition: new THREE.MeshStandardMaterial({ color: "#9ff0ff", emissive: "#2affd0", emissiveIntensity: 0.15, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
      bulkhead: new THREE.MeshStandardMaterial({ color: "#6a727c", roughness: 0.45, metalness: 0.8 }),
      warn: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ff3a2a", emissiveIntensity: 2, toneMapped: false }),
      slot: new THREE.MeshStandardMaterial({ color: "#1c2228", roughness: 0.4, metalness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
  }, []);
  useEffect(() => () => {
    for (const [k, g] of Object.entries(geo)) { if (k === "coral") (g as THREE.BufferGeometry[]).forEach((x) => x.dispose()); else (g as THREE.BufferGeometry).dispose(); }
    mats.caustic.map?.dispose(); mats.screen.map?.dispose();
    for (const m of Object.values(mats)) for (const one of (Array.isArray(m) ? m : [m]) as THREE.Material[]) one.dispose();
  }, [geo, mats]);

  const props = useMemo(() => a.cover.map((k) => ({ k, x: sx + k.x, y: B + surfaceAt(a, k.x, k.z), z: sz + k.z })), [a, sx, sz, B]);
  const shifters = useMemo(() => a.shifters.map((k) => ({ k, x: sx + k.x, y: B + surfaceAt(a, k.x, k.z), z: sz + k.z, glass: k.phase === "up" })), [a, sx, sz, B]);
  // each fish's orbit round the dome: radius, height, speed, phase; three schools in different bands
  const fishOrbits = useMemo(() => Array.from({ length: FISH }, (_, i) => { const school = i % 3; return { r: 60 + school * 14 + ((i * 7) % 6), y: B + 24 + school * 8 + ((i * 13) % 5), w: (0.12 - school * 0.025) * (school === 1 ? -1 : 1), p: (school * 2.1) + ((i * 0.37) % 1.4) }; }), [B]);

  const moving = useRef<(THREE.Group | null)[]>([]), fishMesh = useRef<THREE.InstancedMesh>(null), bubbles = useRef<THREE.Group>(null), alarm = useRef<THREE.PointLight>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const t = state.clock, ev = fractureAt(a, t);
    shifters.forEach(({ k }, i) => {
      const g = moving.current[i]; if (!g) return;
      const lift = shifterLift(a, k, t);
      g.position.y = (lift - 1) * (k.h + 0.05); g.visible = lift > 0.01;
    });
    // caustics drift; fish circle; the alarm pulses red through the breach
    const c = mats.caustic.map; if (c) { c.offset.x = (c.offset.x + dt * 0.02) % 1; c.offset.y = (c.offset.y + dt * 0.013) % 1; }
    const m = fishMesh.current;
    if (m) {
      fishOrbits.forEach((f, i) => { const ang = f.p + t * f.w; tmp.position.set(sx + Math.cos(ang) * f.r, f.y + Math.sin(t * 0.7 + i) * 0.4, sz + Math.sin(ang) * f.r); tmp.rotation.set(0, -ang + (f.w > 0 ? Math.PI : 0), 0); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); });
      m.instanceMatrix.needsUpdate = true;
    }
    const red = ev.active ? 0.6 + 0.4 * Math.sin(performance.now() / 160) : ev.warning ? (Math.sin(performance.now() / 90) > 0 ? 0.8 : 0) : 0;
    mats.warn.emissiveIntensity = 0.3 + red * 3;
    (mats.ocean.uniforms["alarm"] as { value: number }).value = ev.active ? red : 0;
    if (alarm.current) alarm.current.intensity = red * 900;
    if (bubbles.current) bubbles.current.visible = ev.active;
  });

  const shafts = useMemo(() => [[-20, 10, 0.3], [15, -18, -0.25], [30, 25, 0.2], [-35, -25, -0.3], [5, 40, 0.15]] as const, []);
  return (
    <group name="killbox-arena:thalassia-dome">
      {/* drawn at the far plane after the world's own sky: the dome stands in its own deep water */}
      <mesh geometry={geo.ocean} material={mats.ocean} renderOrder={1} frustumCulled={false} />
      <hemisphereLight args={["#7fe0f0", "#1a3a48", phone ? 1.4 : 1]} />
      <directionalLight position={[sx + 40, B + 200, sz + 30]} color="#bff4ff" intensity={1.1} />
      {!phone && [[-18, 18], [18, -18], [18, 18], [-18, -18]].map(([dx, dz], i) => <pointLight key={i} position={[sx + dx!, B + 30, sz + dz!]} color="#cff8ff" intensity={600} distance={40} decay={2} />)}
      {!phone && <pointLight position={[sx, B + 17, sz]} color="#3ad8ff" intensity={400} distance={20} decay={2} />}
      <pointLight ref={alarm} position={[sx, B + 32, sz]} color="#ff3a2a" intensity={0} distance={70} decay={1.5} />
      <mesh geometry={geo.seabed} material={mats.seabed} receiveShadow />
      {geo.coral.map((g, i) => <mesh key={i} geometry={g} material={mats.corals[i]!} />)}
      <mesh geometry={geo.kelp} material={mats.kelp} />
      <mesh geometry={geo.plinth} material={mats.plinth} />
      <mesh geometry={geo.ring} material={mats.plinth} receiveShadow />
      <mesh geometry={geo.tiles} material={mats.tile} receiveShadow />
      <mesh geometry={geo.tiles} material={mats.caustic} />
      <mesh geometry={geo.lines} material={mats.line} />
      <mesh geometry={geo.pool} material={mats.pool} />
      <mesh geometry={geo.water} material={mats.water} />
      <mesh geometry={geo.steel} material={mats.steel} castShadow receiveShadow />
      <mesh geometry={geo.deckTops} material={mats.deck} receiveShadow />
      <mesh geometry={geo.lights} material={mats.porthole} />
      <mesh geometry={geo.rails} material={mats.rail} />
      <mesh geometry={geo.glass} material={mats.glass} />
      <mesh geometry={geo.ribs} material={mats.rib} />
      <mesh geometry={geo.dome} material={mats.dome} renderOrder={2} />
      {shafts.map(([dx, dz, tilt], i) => <mesh key={i} geometry={geo.shaft} material={mats.shaft} position={[sx + dx, B + 20, sz + dz]} rotation={[tilt, i * 0.9, tilt * 0.5]} />)}
      <instancedMesh ref={fishMesh} args={[geo.fish, mats.fish, FISH]} frustumCulled={false} />
      {props.map(({ k, x, y, z }) => {
        if (k.kind === "console") return (
          <group key={k.id} position={[x, y, z]} rotation-y={k.w >= k.d ? 0 : Math.PI / 2}>
            {/* a lab bench: a white worktop on a steel base, a screen on a stand at each face */}
            <mesh geometry={geo.box} material={mats.steel} position-y={k.h * 0.45} scale={[Math.max(k.w, k.d) - 0.1, k.h * 0.9, Math.min(k.w, k.d) - 0.2]} castShadow receiveShadow />
            <mesh geometry={geo.box} material={mats.bench} position-y={k.h - 0.04} scale={[Math.max(k.w, k.d), 0.08, Math.min(k.w, k.d)]} castShadow />
            {[-1, 1].map((s) => <mesh key={s} geometry={geo.plane} material={mats.screen} position={[s * 0.6, k.h + 0.35, 0]} rotation-y={s < 0 ? 0 : Math.PI} scale={[0.9, 0.5, 1]} />)}
          </group>
        );
        if (k.kind === "tank") return (
          <group key={k.id} position={[x, y, z]}>
            {/* a specimen tank: a glass cylinder of glowing fluid between steel caps */}
            <mesh geometry={geo.cyl} material={mats.steel} position-y={0.15} scale={[k.w / 2, 0.3, k.d / 2]} castShadow />
            <mesh geometry={geo.cyl} material={mats.fluid} position-y={k.h / 2} scale={[k.w / 2 - 0.15, k.h - 0.7, k.d / 2 - 0.15]} />
            <mesh geometry={geo.cyl} material={mats.tankGlass} position-y={k.h / 2} scale={[k.w / 2, k.h - 0.6, k.d / 2]} />
            <mesh geometry={geo.cyl} material={mats.steel} position-y={k.h - 0.15} scale={[k.w / 2, 0.3, k.d / 2]} castShadow />
          </group>
        );
        if (k.kind === "pillar") return (
          <group key={k.id} position={[x, y, z]}>
            <mesh geometry={geo.cyl} material={mats.pillar} position-y={k.h / 2} scale={[k.w / 2, k.h, k.d / 2]} castShadow receiveShadow />
            <mesh geometry={geo.cyl} material={mats.porthole} position-y={k.h * 0.7} scale={[k.w / 2 + 0.02, 0.1, k.d / 2 + 0.02]} />
          </group>
        );
        if (k.kind === "crate") return <mesh key={k.id} geometry={geo.crate} material={mats.crate} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />;
        return <mesh key={k.id} geometry={geo.barrier} material={mats.barrier} position={[x, y, z]} rotation-y={k.d > k.w ? 0 : Math.PI / 2} scale={[Math.min(k.w, k.d), k.h, Math.max(k.w, k.d)]} castShadow receiveShadow />;
      })}
      {shifters.map(({ k, x, y, z }) => <mesh key={`slot:${k.id}`} geometry={geo.box} material={mats.slot} position={[x, y + 0.012, z]} scale={[k.w + 0.2, 0.02, k.d + 0.2]} />)}
      {shifters.map(({ k, x, y, z, glass }, i) => {
        const wide = k.w >= k.d, len = Math.max(k.w, k.d), thick = Math.min(k.w, k.d);
        return (
          <group key={k.id} position={[x, y, z]}>
            <group ref={(g) => { moving.current[i] = g; }}>
              <group rotation-y={wide ? 0 : Math.PI / 2}>
                {glass ? (<>
                  {/* a glass partition in a white frame */}
                  <mesh geometry={geo.box} material={mats.partition} position-y={k.h / 2} scale={[len - 0.2, k.h - 0.15, 0.05]} />
                  {[-1, 1].map((s) => <mesh key={s} geometry={geo.box} material={mats.bench} position={[s * (len / 2 - 0.06), k.h / 2, 0]} scale={[0.12, k.h, 0.14]} castShadow />)}
                  <mesh geometry={geo.box} material={mats.bench} position-y={k.h - 0.05} scale={[len, 0.1, 0.14]} />
                </>) : (<>
                  {/* a bulkhead: a thick riveted steel door with a red warning band */}
                  <mesh geometry={geo.box} material={mats.bulkhead} position-y={k.h / 2} scale={[len, k.h, thick * 0.7]} castShadow receiveShadow />
                  <mesh geometry={geo.box} material={mats.warn} position-y={k.h - 0.25} scale={[len + 0.02, 0.12, thick * 0.72]} />
                  {[-1, 1].map((s) => <mesh key={s} geometry={geo.box} material={mats.rib} position={[s * (len / 2 + 0.04), k.h / 2, 0]} scale={[0.12, k.h + 0.1, thick * 0.8]} />)}
                </>)}
              </group>
            </group>
          </group>
        );
      })}
      <ArenaWeather kind="motes" center={{ x: sx, y: B + 20, z: sz }} count={phone ? 200 : 600} size={90} height={30} color="#bfefff" />
      <group ref={bubbles} visible={false}><ArenaWeather kind="motes" center={{ x: sx, y: B + 18, z: sz }} count={phone ? 500 : 1800} size={60} height={20} color="#e8fbff" /></group>
    </group>
  );
}
