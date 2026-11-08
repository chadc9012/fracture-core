import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BUILDING_MODELS, type BuildingModelId } from "@/game/building-models";
import { equipmentCase } from "@/game/camp-geometry";
import { isTouchDevice } from "@/game/client-input";
import { arenaParapets, fractureAt, shifterLift, surfaceAt, type KillboxArena as Arena } from "@/game/killbox-arenas";
import type { PvpState } from "@/game/pvp";
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";
import { ArenaWeather } from "./ArenaWeather";
import { InstancedGlb, type GlbInstance } from "./InstancedGlb";
import { floorStrip, hazardTexture, jerseyBarrier, shippingContainer, slab } from "./arena-parts";

/** Neon Yard (killbox-arenas.ts NEON_YARD), after the owner's PvP maps board: a container yard on a harbour pier at night in the
 * rain. Every container — cover, the climbable stacks, the boxes the crane moves — is built tier by tier from the same box the
 * collision uses, in bright shipping paint; a yellow gantry crane straddles the yard, and in the Crane Shuffle the boxes it drops
 * come down from its height. Neon signs on the stacks, magenta and cyan floodlights, wet asphalt with bay lines, guard rails with
 * hazard stripes at the pier's edge, dark harbour water below and the Neon skyline across it. */

const PAINT = ["#b8322a", "#1f5f8a", "#2a8a7a", "#d4762a", "#8a2f7a", "#c9b23a", "#3a4a9a", "#6a8a2a"];
const TIER = 2.6;
const WATER = 12; // the harbour, m above the arena base (the kill plane)

