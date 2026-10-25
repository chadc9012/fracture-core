import { useMemo, type ReactNode, type RefObject } from "react";
import * as THREE from "three";

import { SITES, type Site } from "@/game/region-atlas";
import { walkHeight } from "@/game/terrain";
import { mulberry32 } from "@/game/rng";
import { chippedBlock, flutedColumn, organicRock, saggingTent } from "@/game/organic-geometry";
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";
import { NearOnly } from "./NearOnly";
import { ReclaimedCity } from "./ReclaimedCity";
import { CITY } from "@/game/reclaimed-city";
import { InstancedFleet, type FleetInstance } from "./InstancedFleet";
import type { FleetModelId } from "@/game/fleet-models";

/**
 * Set pieces for the board's named wilderness sites (region-atlas.ts): each site stands something of its kind so the
 * map's names are places you can find — a temple of stepped stone and columns, ruins of broken walls, a village of huts
 * with lanterns, a cave mouth framed in boulders, a spire of crystal / obsidian / ice by region, a raider camp with tents
 * and fire, a research station of domes and masts, a scrapyard and an abandoned highway of real wrecked cars, a crater
 * rim, a forge. Only sites near the player are mounted (NearOnly). Cities draw their own districts.
 */
type Pal = { stone: string; dark: string; glow: string; accent: string };
const PAL: Record<string, Pal> = {
  wastelands: { stone: "#9a7b5c", dark: "#4a3a2c", glow: "#ffb347", accent: "#ff6a2a" },
  veridan: { stone: "#7d8a72", dark: "#3a4434", glow: "#b8ff9a", accent: "#7ce07a" },
  frostspire: { stone: "#c9d6e2", dark: "#5c6a78", glow: "#9fe8ff", accent: "#bfefff" },
  ember: { stone: "#3a3236", dark: "#1c1719", glow: "#ff5a1a", accent: "#ff8a3a" },
  solara: { stone: "#c8a98a", dark: "#6a5240", glow: "#c77dff", accent: "#e0b0ff" },
  swamps: { stone: "#5f6a58", dark: "#2c3428", glow: "#b6ff7a", accent: "#7fd8a0" },
};

const mats = new Map<string, THREE.MeshStandardMaterial>();
function M(color: string, rough = 0.85, metal = 0.05, emissive?: string, ei = 0): THREE.MeshStandardMaterial {
  const k = `${color}|${rough}|${metal}|${emissive}|${ei}`;
  let m = mats.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...(emissive ? { emissive, emissiveIntensity: ei } : {}) });
    // matte, unlit surfaces (stone, timber, canvas) carry the world-space weathering detail: stains, streaks, cracks
    if (!emissive && rough >= 0.7) applyWorldTriplanar(m, weatheredConcreteTexture(), 4);
    mats.set(k, m);
  }
  return m;
}
/* worked-stone geometry, cached by size: chipped blocks and fluted columns instead of raw boxes and 10-sided tubes */
const blocks = new Map<string, THREE.BufferGeometry>();
const blockGeo = (w: number, h: number, d: number) => { const k = `${w.toFixed(1)}|${h.toFixed(1)}|${d.toFixed(1)}`; let g = blocks.get(k); if (!g) { g = chippedBlock(w, h, d, Math.round(w * 13 + h * 7 + d * 3)); blocks.set(k, g); } return g; };
const columns = new Map<string, THREE.BufferGeometry>();
const columnGeo = (h: number, rad: number) => { const k = `${h.toFixed(1)}|${rad.toFixed(2)}`; let g = columns.get(k); if (!g) { g = flutedColumn(h, rad, Math.round(h * 10)); columns.set(k, g); } return g; };
const tentGeo = saggingTent(2.4, 2.8);
const rocks = new Map<string, THREE.BufferGeometry>();
const rockGeo = (seed: number, r: number) => { const k = `${seed}|${r.toFixed(2)}`; let g = rocks.get(k); if (!g) { g = organicRock(r, seed, 1); rocks.set(k, g); } return g; };

function Box({ p, s, m, r = 0 }: { p: [number, number, number]; s: [number, number, number]; m: THREE.Material; r?: number }) {
  return <mesh position={p} rotation-y={r} material={m} geometry={blockGeo(s[0], s[1], s[2])} castShadow receiveShadow />;
}
function Col({ p, h, rad, m, tilt = 0 }: { p: [number, number, number]; h: number; rad: number; m: THREE.Material; tilt?: number }) {
  return <mesh position={p} rotation-z={tilt} material={m} geometry={columnGeo(h, rad)} castShadow receiveShadow />;
}

