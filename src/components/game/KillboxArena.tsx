import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { arenaParapets, fractureAt, surfaceAt, type KillboxArena as Arena } from "@/game/killbox-arenas";
import type { PvpState } from "@/game/pvp";
import { antennaMast, hvacUnit, waterTank } from "@/game/street-geometry";
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";
import { facadeTexture } from "./InstancedGlb";
import { DataFieldsView } from "./DataFieldsArena";
import { slab, towerShell } from "./arena-parts";

/** A built Killbox arena (killbox-arenas.ts), drawn from the same data its decks and walls come from so what you see is what you
 * stand on. Rooftop Run: Neon City tower blocks rising out of a wet neon street, concrete roofs with steel parapets, the steel
 * catwalks and the billboard bridge across the street, rooftop plant (water tanks, HVAC, vents) as cover, a ring of lit towers
 * round the block for the skyline, and neon signs. During the Billboard Blackout every sign and window fades out.
 * Everything is in world space; arena space (dx, dz, m above base) maps to it with the arena's site and base. */

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

/** neon signs: arena space, `y` = centre height above the street; a plane faces +z at yaw 0 */
const SIGNS: readonly { word: string; tube: string; dx: number; dz: number; yaw: number; w: number; h: number; y: number }[] = [
  // the two big billboards facing each other across the map, standing on the far parapet of each mid roof
  { word: "VOLTA", tube: "#ff3df0", dx: 0, dz: 34.4, yaw: Math.PI, w: 18, h: 5.6, y: 24.2 },
  { word: "KAIJU", tube: "#38e8ff", dx: 0, dz: -34.4, yaw: 0, w: 18, h: 5.6, y: 24.2 },
  // signs hung on the street faces of the towers, below the roofs, so the street glows
  { word: "NOODLE", tube: "#ffb02e", dx: -31, dz: 7.85, yaw: Math.PI, w: 9, h: 2.8, y: 16 },
  { word: "HOTEL", tube: "#38e8ff", dx: 31, dz: 7.85, yaw: Math.PI, w: 9, h: 2.8, y: 15 },
  { word: "PACHI", tube: "#ff3df0", dx: 31, dz: -7.85, yaw: 0, w: 9, h: 2.8, y: 16 },
  { word: "SYNTH", tube: "#7dff6a", dx: -31, dz: -7.85, yaw: 0, w: 9, h: 2.8, y: 15 },
  // faces on the rooftop sign props (cover nm-sign / sm-sign in killbox-arenas.ts), toward the bridge
  { word: "OPEN", tube: "#ff4a3a", dx: -6, dz: 21.45, yaw: Math.PI, w: 6.6, h: 2, y: 21.1 },
  { word: "OPEN", tube: "#ff4a3a", dx: 6, dz: -21.45, yaw: 0, w: 6.6, h: 2, y: 21.1 },
];

/** the skyline round the block: lit towers standing in the haze (decoration only, nothing collides) */
const SKYLINE: readonly [number, number, number, number, number][] = [
  // dx, dz, width, depth, height above the street
  [-95, 60, 22, 22, 96], [-60, 95, 26, 18, 128], [-10, 110, 30, 20, 88], [45, 98, 24, 24, 140], [92, 70, 20, 28, 104],
  [110, 5, 22, 22, 76], [95, -62, 26, 20, 118], [55, -100, 24, 24, 92], [-5, -112, 30, 22, 134], [-58, -96, 22, 26, 100],
  [-100, -50, 24, 22, 84], [-112, 8, 20, 20, 112], [-150, 120, 30, 30, 160], [150, -125, 30, 30, 170], [160, 80, 26, 26, 150], [-160, -110, 28, 28, 145],
];

/** the arena a match plays on, dressed for its look */
export function KillboxArena({ arena, state }: { arena: Arena; state: PvpState }) {
  return arena.look === "nexus-grid" ? <DataFieldsView arena={arena} state={state} /> : <RooftopRunView arena={arena} state={state} />;
}

