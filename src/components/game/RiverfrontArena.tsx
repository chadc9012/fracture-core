import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BUILDING_MODELS, type BuildingModelId } from "@/game/building-models";
import { equipmentCase } from "@/game/camp-geometry";
import { isTouchDevice } from "@/game/client-input";
import { arenaParapets, fractureAt, shifterLift, surfaceAt, type KillboxArena as Arena } from "@/game/killbox-arenas";
import { canopyCluster } from "@/game/organic-geometry";
import type { PvpState } from "@/game/pvp";
import { lampHead, lampLens, lampPole } from "@/game/street-geometry";
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";
import { ArenaWeather } from "./ArenaWeather";
import { InstancedGlb, type GlbInstance } from "./InstancedGlb";
import { floorStrip, hazardTexture, jerseyBarrier, slab } from "./arena-parts";

/** Riverfront (killbox-arenas.ts RIVERFRONT), after the owner's PvP maps board: a river through Neon City at night in the rain. Stone
 * embankments carry wet paved promenades with iron railings and street lamps; shopfronts and Neon towers line both banks; a steel
 * road bridge on each flank with lattice girders and an overhead sign gantry, a slim footbridge between the stone quays, stone stairs
 * down to them, a barge moored against each bank, and dark water streaked with the city's light. Cover: noodle stalls under awnings,
 * planters, ticket kiosks, concrete barriers, crates. In the Flood Alert the glass windbreaks sink, yellow flood barriers rise out of
 * their slots, beacons turn orange and the rain comes down in sheets. Drawn from the same data its decks and walls come from. */

const WATER = 12; // the river, m above the arena base (the kill plane is just under it)
const BANK_REACH = 220; // the embankments run on this far either way past the playable stretch
const LAMPS: readonly [number, number][] = [[-36, 13], [-20, 13], [24, 13], [36, 13], [36, -13], [20, -13], [-24, -13], [-36, -13]];
const STALL_SIGNS: readonly [string, string][] = [["RAMEN", "#ff3df0"], ["NOODLES", "#38e8ff"]];
const SHOPS: readonly [number, number, BuildingModelId, number][] = [
  [-52, 46, "neon-block-a", 1.1], [-30, 44, "neon-block-b", 1], [-8, 46, "neon-block-a", 1.2], [14, 44, "neon-block-b", 1.1], [36, 46, "neon-block-a", 1], [58, 44, "neon-block-b", 1.2],
  [52, -46, "neon-block-a", 1.1], [30, -44, "neon-block-b", 1], [8, -46, "neon-block-a", 1.2], [-14, -44, "neon-block-b", 1.1], [-36, -46, "neon-block-a", 1], [-58, -44, "neon-block-b", 1.2],
];
const TOWERS: readonly [number, number, BuildingModelId, number][] = [
  [-80, 90, "neon-tower-a", 190], [-10, 105, "neon-tower-c", 160], [60, 95, "neon-tower-b", 210], [130, 70, "neon-tower-a", 170],
  [80, -90, "neon-tower-a", 190], [10, -105, "neon-tower-c", 160], [-60, -95, "neon-tower-b", 210], [-130, -70, "neon-tower-a", 170],
  [-200, 20, "neon-tower-b", 230], [200, -20, "neon-tower-c", 230],
];