/** split a cover box into containers: tiers of 2.6 m, each tier a row of boxes about 6 m long (or 3 m when the run is short) */
function containerSlots(k: { x: number; z: number; w: number; d: number; h: number }) {
  const long = k.w >= k.d, len = long ? k.w : k.d, wide = long ? k.d : k.w, tiers = Math.max(1, Math.round(k.h / TIER));
  const per = len > 7 ? Math.round(len / 6) : 1, across = wide > 3.6 ? 2 : 1, out: { x: number; z: number; y: number; long: boolean; l: number; w: number }[] = [];
  for (let t = 0; t < tiers; t++) for (let i = 0; i < per; i++) for (let j = 0; j < across; j++) {
    const a = -len / 2 + (i + 0.5) * (len / per), b = -wide / 2 + (j + 0.5) * (wide / across);
    out.push({ x: k.x + (long ? a : b), z: k.z + (long ? b : a), y: t * TIER, long, l: len / per - 0.08, w: wide / across - 0.06 });
  }
  return out;
}
/** a neon sign: a word in tube light on a dark panel */
function signTexture(word: string, tube: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#07060c"; x.fillRect(0, 0, 512, 128);
  x.shadowColor = tube; x.shadowBlur = 16; x.strokeStyle = tube; x.lineWidth = 5; x.strokeRect(10, 10, 492, 108);
  x.font = "bold 72px 'Arial Black', Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#fff4ff"; x.shadowBlur = 22; x.fillText(word, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** signs on the stacks (dx, dz, yaw, y above the yard, word, tube colour): each on a container face */
const SIGNS: readonly [number, number, number, number, string, string][] = [
  [-12, 12.75, Math.PI, 3.9, "ASG LINES", "#ff3df0"], [12, -12.75, 0, 3.9, "KAIJU FREIGHT", "#38e8ff"],
  [-30, 18.95, Math.PI, 3.9, "BAY 07", "#ffb02e"], [30, -18.95, 0, 3.9, "BAY 12", "#ffb02e"],
  [-26.05, 0, -Math.PI / 2, 3.9, "NEON YARD", "#ff3df0"], [26.05, 0, Math.PI / 2, 3.9, "NEON YARD", "#38e8ff"],
];
const MASTS: readonly [number, number, string][] = [[-38, 32, "#ff3df0"], [38, -32, "#38e8ff"], [38, 32, "#38e8ff"], [-38, -32, "#ff3df0"]];
const SKYLINE: readonly [number, number, BuildingModelId, number][] = [
  [-120, 170, "neon-tower-a", 150], [-50, 200, "neon-tower-b", 190], [30, 190, "neon-tower-c", 140], [110, 160, "neon-tower-a", 175],
  [-130, -170, "neon-tower-c", 160], [-40, -200, "neon-tower-a", 200], [50, -195, "neon-tower-b", 150], [125, -160, "neon-tower-c", 180],
];

export function NeonYardView({ arena: a, state }: { arena: Arena; state: PvpState }) {
  const { x: sx, z: sz } = a.site, B = a.base;
  const phone = useMemo(() => isTouchDevice(), []);
  const plain = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k); return n; };

  const geo = useMemo(() => {
    const W = (dx: number, dz: number) => ({ x: sx + dx, z: sz + dz });
    const yard = a.roofs[0]!, c = W((yard.x0 + yard.x1) / 2, (yard.z0 + yard.z1) / 2), w = yard.x1 - yard.x0, d = yard.z1 - yard.z0;
    // the pier: a concrete deck on piles standing in the water
    const pier: THREE.BufferGeometry[] = [plain(slab(c.x, B + yard.top - 1.5, c.z, w + 1, 3, d + 1))];
    for (let x = yard.x0 + 4; x < yard.x1; x += 8) for (const z of [yard.z0 + 2, yard.z1 - 2]) { const p = W(x, z); pier.push(plain(new THREE.CylinderGeometry(0.6, 0.7, yard.top - 3 - WATER + 2, 12).translate(p.x, B + WATER - 2 + (yard.top - 3 - WATER + 2) / 2, p.z))); }
    // the yard surface with bay lines painted on it
    const top = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(c.x, B + yard.top + 0.01, c.z);
    const lines: THREE.BufferGeometry[] = [];
    for (let x = yard.x0 + 8; x < yard.x1 - 1; x += 8) lines.push(new THREE.PlaneGeometry(0.15, d - 4).rotateX(-Math.PI / 2).translate(sx + x, B + yard.top + 0.02, c.z));
    lines.push(new THREE.PlaneGeometry(w - 4, 0.15).rotateX(-Math.PI / 2).translate(c.x, B + yard.top + 0.02, sz));
    // stairs: steel steps with railings
    const steps: THREE.BufferGeometry[] = [], rails: THREE.BufferGeometry[] = [];
    for (const k of a.walks) {
      const cw = W(k.x, k.z), rise = k.topB - k.top, n = Math.round(Math.abs(rise) / 0.25), run = k.length / n, lo = Math.min(k.top, k.topB);
      for (let i = 0; i < n; i++) { const s = -k.length / 2 + (i + 0.5) * run, h = k.top + rise * ((i + 1) / n); steps.push(plain(slab(cw.x, B + (lo + h) / 2, cw.z + s, k.width, Math.max(0.05, h - lo), run + 0.01))); }
      for (const side of [-1, 1]) {
        const x = cw.x + side * (k.width / 2 - 0.06), len = Math.hypot(k.length, rise);
        rails.push(plain(new THREE.BoxGeometry(0.06, 0.06, len).rotateX(-Math.atan2(rise, k.length)).translate(x, B + (k.top + k.topB) / 2 + 1.05, cw.z)));
        for (let i = 0; i <= 4; i++) { const s = -k.length / 2 + (i / 4) * k.length; rails.push(plain(slab(x, B + k.top + rise * (i / 4) + 0.52, cw.z + s, 0.06, 1.05, 0.06))); }
      }
    }
    // guard rails along every parapet line (the pier's edge), hazard stripes inside them
    for (const p of arenaParapets(a)) {
      const len = Math.hypot(p.bx - p.ax, p.bz - p.az), n = Math.max(1, Math.round(len / 2.5));
      for (let i = 0; i <= n; i++) { const t = i / n; rails.push(plain(slab(p.ax + (p.bx - p.ax) * t, p.base + 1.05, p.az + (p.bz - p.az) * t, 0.08, 1.1, 0.08))); }
      for (const h of [0.6, 1.1]) rails.push(plain(new THREE.BoxGeometry(0.07, 0.07, len).rotateY(Math.atan2(p.bx - p.ax, p.bz - p.az)).translate((p.ax + p.bx) / 2, p.base + 0.5 + h, (p.az + p.bz) / 2)));
    }
    const stripes = mergeGeometries(arenaParapets(a).filter((p) => Math.abs(p.base - (B + yard.top - 0.5)) < 0.1).map((p) => {
      const len = Math.hypot(p.bx - p.ax, p.bz - p.az), nx = -(p.bz - p.az) / len, nz = (p.bx - p.ax) / len, mx = (p.ax + p.bx) / 2 - sx, mz = (p.az + p.bz) / 2 - sz;
      const s = Number.isFinite(surfaceAt(a, mx + nx * 0.8, mz + nz * 0.8)) ? 1 : -1;
      return floorStrip(p.ax + nx * s * 0.6, p.az + nz * s * 0.6, p.bx + nx * s * 0.6, p.bz + nz * s * 0.6, 0.5, B + yard.top + 0.03);
    }))!;
    // the gantry crane: two A-frame legs outside the yard, a box girder across it at 16 m, a trolley and a spreader on cables
    const crane: THREE.BufferGeometry[] = [], cy = B + yard.top + 16;
    for (const side of [-1, 1]) {
      const x = sx + side * (yard.x1 + 3);
      for (const dz of [-5, 5]) crane.push(plain(new THREE.BoxGeometry(0.9, 17, 0.9).rotateX(dz > 0 ? -0.15 : 0.15).translate(x, cy - 8.2, sz + dz * 0.7)));
      crane.push(plain(slab(x, B + yard.top + 0.4, sz, 1.4, 0.8, 12)), plain(slab(x, cy - 7, sz, 0.5, 0.5, 8)));
    }
    crane.push(plain(slab(sx, cy + 0.6, sz - 1.2, (yard.x1 + 3) * 2 + 1, 1.6, 1)), plain(slab(sx, cy + 0.6, sz + 1.2, (yard.x1 + 3) * 2 + 1, 1.6, 1)));
    crane.push(plain(slab(sx, cy - 0.6, sz, 4, 1.4, 3.6))); // trolley
    for (const [ox, oz] of [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]] as const) crane.push(plain(slab(sx + ox, cy - 4, sz + oz, 0.05, 6, 0.05)));
    crane.push(plain(slab(sx, cy - 7.1, sz, 6.2, 0.4, 2.6))); // spreader
    // floodlight masts
    const masts: THREE.BufferGeometry[] = [], lamps: THREE.BufferGeometry[] = [];
    for (const [dx, dz] of MASTS) { const p = W(dx, dz); masts.push(plain(new THREE.CylinderGeometry(0.15, 0.22, 12, 10).translate(p.x, B + yard.top + 6, p.z))); lamps.push(plain(slab(p.x, B + yard.top + 12.2, p.z, 1.6, 0.5, 1.6))); }
    const water = new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2).translate(sx, B + WATER, sz);
    const puddle = (dx: number, dz: number, rx: number, rz: number) => { const p = W(dx, dz); return new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2).scale(rx, 1, rz).translate(p.x, B + yard.top + 0.025, p.z); };
    return {
      pier: mergeGeometries(pier)!, top, lines: mergeGeometries(lines)!, steps: mergeGeometries(steps)!, rails: mergeGeometries(rails)!, stripes, crane: mergeGeometries(crane)!,
      masts: mergeGeometries(masts)!, lamps: mergeGeometries(lamps)!, water,
      puddles: mergeGeometries([[-4, -10, 3, 1.4], [4, 10, 3, 1.4], [-20, 18, 2.4, 1.2], [20, -18, 2.4, 1.2], [-34, -14, 1.6, 2.4], [34, 14, 1.6, 2.4], [10, -24, 2, 1], [-10, 24, 2, 1]].map(([x, z, rx, rz]) => puddle(x!, z!, rx!, rz!)))!,
      container: shippingContainer(), crate: equipmentCase(), barrier: jerseyBarrier(), sign: new THREE.PlaneGeometry(1, 1),
    };
  }, [a, sx, sz, B]); // eslint-disable-line react-hooks/exhaustive-deps

  const mats = useMemo(() => {
    const concrete = weatheredConcreteTexture(), hazard = hazardTexture();
    return {
      pier: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#4a4a50", roughness: 0.7 }), concrete, 3),
      // wet asphalt: dark, with a sheen that takes the neon
      top: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#44454e", roughness: 0.22, metalness: 0.25 }), concrete, 5),
      lines: new THREE.MeshStandardMaterial({ color: "#d9c46a", roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
      steel: new THREE.MeshStandardMaterial({ color: "#5a5f68", roughness: 0.45, metalness: 0.7 }),
      rail: new THREE.MeshStandardMaterial({ color: "#d1a52e", roughness: 0.45, metalness: 0.5 }),
      stripe: new THREE.MeshStandardMaterial({ color: "#ffffff", map: hazard, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
      crane: new THREE.MeshStandardMaterial({ color: "#e0a92a", roughness: 0.5, metalness: 0.45 }),
      lamp: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#f6eaff", emissiveIntensity: 4, toneMapped: false }),
      water: new THREE.MeshStandardMaterial({ color: "#05070d", roughness: 0.08, metalness: 0.9 }),
      puddle: new THREE.MeshStandardMaterial({ color: "#1a1826", roughness: 0.03, metalness: 0.9, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
      paint: PAINT.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.45 })),
      crate: new THREE.MeshStandardMaterial({ color: "#5c5a3c", roughness: 0.7, metalness: 0.3 }),
      barrier: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#8d8a84", roughness: 0.85 }), concrete, 2),
      signs: SIGNS.map(([, , , , word, tube]) => { const t = signTexture(word, tube); return new THREE.MeshStandardMaterial({ color: "#111", map: t, emissive: "#ffffff", emissiveMap: t, emissiveIntensity: 2.2, roughness: 0.4, toneMapped: false }); }),
    };
  }, []);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose());
    for (const [k, m] of Object.entries(mats)) for (const one of (Array.isArray(m) ? m : [m]) as THREE.MeshStandardMaterial[]) { if (k === "signs" || k === "stripe") one.map?.dispose(); one.dispose(); }
  }, [geo, mats]);

  // every container in the yard: the climbable stacks, the container cover, and (separately, since they move) the crane's boxes
  const fixed = useMemo(() => {
    const boxes = [
      ...a.roofs.slice(1).map((r) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, w: r.x1 - r.x0, d: r.z1 - r.z0, h: r.top - 20 })),
      ...a.cover.filter((k) => k.kind === "container"),
    ];
    return boxes.flatMap((k, i) => containerSlots(k).map((s, j) => ({ ...s, paint: (i * 3 + j * 5) % PAINT.length })));
  }, [a]);
  const moving = useMemo(() => a.shifters.map((k, i) => ({ k, slots: containerSlots(k), paint: (i * 7 + 2) % PAINT.length })), [a]);
  const others = useMemo(() => a.cover.filter((k) => k.kind !== "container").map((k) => ({ k, y: B + surfaceAt(a, k.x, k.z), x: sx + k.x, z: sz + k.z })), [a, sx, sz, B]);
  const skyline = useMemo(() => {
    const by = new Map<BuildingModelId, GlbInstance[]>();
    for (const [dx, dz, id, h] of SKYLINE) by.set(id, [...(by.get(id) ?? []), { x: sx + dx, y: B + WATER - 1, z: sz + dz, yaw: Math.atan2(-dx, -dz), scale: h / BUILDING_MODELS[id].height }]);
    return [...by.entries()];
  }, [sx, sz, B]);

  const shifting = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const t = state.clock;
    // the crane's boxes come down from its height and go back up to it
    moving.forEach(({ k }, i) => {
      const g = shifting.current[i]; if (!g) return;
      const lift = shifterLift(a, k, t);
      g.visible = lift > 0.02; g.position.y = B + 20 + (1 - lift) * 14;
    });
    const ev = fractureAt(a, t);
    for (const m of mats.signs) m.emissiveIntensity = ev.warning ? 2.2 + Math.sin(performance.now() / 120) * 0.8 : 2.2;
  });

  const box = (s: { x: number; z: number; y: number; long: boolean; l: number; w: number }, paint: number, key: string, y0: number) => (
    <mesh key={key} geometry={geo.container} material={mats.paint[paint]!} position={[sx + s.x, y0 + s.y, sz + s.z]} rotation-y={s.long ? Math.PI / 2 : 0} scale={[s.w, TIER - 0.04, s.l]} castShadow receiveShadow />
  );
  return (
    <group name="killbox-arena:neon-yard">
      <hemisphereLight args={["#9a8cff", "#ff5ad8", 1.35]} />
      {!phone && MASTS.map(([dx, dz, col], i) => <pointLight key={i} position={[sx + dx * 0.92, B + 31, sz + dz * 0.92]} color={col} intensity={900} distance={60} decay={2} />)}
      <mesh geometry={geo.water} material={mats.water} />
      <mesh geometry={geo.pier} material={mats.pier} receiveShadow />
      <mesh geometry={geo.top} material={mats.top} receiveShadow />
      <mesh geometry={geo.lines} material={mats.lines} />
      <mesh geometry={geo.puddles} material={mats.puddle} />
      <mesh geometry={geo.stripes} material={mats.stripe} />
      <mesh geometry={geo.steps} material={mats.steel} castShadow receiveShadow />
      <mesh geometry={geo.rails} material={mats.rail} castShadow />
      <mesh geometry={geo.crane} material={mats.crane} castShadow />
      <mesh geometry={geo.masts} material={mats.steel} />
      <mesh geometry={geo.lamps} material={mats.lamp} />
      {fixed.map((s, i) => box(s, s.paint, `c${i}`, B + 20))}
      {moving.map(({ k, slots, paint }, i) => (
        <group key={k.id} ref={(g) => { shifting.current[i] = g; }}>
          {slots.map((s, j) => box(s, paint, `${k.id}:${j}`, 0))}
        </group>
      ))}
      {others.map(({ k, x, y, z }) => k.kind === "crate"
        ? <mesh key={k.id} geometry={geo.crate} material={mats.crate} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />
        : <mesh key={k.id} geometry={geo.barrier} material={mats.barrier} position={[x, y, z]} rotation-y={k.d > k.w ? 0 : Math.PI / 2} scale={[Math.min(k.w, k.d), k.h, Math.max(k.w, k.d)]} castShadow receiveShadow />)}
      {SIGNS.map(([dx, dz, yaw, y, word], i) => <mesh key={`${word}${i}`} geometry={geo.sign} material={mats.signs[i]!} position={[sx + dx, B + 20 + y, sz + dz]} rotation-y={yaw} scale={[5.2, 1.3, 1]} />)}
      {skyline.map(([id, items]) => <InstancedGlb key={id} url={BUILDING_MODELS[id].url} items={items} shadows={false} nightGlow={[0.6, 1.8]} windowScale={1.4} />)}
      <ArenaWeather kind="rain" center={{ x: sx, y: B + 14, z: sz }} count={phone ? 500 : 1800} size={110} />
    </group>
  );
}
