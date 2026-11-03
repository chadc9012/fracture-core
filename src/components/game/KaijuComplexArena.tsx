import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BUILDING_MODELS, type BuildingModelId } from "@/game/building-models";
import { equipmentCase } from "@/game/camp-geometry";
import { isTouchDevice } from "@/game/client-input";
import { arenaParapets, fractureAt, surfaceAt, type KillboxArena as Arena } from "@/game/killbox-arenas";
import type { PvpState } from "@/game/pvp";
import { antennaMast, hvacUnit, lampHead, lampLens, lampPole, waterTank } from "@/game/street-geometry";
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";
import { InstancedGlb, facadeTexture, type GlbInstance } from "./InstancedGlb";
import { ArenaWeather } from "./ArenaWeather";
import { jerseyBarrier, slab, towerShell } from "./arena-parts";

/** Kaiju Complex (killbox-arenas.ts KAIJU_COMPLEX), drawn from the same data its decks and walls come from so what you see is what you
 * stand on. Neon City at night in the rain: lit tower blocks with floor ledges, corner piers and a cornice rising out of a wet neon
 * street (lamps, parked cars), concrete roofs with metal-capped parapets, pipe runs, skylights and standing water, steel catwalks
 * and the billboard bridge across the street, rooftop plant as cover, neon signs, and the authored Neon towers for the skyline.
 * During the Billboard Blackout every sign, window and lamp fades out. World space: arena space maps to it with site and base. */

