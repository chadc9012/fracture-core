import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { crystalShard, equipmentCase } from "@/game/camp-geometry";
import { isTouchDevice } from "@/game/client-input";
import { arenaParapets, fractureAt, shifterLift, surfaceAt, type KillboxArena as Arena } from "@/game/killbox-arenas";
import { organicRock } from "@/game/organic-geometry";
import type { PvpState } from "@/game/pvp";
import { hvacUnit, waterTank } from "@/game/street-geometry";
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";
import { ArenaWeather } from "./ArenaWeather";
import { floorStrip, jerseyBarrier, shippingContainer, slab } from "./arena-parts";

/** Frostveil Ring (killbox-arenas.ts FROSTVEIL_RING), after the owner's PvP maps board: a frozen ring of deck round a bottomless
 * shaft in the Frostveil, in icy twilight under the aurora (it brings its own sky). Frosted concrete with snow drifts against the
 * rails, icicles under the shaft's lip, the shaft's walls running down into a blue glow; the beacon platform stands on a column out
 * of the depths with the frozen beacon — a cluster of glowing ice crystal — turning in the air above it; lattice bridges; steel
 * watchtower cabins with lit windows; icy peaks all round; falling snow. Cover: snow-capped barriers, crates, a generator, a fuel
 * tank, a container. In the Whiteout the sky goes white, the snow comes in sideways, the heated screens' grilles go dark as they
 * sink, and walls of ice grow across the bridges. */

const SKY = { top: "#07102a", mid: "#22406e", low: "#8eaccc" } as const;
const MOON = new THREE.Vector3(-0.4, 0.55, 0.7).normalize();
const DEPTH = 110; // the shaft's glow lies this far below the arena base
const PEAKS: readonly [number, number, number, number][] = [
  [-240, 210, 45, 200], [-60, 320, 60, 240], [170, 280, 40, 190], [320, 80, 55, 220], [270, -170, 45, 200],
  [60, -320, 65, 250], [-180, -270, 45, 190], [-330, -30, 60, 230], [-360, 200, 40, 170], [380, -280, 50, 210],
];

