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
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";
import { ArenaWeather } from "./ArenaWeather";
import { InstancedGlb, facadeTexture, type GlbInstance } from "./InstancedGlb";
import { floorStrip, hazardTexture, jerseyBarrier, slab, towerShell } from "./arena-parts";

/** Glass Spire (killbox-arenas.ts GLASS_SPIRE), after the owner's PvP maps board: the crown of a glass corporate tower in Nexus City
 * at night in light rain. A curtain-wall tower with steel fins drops away under the plaza; the plaza is polished dark stone with cyan
 * inlay lines; the Spire Crown in the middle is a glass-sided platform under a beam of light and turning holo rings; the sky gardens
 * down each flank are turf with hedges in troughs beyond their glass balustrades. Cover: planters with shrubs, stone pillars with light
 * strips, info kiosks, concrete barriers. In the Spire Shatter every glass panel on the plaza bursts into shards that fall and lie on
 * the stone while its frame sinks, and steel blast shutters rise out of the floor slots. City lights far below, Nexus and Neon towers
 * all round. Drawn from the same data its decks and walls come from. */

const DROP = 140; // the tower's street lies this far below the arena base
const SKYLINE: readonly [number, number, BuildingModelId, number][] = [
  [-125, 95, "neon-tower-b", 230], [-40, 150, "neon-tower-a", 260], [55, 145, "nexus-spire", 250], [135, 85, "neon-tower-c", 215],
  [165, -15, "neon-tower-a", 205], [125, -100, "nexus-spire", 240], [40, -150, "neon-tower-c", 225], [-55, -145, "neon-tower-b", 265],
  [-135, -85, "nexus-spire", 235], [-165, 10, "neon-tower-c", 210], [-230, 200, "neon-tower-a", 300], [230, -200, "neon-tower-b", 300],
];
const LIGHTS: readonly [number, number, string][] = [[-26, 28, "#38e8ff"], [26, -28, "#38e8ff"], [26, 28, "#c46bff"], [-26, -28, "#c46bff"]];
const SHARDS = 22; // per glass panel

/** a vertical fade (opaque at the foot, clear at the top) for the light column */
function fadeTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 4; c.height = 128;
  const x = c.getContext("2d")!, g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "#000"); g.addColorStop(0.5, "#666"); g.addColorStop(1, "#fff"); x.fillStyle = g; x.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}

/** city lights seen from 140 m up: a dark ground scattered with warm and cyan points and a few street lines */
function cityTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 1024;
  const x = c.getContext("2d")!;
  x.fillStyle = "#04050a"; x.fillRect(0, 0, 1024, 1024);
  x.globalAlpha = 0.5;
  for (let i = 0; i < 1024; i += 64) { x.fillStyle = i % 128 ? "#4a3a20" : "#1c4a5a"; x.fillRect(i, 0, 3, 1024); x.fillRect(0, i, 1024, 3); }
  x.globalAlpha = 1;
  for (let i = 0; i < 2600; i++) { x.fillStyle = Math.random() < 0.7 ? "#ffcf7a" : Math.random() < 0.6 ? "#7ff4ff" : "#ff6ad8"; const s = Math.random() < 0.9 ? 2 : 4; x.fillRect(Math.random() * 1024, Math.random() * 1024, s, s); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t;
}
/** a glass panel's face: a faint cyan tint, a bright frame line and the Spire's chevron etched in */
function paneTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, "rgba(150,235,255,0.55)"); g.addColorStop(1, "rgba(40,120,170,0.25)");
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = "#bdf6ff"; x.lineWidth = 4; x.strokeRect(3, 3, 250, 122);
  x.lineWidth = 3; x.beginPath(); x.moveTo(98, 84); x.lineTo(128, 44); x.lineTo(158, 84); x.stroke();
  x.globalAlpha = 0.35; x.lineWidth = 2; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(20 + i * 50, 120); x.lineTo(60 + i * 50, 8); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** the holo sign text in tube light */