/** light on the river: dark water streaked along its length with reflections of the lamps and signs */
function riverTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#000"; x.fillRect(0, 0, 512, 256);
  const cols = ["#ff3df0", "#38e8ff", "#ffb02e", "#f4e7ff"];
  for (let i = 0; i < 220; i++) { x.globalAlpha = 0.15 + Math.random() * 0.4; x.fillStyle = cols[i % cols.length]!; x.fillRect(Math.random() * 512, Math.random() * 256, 8 + Math.random() * 60, 1 + Math.random() * 1.5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
/** a neon word in tube light on a dark backing */
function signTexture(word: string, tube: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#07060c"; x.fillRect(0, 0, 512, 128);
  x.shadowColor = tube; x.shadowBlur = 16; x.strokeStyle = tube; x.lineWidth = 5; x.strokeRect(10, 10, 492, 108);
  x.font = "bold 70px 'Arial Black', Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#fff4ff"; x.shadowBlur = 22; x.fillText(word, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** dressed stone blocks for the embankment walls: courses of 0.6 m with offset joints */
function stoneTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d")!;
  for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) {
    const v = 70 + Math.random() * 30; x.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
    x.fillRect(k * 64 + (r % 2) * 32 + 1, r * 32 + 1, 62, 30);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function RiverfrontView({ arena: a, state }: { arena: Arena; state: PvpState }) {
  const { x: sx, z: sz } = a.site, B = a.base;
  const phone = useMemo(() => isTouchDevice(), []);
  const plain = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k); return n; };

  const geo = useMemo(() => {
    const W = (dx: number, dz: number) => ({ x: sx + dx, z: sz + dz });
    // stone bodies: every roof from the water up, and the embankments running on past the playable stretch
    const stone: THREE.BufferGeometry[] = [];
    const body = (x0: number, x1: number, z0: number, z1: number, top: number) => { const c = W((x0 + x1) / 2, (z0 + z1) / 2); stone.push(slab(c.x, B + (WATER - 2 + top) / 2, c.z, x1 - x0, top - WATER + 2, z1 - z0)); };
    for (const r of a.roofs) body(r.x0, r.x1, r.z0, r.z1, r.top - 0.02);
    for (const s of [-1, 1]) for (const z of [[12, 32], [-32, -12]] as const) body(s < 0 ? -BANK_REACH : 40, s < 0 ? -40 : BANK_REACH, z[0], z[1], 19.98);
    // the streets behind the promenades, where the shopfronts stand
    for (const z of [[32, 80], [-80, -32]] as const) body(-BANK_REACH, BANK_REACH, z[0], z[1], 19.9);
    // paving: the walking surfaces, and the dark embankment tops beyond the hoardings
    const pave = mergeGeometries(a.roofs.map((r) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(-Math.PI / 2).translate(c.x, B + r.top + 0.01, c.z); }))!;
    // a kerb line of light along the promenade's back and a strip at the quay edges
    const strips: THREE.BufferGeometry[] = [];
    for (const z of [31.4, -31.4]) strips.push(floorStrip(sx - 40, sz + z, sx + 40, sz + z, 0.12, B + 20.02));
    // stairs: stone treads
    const steps: THREE.BufferGeometry[] = [], rails: THREE.BufferGeometry[] = [];
    for (const k of a.walks.filter((q) => q.top !== q.topB)) {
      const c = W(k.x, k.z), rise = k.topB - k.top, n = Math.max(2, Math.round(Math.abs(rise) / 0.25)), run = k.length / n, ax = k.along === "x", lo = Math.min(k.top, k.topB);
      for (let i = 0; i < n; i++) {
        const s = -k.length / 2 + (i + 0.5) * run, h = k.top + rise * ((i + 1) / n);
        steps.push(plain(slab(c.x + (ax ? s : 0), B + (WATER + h) / 2, c.z + (ax ? 0 : s), ax ? run + 0.01 : k.width, h - WATER, ax ? k.width : run + 0.01)));
      }
      for (const side of [-1, 1]) {
        const ox = ax ? 0 : side * (k.width / 2 - 0.08), oz = ax ? side * (k.width / 2 - 0.08) : 0, len = Math.hypot(k.length, rise), tilt = Math.atan2(rise, k.length);
        const tube = new THREE.BoxGeometry(ax ? len : 0.06, 0.06, ax ? 0.06 : len);
        if (ax) tube.rotateZ(tilt); else tube.rotateX(-tilt);
        rails.push(plain(tube.translate(c.x + ox, B + (k.top + k.topB) / 2 + 1, c.z + oz)));
        for (let i = 0; i <= 4; i++) { const s = -k.length / 2 + (i / 4) * k.length, h = k.top + rise * (i / 4); rails.push(plain(slab(c.x + ox + (ax ? s : 0), B + h + 0.5, c.z + oz + (ax ? 0 : s), 0.06, 1, 0.06))); }
      }
    }
    // iron railings on every parapet line, and on past the playable stretch along the river
    const railLine = (ax: number, az: number, bx: number, bz: number, floor: number) => {
      const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), n = Math.max(1, Math.round(len / 1.2));
      for (let i = 0; i <= n; i++) { const t = i / n; rails.push(plain(slab(ax + (bx - ax) * t, floor + 0.55, az + (bz - az) * t, 0.05, 1.1, 0.05))); }
      for (const h of [0.15, 1.08]) rails.push(plain(new THREE.BoxGeometry(0.07, 0.06, len).rotateY(yaw).translate((ax + bx) / 2, floor + h, (az + bz) / 2)));
    };
    for (const p of arenaParapets(a)) railLine(p.ax, p.az, p.bx, p.bz, p.base + 0.5);
    for (const s of [-1, 1]) for (const z of [12, -12]) railLine(sx + s * 40, sz + z, sx + s * BANK_REACH, sz + z, B + 20);
    // hoardings closing the promenades at the map's ends
    const hoard: THREE.BufferGeometry[] = [];
    for (const x of [-40.3, 40.3]) for (const [z0, z1] of [[12, 32], [-32, -12]] as const) { const c = W(x, (z0 + z1) / 2); hoard.push(plain(slab(c.x, B + 21.5, c.z, 0.12, 3, z1 - z0))); }
    // the road bridges: a steel deck, lattice girders along each side, two piers in the river and an overhead sign gantry
    const steel: THREE.BufferGeometry[] = [];
    for (const k of a.walks.filter((q) => q.top === q.topB)) {
      const c = W(k.x, k.z), road = k.width > 5, deck = road ? 1.2 : 0.5;
      steel.push(plain(slab(c.x, B + k.top - deck / 2 - 0.02, c.z, k.width + 0.4, deck, k.length - 2)));
      for (const s of [-1, 1]) {
        const x = c.x + s * (k.width / 2 + 0.1), len = k.length - 2, n = Math.round(len / 2);
        steel.push(plain(slab(x, B + k.top + 1.1, c.z, 0.16, 0.14, len)), plain(slab(x, B + k.top + 0.05, c.z, 0.16, 0.14, len)));
        for (let i = 0; i <= n; i++) {
          const z = c.z - len / 2 + (i / n) * len; steel.push(plain(slab(x, B + k.top + 0.58, z, 0.12, 1.1, 0.12)));
          if (i < n) steel.push(plain(new THREE.BoxGeometry(0.06, 0.06, Math.hypot(len / n, 1.0)).rotateX((i % 2 ? 1 : -1) * Math.atan2(1.0, len / n)).translate(x, B + k.top + 0.6, z + len / n / 2)));
        }
      }
      if (road) {
        for (const z of [-3, 3]) steel.push(plain(new THREE.CylinderGeometry(0.9, 1.1, k.top - WATER + 1, 16).translate(c.x, B + (WATER - 1 + k.top - deck) / 2, c.z + z)));
        for (const s of [-1, 1]) steel.push(plain(slab(c.x + s * (k.width / 2 + 0.3), B + k.top + 3.3, c.z, 0.3, 6.6, 0.3)));
        steel.push(plain(slab(c.x, B + k.top + 6.5, c.z, k.width + 1.2, 0.4, 0.4)));
      } else for (const s of [-1, 1]) steel.push(plain(slab(c.x, B + k.top - 0.8, c.z + s * 4, k.width * 0.8, 0.6, 0.6)));
    }
    // street lamps along the river
    const poles: THREE.BufferGeometry[] = [], heads: THREE.BufferGeometry[] = [], lenses: THREE.BufferGeometry[] = [];
    for (const [dx, dz] of LAMPS) {
      const p = W(dx, dz), yaw = dz > 0 ? Math.PI : 0, place = (g: THREE.BufferGeometry) => g.rotateY(yaw).translate(p.x, B + 20, p.z);
      poles.push(place(lampPole(6.5, 1.6))); heads.push(place(lampHead(6.5, 1.6))); lenses.push(place(plain(lampLens(6.5, 1.6))));
    }
    // a barge moored against each bank, out of the lanes
    const barges: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const c = W(s * 19, s * 6.2);
      barges.push(plain(slab(c.x, B + WATER + 0.4, c.z, 14, 1.6, 3.6)), plain(slab(c.x - s * 4, B + WATER + 1.9, c.z, 4, 1.6, 3)), plain(slab(c.x + s * 2, B + WATER + 1.4, c.z, 6, 0.5, 3.2)));
    }
    // shrubs in the planters
    const shrubs: THREE.BufferGeometry[] = [];
    for (const k of a.cover.filter((q) => q.kind === "planter")) {
      const c = W(k.x, k.z), top = B + surfaceAt(a, k.x, k.z) + k.h, long = Math.max(k.w, k.d), n = Math.max(1, Math.round(long / 1.4)), alongX = k.w >= k.d;
      for (let i = 0; i < n; i++) { const s = -long / 2 + (i + 0.5) * (long / n); shrubs.push(plain(canopyCluster(i + Math.round(k.x * 3 + k.z)).scale(0.6, 0.5, 0.6).translate(c.x + (alongX ? s : 0), top + 0.25, c.z + (alongX ? 0 : s)))); }
    }
    const water = new THREE.PlaneGeometry(BANK_REACH * 2.4, 24, 1, 1).rotateX(-Math.PI / 2).translate(sx, B + WATER, sz);
    const floor = new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2).translate(sx, B + WATER - 3, sz);
    return {
      stone: mergeGeometries(stone)!, pave, strips: mergeGeometries(strips)!, steps: mergeGeometries(steps)!, rails: mergeGeometries(rails)!, hoard: mergeGeometries(hoard)!,
      steel: mergeGeometries(steel)!, poles: mergeGeometries(poles)!, heads: mergeGeometries(heads)!, lenses: mergeGeometries(lenses)!, barges: mergeGeometries(barges)!,
      shrubs: mergeGeometries(shrubs)!, water, floor, box: new THREE.BoxGeometry(1, 1, 1), plane: new THREE.PlaneGeometry(1, 1), crate: equipmentCase(), barrier: jerseyBarrier(),
      beacon: new THREE.SphereGeometry(0.16, 16, 12),
    };
  }, [a, sx, sz, B]); // eslint-disable-line react-hooks/exhaustive-deps

  const mats = useMemo(() => {
    const concrete = weatheredConcreteTexture(), hazard = hazardTexture(), river = riverTexture(), blocks = stoneTexture();
    return {
      stone: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#8a8478", roughness: 0.75 }), blocks, 4),
      pave: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#4a4a54", roughness: 0.22, metalness: 0.2 }), concrete, 3),
      strip: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ff3df0", emissiveIntensity: 2.2, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      steps: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#7a766e", roughness: 0.6 }), concrete, 2),
      iron: new THREE.MeshStandardMaterial({ color: "#2a2c33", roughness: 0.4, metalness: 0.8 }),
      hoard: new THREE.MeshStandardMaterial({ color: "#ffffff", map: hazard, roughness: 0.6 }),
      steel: new THREE.MeshStandardMaterial({ color: "#3d5a7a", roughness: 0.4, metalness: 0.75 }),
      lamp: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ffe2b0", emissiveIntensity: 4, toneMapped: false }),
      barge: new THREE.MeshStandardMaterial({ color: "#3a2a24", roughness: 0.7, metalness: 0.4 }),
      shrub: new THREE.MeshStandardMaterial({ color: "#2f6a34", roughness: 0.85 }),
      water: new THREE.MeshStandardMaterial({ color: "#04060c", emissive: "#ffffff", emissiveMap: river, emissiveIntensity: 0.7, roughness: 0.06, metalness: 0.9 }),
      floor: new THREE.MeshStandardMaterial({ color: "#020306", roughness: 1 }),
      stall: new THREE.MeshStandardMaterial({ color: "#7a2a3a", roughness: 0.55, metalness: 0.3 }),
      awning: new THREE.MeshStandardMaterial({ color: "#e0e0e8", roughness: 0.7, side: THREE.DoubleSide }),
      counter: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ffcf7a", emissiveIntensity: 1.6, toneMapped: false }),
      planter: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#8f8a80", roughness: 0.8 }), concrete, 2),
      kiosk: new THREE.MeshStandardMaterial({ color: "#1c2028", roughness: 0.35, metalness: 0.7 }),
      screen: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#38e8ff", emissiveIntensity: 1.8, toneMapped: false }),
      crate: new THREE.MeshStandardMaterial({ color: "#5c5a3c", roughness: 0.7, metalness: 0.3 }),
      barrier: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#9a968e", roughness: 0.85 }), concrete, 2),
      glass: new THREE.MeshStandardMaterial({ color: "#9fe6ff", emissive: "#38c8ff", emissiveIntensity: 0.15, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
      flood: new THREE.MeshStandardMaterial({ color: "#e0b02a", roughness: 0.5, metalness: 0.5 }),
      stripe: new THREE.MeshStandardMaterial({ color: "#ffffff", map: hazard, roughness: 0.5 }),
      slot: new THREE.MeshStandardMaterial({ color: "#14161b", roughness: 0.4, metalness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
      beacon: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ffb02e", emissiveIntensity: 0.4, toneMapped: false }),
      signs: STALL_SIGNS.map(([w, c]) => { const t = signTexture(w, c); return new THREE.MeshStandardMaterial({ color: "#111", map: t, emissive: "#ffffff", emissiveMap: t, emissiveIntensity: 2.2, roughness: 0.4, toneMapped: false }); }),
      bridgeSigns: [["WEST BRIDGE", "#38e8ff"], ["EAST BRIDGE", "#ff3df0"]].map(([w, c]) => { const t = signTexture(w!, c!); return new THREE.MeshStandardMaterial({ color: "#111", map: t, emissive: "#ffffff", emissiveMap: t, emissiveIntensity: 2, roughness: 0.4, toneMapped: false, side: THREE.DoubleSide }); }),
    };
  }, []);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose());
    for (const [k, m] of Object.entries(mats)) for (const one of (Array.isArray(m) ? m : [m]) as THREE.MeshStandardMaterial[]) { if (["signs", "bridgeSigns", "hoard", "stripe"].includes(k)) one.map?.dispose(); if (k === "water") one.emissiveMap?.dispose(); one.dispose(); }
  }, [geo, mats]);

  const props = useMemo(() => a.cover.map((k) => ({ k, x: sx + k.x, y: B + surfaceAt(a, k.x, k.z), z: sz + k.z })), [a, sx, sz, B]);
  const shifters = useMemo(() => a.shifters.map((k) => ({ k, x: sx + k.x, y: B + surfaceAt(a, k.x, k.z), z: sz + k.z, screen: k.phase === "up" })), [a, sx, sz, B]);
  const buildings = useMemo(() => {
    const by = new Map<BuildingModelId, GlbInstance[]>();
    for (const [dx, dz, id, sc] of SHOPS) by.set(id, [...(by.get(id) ?? []), { x: sx + dx, y: B + 19.9, z: sz + dz, yaw: dz > 0 ? Math.PI : 0, scale: sc }]);
    for (const [dx, dz, id, h] of TOWERS) by.set(id, [...(by.get(id) ?? []), { x: sx + dx, y: B + 19.9, z: sz + dz, yaw: Math.atan2(-dx, -dz), scale: h / BUILDING_MODELS[id].height }]);
    return [...by.entries()];
  }, [sx, sz, B]);
  const bridges = useMemo(() => a.walks.filter((k) => k.top === k.topB && k.width > 5), [a]);

  const moving = useRef<(THREE.Group | null)[]>([]), downpour = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const t = state.clock, ev = fractureAt(a, t);
    shifters.forEach(({ k }, i) => {
      const g = moving.current[i]; if (!g) return;
      const lift = shifterLift(a, k, t);
      g.position.y = (lift - 1) * (k.h + 0.05); g.visible = lift > 0.01;
    });
    // beacons pulse in the warning and turn steady orange in the alert; the river's light drifts downstream
    mats.beacon.emissiveIntensity = ev.active ? 2.5 + Math.sin(performance.now() / 150) * 1.5 : ev.warning ? (Math.sin(performance.now() / 90) > 0 ? 3 : 0.3) : 0.4;
    const m = mats.water.emissiveMap; if (m) m.offset.x = (m.offset.x + dt * 0.01) % 1;
    if (downpour.current) downpour.current.visible = ev.active;
  });

  return (
    <group name="killbox-arena:riverfront">
      <hemisphereLight args={["#9aa0ff", "#b04a9a", 1.25]} />
      {!phone && LAMPS.filter((_, i) => i % 2 === 0).map(([dx, dz], i) => <pointLight key={i} position={[sx + dx, B + 25.5, sz + dz + (dz > 0 ? -1.6 : 1.6)]} color="#ffd9a0" intensity={500} distance={36} decay={2} />)}
      {!phone && [[0, 4, "#ff3df0"], [0, -4, "#38e8ff"]].map(([dx, dz, c], i) => <pointLight key={`n${i}`} position={[sx + (dx as number), B + 30, sz + (dz as number)]} color={c as string} intensity={350} distance={45} decay={2} />)}
      <mesh geometry={geo.floor} material={mats.floor} />
      <mesh geometry={geo.water} material={mats.water} />
      <mesh geometry={geo.stone} material={mats.stone} receiveShadow />
      <mesh geometry={geo.pave} material={mats.pave} receiveShadow />
      <mesh geometry={geo.strips} material={mats.strip} />
      <mesh geometry={geo.steps} material={mats.steps} castShadow receiveShadow />
      <mesh geometry={geo.rails} material={mats.iron} castShadow />
      <mesh geometry={geo.hoard} material={mats.hoard} />
      <mesh geometry={geo.steel} material={mats.steel} castShadow receiveShadow />
      <mesh geometry={geo.poles} material={mats.iron} />
      <mesh geometry={geo.heads} material={mats.iron} />
      <mesh geometry={geo.lenses} material={mats.lamp} />
      <mesh geometry={geo.barges} material={mats.barge} />
      <mesh geometry={geo.shrubs} material={mats.shrub} castShadow />
      {bridges.map((k, i) => (
        <group key={k.id}>
          <mesh geometry={geo.plane} material={mats.bridgeSigns[i % 2]!} position={[sx + k.x, B + k.top + 5.6, sz + k.z]} scale={[k.width, 1.4, 1]} />
          {[-1, 1].map((s) => <mesh key={s} geometry={geo.beacon} material={mats.beacon} position={[sx + k.x + s * (k.width / 2 + 0.3), B + k.top + 6.8, sz + k.z]} />)}
        </group>
      ))}
      {props.map(({ k, x, y, z }, i) => {
        if (k.kind === "container") {
          // a noodle stall: a coloured van body, a lit serving hatch on the long side facing the river, an awning and a neon sign on top
          const long = Math.max(k.w, k.d), deep = Math.min(k.w, k.d), face = k.z > 0 ? -1 : 1;
          return (
            <group key={k.id} position={[x, y, z]} rotation-y={k.w >= k.d ? 0 : Math.PI / 2}>
              <mesh geometry={geo.box} material={mats.stall} position-y={k.h / 2} scale={[long, k.h, deep]} castShadow receiveShadow />
              <mesh geometry={geo.plane} material={mats.counter} position={[0, k.h * 0.55, face * (deep / 2 + 0.01)]} rotation-y={face < 0 ? Math.PI : 0} scale={[long * 0.7, k.h * 0.35, 1]} />
              <mesh geometry={geo.plane} material={mats.awning} position={[0, k.h * 0.82, face * (deep / 2 + 0.55)]} rotation-x={face * (-Math.PI / 2 + 0.35)} scale={[long * 0.85, 1.2, 1]} />
              <mesh geometry={geo.plane} material={mats.signs[i % 2]!} position={[0, k.h + 0.6, 0]} rotation-y={face < 0 ? Math.PI : 0} scale={[long * 0.6, 1.1, 1]} />
            </group>
          );
        }
        if (k.kind === "planter") return <mesh key={k.id} geometry={geo.box} material={mats.planter} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />;
        if (k.kind === "console") return (
          <group key={k.id} position={[x, y, z]}>
            <mesh geometry={geo.box} material={mats.kiosk} position-y={k.h / 2} scale={[k.w, k.h, k.d]} castShadow receiveShadow />
            {[0, 1, 2, 3].map((s) => <mesh key={s} geometry={geo.plane} material={mats.screen} position={[Math.sin((s * Math.PI) / 2) * (k.w / 2 + 0.01), k.h * 0.62, Math.cos((s * Math.PI) / 2) * (k.d / 2 + 0.01)]} rotation-y={(s * Math.PI) / 2} scale={[k.w * 0.7, k.h * 0.45, 1]} />)}
          </group>
        );
        if (k.kind === "crate") return <mesh key={k.id} geometry={geo.crate} material={mats.crate} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />;
        return <mesh key={k.id} geometry={geo.barrier} material={mats.barrier} position={[x, y, z]} rotation-y={k.d > k.w ? 0 : Math.PI / 2} scale={[Math.min(k.w, k.d), k.h, Math.max(k.w, k.d)]} castShadow receiveShadow />;
      })}
      {shifters.map(({ k, x, y, z }) => <mesh key={`slot:${k.id}`} geometry={geo.box} material={mats.slot} position={[x, y + 0.012, z]} scale={[k.w + 0.2, 0.02, k.d + 0.2]} />)}
      {shifters.map(({ k, x, y, z, screen }, i) => {
        const wide = k.w >= k.d, len = Math.max(k.w, k.d), thick = Math.min(k.w, k.d);
        return (
          <group key={k.id} position={[x, y, z]}>
            <group ref={(g) => { moving.current[i] = g; }}>
              <group rotation-y={wide ? 0 : Math.PI / 2}>
                {screen ? (<>
                  {/* a glass windbreak in a steel frame */}
                  {[-1, 1].map((s) => <mesh key={s} geometry={geo.box} material={mats.iron} position={[s * (len / 2 - 0.06), k.h / 2, 0]} scale={[0.12, k.h, 0.16]} castShadow />)}
                  <mesh geometry={geo.box} material={mats.iron} position-y={k.h - 0.05} scale={[len, 0.1, 0.16]} />
                  <mesh geometry={geo.box} material={mats.glass} position-y={k.h / 2} scale={[len - 0.2, k.h - 0.2, 0.04]} />
                </>) : (<>
                  {/* a flood barrier: ribbed yellow steel with a hazard-striped top */}
                  {Array.from({ length: Math.round(k.h / 0.4) }, (_, s) => <mesh key={s} geometry={geo.box} material={mats.flood} position-y={0.2 + s * 0.4} scale={[len, 0.36, thick * 0.45]} castShadow receiveShadow />)}
                  <mesh geometry={geo.box} material={mats.stripe} position-y={k.h - 0.06} scale={[len + 0.06, 0.18, thick * 0.55]} />
                  {[-1, 1].map((s) => <mesh key={s} geometry={geo.box} material={mats.iron} position={[s * (len / 2 + 0.05), k.h / 2, 0]} scale={[0.14, k.h + 0.1, thick * 0.6]} />)}
                </>)}
              </group>
            </group>
          </group>
        );
      })}
      {buildings.map(([id, items]) => <InstancedGlb key={id} url={BUILDING_MODELS[id].url} items={items} shadows={false} nightGlow={[0.6, 1.8]} windowScale={1.4} />)}
      <ArenaWeather kind="rain" center={{ x: sx, y: B + 14, z: sz }} count={phone ? 500 : 1600} size={100} />
      <group ref={downpour} visible={false}><ArenaWeather kind="rain" center={{ x: sx, y: B + 14, z: sz }} count={phone ? 600 : 2600} size={80} /></group>
    </group>
  );
}