function Temple({ pal }: { pal: Pal }) {
  const stone = M(pal.stone), dark = M(pal.dark);
  return <group>
    {[0, 1, 2].map((k) => <Box key={k} p={[0, 0.5 + k, 0]} s={[22 - k * 4, 1, 16 - k * 3]} m={stone} />)}
    {[-6, -2, 2, 6].map((x) => [-4, 4].map((z) => <Col key={`${x}${z}`} p={[x, 3, z]} h={7} rad={0.7} m={stone} />))}
    <Box p={[0, 10.4, 0]} s={[16, 0.8, 11]} m={dark} />
    <mesh position={[0, 12, 0]} material={stone} castShadow><coneGeometry args={[8, 3, 4]} /></mesh>
    <pointLight position={[0, 5, 0]} color={pal.glow} intensity={6} distance={18} decay={2} />
  </group>;
}
function Ruins({ pal, seed }: { pal: Pal; seed: number }) {
  const r = mulberry32(seed), stone = M(pal.stone);
  return <group>
    {Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2, d = 6 + r() * 6; return <Col key={i} p={[Math.cos(a) * d, 0, Math.sin(a) * d]} h={1.5 + r() * 6} rad={0.6} m={stone} tilt={(r() - 0.5) * 0.3} />; })}
    {Array.from({ length: 4 }, (_, i) => <Box key={`w${i}`} p={[(r() - 0.5) * 14, 1.2, (r() - 0.5) * 14]} s={[4 + r() * 5, 2.4 + r() * 2, 0.8]} m={stone} r={r() * Math.PI} />)}
    {Array.from({ length: 6 }, (_, i) => <mesh key={`r${i}`} geometry={rockGeo(seed + i, 0.8 + r())} material={stone} position={[(r() - 0.5) * 16, 0.3, (r() - 0.5) * 16]} castShadow />)}
  </group>;
}
function Village({ pal, seed }: { pal: Pal; seed: number }) {
  const r = mulberry32(seed), wall = M(pal.stone), roof = M(pal.dark), lamp = M("#fff1d8", 0.4, 0, pal.glow, 3);
  return <group>
    {Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2 + r() * 0.4, d = 9 + r() * 5, x = Math.cos(a) * d, z = Math.sin(a) * d, w = 4 + r() * 2;
      return <group key={i} position={[x, 0, z]} rotation-y={-a}>
        <Box p={[0, 1.6, 0]} s={[w, 3.2, 4]} m={wall} />
        <mesh position={[0, 4, 0]} rotation-y={Math.PI / 4} material={roof} castShadow><coneGeometry args={[w * 0.82, 1.8, 4]} /></mesh>
        <Box p={[0, 1.2, 2.02]} s={[1, 2, 0.05]} m={roof} />
        <mesh position={[0.9, 2.4, 2.1]} material={lamp}><sphereGeometry args={[0.16, 8, 6]} /></mesh>
      </group>; })}
    <pointLight position={[0, 4, 0]} color={pal.glow} intensity={10} distance={28} decay={2} />
  </group>;
}
function Cave({ pal, seed }: { pal: Pal; seed: number }) {
  const r = mulberry32(seed), stone = M(pal.stone, 0.95), dark = M("#050506", 1);
  return <group>
    {Array.from({ length: 11 }, (_, i) => { const a = Math.PI * (i / 10); return <mesh key={i} geometry={rockGeo(seed + i, 2.2 + r() * 1.4)} material={stone} position={[Math.cos(a) * 6, Math.sin(a) * 6, 0]} castShadow receiveShadow />; })}
    <mesh position={[0, 2.6, -0.6]} material={dark}><circleGeometry args={[4.6, 24, 0, Math.PI]} /></mesh>
    <mesh position={[0, 0.02, -0.6]} rotation-x={-Math.PI / 2} material={dark}><planeGeometry args={[9, 3]} /></mesh>
    <pointLight position={[0, 2, 1]} color={pal.glow} intensity={4} distance={12} decay={2} />
  </group>;
}
function Spire({ pal, regionId }: { pal: Pal; regionId: string }) {
  const crystal = regionId === "solara" || regionId === "frostspire";
  const body = crystal ? M(pal.accent, 0.15, 0.1, pal.glow, regionId === "solara" ? 1.2 : 0.4) : M(pal.dark, 0.35, 0.3, pal.glow, 0.25);
  return <group>
    <mesh position={[0, 18, 0]} material={body} castShadow><coneGeometry args={[4.5, 36, 6]} /></mesh>
    {[0, 1, 2, 3, 4].map((k) => { const a = k * 1.3; return <mesh key={k} position={[Math.cos(a) * 5, 5 + k, Math.sin(a) * 5]} rotation={[Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4]} material={body} castShadow><coneGeometry args={[1.4, 10 + k * 2, 6]} /></mesh>; })}
    <pointLight position={[0, 10, 0]} color={pal.glow} intensity={14} distance={40} decay={2} />
  </group>;
}
function Camp({ pal, seed }: { pal: Pal; seed: number }) {
  const r = mulberry32(seed), cloth = M("#6a4a32", 0.9), wood = M("#3a2a1e", 0.9), fire = M("#ffb347", 0.5, 0, "#ff6a1a", 4), steel = M("#5b6066", 0.5, 0.8);
  return <group>
    {Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2, x = Math.cos(a) * 8, z = Math.sin(a) * 8; return <mesh key={i} position={[x, 1.4, z]} rotation-y={a} material={cloth} geometry={tentGeo} castShadow />; })}
    <mesh position={[0, 0.4, 0]} material={fire}><coneGeometry args={[0.7, 1.2, 7]} /></mesh>
    <pointLight position={[0, 1.6, 0]} color="#ff8a3a" intensity={12} distance={22} decay={2} />
    {Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return <mesh key={`s${i}`} position={[Math.cos(a) * 14, 1.6, Math.sin(a) * 14]} rotation={[0, -a, 0.15 * (r() - 0.5)]} material={i % 3 ? wood : steel} castShadow><cylinderGeometry args={[0.18, 0.26, 3.2, 6]} /></mesh>; })}
  </group>;
}
function Station({ pal }: { pal: Pal }) {
  const shell = M("#dfe6ec", 0.4, 0.3), dark = M("#2a3036", 0.5, 0.7), beacon = M("#ff3030", 0.3, 0, "#ff2020", 5), win = M("#9fe8ff", 0.2, 0, pal.glow, 1.5);
  return <group>
    {([[0, 0, 7], [11, 3, 5], [-10, -4, 5]] as const).map(([x, z, r], i) => <group key={i}><mesh position={[x, 0, z]} material={shell} castShadow><sphereGeometry args={[r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh><Box p={[x, 1.2, z + r - 0.2]} s={[2, 1.2, 0.3]} m={win} /></group>)}
    <Col p={[4, 0, -6]} h={18} rad={0.25} m={dark} />
    <mesh position={[4, 18.4, -6]} material={beacon}><sphereGeometry args={[0.4, 8, 6]} /></mesh>
    <mesh position={[-4, 6, -8]} rotation={[0.6, 0, 0]} material={shell} castShadow><cylinderGeometry args={[3, 0.3, 1.2, 20]} /></mesh>
  </group>;
}
function Outpost({ pal }: { pal: Pal }) {
  const wall = M(pal.stone), dark = M(pal.dark), lamp = M("#fff1d8", 0.4, 0, pal.glow, 3);
  return <group>
    {([[0, -12, 24, 0], [0, 12, 24, 0], [-12, 0, 24, 1], [12, 0, 24, 1]] as const).map(([x, z, l, rot], i) => <Box key={i} p={[x, 2, z]} s={[l, 4, 1]} m={wall} r={rot * Math.PI / 2} />)}
    <Box p={[10, 5, -10]} s={[4, 10, 4]} m={dark} />
    <mesh position={[10, 10.6, -10]} material={lamp}><boxGeometry args={[3, 0.4, 3]} /></mesh>
    <pointLight position={[10, 11, -10]} color={pal.glow} intensity={10} distance={30} decay={2} />
  </group>;
}
function Crater({ pal, seed }: { pal: Pal; seed: number }) {
  const r = mulberry32(seed), stone = M(pal.dark, 0.95), glow = M(pal.glow, 0.4, 0, pal.glow, 1.4);
  return <group>
    {Array.from({ length: 22 }, (_, i) => { const a = (i / 22) * Math.PI * 2, d = 20 + r() * 4; return <mesh key={i} geometry={rockGeo(seed + i, 2 + r() * 2.5)} material={stone} position={[Math.cos(a) * d, 0.6, Math.sin(a) * d]} castShadow receiveShadow />; })}
    <mesh position={[0, 0.15, 0]} rotation-x={-Math.PI / 2} material={glow}><circleGeometry args={[3, 20]} /></mesh>
    <pointLight position={[0, 3, 0]} color={pal.glow} intensity={10} distance={30} decay={2} />
  </group>;
}
function Forge({ pal }: { pal: Pal }) {
  const iron = M("#2a2628", 0.5, 0.8), hot = M("#ff7a2a", 0.4, 0, "#ff4a10", 3), stone = M(pal.stone);
  return <group>
    <Box p={[0, 1, 0]} s={[16, 2, 12]} m={stone} />
    <Box p={[0, 3.4, 0]} s={[6, 2.8, 2.6]} m={iron} />
    <Box p={[0, 5.1, 0]} s={[8, 0.8, 3]} m={iron} />
    <mesh position={[5, 2.3, 3]} material={hot}><cylinderGeometry args={[1.6, 1.8, 0.6, 20]} /></mesh>
    {[-6, 6].map((x) => <Col key={x} p={[x, 2, -5]} h={10} rad={0.9} m={stone} />)}
    <pointLight position={[5, 4, 3]} color="#ff6a2a" intensity={16} distance={26} decay={2} />
  </group>;
}
function Venue({ name, pal }: { name: string; pal: Pal }) {
  // the Wastelands cabaret: a scrap-built hall with rope lights; signage only (no interior)
  const wood = M("#4a3424", 0.85), sign = M("#ff3a3a", 0.3, 0, "#ff2a2a", 3), bulbs = M("#ffd28a", 0.3, 0, "#ffc070", 3);
  return <group>
    <Box p={[0, 4, 0]} s={[18, 8, 12]} m={wood} />
    <Box p={[0, 9.4, 6.3]} s={[11, 2.4, 0.4]} m={sign} />
    {Array.from({ length: 14 }, (_, i) => <mesh key={i} position={[-8.5 + i * 1.3, 7.8, 6.2]} material={bulbs}><sphereGeometry args={[0.14, 6, 4]} /></mesh>)}
    <Box p={[0, 1.6, 6.05]} s={[2.6, 3.2, 0.1]} m={M("#1a0c0c", 0.6)} />
    <pointLight position={[0, 6, 9]} color={pal.accent} intensity={14} distance={26} decay={2} />
  </group>;
}
const WRECK_MODELS: FleetModelId[] = ["muscle-car", "offroad-truck", "luxury-sedan", "tuner", "armored-muscle", "raider-buggy"];
const RUST = ["#5a3b2a", "#6a4a30", "#4a3a30", "#3a3530", "#70503a"];
function Wrecks({ site, count, spread, line }: { site: Site; count: number; spread: number; line?: boolean }) {
  const items = useMemo<FleetInstance[]>(() => {
    const r = mulberry32(site.id.length * 997);
    return Array.from({ length: count }, (_, i) => {
      const x = site.x + (line ? (i - count / 2) * 7 : (r() - 0.5) * spread), z = site.z + (line ? (r() - 0.5) * 6 : (r() - 0.5) * spread);
      return { model: WRECK_MODELS[i % WRECK_MODELS.length]!, x, y: walkHeight(x, z) - 0.15, z, yaw: line ? Math.PI / 2 + (r() - 0.5) * 0.6 : r() * Math.PI * 2, paint: RUST[i % RUST.length]! };
    });
  }, [site, count, spread, line]);
  return <InstancedFleet items={items} shadows={false} />;
}

function Piece({ site }: { site: Site }) {
  const pal = PAL[site.regionId] ?? PAL["wastelands"]!;
  const seed = [...site.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  switch (site.kind) {
    case "temple": return <Temple pal={pal} />;
    case "ruins": return <Ruins pal={pal} seed={seed} />;
    case "village": return <Village pal={pal} seed={seed} />;
    case "cave": return <Cave pal={pal} seed={seed} />;
    case "spire": return <Spire pal={pal} regionId={site.regionId} />;
    case "camp": return <Camp pal={pal} seed={seed} />;
    case "research": return <Station pal={pal} />;
    case "outpost": return <Outpost pal={pal} />;
    case "crater": return <Crater pal={pal} seed={seed} />;
    case "forge": return <Forge pal={pal} />;
    case "lounge": return <Venue name={site.name} pal={pal} />;
    default: return null;
  }
}

const WILD = new Set(["wastelands", "veridan", "frostspire", "ember", "solara", "swamps"]);

export function SiteMarkers({ playerRef }: { playerRef: RefObject<THREE.Object3D> }) {
  const sites = useMemo(() => SITES.filter((s) => WILD.has(s.regionId)), []);
  return <group name="atlas-sites">{sites.map((s) => {
    const y = walkHeight(s.x, s.z);
    let body: ReactNode = <group position={[s.x, y, s.z]} rotation-y={(s.x * 0.013) % (Math.PI * 2)}><Piece site={s} /></group>;
    if (s.kind === "scrapyard") body = <Wrecks site={s} count={18} spread={40} />;
    if (s.kind === "highway") body = <Wrecks site={s} count={8} spread={0} line />;
    if (s.id === CITY.siteId) body = <ReclaimedCity />; // the trailer's jungle-reclaimed city stands on the Ancient Ruins
    return <NearOnly key={s.id} playerRef={playerRef} x={s.x} z={s.z} radius={420} name={`site:${s.id}`}>{body}</NearOnly>;
  })}</group>;
}