function signTexture(word: string, tube: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 1024; c.height = 192;
  const x = c.getContext("2d")!;
  x.font = "bold 120px 'Arial Black', Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.shadowColor = tube; x.shadowBlur = 30; x.fillStyle = tube; x.fillText(word, 512, 100); x.shadowBlur = 8; x.fillStyle = "#f4feff"; x.fillText(word, 512, 100);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function GlassSpireView({ arena: a, state }: { arena: Arena; state: PvpState }) {
  const { x: sx, z: sz } = a.site, B = a.base;
  const phone = useMemo(() => isTouchDevice(), []);
  const plain = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k); return n; };

  const geo = useMemo(() => {
    const W = (dx: number, dz: number) => ({ x: sx + dx, z: sz + dz });
    const plaza = a.roofs.find((r) => r.id === "plaza")!, crown = a.roofs.find((r) => r.id === "crown")!, gardens = a.roofs.filter((r) => r.id.endsWith("garden"));
    // the tower: a curtain wall under the plaza and a lower wing under each garden, with steel fins up the glass every 4 m
    const blocks = [plaza, ...gardens].map((r) => ({ p: W(r.x0, r.z0), q: W(r.x1, r.z1), top: B + r.top - 0.4 }));
    const shell = mergeGeometries(blocks.map((b) => towerShell(b.p.x, b.q.x, b.p.z, b.q.z, B - DROP, b.top)))!;
    const fins: THREE.BufferGeometry[] = [];
    for (const b of blocks) {
      const h = b.top - (B - DROP), y = (B - DROP + b.top) / 2;
      for (let x = b.p.x; x <= b.q.x + 0.01; x += 4) fins.push(plain(slab(x, y, b.p.z - 0.25, 0.18, h, 0.5)), plain(slab(x, y, b.q.z + 0.25, 0.18, h, 0.5)));
      for (let z = b.p.z; z <= b.q.z + 0.01; z += 4) fins.push(plain(slab(b.p.x - 0.25, y, z, 0.5, h, 0.18)), plain(slab(b.q.x + 0.25, y, z, 0.5, h, 0.18)));
    }
    // the floor slabs (a stone band round each roof's edge) and the crown's glass body
    const bodies = mergeGeometries([plaza, ...gardens].map((r) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return plain(slab(c.x, B + r.top - 0.6, c.z, r.x1 - r.x0 + 0.4, 1.2, r.z1 - r.z0 + 0.4)); }))!;
    const cc = W(0, 0), crownBody = plain(slab(cc.x, B + (plaza.top + crown.top) / 2 - 0.05, cc.z, crown.x1 - crown.x0, crown.top - plaza.top - 0.1, crown.z1 - crown.z0));
    const crownGlass = towerShell(cc.x + crown.x0 - 0.02, cc.x + crown.x1 + 0.02, cc.z + crown.z0 - 0.02, cc.z + crown.z1 + 0.02, B + plaza.top, B + crown.top - 0.2);
    const crownCap = plain(slab(cc.x, B + crown.top - 0.1, cc.z, crown.x1 - crown.x0 + 0.3, 0.2, crown.z1 - crown.z0 + 0.3));
    // walking surfaces
    const surf = (r: typeof plaza) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(-Math.PI / 2).translate(c.x, B + r.top + 0.01, c.z); };
    const stone = mergeGeometries([surf(plaza), surf(crown)])!, turf = mergeGeometries(gardens.map(surf))!;
    // cyan inlay: two squares round the crown, lines out to the stairs and the spawn ends, and the crown's light edges
    const inlay: THREE.BufferGeometry[] = [], y0 = B + plaza.top + 0.02;
    const line = (ax: number, az: number, bx: number, bz: number, w = 0.12, y = y0) => inlay.push(floorStrip(sx + ax, sz + az, sx + bx, sz + bz, w, y));
    for (const r of [9.5, 12.5]) { line(-r, -r, r, -r); line(r, -r, r, r); line(r, r, -r, r); line(-r, r, -r, -r); }
    for (const s of [-1, 1]) { line(-27, s * 18, 27, s * 18, 0.08); line(s * 18, -29, s * 18, 29, 0.08); }
    const glow: THREE.BufferGeometry[] = [];
    for (const [y, inset] of [[crown.top - 0.25, 0], [plaza.top + 0.15, 0]] as const) {
      const h = (crown.x1 - crown.x0) / 2 + 0.03 - inset;
      glow.push(plain(slab(cc.x, B + y, cc.z - h, h * 2, 0.08, 0.06)), plain(slab(cc.x, B + y, cc.z + h, h * 2, 0.08, 0.06)), plain(slab(cc.x - h, B + y, cc.z, 0.06, 0.08, h * 2)), plain(slab(cc.x + h, B + y, cc.z, 0.06, 0.08, h * 2)));
    }
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) glow.push(plain(slab(cc.x + x * 6.02, B + (plaza.top + crown.top) / 2, cc.z + z * 6.02, 0.08, crown.top - plaza.top, 0.08)));
    // stairs: 0.25 m treads with handrails where the walkway has rails
    const steps: THREE.BufferGeometry[] = [], rails: THREE.BufferGeometry[] = [];
    for (const k of a.walks) {
      const c = W(k.x, k.z), rise = k.topB - k.top, n = Math.max(2, Math.round(Math.abs(rise) / 0.25)), run = k.length / n, ax = k.along === "x", lo = Math.min(k.top, k.topB);
      for (let i = 0; i < n; i++) {
        const s = -k.length / 2 + (i + 0.5) * run, h = k.top + rise * ((i + 1) / n);
        steps.push(plain(slab(c.x + (ax ? s : 0), B + lo + (h - lo) / 2, c.z + (ax ? 0 : s), ax ? run + 0.01 : k.width, Math.max(0.05, h - lo), ax ? k.width : run + 0.01)));
      }
      if (!k.rails) continue;
      for (const side of [-1, 1]) {
        const ox = ax ? 0 : side * (k.width / 2 - 0.08), oz = ax ? side * (k.width / 2 - 0.08) : 0, len = Math.hypot(k.length, rise), tilt = Math.atan2(rise, k.length);
        const tube = new THREE.BoxGeometry(ax ? len : 0.06, 0.06, ax ? 0.06 : len);
        if (ax) tube.rotateZ(tilt); else tube.rotateX(-tilt);
        rails.push(plain(tube.translate(c.x + ox, B + (k.top + k.topB) / 2 + 1, c.z + oz)));
        for (let i = 0; i <= 4; i++) { const s = -k.length / 2 + (i / 4) * k.length, h = k.top + rise * (i / 4); rails.push(plain(slab(c.x + ox + (ax ? s : 0), B + h + 0.5, c.z + oz + (ax ? 0 : s), 0.06, 1, 0.06))); }
      }
    }
    // glass balustrades on every parapet line: steel posts and a cap rail, a glass panel between, a light strip at its foot
    const parapets = arenaParapets(a), glass: THREE.BufferGeometry[] = [], ledLines: THREE.BufferGeometry[] = [];
    for (const p of parapets) {
      const len = Math.hypot(p.bx - p.ax, p.bz - p.az), yaw = Math.atan2(p.bx - p.ax, p.bz - p.az), mx = (p.ax + p.bx) / 2, mz = (p.az + p.bz) / 2, floor = p.base + 0.5;
      const n = Math.max(1, Math.round(len / 1.6));
      for (let i = 0; i <= n; i++) { const t = i / n; rails.push(plain(slab(p.ax + (p.bx - p.ax) * t, floor + 0.55, p.az + (p.bz - p.az) * t, 0.07, 1.1, 0.07))); }
      rails.push(plain(new THREE.BoxGeometry(0.1, 0.06, len).rotateY(yaw).translate(mx, floor + 1.1, mz)));
      glass.push(plain(new THREE.BoxGeometry(0.03, 0.95, len).rotateY(yaw).translate(mx, floor + 0.55, mz)));
      ledLines.push(plain(new THREE.BoxGeometry(0.08, 0.05, len).rotateY(yaw).translate(mx, floor + 0.04, mz)));
    }
    // hedges in a trough hung outside each garden's outer edge
    const hedges: THREE.BufferGeometry[] = [], troughs: THREE.BufferGeometry[] = [];
    for (const r of gardens) {
      const out = r.x0 < 0 ? r.x0 - 0.9 : r.x1 + 0.9, x = sx + out;
      troughs.push(plain(slab(x, B + r.top - 0.1, sz + (r.z0 + r.z1) / 2, 1.4, 0.9, r.z1 - r.z0)));
      for (let z = r.z0 + 1; z <= r.z1 - 1; z += 1.9) hedges.push(plain(canopyCluster(Math.round(z * 7 + out)).scale(0.9, 0.75, 1.1).translate(x, B + r.top + 0.55, sz + z)));
    }
    // shrubs on every planter, a small tree on the long ones
    for (const k of a.cover.filter((q) => q.kind === "planter")) {
      const c = W(k.x, k.z), top = B + surfaceAt(a, k.x, k.z) + k.h, long = Math.max(k.w, k.d), n = Math.max(1, Math.round(long / 1.4)), alongX = k.w >= k.d;
      for (let i = 0; i < n; i++) { const s = -long / 2 + (i + 0.5) * (long / n); hedges.push(plain(canopyCluster(i + Math.round(k.x * 3 + k.z)).scale(0.6, 0.5, 0.6).translate(c.x + (alongX ? s : 0), top + 0.25, c.z + (alongX ? 0 : s)))); }
    }
    // the city far below and a column of light over the crown
    const city = new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2).translate(sx, B - DROP, sz);
    const beam = new THREE.CylinderGeometry(0.8, 3.2, 60, 32, 1, true).translate(cc.x, B + crown.top + 30, cc.z);
    const ring = new THREE.TorusGeometry(1, 0.035, 8, 96).rotateX(Math.PI / 2);
    const sign = new THREE.PlaneGeometry(1, 1);
    // the glass panels' shards: small slivers of glass, one instanced draw for them all
    const shard = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.12, 0, 0), new THREE.Vector3(0.12, 0, 0.02), new THREE.Vector3(0.02, 0.32, 0)]); shard.computeVertexNormals();
    return {
      shell, fins: mergeGeometries(fins)!, bodies, crownBody, crownGlass, crownCap, stone, turf, inlay: mergeGeometries(inlay)!, glow: mergeGeometries(glow)!,
      steps: mergeGeometries(steps)!, rails: mergeGeometries(rails)!, glass: mergeGeometries(glass)!, led: mergeGeometries(ledLines)!,
      hedges: mergeGeometries(hedges)!, troughs: mergeGeometries(troughs)!, city, beam, ring, sign, shard,
      box: new THREE.BoxGeometry(1, 1, 1), crate: equipmentCase(), barrier: jerseyBarrier(),
    };
  }, [a, sx, sz, B]); // eslint-disable-line react-hooks/exhaustive-deps

  const mats = useMemo(() => {
    const concrete = weatheredConcreteTexture(), fac = facadeTexture(), hazard = hazardTexture(), pane = paneTexture(), city = cityTexture();
    return {
      // blue-black curtain glass with the lit-window grid
      shell: new THREE.MeshStandardMaterial({ color: "#1c2a3c", map: fac, emissive: "#ffffff", emissiveMap: fac, emissiveIntensity: 1.1, roughness: 0.15, metalness: 0.75 }),
      crownGlass: new THREE.MeshStandardMaterial({ color: "#3a6a88", map: fac, emissive: "#7ff4ff", emissiveMap: fac, emissiveIntensity: 0.9, roughness: 0.08, metalness: 0.7 }),
      fin: new THREE.MeshStandardMaterial({ color: "#3a4250", roughness: 0.35, metalness: 0.85 }),
      body: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#5c606a", roughness: 0.5 }), concrete, 3),
      crown: new THREE.MeshStandardMaterial({ color: "#1a3346", roughness: 0.08, metalness: 0.85, emissive: "#0c3a52", emissiveIntensity: 0.7 }),
      // polished dark stone that takes the lights
      stone: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#3a3d48", roughness: 0.18, metalness: 0.3 }), concrete, 4),
      turf: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#35543a", roughness: 0.9 }), concrete, 2),
      inlay: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#38e8ff", emissiveIntensity: 2.2, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      glow: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#7ff4ff", emissiveIntensity: 3, toneMapped: false }),
      steel: new THREE.MeshStandardMaterial({ color: "#a3aab5", roughness: 0.35, metalness: 0.7 }),
      glass: new THREE.MeshStandardMaterial({ color: "#9fe6ff", roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.22, depthWrite: false }),
      led: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#c46bff", emissiveIntensity: 2.5, toneMapped: false }),
      hedge: new THREE.MeshStandardMaterial({ color: "#2f6a34", roughness: 0.85 }),
      planter: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#8f8a80", roughness: 0.8 }), concrete, 2),
      pillar: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#2a2c34", roughness: 0.25, metalness: 0.4 }), concrete, 2),
      kiosk: new THREE.MeshStandardMaterial({ color: "#1c2028", roughness: 0.35, metalness: 0.7 }),
      screen: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#38e8ff", emissiveIntensity: 1.8, toneMapped: false }),
      crate: new THREE.MeshStandardMaterial({ color: "#4a4e58", roughness: 0.6, metalness: 0.4 }),
      barrier: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#9a968e", roughness: 0.85 }), concrete, 2),
      pane: new THREE.MeshStandardMaterial({ color: "#ffffff", map: pane, emissive: "#38c8ff", emissiveIntensity: 0.35, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
      shard: new THREE.MeshStandardMaterial({ color: "#c8f4ff", emissive: "#38c8ff", emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
      shutter: new THREE.MeshStandardMaterial({ color: "#5d636d", roughness: 0.45, metalness: 0.8 }),
      stripe: new THREE.MeshStandardMaterial({ color: "#ffffff", map: hazard, roughness: 0.5 }),
      slot: new THREE.MeshStandardMaterial({ color: "#14161b", roughness: 0.4, metalness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
      city: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ffffff", emissiveMap: city, emissiveIntensity: 1.2, roughness: 1 }),
      beam: new THREE.MeshBasicMaterial({ color: "#5fdcff", alphaMap: fadeTexture(), transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }),
      ring: new THREE.MeshBasicMaterial({ color: "#8ff6ff", toneMapped: false }),
      signs: [["NEXUS", "#38e8ff"], ["GLASS SPIRE", "#c46bff"]].map(([w, c]) => { const t = signTexture(w!, c!); return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }); }),
    };
  }, []);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose());
    for (const [k, m] of Object.entries(mats)) for (const one of (Array.isArray(m) ? m : [m]) as THREE.MeshStandardMaterial[]) { if (k === "signs" || k === "pane" || k === "city" || k === "stripe") one.map?.dispose(); if (k === "beam") one.alphaMap?.dispose(); if (k === "city") one.emissiveMap?.dispose(); one.dispose(); }
  }, [geo, mats]);

  const props = useMemo(() => a.cover.map((k) => ({ k, x: sx + k.x, y: B + surfaceAt(a, k.x, k.z), z: sz + k.z })), [a, sx, sz, B]);
  const shifters = useMemo(() => { let n = 0; return a.shifters.map((k) => ({ k, x: sx + k.x, y: B + surfaceAt(a, k.x, k.z), z: sz + k.z, glass: k.phase === "up", pane: k.phase === "up" ? n++ : -1 })); }, [a, sx, sz, B]);
  const glassPanels = useMemo(() => shifters.filter((s) => s.glass), [shifters]);
  // each shard's start on its panel and its throw, seeded so every panel breaks the same way each time
  const shardSeeds = useMemo(() => glassPanels.flatMap(({ k }, p) => Array.from({ length: SHARDS }, (_, i) => {
    const r = (n: number) => { const v = Math.sin((p * 97 + i * 13 + n * 7) * 12.9898) * 43758.5453; return v - Math.floor(v); };
    const along = (r(1) - 0.5) * Math.max(k.w, k.d), up = r(2) * k.h, push = (r(3) - 0.5) * 4, spin = r(4) * Math.PI * 2;
    return { p, along, up, push, spin, side: (r(5) - 0.5) * 2.4, tilt: r(6) * Math.PI };
  })), [glassPanels]);
  const skyline = useMemo(() => {
    const by = new Map<BuildingModelId, GlbInstance[]>();
    for (const [dx, dz, id, h] of SKYLINE) by.set(id, [...(by.get(id) ?? []), { x: sx + dx, y: B - DROP, z: sz + dz, yaw: Math.atan2(-dx, -dz), scale: h / BUILDING_MODELS[id].height }]);
    return [...by.entries()];
  }, [sx, sz, B]);

  const moving = useRef<(THREE.Group | null)[]>([]), panes = useRef<(THREE.Mesh | null)[]>([]), shardMesh = useRef<THREE.InstancedMesh>(null), rings = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const t = state.clock, f = a.fracture, ev = fractureAt(a, t);
    shifters.forEach(({ k, glass, pane }, i) => {
      const g = moving.current[i]; if (!g) return;
      const lift = shifterLift(a, k, t);
      // frames and shutters sink into / rise out of their floor slots; a glass pane is gone the instant the event breaks it
      g.position.y = (lift - 1) * (k.h + 0.05); g.visible = lift > 0.01;
      const p = glass ? panes.current[pane] : null; if (p) p.visible = !ev.active;
    });
    // shards: thrown out of each panel as the event starts, falling under gravity onto the stone, gone when the event ends
    const m = shardMesh.current;
    if (m) {
      const into = ev.active ? (t - f.first) % f.every : -1;
      m.visible = into >= 0;
      if (into >= 0) {
        shardSeeds.forEach((s, i) => {
          const { k, x, y, z } = glassPanels[s.p]!, wide = k.w >= k.d, tt = Math.min(into, 3);
          const h = Math.max(0.02, k.h * 0.5 + s.up * 0.5 + 1.5 * tt - 4.9 * tt * tt), out = s.push * Math.min(tt, 0.7) * 1.4, lat = s.side * Math.min(tt, 0.7);
          const landed = h <= 0.02;
          tmp.position.set(x + (wide ? s.along + lat * 0.3 : out), y + h, z + (wide ? out : s.along + lat * 0.3));
          tmp.rotation.set(landed ? -Math.PI / 2 : s.tilt + tt * 6, s.spin, landed ? 0 : tt * 4); tmp.scale.setScalar(1);
          tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix);
        });
        m.instanceMatrix.needsUpdate = true;
      }
    }
    // the holo rings turn over the crown; they flicker in the warning
    const r = rings.current;
    if (r) { r.children.forEach((c, i) => { c.rotation.y += dt * (0.3 + i * 0.15) * (i % 2 ? -1 : 1); }); mats.ring.color.set(ev.warning && Math.sin(performance.now() / 90) > 0 ? "#ff6ad8" : "#8ff6ff"); }
    mats.beam.opacity = ev.active ? 0.05 : 0.12;
  });

  const cc = { x: sx, z: sz }, crownTop = B + 25;
  return (
    <group name="killbox-arena:glass-spire">
      <hemisphereLight args={["#9ab4ff", "#4a3a6a", 1.5]} />
      {!phone && LIGHTS.map(([dx, dz, col], i) => <pointLight key={i} position={[sx + dx, B + 30, sz + dz]} color={col} intensity={700} distance={55} decay={2} />)}
      {!phone && [-35, 35].map((dx) => <pointLight key={dx} position={[sx + dx, B + 24, sz]} color="#9affc8" intensity={350} distance={34} decay={2} />)}
      {!phone && <pointLight position={[cc.x, crownTop + 6, cc.z]} color="#7ff4ff" intensity={500} distance={40} decay={2} />}
      <mesh geometry={geo.city} material={mats.city} />
      <mesh geometry={geo.shell} material={mats.shell} />
      <mesh geometry={geo.fins} material={mats.fin} />
      <mesh geometry={geo.bodies} material={mats.body} receiveShadow />
      <mesh geometry={geo.crownBody} material={mats.crown} castShadow receiveShadow />
      <mesh geometry={geo.crownGlass} material={mats.crownGlass} />
      <mesh geometry={geo.crownCap} material={mats.body} receiveShadow />
      <mesh geometry={geo.stone} material={mats.stone} receiveShadow />
      <mesh geometry={geo.turf} material={mats.turf} receiveShadow />
      <mesh geometry={geo.inlay} material={mats.inlay} />
      <mesh geometry={geo.glow} material={mats.glow} />
      <mesh geometry={geo.steps} material={mats.steel} castShadow receiveShadow />
      <mesh geometry={geo.rails} material={mats.steel} castShadow />
      <mesh geometry={geo.glass} material={mats.glass} />
      <mesh geometry={geo.led} material={mats.led} />
      <mesh geometry={geo.troughs} material={mats.planter} />
      <mesh geometry={geo.hedges} material={mats.hedge} castShadow />
      <mesh geometry={geo.beam} material={mats.beam} />
      <group ref={rings} position={[cc.x, 0, cc.z]}>
        {[[3.6, 30], [5.2, 34], [2.6, 38]].map(([s, y], i) => <mesh key={i} geometry={geo.ring} material={mats.ring} position-y={B + y!} scale={[s!, 1, s!]} rotation-z={i * 0.25} />)}
      </group>
      {([[40, 0], [-40, Math.PI]] as const).map(([dz, yaw], i) => <mesh key={i} geometry={geo.sign} material={mats.signs[i]!} position={[sx, B + 34, sz + dz]} rotation-y={yaw + Math.PI} scale={[26, 4.9, 1]} />)}
      {props.map(({ k, x, y, z }) => {
        if (k.kind === "planter") return <mesh key={k.id} geometry={geo.box} material={mats.planter} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />;
        if (k.kind === "pillar") return (
          <group key={k.id} position={[x, y, z]}>
            <mesh geometry={geo.box} material={mats.pillar} position-y={k.h / 2} scale={[k.w, k.h, k.d]} castShadow receiveShadow />
            {[0, 1, 2, 3].map((s) => <mesh key={s} geometry={geo.box} material={mats.glow} position={[Math.sin((s * Math.PI) / 2) * (k.w / 2 + 0.01), k.h / 2, Math.cos((s * Math.PI) / 2) * (k.d / 2 + 0.01)]} rotation-y={(s * Math.PI) / 2} scale={[0.12, k.h - 0.6, 0.02]} />)}
            <mesh geometry={geo.box} material={mats.fin} position-y={k.h + 0.06} scale={[k.w + 0.2, 0.12, k.d + 0.2]} />
          </group>
        );
        if (k.kind === "console") return (
          <group key={k.id} position={[x, y, z]}>
            <mesh geometry={geo.box} material={mats.kiosk} position-y={k.h / 2} scale={[k.w, k.h, k.d]} castShadow receiveShadow />
            {[0, 1, 2, 3].map((s) => <mesh key={s} geometry={geo.sign} material={mats.screen} position={[Math.sin((s * Math.PI) / 2) * (k.w / 2 + 0.01), k.h * 0.62, Math.cos((s * Math.PI) / 2) * (k.d / 2 + 0.01)]} rotation-y={(s * Math.PI) / 2} scale={[k.w * 0.7, k.h * 0.45, 1]} />)}
          </group>
        );
        if (k.kind === "crate") return <mesh key={k.id} geometry={geo.crate} material={mats.crate} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />;
        return <mesh key={k.id} geometry={geo.barrier} material={mats.barrier} position={[x, y, z]} rotation-y={k.d > k.w ? 0 : Math.PI / 2} scale={[Math.min(k.w, k.d), k.h, Math.max(k.w, k.d)]} castShadow receiveShadow />;
      })}
      {shifters.map(({ k, x, y, z }) => <mesh key={`slot:${k.id}`} geometry={geo.box} material={mats.slot} position={[x, y + 0.012, z]} scale={[k.w + 0.2, 0.02, k.d + 0.2]} />)}
      {shifters.map(({ k, x, y, z, glass, pane }, i) => {
        const wide = k.w >= k.d, len = Math.max(k.w, k.d), thick = Math.min(k.w, k.d);
        return (
          <group key={k.id} position={[x, y, z]}>
            <group ref={(g) => { moving.current[i] = g; }}>
              {glass ? (
                <group rotation-y={wide ? 0 : Math.PI / 2}>
                  {/* the steel frame: two posts and a head and sill rail */}
                  {[-1, 1].map((s) => <mesh key={s} geometry={geo.box} material={mats.steel} position={[s * (len / 2 - 0.08), k.h / 2, 0]} scale={[0.16, k.h, 0.22]} castShadow />)}
                  <mesh geometry={geo.box} material={mats.steel} position-y={k.h - 0.06} scale={[len, 0.12, 0.22]} />
                  <mesh geometry={geo.box} material={mats.steel} position-y={0.08} scale={[len, 0.16, 0.26]} />
                  <mesh geometry={geo.box} material={mats.glow} position-y={0.17} scale={[len - 0.3, 0.03, 0.27]} />
                  <mesh ref={(m) => { panes.current[pane] = m; }} geometry={geo.sign} material={mats.pane} position-y={k.h / 2 + 0.02} scale={[len - 0.32, k.h - 0.3, 1]} />
                </group>
              ) : (
                <group rotation-y={wide ? 0 : Math.PI / 2}>
                  {/* the blast shutter: ribbed steel slats with a hazard-striped head */}
                  {Array.from({ length: Math.round(k.h / 0.3) }, (_, s) => <mesh key={s} geometry={geo.box} material={mats.shutter} position-y={0.15 + s * 0.3} scale={[len, 0.27, thick * 0.5]} castShadow receiveShadow />)}
                  <mesh geometry={geo.box} material={mats.stripe} position-y={k.h - 0.05} scale={[len + 0.1, 0.22, thick * 0.6]} />
                </group>
              )}
            </group>
          </group>
        );
      })}
      <instancedMesh ref={shardMesh} args={[geo.shard, mats.shard, shardSeeds.length]} visible={false} frustumCulled={false} />
      {skyline.map(([id, items]) => <InstancedGlb key={id} url={BUILDING_MODELS[id].url} items={items} shadows={false} nightGlow={[0.6, 1.8]} windowScale={1.4} />)}
      <ArenaWeather kind="rain" center={{ x: sx, y: B + 14, z: sz }} count={phone ? 400 : 1400} size={100} />
    </group>
  );
}