function RooftopRunView({ arena: a, state }: { arena: Arena; state: PvpState }) {
  const { x: sx, z: sz } = a.site, B = a.base;

  const geo = useMemo(() => {
    const W = (dx: number, dz: number) => ({ x: sx + dx, z: sz + dz });
    // the tower blocks under each roof: lit facade from the street (and 30 m below it, for the drop) to the roof slab
    const towers = mergeGeometries(a.roofs.map((r) => { const p = W(r.x0, r.z0), q = W(r.x1, r.z1); return towerShell(p.x, q.x, p.z, q.z, B - 30, B + r.top - 0.4); }))!;
    const skyline = mergeGeometries(SKYLINE.map(([dx, dz, w, d, h]) => { const c = W(dx, dz); return towerShell(c.x - w / 2, c.x + w / 2, c.z - d / 2, c.z + d / 2, B - 40, B + h); }))!;
    // roof slabs (the walking surface, 0.4 m thick) and the tower tops of the skyline
    const roofs = mergeGeometries([
      ...a.roofs.map((r) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return slab(c.x, B + r.top - 0.2, c.z, r.x1 - r.x0, 0.4, r.z1 - r.z0); }),
      ...SKYLINE.map(([dx, dz, w, d, h]) => { const c = W(dx, dz); return slab(c.x, B + h + 0.4, c.z, w + 0.6, 0.8, d + 0.6); }),
    ])!;
    // parapets, rails and ledges: drawn from the same walls the player collides with (kept low: the wall top is the jump-over line)
    const parapets = mergeGeometries(arenaParapets(a).map((w) => {
      const len = Math.hypot(w.bx - w.ax, w.bz - w.az), h = w.top - w.base - 0.5, yaw = Math.atan2(w.bx - w.ax, w.bz - w.az);
      return new THREE.BoxGeometry(Math.max(0.2, w.half * 2), h, len).rotateY(yaw).translate((w.ax + w.bx) / 2, w.base + 0.5 + h / 2, (w.az + w.bz) / 2);
    }))!;
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
    const rails: THREE.BufferGeometry[] = [];
    for (const w of a.walks) if (w.rails && w.along === "z") for (const side of [-1, 1]) {
      const x = sx + w.x + side * (w.width / 2), rise = w.topB - w.top, tilt = Math.atan2(rise, w.length);
      rails.push(new THREE.BoxGeometry(0.07, 0.07, Math.hypot(w.length, rise)).rotateX(-tilt).translate(x, B + (w.top + w.topB) / 2 + 1.05, sz + w.z));
      for (let s = -w.length / 2; s <= w.length / 2 + 0.01; s += 2) rails.push(slab(x, B + w.top + rise * ((s + w.length / 2) / w.length) + 0.52, sz + w.z + s, 0.06, 1.05, 0.06));
    }
    const walkway = mergeGeometries(decks)!, girders = mergeGeometries([...beams, ...rails])!;
    // the street: wet asphalt between the blocks and out under the skyline
    const street = new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2).translate(sx, B, sz);
    // a steel back and two legs behind every sign, so a billboard seen from behind is a billboard, not nothing
    const backs = mergeGeometries(SIGNS.flatMap((g) => {
      const c = W(g.dx, g.dz), bx = -Math.sin(g.yaw) * 0.18, bz = -Math.cos(g.yaw) * 0.18, out = [new THREE.BoxGeometry(g.w + 0.3, g.h + 0.3, 0.25).rotateY(g.yaw).translate(c.x + bx, B + g.y, c.z + bz)];
      // the roof billboards stand on legs down to the roof; the street signs hang from the wall on a bracket
      const legTo = g.y > 22 ? 20 : g.y + g.h / 2 + 0.6;
      for (const s of [-0.35, 0.35]) { const ox = Math.cos(g.yaw) * s * g.w, oz = -Math.sin(g.yaw) * s * g.w, h = g.y - g.h / 2 - legTo; if (h > 0.2) out.push(new THREE.BoxGeometry(0.3, h, 0.3).translate(c.x + ox + bx * 2, B + legTo + h / 2, c.z + oz + bz * 2)); }
      return out;
    }))!;
    // antenna masts on the two tall roofs, the block's silhouette from across the street
    const masts = mergeGeometries([[-42, 31], [42, -31]].map(([dx, dz]) => { const c = W(dx!, dz!); return antennaMast(11).translate(c.x, B + 23, c.z); }))!;
    const lines = mergeGeometries([-1, 1].map((s) => slab(sx, B + 0.02, sz + s * 1.2, 300, 0.02, 0.18)))!;
    return { towers, skyline, roofs, parapets, walkway, girders, street, lines, backs, masts, tank: waterTank(), hvac: hvacUnit(), box: new THREE.BoxGeometry(1, 1, 1), sign: new THREE.PlaneGeometry(1, 1) };
  }, [a, sx, sz, B]);

  const mats = useMemo(() => {
    const fac = facadeTexture();
    const concrete = weatheredConcreteTexture();
    const signMats = SIGNS.map((s) => { const t = signTexture(s.word, s.tube); return new THREE.MeshStandardMaterial({ color: "#111", emissive: "#ffffff", emissiveMap: t, map: t, emissiveIntensity: 2.2, roughness: 0.4, toneMapped: false }); });
    return {
      tower: new THREE.MeshStandardMaterial({ color: "#1a2130", map: fac, emissive: "#ffffff", emissiveMap: fac, emissiveIntensity: 1.25, roughness: 0.32, metalness: 0.55 }),
      skyline: new THREE.MeshStandardMaterial({ color: "#121826", map: fac, emissive: "#ffffff", emissiveMap: fac, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.5, fog: true }),
      roof: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#5b5a5e", roughness: 0.55, metalness: 0.05 }), concrete, 4),
      parapet: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#6b6870", roughness: 0.8 }), concrete, 3),
      steel: new THREE.MeshStandardMaterial({ color: "#4a4e56", roughness: 0.5, metalness: 0.5 }),
      plant: new THREE.MeshStandardMaterial({ color: "#7d8288", roughness: 0.6, metalness: 0.55 }),
      tank: new THREE.MeshStandardMaterial({ color: "#5a4636", roughness: 0.85, metalness: 0.1 }),
      street: new THREE.MeshStandardMaterial({ color: "#0b0c12", roughness: 0.18, metalness: 0.6, emissive: "#2a0f3a", emissiveIntensity: 0.35 }),
      lines: new THREE.MeshStandardMaterial({ color: "#d9c46a", emissive: "#f2d45a", emissiveIntensity: 0.6 }),
      edge: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#38e8ff", emissiveIntensity: 2.4, toneMapped: false }),
      signs: signMats,
    };
  }, []);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose());
    for (const [k, m] of Object.entries(mats)) {
      if (k === "signs") (m as THREE.MeshStandardMaterial[]).forEach((s) => { s.map?.dispose(); s.dispose(); });
      else (m as THREE.Material).dispose(); // the facade map is shared with the city towers: not disposed here
    }
  }, [geo, mats]);

  // the neon trim along every catwalk edge, and the plant on the roofs (cover in killbox-arenas.ts)
  const trims = useMemo(() => a.walks.filter((w) => w.along === "z").flatMap((w) => [-1, 1].map((s) => ({ x: sx + w.x + s * (w.width / 2 + 0.05), z: sz + w.z, y: B + (w.top + w.topB) / 2 + 0.05, len: w.length, tilt: Math.atan2(w.topB - w.top, w.length) }))), [a, sx, sz, B]);
  const props = useMemo(() => a.cover.map((k) => ({ k, y: B + (Number.isFinite(surfaceAt(a, k.x, k.z)) ? surfaceAt(a, k.x, k.z) : 0), x: sx + k.x, z: sz + k.z })), [a, sx, sz, B]);

  // the neon bounce: the signs and the lit towers spill violet and cyan onto the roofs, so the block never reads as black at night
  // (AGENTS.md: Neon's cyberpunk comes from colour, not crushed darks). Mounted only for the match, and it goes out with the signs.
  const bounce = useRef<THREE.HemisphereLight>(null);
  // Billboard Blackout: every sign, window and trim fades out with the event
  useFrame(() => {
    const f = fractureAt(a, state.clock), dark = 1 - 0.94 * f.strength;
    if (bounce.current) bounce.current.intensity = 1.15 * (1 - 0.8 * f.strength);
    mats.tower.emissiveIntensity = 1.25 * dark; mats.skyline.emissiveIntensity = 0.9 * dark;
    mats.edge.emissiveIntensity = 2.4 * dark; mats.street.emissiveIntensity = 0.35 * dark;
    // a dying sign flickers on its way out
    const flicker = f.active && f.strength < 1 ? (Math.random() < 0.3 ? 0.2 : 1) : 1;
    for (const m of mats.signs) m.emissiveIntensity = 2.2 * dark * flicker;
  });

  return (
    <group name="killbox-arena">
      <hemisphereLight ref={bounce} args={["#7a5cff", "#ff3df0", 1.15]} />
      <mesh geometry={geo.street} material={mats.street} receiveShadow />
      <mesh geometry={geo.lines} material={mats.lines} />
      <mesh geometry={geo.towers} material={mats.tower} />
      <mesh geometry={geo.skyline} material={mats.skyline} />
      <mesh geometry={geo.roofs} material={mats.roof} receiveShadow castShadow />
      <mesh geometry={geo.parapets} material={mats.parapet} receiveShadow castShadow />
      <mesh geometry={geo.walkway} material={mats.steel} receiveShadow castShadow />
      <mesh geometry={geo.girders} material={mats.steel} />
      <mesh geometry={geo.backs} material={mats.steel} castShadow />
      <mesh geometry={geo.masts} material={mats.steel} castShadow />
      {trims.map((t, i) => <mesh key={i} geometry={geo.box} material={mats.edge} position={[t.x, t.y, t.z]} rotation-x={-t.tilt} scale={[0.08, 0.08, t.len]} />)}
      {props.map(({ k, x, y, z }) => k.kind === "tank"
        ? <group key={k.id} position={[x, y, z]}>
            <mesh geometry={geo.tank} material={mats.tank} position-y={k.h * 0.62} scale={[k.w / 2, k.h * 0.75, k.d / 2]} castShadow receiveShadow />
            {/* the steel stand the tank sits on */}
            <mesh geometry={geo.box} material={mats.steel} position-y={k.h * 0.12} scale={[k.w * 0.8, k.h * 0.24, k.d * 0.8]} castShadow />
          </group>
        : k.kind === "hvac" || k.kind === "vent"
          ? <mesh key={k.id} geometry={geo.hvac} material={mats.plant} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />
          : <mesh key={k.id} geometry={geo.box} material={k.kind === "sign" ? mats.steel : mats.plant} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />)}
      {SIGNS.map((s, i) => <mesh key={i} geometry={geo.sign} material={mats.signs[i]!} position={[sx + s.dx, B + s.y, sz + s.dz]} rotation-y={s.yaw} scale={[s.w, s.h, 1]} />)}
    </group>
  );
}