/** a neon sign face: bold word on a dark panel with a glowing tube border, drawn once to a canvas */
function signTexture(word: string, tube: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 512; c.height = 160;
  const x = c.getContext("2d"); if (!x) return null;
  x.fillStyle = "#07060c"; x.fillRect(0, 0, 512, 160);
  x.shadowColor = tube; x.shadowBlur = 18; x.strokeStyle = tube; x.lineWidth = 6; x.strokeRect(12, 12, 488, 136);
  x.font = "bold 92px 'Arial Black', Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#fff6ff";
  x.shadowBlur = 26; x.fillText(word, 256, 84); x.shadowBlur = 0; x.globalAlpha = 0.55; x.fillStyle = tube; x.fillText(word, 256, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** the Kaiju billboard: the name in cyan tube and a magenta dragon rearing beside it (owner's PvP maps board) */
function kaijuTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 1024; c.height = 320;
  const x = c.getContext("2d"); if (!x) return null;
  x.fillStyle = "#06050b"; x.fillRect(0, 0, 1024, 320);
  x.shadowColor = "#38e8ff"; x.shadowBlur = 22; x.strokeStyle = "#38e8ff"; x.lineWidth = 8; x.strokeRect(14, 14, 996, 292);
  x.font = "bold 168px 'Arial Black', Arial, sans-serif"; x.textAlign = "left"; x.textBaseline = "middle"; x.fillStyle = "#e9fdff";
  x.shadowBlur = 34; x.fillText("KAIJU", 60, 170); x.globalAlpha = 0.5; x.fillStyle = "#38e8ff"; x.fillText("KAIJU", 60, 170); x.globalAlpha = 1;
  // the dragon: a rearing head and neck, horns, an open jaw and a spined back, all in one magenta tube line with a soft fill
  x.save(); x.translate(800, 168); x.shadowColor = "#ff3df0"; x.shadowBlur = 30; x.strokeStyle = "#ff7af6"; x.fillStyle = "rgba(255,61,240,0.35)"; x.lineWidth = 9; x.lineJoin = "round";
  x.beginPath();
  x.moveTo(-90, 130); x.bezierCurveTo(-70, 40, -60, -10, -20, -40); // neck up the back
  x.lineTo(-40, -95); x.lineTo(0, -60); x.lineTo(10, -118); x.lineTo(30, -62); // horns
  x.lineTo(110, -70); x.lineTo(150, -40); x.lineTo(90, -30); // upper jaw and snout
  x.lineTo(130, 0); x.lineTo(70, -5); // lower jaw
  x.bezierCurveTo(40, 30, 30, 80, 60, 130); // throat down
  x.closePath(); x.fill(); x.stroke();
  for (let i = 0; i < 5; i++) { const t = i / 5, px = -88 + t * 60, py = 120 - t * 150; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 30, py - 10); x.lineTo(px + 6, py - 26); x.stroke(); } // spines
  x.fillStyle = "#fff"; x.beginPath(); x.arc(52, -50, 8, 0, Math.PI * 2); x.fill(); // eye
  x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** a vertical blade sign: letters stacked down a narrow lit panel (hung off a tower corner over the street) */
function bladeTexture(word: string, tube: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 128; c.height = 512;
  const x = c.getContext("2d"); if (!x) return null;
  x.fillStyle = "#06050a"; x.fillRect(0, 0, 128, 512);
  x.shadowColor = tube; x.shadowBlur = 14; x.strokeStyle = tube; x.lineWidth = 5; x.strokeRect(8, 8, 112, 496);
  x.font = "bold 78px 'Arial Black', Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#fff6ff";
  const n = word.length; for (let i = 0; i < n; i++) x.fillText(word[i]!, 64, 40 + (i + 0.5) * (432 / n));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** neon signs: arena space, `y` = centre height above the street; a plane faces +z at yaw 0 */
const SIGNS: readonly { word: string; tube: string; dx: number; dz: number; yaw: number; w: number; h: number; y: number; blade?: boolean; kaiju?: boolean }[] = [
  // the two big billboards facing each other across the map, standing on the far parapet of each mid roof
  { word: "VOLTA", tube: "#ff3df0", dx: 0, dz: 34.4, yaw: Math.PI, w: 18, h: 5.6, y: 24.2 },
  { word: "KAIJU", tube: "#38e8ff", dx: 0, dz: -34.4, yaw: 0, w: 20, h: 6.25, y: 24.6, kaiju: true },
  // signs hung on the street faces of the towers, below the roofs, so the street glows
  { word: "NOODLE", tube: "#ffb02e", dx: -31, dz: 7.85, yaw: Math.PI, w: 9, h: 2.8, y: 16 },
  { word: "HOTEL", tube: "#38e8ff", dx: 31, dz: 7.85, yaw: Math.PI, w: 9, h: 2.8, y: 15 },
  { word: "PACHI", tube: "#ff3df0", dx: 31, dz: -7.85, yaw: 0, w: 9, h: 2.8, y: 16 },
  { word: "SYNTH", tube: "#7dff6a", dx: -31, dz: -7.85, yaw: 0, w: 9, h: 2.8, y: 15 },
  // vertical blades off the tower corners, sideways to the street so you read them looking along it
  { word: "BAR", tube: "#ff3d5a", dx: -46.9, dz: 9.5, yaw: Math.PI / 2, w: 1.6, h: 6.5, y: 12, blade: true },
  { word: "RAMEN", tube: "#ffb02e", dx: 46.9, dz: -9.5, yaw: -Math.PI / 2, w: 1.6, h: 6.5, y: 12, blade: true },
  { word: "HOTEL", tube: "#38e8ff", dx: -15.9, dz: -9.5, yaw: Math.PI / 2, w: 1.6, h: 6.5, y: 10, blade: true },
  { word: "CLUB", tube: "#ff3df0", dx: 15.9, dz: 9.5, yaw: -Math.PI / 2, w: 1.6, h: 6.5, y: 10, blade: true },
  // faces on the rooftop sign props (cover nm-sign / sm-sign in killbox-arenas.ts), toward the bridge
  { word: "OPEN", tube: "#ff4a3a", dx: -6, dz: 21.45, yaw: Math.PI, w: 6.6, h: 2, y: 21.1 },
  { word: "OPEN", tube: "#ff4a3a", dx: 6, dz: -21.45, yaw: 0, w: 6.6, h: 2, y: 21.1 },
  // and toward each team's own spawn, so the prop never reads as a black slab
  { word: "24 HR", tube: "#ffb02e", dx: -6, dz: 22.55, yaw: 0, w: 6.6, h: 2, y: 21.1 },
  { word: "24 HR", tube: "#ffb02e", dx: 6, dz: -22.55, yaw: Math.PI, w: 6.6, h: 2, y: 21.1 },
];
/** coloured light the big signs throw on the roofs (dx, dz, height, colour); none on phones */
const SPILL: readonly [number, number, number, string][] = [[0, 35.5, 26, "#ff3df0"], [0, -35.5, 26, "#38e8ff"], [-30, 0, 15, "#ffb02e"], [30, 0, 15, "#ff3df0"]];

/** the skyline round the block: the authored Neon towers (dx, dz, model, height to stand at), lobbies toward the arena */
const SKYLINE: readonly [number, number, BuildingModelId, number][] = [
  [-95, 60, "neon-tower-a", 110], [-60, 98, "neon-tower-b", 140], [-10, 112, "neon-tower-c", 100], [45, 100, "neon-tower-a", 150], [94, 70, "neon-tower-b", 120],
  [112, 5, "neon-tower-c", 95], [96, -62, "neon-tower-a", 130], [55, -102, "neon-tower-b", 105], [-5, -114, "neon-tower-c", 145], [-58, -98, "neon-tower-a", 115],
  [-102, -50, "neon-tower-b", 100], [-114, 8, "neon-tower-c", 125], [-150, 125, "neon-tower-b", 175], [152, -128, "neon-tower-a", 185], [162, 82, "neon-tower-c", 160], [-162, -112, "neon-tower-a", 165],
];
/** parked cars along both kerbs of the street (fleet models): dx, model */
const PARKED: readonly [number, number, string][] = [
  [-40, 1, "muscle-car"], [-24, 1, "tuner"], [-6, 1, "luxury-sedan"], [14, 1, "security-suv"], [36, 1, "tuner"],
  [-32, -1, "luxury-sedan"], [-14, -1, "muscle-car"], [6, -1, "tuner"], [26, -1, "muscle-car"], [42, -1, "luxury-sedan"],
];

export function KaijuComplexView({ arena: a, state }: { arena: Arena; state: PvpState }) {
  const { x: sx, z: sz } = a.site, B = a.base;
  const phone = useMemo(() => isTouchDevice(), []);

  const geo = useMemo(() => {
    const W = (dx: number, dz: number) => ({ x: sx + dx, z: sz + dz });
    // the tower blocks under each roof: lit facade from the street (and 30 m below it, for the drop) to the roof slab
    const towers = mergeGeometries(a.roofs.map((r) => { const p = W(r.x0, r.z0), q = W(r.x1, r.z1); return towerShell(p.x, q.x, p.z, q.z, B - 30, B + r.top - 0.4); }))!;
    // the masonry that makes a block read as a building: a ledge at every floor, piers up the corners, a cornice under the parapet
    const trim: THREE.BufferGeometry[] = [];
    for (const r of a.roofs) {
      const p = W(r.x0, r.z0), q = W(r.x1, r.z1), cx = (p.x + q.x) / 2, cz = (p.z + q.z) / 2, w = q.x - p.x, d = q.z - p.z, top = B + r.top;
      for (let y = B + 3.6; y < top - 1.6; y += 3.6) trim.push(slab(cx, y, p.z - 0.12, w + 0.3, 0.22, 0.26), slab(cx, y, q.z + 0.12, w + 0.3, 0.22, 0.26), slab(p.x - 0.12, y, cz, 0.26, 0.22, d + 0.3), slab(q.x + 0.12, y, cz, 0.26, 0.22, d + 0.3));
      for (const [x, z] of [[p.x, p.z], [q.x, p.z], [p.x, q.z], [q.x, q.z]] as const) trim.push(slab(x, (B - 30 + top) / 2, z, 1.1, top - (B - 30) - 0.4, 1.1));
      trim.push(slab(cx, top - 1.1, p.z - 0.3, w + 1, 0.7, 0.6), slab(cx, top - 1.1, q.z + 0.3, w + 1, 0.7, 0.6), slab(p.x - 0.3, top - 1.1, cz, 0.6, 0.7, d + 1), slab(q.x + 0.3, top - 1.1, cz, 0.6, 0.7, d + 1));
    }
    const masonry = mergeGeometries(trim)!;
    // roof slabs (the walking surface, 0.4 m thick)
    const roofs = mergeGeometries(a.roofs.map((r) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return slab(c.x, B + r.top - 0.2, c.z, r.x1 - r.x0, 0.4, r.z1 - r.z0); }))!;
    // parapets (drawn from the walls the player collides with), each with a pressed-metal coping cap
    const walls = arenaParapets(a);
    const box = (w: (typeof walls)[number], wide: number, h: number, y: number) => {
      const len = Math.hypot(w.bx - w.ax, w.bz - w.az), yaw = Math.atan2(w.bx - w.ax, w.bz - w.az);
      return new THREE.BoxGeometry(wide, h, len + (wide > 0.35 ? 0.1 : 0)).rotateY(yaw).translate((w.ax + w.bx) / 2, y, (w.az + w.bz) / 2);
    };
    const parapets = mergeGeometries(walls.map((w) => box(w, 0.3, w.top - w.base - 0.58, w.base + 0.5 + (w.top - w.base - 0.58) / 2)))!;
    const coping = mergeGeometries(walls.map((w) => box(w, 0.44, 0.08, w.top - 0.04)))!;
    // the board's look: a neon tube along the outside top of every roof edge, pink on one roof and cyan on the next, and tubes down
    // the top of each tower corner
    const roofOf = (w: (typeof walls)[number]) => {
      const mx = (w.ax + w.bx) / 2 - sx, mz = (w.az + w.bz) / 2 - sz, len = Math.hypot(w.bx - w.ax, w.bz - w.az), nx = -(w.bz - w.az) / len, nz = (w.bx - w.ax) / len;
      const inside = Number.isFinite(surfaceAt(a, mx + nx * 0.6, mz + nz * 0.6)) ? 1 : -1;
      const r = a.roofs.find((q) => mx + nx * 0.6 * inside >= q.x0 && mx + nx * 0.6 * inside <= q.x1 && mz + nz * 0.6 * inside >= q.z0 && mz + nz * 0.6 * inside <= q.z1);
      return { idx: r ? a.roofs.indexOf(r) : 0, ox: -nx * inside * 0.2, oz: -nz * inside * 0.2 };
    };
    const tube = (pink: boolean) => mergeGeometries([
      ...walls.flatMap((w) => { const r = roofOf(w); if ((r.idx % 2 === 0) !== pink) return []; const g = box(w, 0.07, 0.07, w.top + 0.02); return [g.translate(r.ox, 0, r.oz)]; }),
      ...a.roofs.filter((_, i) => (i % 2 === 0) === pink).flatMap((r) => { const p = W(r.x0, r.z0), q = W(r.x1, r.z1), top = B + r.top; return [[p.x - 0.58, p.z - 0.58], [q.x + 0.58, p.z - 0.58], [p.x - 0.58, q.z + 0.58], [q.x + 0.58, q.z + 0.58]].map(([x, z]) => slab(x!, top - 4, z!, 0.07, 8, 0.07)); }),
    ])!;
    const neonPink = tube(true), neonCyan = tube(false);
    // roof plant that is not cover: a pipe run on stands behind every parapet (out of reach: the wall keeps you 0.6 m off it),
    // flush skylights, a satellite dish by each antenna
    const pipes: THREE.BufferGeometry[] = [];
    for (const w of walls) {
      const len = Math.hypot(w.bx - w.ax, w.bz - w.az); if (len < 4) continue;
      const ux = (w.bx - w.ax) / len, uz = (w.bz - w.az) / len;
      // the inside of the wall: the side with roof under it
      const mx = (w.ax + w.bx) / 2 - sx, mz = (w.az + w.bz) / 2 - sz, inX = -uz, inZ = ux, sgn = Number.isFinite(surfaceAt(a, mx + inX * 0.6, mz + inZ * 0.6)) ? 1 : -1;
      const ox = inX * sgn * 0.42, oz = inZ * sgn * 0.42, y = w.base + 0.5 + 0.28;
      pipes.push(new THREE.CylinderGeometry(0.1, 0.1, len - 0.6, 10).rotateX(Math.PI / 2).rotateY(Math.atan2(ux, uz)).translate((w.ax + w.bx) / 2 + ox, y, (w.az + w.bz) / 2 + oz));
      for (let s = 1.5; s < len - 1; s += 3) pipes.push(slab(w.ax + ux * s + ox, y - 0.16, w.az + uz * s + oz, 0.08, 0.3, 0.08));
    }
    for (const [dx, dz] of [[-38, 31.6], [38, -31.6]] as const) { const c = W(dx, dz); pipes.push(new THREE.SphereGeometry(1.1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 3.2).rotateX(-1.1).translate(c.x, B + 23 + 1.9, c.z), slab(c.x, B + 23 + 0.8, c.z, 0.12, 1.6, 0.12)); }
    const plant = mergeGeometries(pipes.map((g) => g.index ? g.toNonIndexed() : g).map((g) => { for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k); return g; }))!;
    const skylights = mergeGeometries([[-30, 22], [24, 22], [-24, -22], [30, -22], [-10, 30], [10, -30]].map(([dx, dz]) => { const c = W(dx!, dz!), top = surfaceAt(a, dx!, dz!); return slab(c.x, B + top + 0.06, c.z, 3, 0.12, 1.8); }))!;
    // standing water on the roofs and the street: dark mirror patches that pick up the neon
    const puddle = (dx: number, dz: number, rx: number, rz: number, y: number) => { const c = W(dx, dz); return new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2).scale(rx, 1, rz).translate(c.x, y, c.z); };
    const puddles = mergeGeometries([
      ...[[-20, 26, 2.2, 1.4], [4, 18, 1.6, 2.4], [34, 18, 2.8, 1.2], [20, -26, 2.2, 1.4], [-4, -18, 1.6, 2.4], [-34, -18, 2.8, 1.2], [0, 4, 1.2, 1.8], [0, -4, 1.2, 1.8]].map(([dx, dz, rx, rz]) => puddle(dx!, dz!, rx!, rz!, B + surfaceAt(a, dx!, dz!) + 0.015)),
      ...[[-30, 2, 4, 1.4], [8, -3, 5, 1.6], [40, 3, 3, 1.2]].map(([dx, dz, rx, rz]) => puddle(dx!, dz!, rx!, rz!, B + 0.02)),
    ])!;
    // the walkways: steel decks (sloped where the ends differ), with a crossbeam under every 2 m
    const decks: THREE.BufferGeometry[] = [], beams: THREE.BufferGeometry[] = [];
    for (const w of a.walks) {
      const c = W(w.x, w.z), rise = w.topB - w.top, run = w.length, tilt = Math.atan2(rise, run);
      const g = new THREE.BoxGeometry(w.along === "x" ? Math.hypot(run, rise) : w.width, 0.3, w.along === "z" ? Math.hypot(run, rise) : w.width);
      if (w.along === "z") g.rotateX(-tilt); else g.rotateZ(tilt);
      decks.push(g.translate(c.x, B + (w.top + w.topB) / 2 - 0.15, c.z));
      for (let s = -run / 2 + 1; s < run / 2; s += 2) {
        const t = (s + run / 2) / run, y = B + w.top + rise * t - 0.45;
        beams.push(w.along === "z" ? slab(c.x, y, c.z + s, w.width + 0.3, 0.25, 0.25) : slab(c.x + s, y, c.z, 0.25, 0.25, w.width + 0.3));
      }
    }
    // the crossings' rails: a post every 2 m and a top tube following the slope, on the lines the rail walls run
    for (const w of a.walks) if (w.rails && w.along === "z") for (const side of [-1, 1]) {
      const x = sx + w.x + side * (w.width / 2), rise = w.topB - w.top, tilt = Math.atan2(rise, w.length);
      beams.push(new THREE.BoxGeometry(0.07, 0.07, Math.hypot(w.length, rise)).rotateX(-tilt).translate(x, B + (w.top + w.topB) / 2 + 1.05, sz + w.z));
      for (let s = -w.length / 2; s <= w.length / 2 + 0.01; s += 2) beams.push(slab(x, B + w.top + rise * ((s + w.length / 2) / w.length) + 0.52, sz + w.z + s, 0.06, 1.05, 0.06));
    }
    const walkway = mergeGeometries(decks)!, girders = mergeGeometries(beams)!;
    // the street: wet asphalt between the blocks and out under the skyline, kerbs and lane lines
    const street = new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2).translate(sx, B, sz);
    const kerbs = mergeGeometries([-1, 1].map((s) => slab(sx, B + 0.09, sz + s * 6.4, 300, 0.18, 3.2)))!;
    const lines = mergeGeometries([-1, 1].map((s) => slab(sx, B + 0.02, sz + s * 0.18, 300, 0.02, 0.12)))!;
    // a steel back and two legs behind every sign, so a billboard seen from behind is a billboard, not nothing
    const backs = mergeGeometries(SIGNS.flatMap((g) => {
      const c = W(g.dx, g.dz), bx = -Math.sin(g.yaw) * 0.18, bz = -Math.cos(g.yaw) * 0.18, out = [new THREE.BoxGeometry(g.w + 0.3, g.h + 0.3, 0.25).rotateY(g.yaw).translate(c.x + bx, B + g.y, c.z + bz)];
      if (g.blade) { out.push(new THREE.BoxGeometry(0.12, 0.12, 1.4).rotateY(g.yaw + Math.PI / 2).translate(c.x - bx * 4, B + g.y + g.h / 2 - 0.3, c.z - bz * 4)); return out; }
      const legTo = g.y > 22 ? 20 : g.y + g.h / 2 + 0.6;
      for (const s of [-0.35, 0.35]) { const ox = Math.cos(g.yaw) * s * g.w, oz = -Math.sin(g.yaw) * s * g.w, h = g.y - g.h / 2 - legTo; if (h > 0.2) out.push(new THREE.BoxGeometry(0.3, h, 0.3).translate(c.x + ox + bx * 2, B + legTo + h / 2, c.z + oz + bz * 2)); }
      return out;
    }))!;
    const masts = mergeGeometries([[-42, 31], [42, -31]].map(([dx, dz]) => { const c = W(dx!, dz!); return antennaMast(11).translate(c.x, B + 23, c.z); }))!;
    // street lamps along both pavements, arms over the road
    const lamps: { x: number; z: number; yaw: number }[] = [];
    for (let dx = -42; dx <= 42; dx += 14) for (const s of [-1, 1]) lamps.push({ ...W(dx + (s > 0 ? 7 : 0), s * 7.3), yaw: s > 0 ? Math.PI : 0 });
    const place = (g: () => THREE.BufferGeometry) => mergeGeometries(lamps.map((l) => g().rotateY(l.yaw).translate(l.x, B + 0.18, l.z)))!;
    return {
      towers, masonry, roofs, parapets, coping, neonPink, neonCyan, plant, skylights, puddles, walkway, girders, street, kerbs, lines, backs, masts,
      lampPoles: place(() => lampPole(7.5, 2.2)), lampHeads: place(() => lampHead(7.5, 2.2)), lampLens: place(() => lampLens(7.5, 2.2)),
      tank: waterTank(), hvac: hvacUnit(), case: equipmentCase(), barrier: jerseyBarrier(), box: new THREE.BoxGeometry(1, 1, 1), sign: new THREE.PlaneGeometry(1, 1),
    };
  }, [a, sx, sz, B]);

  const mats = useMemo(() => {
    const fac = facadeTexture();
    const concrete = weatheredConcreteTexture();
    const signMats = SIGNS.map((s) => { const t = s.kaiju ? kaijuTexture() : s.blade ? bladeTexture(s.word, s.tube) : signTexture(s.word, s.tube); return new THREE.MeshStandardMaterial({ color: "#111", emissive: "#ffffff", emissiveMap: t, map: t, emissiveIntensity: 2.2, roughness: 0.4, toneMapped: false }); });
    return {
      tower: new THREE.MeshStandardMaterial({ color: "#1a2130", map: fac, emissive: "#ffd7b0", emissiveMap: fac, emissiveIntensity: 1.25, roughness: 0.22, metalness: 0.6 }),
      masonry: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#3f3d44", roughness: 0.75, metalness: 0.05 }), concrete, 3),
      // wet concrete: rain darkens it and gives it a sheen
      roof: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#6e6c74", roughness: 0.36, metalness: 0.08 }), concrete, 4),
      parapet: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#77747c", roughness: 0.6 }), concrete, 3),
      coping: new THREE.MeshStandardMaterial({ color: "#8a8f96", roughness: 0.3, metalness: 0.85 }),
      steel: new THREE.MeshStandardMaterial({ color: "#4a4e56", roughness: 0.42, metalness: 0.55 }),
      pipe: new THREE.MeshStandardMaterial({ color: "#6f6656", roughness: 0.55, metalness: 0.6 }),
      plant: new THREE.MeshStandardMaterial({ color: "#7d8288", roughness: 0.5, metalness: 0.55 }),
      case: new THREE.MeshStandardMaterial({ color: "#2f3a33", roughness: 0.6, metalness: 0.4 }),
      barrier: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#8d8a84", roughness: 0.85 }), concrete, 2),
      tank: new THREE.MeshStandardMaterial({ color: "#5a4636", roughness: 0.85, metalness: 0.1 }),
      skylight: new THREE.MeshStandardMaterial({ color: "#2a2418", emissive: "#ffcf8a", emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.3 }),
      puddle: new THREE.MeshStandardMaterial({ color: "#1a1826", roughness: 0.03, metalness: 0.9, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      street: new THREE.MeshStandardMaterial({ color: "#0b0c12", roughness: 0.16, metalness: 0.6, emissive: "#2a0f3a", emissiveIntensity: 0.35 }),
      kerb: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#3a393e", roughness: 0.5 }), concrete, 3),
      lines: new THREE.MeshStandardMaterial({ color: "#d9c46a", emissive: "#f2d45a", emissiveIntensity: 0.5 }),
      lens: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ffd9a0", emissiveIntensity: 3, toneMapped: false }),
      edge: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#38e8ff", emissiveIntensity: 2.4, toneMapped: false }),
      pink: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ff3df0", emissiveIntensity: 2.6, toneMapped: false }),
      signs: signMats,
    };
  }, []);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose());
    for (const [k, m] of Object.entries(mats)) {
      if (k === "signs") (m as THREE.MeshStandardMaterial[]).forEach((s) => { s.map?.dispose(); s.dispose(); });
      else (m as THREE.Material).dispose(); // the facade and concrete maps are shared: not disposed here
    }
  }, [geo, mats]);

  // the neon trim along every catwalk edge, and the plant on the roofs (cover in killbox-arenas.ts)
  const trims = useMemo(() => a.walks.filter((w) => w.along === "z").flatMap((w) => [-1, 1].map((s) => ({ x: sx + w.x + s * (w.width / 2 + 0.05), z: sz + w.z, y: B + (w.top + w.topB) / 2 + 0.05, len: w.length, tilt: Math.atan2(w.topB - w.top, w.length) }))), [a, sx, sz, B]);
  const props = useMemo(() => a.cover.map((k) => ({ k, y: B + (Number.isFinite(surfaceAt(a, k.x, k.z)) ? surfaceAt(a, k.x, k.z) : 0), x: sx + k.x, z: sz + k.z })), [a, sx, sz, B]);
  // the authored skyline and the parked cars, batched by model
  const skyline = useMemo(() => {
    const by = new Map<BuildingModelId, GlbInstance[]>();
    for (const [dx, dz, id, h] of SKYLINE) { const m = BUILDING_MODELS[id], s = h / m.height; by.set(id, [...(by.get(id) ?? []), { x: sx + dx, y: B - 2, z: sz + dz, yaw: Math.atan2(-dx, -dz), scale: s }]); }
    return [...by.entries()];
  }, [sx, sz, B]);
  const cars = useMemo(() => {
    const by = new Map<string, GlbInstance[]>();
    // phones park the low-detail models (the fleet's -lod GLBs) instead
    PARKED.forEach(([dx, side, full], i) => { const id = phone ? (i % 2 ? "street-racer-lod" : "muscle-car-lod") : full; by.set(id, [...(by.get(id) ?? []), { x: sx + dx, y: B, z: sz + side * 4.2, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2 + (i % 3 === 0 ? 0.05 : 0) }]); });
    return [...by.entries()];
  }, [sx, sz, B, phone]);

  // the neon bounce: the signs and the lit towers spill violet and cyan onto the roofs, so the block never reads as black at night
  // (AGENTS.md: Neon's cyberpunk comes from colour, not crushed darks). Mounted only for the match, and it goes out with the signs.
  const bounce = useRef<THREE.HemisphereLight>(null), spill = useRef<(THREE.PointLight | null)[]>([]);
  // Billboard Blackout: every sign, window, lamp and trim fades out with the event
  useFrame(() => {
    const f = fractureAt(a, state.clock), dark = 1 - 0.94 * f.strength;
    if (bounce.current) bounce.current.intensity = 1.35 * (1 - 0.8 * f.strength);
    for (const l of spill.current) if (l) l.intensity = 200 * dark;
    mats.tower.emissiveIntensity = 1.25 * dark; mats.edge.emissiveIntensity = 2.4 * dark; mats.pink.emissiveIntensity = 2.6 * dark; mats.street.emissiveIntensity = 0.35 * dark;
    mats.lens.emissiveIntensity = 3 * dark; mats.skylight.emissiveIntensity = 0.9 * dark;
    // a dying sign flickers on its way out
    const flicker = f.active && f.strength < 1 ? (Math.random() < 0.3 ? 0.2 : 1) : 1;
    for (const m of mats.signs) m.emissiveIntensity = 2.2 * dark * flicker;
  });

  return (
    <group name="killbox-arena:kaiju-complex">
      <hemisphereLight ref={bounce} args={["#b4b0dc", "#6a4a6e", 1.35]} />
      {!phone && SPILL.map(([dx, dz, y, c], i) => <pointLight key={i} ref={(l) => { spill.current[i] = l; }} position={[sx + dx, B + y, sz + dz]} color={c} intensity={200} distance={40} decay={2} />)}
      <mesh geometry={geo.street} material={mats.street} receiveShadow />
      <mesh geometry={geo.kerbs} material={mats.kerb} receiveShadow />
      <mesh geometry={geo.lines} material={mats.lines} />
      <mesh geometry={geo.towers} material={mats.tower} />
      <mesh geometry={geo.masonry} material={mats.masonry} castShadow receiveShadow />
      <mesh geometry={geo.roofs} material={mats.roof} receiveShadow castShadow />
      <mesh geometry={geo.parapets} material={mats.parapet} receiveShadow castShadow />
      <mesh geometry={geo.coping} material={mats.coping} castShadow />
      <mesh geometry={geo.neonPink} material={mats.pink} />
      <mesh geometry={geo.neonCyan} material={mats.edge} />
      <mesh geometry={geo.plant} material={mats.pipe} castShadow />
      <mesh geometry={geo.skylights} material={mats.skylight} />
      <mesh geometry={geo.puddles} material={mats.puddle} />
      <mesh geometry={geo.walkway} material={mats.steel} receiveShadow castShadow />
      <mesh geometry={geo.girders} material={mats.steel} />
      <mesh geometry={geo.backs} material={mats.steel} castShadow />
      <mesh geometry={geo.masts} material={mats.steel} castShadow />
      <mesh geometry={geo.lampPoles} material={mats.steel} castShadow />
      <mesh geometry={geo.lampHeads} material={mats.steel} />
      <mesh geometry={geo.lampLens} material={mats.lens} />
      {trims.map((t, i) => <mesh key={i} geometry={geo.box} material={mats.edge} position={[t.x, t.y, t.z]} rotation-x={-t.tilt} scale={[0.08, 0.08, t.len]} />)}
      {props.map(({ k, x, y, z }) => k.kind === "tank"
        ? <group key={k.id} position={[x, y, z]}>
            <mesh geometry={geo.tank} material={mats.tank} position-y={k.h * 0.62} scale={[k.w / 2, k.h * 0.75, k.d / 2]} castShadow receiveShadow />
            <mesh geometry={geo.box} material={mats.steel} position-y={k.h * 0.12} scale={[k.w * 0.8, k.h * 0.24, k.d * 0.8]} castShadow />
          </group>
        : k.kind === "hvac" || k.kind === "vent"
          ? <mesh key={k.id} geometry={geo.hvac} material={mats.plant} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />
          : k.kind === "crate" && k.h <= 1.25
            ? <mesh key={k.id} geometry={geo.barrier} material={mats.barrier} position={[x, y, z]} rotation-y={k.d > k.w ? 0 : Math.PI / 2} scale={[Math.min(k.w, k.d), k.h, Math.max(k.w, k.d)]} castShadow receiveShadow />
            : k.kind === "crate"
              ? <mesh key={k.id} geometry={geo.case} material={mats.case} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />
              : <mesh key={k.id} geometry={geo.box} material={mats.steel} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />)}
      {SIGNS.map((s, i) => <mesh key={i} geometry={geo.sign} material={mats.signs[i]!} position={[sx + s.dx, B + s.y, sz + s.dz]} rotation-y={s.yaw} scale={[s.w, s.h, 1]} />)}
      {skyline.map(([id, items]) => <InstancedGlb key={id} url={BUILDING_MODELS[id].url} items={items} shadows={false} nightGlow={[0.6, 1.8]} windowScale={1.4} />)}
      {cars.map(([id, items]) => <InstancedGlb key={id} url={`/models/fleet/${id}.glb`} items={items} shadows={!phone} />)}
      <ArenaWeather kind="rain" center={{ x: sx, y: B + 10, z: sz }} count={phone ? 600 : 2200} />
    </group>
  );
}