/** frost on concrete: a pale bluish wash with crystal speckle */
function frostTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#c6d2de"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) { const v = 190 + Math.random() * 65; x.fillStyle = `rgba(${v - 10},${v},${Math.min(255, v + 12)},0.5)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 2); }
  x.globalAlpha = 0.25; x.strokeStyle = "#7f93a8"; x.lineWidth = 1;
  for (let i = 0; i < 40; i++) { x.beginPath(); let px = Math.random() * 256, py = Math.random() * 256; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (Math.random() - 0.5) * 30; py += (Math.random() - 0.5) * 30; x.lineTo(px, py); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
/** dark ice-bound rock with glowing blue veins, for the shaft walls */
function shaftTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#000"; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "#38c8ff"; x.shadowColor = "#38c8ff"; x.shadowBlur = 6;
  for (let i = 0; i < 26; i++) { x.globalAlpha = 0.3 + Math.random() * 0.5; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); let px = Math.random() * 256, py = Math.random() * 256; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (Math.random() - 0.5) * 40; py += Math.random() * 30; x.lineTo(px, py); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function FrostveilRingView({ arena: a, state }: { arena: Arena; state: PvpState }) {
  const { x: sx, z: sz } = a.site, B = a.base;
  const phone = useMemo(() => isTouchDevice(), []);
  const plain = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k); return n; };

  const geo = useMemo(() => {
    const W = (dx: number, dz: number) => ({ x: sx + dx, z: sz + dz });
    const arms = a.roofs.filter((r) => r.id.endsWith("arm")), beacon = a.roofs.find((r) => r.id === "beacon")!, towers = a.roofs.filter((r) => r.id.startsWith("tower"));
    // the ring's deck: a 2 m slab under every arm and the beacon platform, frosted on top
    const decks = mergeGeometries([...arms, beacon].map((r) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return plain(slab(c.x, B + r.top - 1, c.z, r.x1 - r.x0, 2, r.z1 - r.z0)); }))!;
    const tops = mergeGeometries([...arms, beacon].map((r) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(-Math.PI / 2).translate(c.x, B + r.top + 0.01, c.z); }))!;
    // the shaft: its four walls drop from just under the ring's inner lip into the glow; the ring's outer walls drop into the dark
    const inner = { x0: -20, x1: 20, z0: -18, z1: 18 }, outer = { x0: -32, x1: 32, z0: -30, z1: 30 };
    const wallsOf = (r: typeof inner, inward: boolean) => {
      const h = DEPTH + 18, y = B + 18 - h / 2, out: THREE.BufferGeometry[] = [], cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      for (const s of [-1, 1]) {
        const z = s < 0 ? r.z0 : r.z1, x = s < 0 ? r.x0 : r.x1, n = inward ? -s : s;
        out.push(new THREE.PlaneGeometry(r.x1 - r.x0, h).rotateY(n > 0 ? 0 : Math.PI).translate(sx + cx, y, sz + z));
        out.push(new THREE.PlaneGeometry(r.z1 - r.z0, h).rotateY(n > 0 ? Math.PI / 2 : -Math.PI / 2).translate(sx + x, y, sz + cz));
      }
      return out;
    };
    const shaft = mergeGeometries(wallsOf(inner, true))!, cliffs = mergeGeometries(wallsOf(outer, false))!;
    const glow = new THREE.PlaneGeometry(inner.x1 - inner.x0, inner.z1 - inner.z0).rotateX(-Math.PI / 2).translate(sx, B - DEPTH, sz);
    const abyss = new THREE.PlaneGeometry(2600, 2600).rotateX(-Math.PI / 2).translate(sx, B - DEPTH - 20, sz);
    // the beacon's column out of the depths, ribbed
    const bc = W(0, 0), column: THREE.BufferGeometry[] = [plain(new THREE.CylinderGeometry(3.4, 4.4, DEPTH + 18, 32).translate(bc.x, B + 18 - (DEPTH + 18) / 2, bc.z))];
    for (let y = -DEPTH + 6; y < 16; y += 9) column.push(plain(new THREE.TorusGeometry(3.6 + (16 - y) * 0.006, 0.18, 8, 40).rotateX(Math.PI / 2).translate(bc.x, B + y, bc.z)));
    // icicles under the shaft's inner lip and the beacon platform's edge
    const icicles: THREE.BufferGeometry[] = [];
    const fringe = (ax: number, az: number, bx: number, bz: number, y: number, seed: number) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 0.9);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, k = ((i * 37 + seed) % 11) / 11; icicles.push(plain(crystalShard(i + seed).scale(0.16, 0.6 + k * 1.6, 0.16).rotateX(Math.PI).translate(ax + (bx - ax) * t, y - (0.3 + k * 0.8), az + (bz - az) * t))); }
    };
    for (const [ax, az, bx, bz] of [[-20, -18, 20, -18], [-20, 18, 20, 18], [-20, -18, -20, 18], [20, -18, 20, 18]] as const) fringe(sx + ax, sz + az, sx + bx, sz + bz, B + 18, ax * 3 + az);
    for (const [ax, az, bx, bz] of [[-7, -6, 7, -6], [-7, 6, 7, 6]] as const) fringe(sx + ax, sz + az, sx + bx, sz + bz, B + 18, az * 5);
    // bridges: a steel deck with lattice girders each side
    const steel: THREE.BufferGeometry[] = [], rails: THREE.BufferGeometry[] = [];
    for (const k of a.walks) {
      const c = W(k.x, k.z), ax = k.along === "x", rise = k.topB - k.top;
      if (rise === 0) {
        steel.push(plain(slab(c.x, B + k.top - 0.35, c.z, ax ? k.length - 2 : k.width + 0.3, 0.7, ax ? k.width + 0.3 : k.length - 2)));
        for (const s of [-1, 1]) {
          const len = k.length - 2, n = Math.round(len / 2), off = s * (k.width / 2 + 0.08);
          for (const y of [0.05, 1.1]) steel.push(plain(slab(c.x + (ax ? 0 : off), B + k.top + y, c.z + (ax ? off : 0), ax ? len : 0.14, 0.12, ax ? 0.14 : len)));
          for (let i = 0; i <= n; i++) { const u = -len / 2 + (i / n) * len; steel.push(plain(slab(c.x + (ax ? u : off), B + k.top + 0.58, c.z + (ax ? off : u), 0.1, 1.05, 0.1))); }
          for (let i = 0; i < n; i++) {
            const u = -len / 2 + ((i + 0.5) / n) * len, d = Math.hypot(len / n, 1), ang = (i % 2 ? 1 : -1) * Math.atan2(1, len / n), g = new THREE.BoxGeometry(0.05, 0.05, d);
            if (ax) g.rotateY(Math.PI / 2).rotateZ(ang); else g.rotateX(ang);
            steel.push(plain(g.translate(c.x + (ax ? u : off), B + k.top + 0.6, c.z + (ax ? off : u))));
          }
        }
      } else {
        // the watchtower stairs: steel treads with handrails
        const n = Math.max(2, Math.round(Math.abs(rise) / 0.25)), run = k.length / n, lo = Math.min(k.top, k.topB);
        for (let i = 0; i < n; i++) { const s = -k.length / 2 + (i + 0.5) * run, h = k.top + rise * ((i + 1) / n); steel.push(plain(slab(c.x + (ax ? s : 0), B + lo + (h - lo) / 2, c.z + (ax ? 0 : s), ax ? run + 0.01 : k.width, Math.max(0.05, h - lo), ax ? k.width : run + 0.01))); }
        for (const side of [-1, 1]) {
          const ox = ax ? 0 : side * (k.width / 2 - 0.08), oz = ax ? side * (k.width / 2 - 0.08) : 0, len = Math.hypot(k.length, rise), tilt = Math.atan2(rise, k.length);
          const tube = new THREE.BoxGeometry(ax ? len : 0.06, 0.06, ax ? 0.06 : len);
          if (ax) tube.rotateZ(tilt); else tube.rotateX(-tilt);
          rails.push(plain(tube.translate(c.x + ox, B + (k.top + k.topB) / 2 + 1, c.z + oz)));
          for (let i = 0; i <= 4; i++) { const s = -k.length / 2 + (i / 4) * k.length, h = k.top + rise * (i / 4); rails.push(plain(slab(c.x + ox + (ax ? s : 0), B + h + 0.5, c.z + oz + (ax ? 0 : s), 0.06, 1, 0.06))); }
        }
      }
    }
    // rails on every parapet line, with a snow drift banked against their foot
    const drifts: THREE.BufferGeometry[] = [];
    for (const p of arenaParapets(a)) {
      const len = Math.hypot(p.bx - p.ax, p.bz - p.az), yaw = Math.atan2(p.bx - p.ax, p.bz - p.az), n = Math.max(1, Math.round(len / 1.5)), floor = p.base + 0.5;
      for (let i = 0; i <= n; i++) { const t = i / n; rails.push(plain(slab(p.ax + (p.bx - p.ax) * t, floor + 0.55, p.az + (p.bz - p.az) * t, 0.07, 1.1, 0.07))); }
      for (const h of [0.5, 1.08]) rails.push(plain(new THREE.BoxGeometry(0.07, 0.06, len).rotateY(yaw).translate((p.ax + p.bx) / 2, floor + h, (p.az + p.bz) / 2)));
      for (let i = 0; i < n; i += 2) { const t = (i + 0.5) / n; drifts.push(plain(organicRock(1, i * 7 + Math.round(p.ax)).scale(1.1, 0.22, 0.45).rotateY(yaw).translate(p.ax + (p.bx - p.ax) * t, floor, p.az + (p.bz - p.az) * t))); }
    }
    // the watchtowers: steel cabins up to their roofs, a band of lit windows, a roof edge
    const cabins: THREE.BufferGeometry[] = [], windows: THREE.BufferGeometry[] = [];
    for (const r of towers) {
      const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), w = r.x1 - r.x0, d = r.z1 - r.z0, h = r.top - 20;
      cabins.push(plain(slab(c.x, B + 20 + h / 2, c.z, w, h, d)), plain(slab(c.x, B + r.top + 0.1, c.z, w + 0.3, 0.2, d + 0.3)));
      for (const s of [-1, 1]) { windows.push(plain(slab(c.x + s * (w / 2 + 0.02), B + 20 + h * 0.55, c.z, 0.02, 1, d * 0.75)), plain(slab(c.x, B + 20 + h * 0.55, c.z + s * (d / 2 + 0.02), w * 0.75, 1, 0.02))); }
    }
    // a frost-blue light line round the beacon platform
    const ring: THREE.BufferGeometry[] = [];
    for (const [ax, az, bx, bz] of [[-6.4, -5.4, 6.4, -5.4], [6.4, -5.4, 6.4, 5.4], [6.4, 5.4, -6.4, 5.4], [-6.4, 5.4, -6.4, -5.4]] as const) ring.push(floorStrip(sx + ax, sz + az, sx + bx, sz + bz, 0.12, B + 20.02));
    // the frozen beacon: a cluster of ice crystal hung in the air over the platform
    const crystal = mergeGeometries([0, 1, 2, 3, 4, 5].map((i) => plain(crystalShard(i + 3).scale(i ? 0.9 : 1.4, i ? 3 + (i % 3) : 6, i ? 0.9 : 1.4).rotateZ(i ? ((i % 2 ? 1 : -1) * (0.35 + i * 0.05)) : 0).rotateY(i * 1.1))))!;
    const beam = new THREE.CylinderGeometry(0.6, 2.2, 12, 24, 1, true).translate(bc.x, B + 26, bc.z);
    // icy peaks
    const peaks = mergeGeometries(PEAKS.map(([dx, dz, r, h], i) => plain(organicRock(1, 31 + i * 5, 2).scale(r * 1.3, h * 0.7, r * 1.1).translate(sx + dx, B - DEPTH + h * 0.15, sz + dz))))!;
    const sky = new THREE.SphereGeometry(900, 32, 16).translate(sx, B, sz);
    return {
      decks, tops, shaft, cliffs, glow, abyss, column: mergeGeometries(column)!, icicles: mergeGeometries(icicles)!, steel: mergeGeometries(steel)!, rails: mergeGeometries(rails)!,
      drifts: mergeGeometries(drifts)!, cabins: mergeGeometries(cabins)!, windows: mergeGeometries(windows)!, ring: mergeGeometries(ring)!, crystal, beam, peaks, sky,
      box: new THREE.BoxGeometry(1, 1, 1), tank: waterTank(), hvac: hvacUnit(), container: shippingContainer(), crate: equipmentCase(), barrier: jerseyBarrier(),
    };
  }, [a, sx, sz, B]); // eslint-disable-line react-hooks/exhaustive-deps

  const mats = useMemo(() => {
    const concrete = weatheredConcreteTexture(), frost = frostTexture(), veins = shaftTexture();
    if (veins) veins.repeat.set(4, 12);
    const fade = (() => { if (typeof document === "undefined") return null; const c = document.createElement("canvas"); c.width = 4; c.height = 64; const x = c.getContext("2d")!, g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, "#000"); g.addColorStop(1, "#fff"); x.fillStyle = g; x.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(c); })();
    const sky = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(SKY.top) }, mid: { value: new THREE.Color(SKY.mid) }, low: { value: new THREE.Color(SKY.low) }, time: { value: 0 }, storm: { value: 0 } },
      vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position - cameraPosition); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }",
      fragmentShader: `uniform vec3 top, mid, low; uniform float time, storm; varying vec3 vDir;
        void main() { vec3 d = normalize(vDir); float h = d.y; vec3 c = mix(mix(low, mid, smoothstep(-0.05, 0.2, h)), top, smoothstep(0.15, 0.8, h));
          // the aurora: curtains of green and teal that sway across the northern half of the sky
          float az = atan(d.x, d.z), band = sin(az * 3.0 + time * 0.05 + sin(az * 7.0 + time * 0.11) * 0.6);
          float curtain = smoothstep(0.12, 0.3, h) * (1.0 - smoothstep(0.45, 0.75, h)) * smoothstep(0.2, 1.0, band) * smoothstep(-0.3, 0.4, d.z);
          c += curtain * mix(vec3(0.15, 0.95, 0.55), vec3(0.2, 0.7, 1.0), smoothstep(0.2, 0.6, h)) * 0.55 * (1.0 - storm);
          c = mix(c, vec3(0.86, 0.9, 0.95), storm * 0.8); gl_FragColor = vec4(c, 1.0); }`,
    });
    return {
      sky,
      deck: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#6c7684", roughness: 0.7 }), concrete, 3),
      frost: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.55, metalness: 0.05 }), frost, 5),
      shaft: new THREE.MeshStandardMaterial({ color: "#1a2433", emissive: "#ffffff", emissiveMap: veins, emissiveIntensity: 1.2, roughness: 0.6, side: THREE.DoubleSide }),
      cliff: new THREE.MeshStandardMaterial({ color: "#56657a", emissive: "#ffffff", emissiveMap: veins, emissiveIntensity: 0.35, roughness: 0.6, side: THREE.DoubleSide }),
      glow: new THREE.MeshBasicMaterial({ color: "#3ab8ff", toneMapped: false }),
      abyss: new THREE.MeshStandardMaterial({ color: "#0a1220", roughness: 1 }),
      column: new THREE.MeshStandardMaterial({ color: "#4a5868", roughness: 0.4, metalness: 0.7 }),
      ice: new THREE.MeshStandardMaterial({ color: "#cfeaff", emissive: "#5fc8ff", emissiveIntensity: 0.25, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 }),
      steel: new THREE.MeshStandardMaterial({ color: "#5c6f86", roughness: 0.45, metalness: 0.7 }),
      rail: new THREE.MeshStandardMaterial({ color: "#a8b4c2", roughness: 0.4, metalness: 0.7 }),
      snow: new THREE.MeshStandardMaterial({ color: "#eef3fa", roughness: 0.9 }),
      cabin: new THREE.MeshStandardMaterial({ color: "#3a4452", roughness: 0.5, metalness: 0.6 }),
      window: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ffc27a", emissiveIntensity: 1.6, toneMapped: false }),
      ring: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#5fe0ff", emissiveIntensity: 2.4, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      crystal: new THREE.MeshStandardMaterial({ color: "#bfefff", emissive: "#38c8ff", emissiveIntensity: 1.6, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.9, toneMapped: false }),
      beam: new THREE.MeshBasicMaterial({ color: "#7fdcff", alphaMap: fade, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }),
      peaks: new THREE.MeshStandardMaterial({ color: "#d6e2f0", roughness: 0.8 }),
      tank: new THREE.MeshStandardMaterial({ color: "#8a3a2a", roughness: 0.5, metalness: 0.5 }),
      hvac: new THREE.MeshStandardMaterial({ color: "#8a929c", roughness: 0.5, metalness: 0.5 }),
      container: new THREE.MeshStandardMaterial({ color: "#2f4a6a", roughness: 0.6, metalness: 0.4 }),
      crate: new THREE.MeshStandardMaterial({ color: "#4a5560", roughness: 0.7, metalness: 0.3 }),
      barrier: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#a8aeb6", roughness: 0.85 }), concrete, 2),
      screen: new THREE.MeshStandardMaterial({ color: "#2c3038", roughness: 0.5, metalness: 0.7 }),
      heater: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ff7a2a", emissiveIntensity: 2, toneMapped: false }),
      slot: new THREE.MeshStandardMaterial({ color: "#1a2028", roughness: 0.4, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
  }, []);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose());
    for (const m of Object.values(mats)) { const s = m as THREE.MeshStandardMaterial; s.map?.dispose(); s.alphaMap?.dispose(); s.dispose(); }
    mats.shaft.emissiveMap?.dispose();
  }, [geo, mats]);

  const props = useMemo(() => a.cover.map((k) => ({ k, x: sx + k.x, y: B + surfaceAt(a, k.x, k.z), z: sz + k.z })), [a, sx, sz, B]);
  const shifters = useMemo(() => a.shifters.map((k) => ({ k, x: sx + k.x, y: B + surfaceAt(a, k.x, k.z), z: sz + k.z, screen: k.phase === "up" })), [a, sx, sz, B]);

  const moving = useRef<(THREE.Group | null)[]>([]), beaconRef = useRef<THREE.Group>(null), storm = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const t = state.clock, ev = fractureAt(a, t);
    shifters.forEach(({ k }, i) => {
      const g = moving.current[i]; if (!g) return;
      const lift = shifterLift(a, k, t);
      g.position.y = (lift - 1) * (k.h + 0.05); g.visible = lift > 0.01;
    });
    const s = ev.active ? ev.strength : 0;
    (mats.sky.uniforms["storm"] as { value: number }).value = s;
    (mats.sky.uniforms["time"] as { value: number }).value = t;
    mats.heater.emissiveIntensity = ev.active ? 0.1 : ev.warning ? (Math.sin(performance.now() / 80) > 0 ? 2 : 0.4) : 2;
    if (beaconRef.current) { beaconRef.current.rotation.y += dt * 0.25; beaconRef.current.position.y = B + 31 + Math.sin(t * 0.8) * 0.4; }
    mats.crystal.emissiveIntensity = ev.active ? 0.6 : 1.6;
    if (storm.current) storm.current.visible = ev.active;
  });

  const moonTarget = useMemo(() => { const o = new THREE.Object3D(); o.position.set(sx, B, sz); return o; }, [sx, sz, B]);
  const moonPos = MOON.clone().multiplyScalar(300);
  return (
    <group name="killbox-arena:frostveil-ring">
      {/* drawn at the far plane after the world's own sky, so the ring's aurora twilight wins wherever no geometry stands in front */}
      <mesh geometry={geo.sky} material={mats.sky} renderOrder={1} frustumCulled={false} />
      <primitive object={moonTarget} />
      <directionalLight position={[sx + moonPos.x, B + moonPos.y, sz + moonPos.z]} target={moonTarget} color="#bcd4ff" intensity={1.1} />
      <hemisphereLight args={["#9ab8ff", "#2a3a52", phone ? 1.2 : 0.8]} />
      {!phone && <pointLight position={[sx, B + 31, sz]} color="#5fd0ff" intensity={900} distance={45} decay={2} />}
      {!phone && [[-28, 26], [28, -26]].map(([dx, dz], i) => <pointLight key={i} position={[sx + dx!, B + 26.5, sz + dz!]} color="#ffc27a" intensity={250} distance={22} decay={2} />)}
      <mesh geometry={geo.abyss} material={mats.abyss} />
      <mesh geometry={geo.peaks} material={mats.peaks} />
      <mesh geometry={geo.cliffs} material={mats.cliff} />
      <mesh geometry={geo.shaft} material={mats.shaft} />
      <mesh geometry={geo.glow} material={mats.glow} />
      <mesh geometry={geo.column} material={mats.column} />
      <mesh geometry={geo.decks} material={mats.deck} castShadow receiveShadow />
      <mesh geometry={geo.tops} material={mats.frost} receiveShadow />
      <mesh geometry={geo.icicles} material={mats.ice} />
      <mesh geometry={geo.steel} material={mats.steel} castShadow receiveShadow />
      <mesh geometry={geo.rails} material={mats.rail} castShadow />
      <mesh geometry={geo.drifts} material={mats.snow} receiveShadow />
      <mesh geometry={geo.cabins} material={mats.cabin} castShadow receiveShadow />
      <mesh geometry={geo.windows} material={mats.window} />
      <mesh geometry={geo.ring} material={mats.ring} />
      <mesh geometry={geo.beam} material={mats.beam} />
      <group ref={beaconRef} position={[sx, B + 31, sz]}><mesh geometry={geo.crystal} material={mats.crystal} /></group>
      {props.map(({ k, x, y, z }) => {
        if (k.kind === "tank") return <mesh key={k.id} geometry={geo.tank} material={mats.tank} position={[x, y + k.h / 2, z]} scale={[k.w / 2, k.h, k.d / 2]} castShadow receiveShadow />;
        if (k.kind === "hvac") return <mesh key={k.id} geometry={geo.hvac} material={mats.hvac} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />;
        if (k.kind === "container") return <mesh key={k.id} geometry={geo.container} material={mats.container} position={[x, y, z]} rotation-y={k.w > k.d ? Math.PI / 2 : 0} scale={[Math.min(k.w, k.d), k.h, Math.max(k.w, k.d)]} castShadow receiveShadow />;
        if (k.kind === "crate") return <mesh key={k.id} geometry={geo.crate} material={mats.crate} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />;
        return (
          <group key={k.id} position={[x, y, z]} rotation-y={k.d > k.w ? 0 : Math.PI / 2}>
            <mesh geometry={geo.barrier} material={mats.barrier} scale={[Math.min(k.w, k.d), k.h, Math.max(k.w, k.d)]} castShadow receiveShadow />
            <mesh geometry={geo.box} material={mats.snow} position-y={k.h + 0.04} scale={[Math.min(k.w, k.d) * 0.4, 0.1, Math.max(k.w, k.d) * 0.95]} />
          </group>
        );
      })}
      {shifters.map(({ k, x, y, z }) => <mesh key={`slot:${k.id}`} geometry={geo.box} material={mats.slot} position={[x, y + 0.012, z]} scale={[k.w + 0.2, 0.02, k.d + 0.2]} />)}
      {shifters.map(({ k, x, y, z, screen }, i) => {
        const wide = k.w >= k.d, len = Math.max(k.w, k.d), thick = Math.min(k.w, k.d);
        return (
          <group key={k.id} position={[x, y, z]}>
            <group ref={(g) => { moving.current[i] = g; }}>
              <group rotation-y={wide ? 0 : Math.PI / 2}>
                {screen ? (<>
                  {/* a heated screen: a steel panel with glowing heater grilles on both faces */}
                  <mesh geometry={geo.box} material={mats.screen} position-y={k.h / 2} scale={[len, k.h, thick * 0.4]} castShadow receiveShadow />
                  {[-1, 1].map((s) => Array.from({ length: 4 }, (_, r) => <mesh key={`${s}${r}`} geometry={geo.box} material={mats.heater} position={[0, 0.45 + r * 0.38, s * (thick * 0.2 + 0.01)]} scale={[len * 0.8, 0.06, 0.02]} />))}
                </>) : (
                  /* an ice wall: a slab of blue ice with a ragged top */
                  <>
                    <mesh geometry={geo.box} material={mats.ice} position-y={k.h / 2} scale={[len, k.h, thick]} castShadow receiveShadow />
                    {[-0.3, 0.1, 0.35].map((u, r) => <mesh key={r} geometry={geo.box} material={mats.ice} position={[u * len, k.h + 0.15, 0]} rotation-z={r - 1} scale={[0.4, 0.5, thick * 0.8]} />)}
                  </>
                )}
              </group>
            </group>
          </group>
        );
      })}
      <ArenaWeather kind="snow" center={{ x: sx, y: B + 14, z: sz }} count={phone ? 500 : 1500} size={90} height={30} />
      <group ref={storm} visible={false}><ArenaWeather kind="snow" center={{ x: sx, y: B + 14, z: sz }} count={phone ? 800 : 3200} size={70} height={22} /></group>
    </group>
  );
}
