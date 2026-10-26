import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

import {
  barCounter, barStool, bed, binLip, bottle, bulkhead, cabinShell, credenza, desk, merge, monitor, overheadBins, pedestalTable, rbox, roundedRect, screenPanel, seatParts,
  seatScreen, seatedFigure, sofa, swivelChair, tumbler, wallX, windowFrame, windowPane,
} from "@/game/cabin-geometry";
import { CABIN_LIGHTING, SEAT_THEMES, cabinSpec, seatEye, type CabinLighting, type CabinMode, type Seat, type SeatStyle } from "@/game/passenger-cabin";
import { JET_LIGHTS, PHANTOM_JET, jetZoneAt, type JetLighting, type JetRoom } from "@/game/phantom-jet";

/**
 * The cabins you ride in (FlightCabin.tsx overlay, PhantomHangar.tsx tour): an airliner / ferry passenger cabin laid out by
 * passenger-cabin.ts, and the Phantom's private cabin from phantom-jet.ts. Geometry comes from cabin-geometry.ts (a real
 * fuselage cross-section, bevelled seats and furniture, lathed glassware), seats and passengers are instanced, the windows
 * show a scrolling sky. One small scene, no shadows, a handful of lights: cheap enough to sit over the world for a trip.
 */

/* ---------------- materials (shared, built once) ---------------- */

const std = (color: string, roughness: number, metalness = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const MAT = {
  wall: std("#c9c4ba", 0.66, 0, { side: THREE.DoubleSide }),
  wallDark: std("#2c2f34", 0.55, 0.1, { side: THREE.DoubleSide }),
  bins: std("#e6e3dc", 0.45),
  carpet: std("#3a3f48", 0.95),
  carpetPhantom: std("#2a2d33", 0.96),
  wood: std("#4a3122", 0.42, 0.05),
  woodLight: std("#7a5638", 0.45, 0.05),
  leatherCream: std("#cfc4ae", 0.55),
  leatherDark: std("#2b2524", 0.5),
  stone: std("#d8d4cc", 0.22, 0.05),
  brass: std("#b59457", 0.3, 0.85),
  chrome: std("#c8ccd0", 0.18, 0.9),
  frame: std("#3d4045", 0.5, 0.35),
  glass: std("#a8c3cc", 0.05, 0.1, { transparent: true, opacity: 0.22, depthWrite: false }),
  screenOff: std("#0b0d10", 0.25, 0.2),
  linen: std("#e7e2d8", 0.85),
  duvet: std("#5d6b78", 0.8),
  skin: std("#ffffff", 0.6),
  hair: std("#2a211c", 0.75),
  clothes: std("#ffffff", 0.82),
  bottleGlass: std("#4d6b4a", 0.08, 0.1, { transparent: true, opacity: 0.75 }),
  amberGlass: std("#8a5a24", 0.08, 0.1, { transparent: true, opacity: 0.8 }),
};
const glowMat = (color: string, k = 1.6) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });
/** muted clothing for fellow passengers */
const CLOTHES = ["#2e3440", "#4b5563", "#5b4a3f", "#3f4f46", "#6b6359", "#1f2937", "#57534e", "#44403c", "#3b4a5c", "#6b4f4f"].map((c) => new THREE.Color(c));
const SKIN = ["#e0b897", "#c69a7c", "#9c6f52", "#6e4a35", "#d7a98a"].map((c) => new THREE.Color(c));

/* ---------------- the view through the windows ---------------- */

export type SkyKind = "apron" | "day" | "dusk" | "night";
const skyCache = new Map<string, THREE.CanvasTexture>();
/** a painted sky strip (clouds, stars, or the apron at the gate); sea crossings show water below the horizon */
function skyTexture(kind: SkyKind, sea: boolean): THREE.CanvasTexture | null {
  const key = `${kind}:${sea}`;
  const hit = skyCache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256;
  const g = cv.getContext("2d");
  if (!g) return null;
  const top = { apron: "#8d949b", day: "#5f8fb8", dusk: "#47496b", night: "#070b16" }[kind];
  const hor = { apron: "#b8bcbf", day: "#c7d9e6", dusk: "#e3976a", night: "#1b2440" }[kind];
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, top); grd.addColorStop(sea ? 0.55 : 0.8, hor); grd.addColorStop(1, sea ? hor : "#9aa7b1");
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  if (kind === "apron") { g.fillStyle = "#5c6166"; g.fillRect(0, 170, 512, 86); g.fillStyle = "#3d4247"; for (let i = 0; i < 6; i++) g.fillRect(i * 90 + 10, 120 - (i % 3) * 14, 70, 50 + (i % 3) * 14); g.fillStyle = "#e8c35a"; for (let i = 0; i < 16; i++) g.fillRect(i * 34, 214, 18, 3); }
  if (kind === "night") { g.fillStyle = "#ffffff"; for (let i = 0; i < 90; i++) { const x = (i * 137) % 512, y = (i * 61) % 150; g.globalAlpha = 0.3 + ((i * 17) % 7) / 10; g.fillRect(x, y, 1.5, 1.5); } g.globalAlpha = 1; }
  if (kind === "day" || kind === "dusk") {
    for (let i = 0; i < 26; i++) {
      const x = (i * 197) % 560 - 24, y = 140 + ((i * 53) % 70), r = 18 + ((i * 29) % 30);
      const c = g.createRadialGradient(x, y, 2, x, y, r);
      c.addColorStop(0, kind === "day" ? "rgba(255,255,255,0.85)" : "rgba(255,196,160,0.7)"); c.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = c; g.beginPath(); g.ellipse(x, y, r * 1.9, r * 0.7, 0, 0, Math.PI * 2); g.fill();
    }
  }
  if (sea && kind !== "apron") { const s = g.createLinearGradient(0, 150, 0, 256); s.addColorStop(0, kind === "night" ? "#0b1424" : "#3b5566"); s.addColorStop(1, kind === "night" ? "#03060c" : "#1d2c36"); g.fillStyle = s; g.fillRect(0, 150, 512, 106); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.SRGBColorSpace;
  skyCache.set(key, t);
  return t;
}
function useSkyMaterial(kind: SkyKind, sea: boolean, moving: boolean) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), []);
  useEffect(() => { const t = skyTexture(kind, sea); mat.map = t; mat.color.set(t ? "#ffffff" : "#8fb3cc"); mat.needsUpdate = true; }, [kind, sea, mat]);
  useFrame((_, dt) => { if (moving && mat.map) mat.map.offset.x = (mat.map.offset.x + dt * 0.035) % 1; });
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

/* ---------------- instancing helper ---------------- */

function Instances({ geometry, material, items, colors, capacity }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: readonly THREE.Matrix4[]; colors?: readonly THREE.Color[]; capacity?: number }) {
  const cap = Math.max(1, capacity ?? items.length);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const n = Math.min(items.length, m.instanceMatrix.count);
    for (let i = 0; i < n; i++) m.setMatrixAt(i, items[i]!);
    if (colors) for (let i = 0; i < Math.min(n, colors.length); i++) m.setColorAt(i, colors[i]!);
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, colors, cap]);
  return <instancedMesh key={cap} ref={ref} args={[undefined, undefined, cap]} geometry={geometry} material={material} frustumCulled={false} visible={items.length > 0} />;
}
const at = (x: number, y: number, z: number, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));

/* ---------------- walking and looking ---------------- */

export type CabinInput = { keys: Set<string>; yaw: number; pitch: number };
export const newCabinInput = (): CabinInput => ({ keys: new Set(), yaw: 0, pitch: -0.04 });
/** first-person camera inside a cabin: walk the aisle (clamped by `clamp`), or sit at `seated` (eye point). Looking is the
 * shared input's yaw/pitch (mouse/touch drag, arrow keys). */
export function CabinWalker({ input, start, clamp, seated, onMove }: {
  input: MutableRefObject<CabinInput>; start: { x: number; z: number }; clamp: (p: { x: number; z: number }) => { x: number; z: number };
  seated: { x: number; y: number; z: number } | null; onMove?: ((p: { x: number; z: number }) => void) | undefined;
}) {
  const camera = useThree((s) => s.camera);
  const pos = useRef({ ...start });
  const eye = useRef(1.62);
  useEffect(() => { pos.current = clamp(start); /* re-seeded when the cabin changes */ }, [start.x, start.z]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt), k = input.current.keys, inp = input.current;
    const turn = (k.has("ArrowLeft") ? 1 : 0) - (k.has("ArrowRight") ? 1 : 0);
    inp.yaw += turn * dt * 1.8;
    if (!seated) {
      const f = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
      const r = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
      if (f || r) {
        const sp = (k.has("ShiftLeft") ? 2.4 : 1.4) * dt, sy = Math.sin(inp.yaw), cy = Math.cos(inp.yaw);
        const next = clamp({ x: pos.current.x + (-sy * f + cy * r) * sp, z: pos.current.z + (-cy * f - sy * r) * sp });
        if (next.x !== pos.current.x || next.z !== pos.current.z) { pos.current = next; onMove?.(next); }
      }
    }
    const target = seated ? seated.y : 1.62;
    eye.current += (target - eye.current) * Math.min(1, dt * 6);
    const x = seated ? seated.x : pos.current.x, z = seated ? seated.z : pos.current.z;
    camera.position.set(x, eye.current, z);
    camera.rotation.set(inp.pitch, inp.yaw, 0, "YXZ");
  });
  return null;
}

/* ---------------- the airliner / ferry cabin ---------------- */

export type AirlinerProps = {
  mode: CabinMode; style: SeatStyle; seats: readonly Seat[]; passengers: readonly string[]; mySeat: string | null; recline: number;
  screen: string | null; lighting: CabinLighting; sky: SkyKind; moving: boolean;
};
export function AirlinerCabin({ mode, style, seats, passengers, mySeat, recline, screen, lighting, sky, moving }: AirlinerProps) {
  const c = cabinSpec(mode), t = SEAT_THEMES[style], sea = mode === "sea";
  const geo = useMemo(() => {
    const parts = seatParts(t, t.pitch), fig = seatedFigure();
    const winW = sea ? 0.9 : 0.27, winH = sea ? 0.62 : 0.37;
    return {
      shell: cabinShell(c.width, c.height, c.length), bins: sea ? null : overheadBins(c.width, c.height, c.length - 1.6), bulk: bulkhead(c.width, c.height, sea ? 1.2 : 0.8, 1.95),
      carpet: rbox(c.aisleWidth + 0.1, 0.012, c.length - 0.4, 0.004), parts, fig,
      winFrame: windowFrame(winW, winH, sea ? 0.07 : 0.05), winPane: windowPane(winW, winH), winW, winH,
      strip: rbox(0.08, 0.02, c.length - 1.4, 0.01), screen: seatScreen(),
      door: rbox(sea ? 1.18 : 0.78, 1.93, 0.05, 0.02), pan: rbox(t.width - 0.04, t.leather ? 0.15 : 0.11, t.depth, 0.045).translate(0, 0.46, 0),
    };
  }, [mode, style]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { for (const g of [geo.shell, geo.bins, geo.bulk, geo.carpet, geo.parts.fabric, geo.parts.frame, geo.parts.trim, geo.parts.back, geo.parts.shell, geo.parts.canopy, geo.fig.clothes, geo.fig.skin, geo.fig.hair, geo.winFrame, geo.winPane, geo.strip, geo.screen, geo.pan, geo.door]) g?.dispose(); }, [geo]);
  const skyMat = useSkyMaterial(sky, sea, moving);
  const others = useMemo(() => seats.filter((s) => s.id !== mySeat), [seats, mySeat]);
  const seatMats = useMemo(() => others.map((s) => at(s.x, 0, s.z)), [others]);
  const fabric = useMemo(() => std(t.fabric, t.leather ? 0.5 : 0.92), [t]);
  const trim = useMemo(() => std(t.trim, 0.4, t.trim === "#b8975a" || t.trim === "#a8925e" ? 0.8 : 0.2), [t]);
  const frame = useMemo(() => std(t.frame, 0.5, 0.3), [t]);
  useEffect(() => () => { fabric.dispose(); trim.dispose(); frame.dispose(); }, [fabric, trim, frame]);
  const people = useMemo(() => seats.filter((s) => passengers.includes(s.id) && s.id !== mySeat), [seats, passengers, mySeat]);
  const peopleCap = seats.length;
  const peopleMats = useMemo(() => people.map((s) => at(s.x, 0, s.z)), [people]);
  const clothes = useMemo(() => people.map((_, i) => CLOTHES[(i * 7) % CLOTHES.length]!), [people]);
  const skin = useMemo(() => people.map((_, i) => SKIN[(i * 3) % SKIN.length]!), [people]);
  // windows: one per seat row on each side (airliner), big panoramic panes on a ferry deck
  const winY = sea ? 1.3 : 1.24, winX = wallX(c.width, c.height, winY) - 0.045;
  const windows = useMemo(() => {
    const out: THREE.Matrix4[] = [], step = sea ? 1.6 : 0.82;
    for (let z = -c.length / 2 + 1.6; z < c.length / 2 - 1.2; z += step) for (const s of [-1, 1]) out.push(new THREE.Matrix4().compose(new THREE.Vector3(s * winX, winY, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -s * Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1)));
    return out;
  }, [sea, c.length, winX, winY]);
  const panes = useMemo(() => windows.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.012))), [windows]);
  const backZ = t.depth / 2 + 0.17;
  const screens = useMemo(() => t.shell === "none" ? others.map((s) => at(s.x, 1.0, s.z + backZ)) : [], [others, t.shell, backZ]);
  const light = CABIN_LIGHTING[lighting];
  const stripMat = useMemo(() => glowMat(light.color, 0.35 + light.intensity * 0.35), [light.color, light.intensity]);
  useEffect(() => () => stripMat.dispose(), [stripMat]);
  const mine = seats.find((s) => s.id === mySeat) ?? null;
  const screenMat = useMemo(() => screen ? glowMat(screen, 1.4) : null, [screen]);
  useEffect(() => () => screenMat?.dispose(), [screenMat]);
  return (
    <>
      <color attach="background" args={["#0a0c10"]} />
      <hemisphereLight args={[light.color, "#4a4f56", 0.7 + light.intensity * 0.55]} />
      <ambientLight intensity={0.18} />
      {[-0.35, 0, 0.35].map((k) => <pointLight key={k} position={[0, c.height - 0.45, k * c.length]} color={light.color} intensity={light.intensity * 4} distance={c.length * 0.45} decay={1.2} />)}
      <mesh geometry={geo.shell} material={MAT.wall} />
      <mesh geometry={geo.carpet} material={MAT.carpet} position={[0, 0.006, 0]} />
      {geo.bins && <><mesh geometry={geo.bins} material={MAT.bins} /><mesh geometry={geo.bins} material={MAT.bins} scale={[-1, 1, 1]} /></>}
      {[-1, 1].map((s) => <mesh key={s} geometry={geo.strip} material={stripMat} position={[s * (sea ? c.width * 0.3 : binLip(c.width, c.height).x + 0.12), sea ? c.height - 0.08 : binLip(c.width, c.height).y - 0.012, 0]} />)}
      {[-1, 1].map((e) => <mesh key={e} geometry={geo.bulk} material={MAT.wallDark} position={[0, 0, e * (c.length / 2 - 0.05)]} />)}
      {[-1, 1].map((e) => <mesh key={`d${e}`} geometry={geo.door} material={MAT.bins} position={[0, 1.0, e * (c.length / 2 - 0.09)]} />)}
      <Instances geometry={geo.winFrame} material={MAT.frame} items={windows} />
      <Instances geometry={geo.winPane} material={skyMat} items={panes} />
      <Instances geometry={geo.parts.fabric} material={fabric} items={seatMats} />
      <Instances geometry={geo.parts.frame} material={frame} items={seatMats} />
      <Instances geometry={geo.parts.trim} material={trim} items={seatMats} />
      {geo.parts.shell && <Instances geometry={geo.parts.shell} material={t.shell === "pod" ? MAT.bins : MAT.wood} items={seats.map((s) => at(s.x, 0, s.z))} />}
      {geo.parts.canopy && <Instances geometry={geo.parts.canopy} material={MAT.glass} items={seatMats} />}
      <Instances geometry={geo.screen} material={MAT.screenOff} items={screens} />
      <Instances geometry={geo.fig.clothes} material={MAT.clothes} items={peopleMats} colors={clothes} capacity={peopleCap} />
      <Instances geometry={geo.fig.skin} material={MAT.skin} items={peopleMats} colors={skin} capacity={peopleCap} />
      <Instances geometry={geo.fig.hair} material={MAT.hair} items={peopleMats} capacity={peopleCap} />
      {mine && (
        <group position={[mine.x, 0, mine.z]}>
          <mesh geometry={geo.parts.frame} material={frame} />
          <mesh geometry={geo.parts.trim} material={trim} />
          {/* the seat pan, and the backrest on its own pivot so it reclines */}
          <mesh geometry={geo.pan} material={fabric} />
          <group position={[0, 0.5, t.depth / 2 - 0.02]} rotation={[0.15 + t.reclineMax * 0.002 + (recline * Math.PI) / 180, 0, 0]}><mesh geometry={geo.parts.back} material={fabric} /></group>
          {/* your screen: on the seat back ahead, or the suite's front wall */}
          {screenMat && <mesh geometry={geo.screen} material={screenMat} position={[0, 1.0, t.shell === "none" ? -t.pitch + backZ + 0.005 : -Math.min(t.pitch - 0.2, 2.2) + t.depth / 2 + 0.27]} />}
        </group>
      )}
    </>
  );
}

/* ---------------- the Phantom's private cabin ---------------- */

/** the Phantom's cabin: six rooms off one aisle, mood-lit in the chosen colour. `clutter` (0..1) leaves glasses out when the
 * cabin hasn't been valeted. */
export function PhantomCabin({ lighting, sky, moving, clutter = 0 }: { lighting: JetLighting; sky: SkyKind; moving: boolean; clutter?: number }) {
  const S = PHANTOM_JET, W = S.width, H = S.height, Lz = S.length;
  const geo = useMemo(() => {
    const so = sofa(1.9, 0.92), b = bed(), bar = barCounter(3.4), d = desk(), mon = monitor(0.6, 0.34), big = screenPanel(2.6, 1.46), game = screenPanel(1.5, 0.84);
    const partitions: THREE.BufferGeometry[] = [];
    for (let i = 1; i < S.zones.length; i++) {
      const z = (S.zones[i - 1]!.centerZ + S.zones[i]!.centerZ) / 2;
      for (const s of [-1, 1]) partitions.push(rbox(W / 2 - 0.95, H - 0.25, 0.08, 0.035).translate(s * (W / 4 + 0.47), (H - 0.25) / 2, z));
      partitions.push(rbox(2.0, 0.22, 0.09, 0.04).translate(0, H - 0.28, z)); // header over the aisle
    }
    return {
      shell: cabinShell(W, H, Lz), bulk: bulkhead(W, H, 0.95, 2.0), runner: rbox(1.4, 0.012, Lz - 0.6, 0.004), so, b, bar, d, mon, big, game,
      partitions: merge(partitions), table: pedestalTable(0.42, 0.46), stool: barStool(), chair: swivelChair(false), gChair: swivelChair(true),
      bottle: bottle(0.3, 0.04), tall: bottle(0.36, 0.035), glass: tumbler(), shelf: credenza(3.0, 1.0, 0.36), side: credenza(1.4, 0.6, 0.45),
      cove: rbox(0.06, 0.02, Lz - 1.2, 0.008), winFrame: windowFrame(0.36, 0.5, 0.06), winPane: windowPane(0.36, 0.5),
      consoleBox: rbox(0.5, 0.08, 0.3, 0.03), door: rbox(0.93, 1.98, 0.05, 0.02),
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { for (const g of Object.values(geo)) { if (g instanceof THREE.BufferGeometry) g.dispose(); else for (const x of Object.values(g)) (x as THREE.BufferGeometry).dispose(); } }, [geo]);
  const light = JET_LIGHTS[lighting];
  const cove = useMemo(() => glowMat(light.color, 1.2 + light.intensity * 0.4), [light.color, light.intensity]);
  const cinema = useMemo(() => glowMat("#5a6f8c", 1.1), []);
  const gameGlow = useMemo(() => glowMat("#4c8a6a", 1.2), []);
  const officeGlow = useMemo(() => glowMat("#6f8fa8", 1.0), []);
  useEffect(() => () => { cove.dispose(); cinema.dispose(); gameGlow.dispose(); officeGlow.dispose(); }, [cove, cinema, gameGlow, officeGlow]);
  const skyMat = useSkyMaterial(sky, false, moving);
  const winX = wallX(W, H, 1.15) - 0.045;
  const windows = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let z = -Lz / 2 + 1.8; z < Lz / 2 - 1.5; z += 1.25) for (const s of [-1, 1]) out.push(new THREE.Matrix4().compose(new THREE.Vector3(s * winX, 1.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -s * Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1)));
    return out;
  }, [winX, Lz]);
  const panes = useMemo(() => windows.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.012))), [windows]);
  const z = (id: JetRoom) => S.zones.find((q) => q.id === id)!.centerZ;
  const side = W / 2 - 0.55; // furniture line against the wall
  const glasses = Math.round(clutter * 6);
  return (
    <>
      <color attach="background" args={["#07080b"]} />
      <hemisphereLight args={[light.color, "#2a2420", 0.45 + light.intensity * 0.35]} />
      <ambientLight intensity={0.1} />
      {S.zones.map((q) => <pointLight key={q.id} position={[0, H - 0.3, q.centerZ]} color={q.id === "bedroom" || q.id === "bar" ? "#ffd7a8" : "#fff2e0"} intensity={5} distance={6} decay={1.5} />)}
      <mesh geometry={geo.shell} material={MAT.wall} />
      <mesh geometry={geo.runner} material={MAT.carpetPhantom} position={[0, 0.006, 0]} />
      {[-1, 1].map((s) => <mesh key={s} geometry={geo.cove} material={cove} position={[s * (wallX(W, H, H - 0.35) - 0.06), H - 0.35, 0]} />)}
      {[-1, 1].map((e) => <mesh key={e} geometry={geo.bulk} material={MAT.wood} position={[0, 0, e * (Lz / 2 - 0.05)]} />)}
      {[-1, 1].map((e) => <mesh key={`d${e}`} geometry={geo.door} material={MAT.frame} position={[0, 1.03, e * (Lz / 2 - 0.09)]} />)}
      <mesh geometry={geo.partitions} material={MAT.wood} />
      <Instances geometry={geo.winFrame} material={MAT.chrome} items={windows} />
      <Instances geometry={geo.winPane} material={skyMat} items={panes} />

      {/* lounge: two sofas facing across a pedestal table */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (side - 0.15), 0, z("lounge")]} rotation={[0, s * Math.PI / 2, 0]}>
          <mesh geometry={geo.so.body} material={MAT.leatherDark} /><mesh geometry={geo.so.cushions} material={MAT.leatherCream} />
        </group>
      ))}
      <mesh geometry={geo.table} material={MAT.wood} position={[1.3, 0, z("lounge") - 1.6]} />
      <mesh geometry={geo.table} material={MAT.wood} position={[-1.3, 0, z("lounge") - 1.6]} />

      {/* office: desk with a monitor and chair, a sofa opposite */}
      <group position={[-side + 0.1, 0, z("office")]} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={geo.d.top} material={MAT.woodLight} /><mesh geometry={geo.d.body} material={MAT.wood} />
        <group position={[0, 0.765, 0.18]} rotation={[0, Math.PI, 0]}><mesh geometry={geo.mon.body} material={MAT.frame} /><mesh geometry={geo.mon.glass} material={officeGlow} /></group>
        <mesh geometry={geo.chair} material={MAT.leatherDark} position={[0, 0, -0.62]} rotation={[0, Math.PI, 0]} />
      </group>
      <group position={[side - 0.15, 0, z("office")]} rotation={[0, -Math.PI / 2, 0]}><mesh geometry={geo.so.body} material={MAT.leatherDark} /><mesh geometry={geo.so.cushions} material={MAT.leatherCream} /></group>

      {/* bar: stone-topped counter, a back shelf of bottles, stools on the aisle side */}
      <group position={[-side + 0.35, 0, z("bar")]}>
        <mesh geometry={geo.bar.body} material={MAT.wood} rotation={[0, Math.PI, 0]} /><mesh geometry={geo.bar.top} material={MAT.stone} rotation={[0, Math.PI, 0]} />
        {Array.from({ length: 7 }, (_, i) => <mesh key={i} geometry={i % 3 ? geo.bottle : geo.tall} material={i % 2 ? MAT.bottleGlass : MAT.amberGlass} position={[0.05, 1.025, -1.2 + i * 0.4]} />)}
        {Array.from({ length: 3 }, (_, i) => <mesh key={i} geometry={geo.stool} material={MAT.chrome} position={[0.95, 0, -1 + i * 1]} />)}
      </group>
      <mesh geometry={geo.shelf} material={MAT.wood} position={[side - 0.05, 0, z("bar")]} />
      {Array.from({ length: 6 }, (_, i) => <mesh key={i} geometry={geo.glass} material={MAT.glass} position={[side - 0.05, 1.0, z("bar") - 1.1 + i * 0.44]} />)}

      {/* cinema: a big screen on the left wall, a sofa facing it */}
      <group position={[-W / 2 + 0.42, 1.35, z("cinema")]} rotation={[0, Math.PI / 2, 0]}><mesh geometry={geo.big.frame} material={MAT.frame} /><mesh geometry={geo.big.glass} material={cinema} /></group>
      <mesh geometry={geo.side} material={MAT.wood} position={[-W / 2 + 0.6, 0, z("cinema")]} />
      <group position={[side - 0.15, 0, z("cinema")]} rotation={[0, -Math.PI / 2, 0]}><mesh geometry={geo.so.body} material={MAT.leatherDark} /><mesh geometry={geo.so.cushions} material={MAT.leatherCream} /></group>

      {/* gaming lounge: a wall screen, a console table and two gaming chairs */}
      <group position={[side + 0.12, 1.3, z("gaming")]} rotation={[0, -Math.PI / 2, 0]}><mesh geometry={geo.game.frame} material={MAT.frame} /><mesh geometry={geo.game.glass} material={gameGlow} /></group>
      <mesh geometry={geo.side} material={MAT.frame} position={[side - 0.05, 0, z("gaming")]} />
      <mesh geometry={geo.consoleBox} material={MAT.frame} position={[side - 0.05, 0.64, z("gaming")]} />
      {[-0.55, 0.55].map((dz) => <mesh key={dz} geometry={geo.gChair} material={MAT.leatherDark} position={[-0.95, 0, z("gaming") + dz]} rotation={[0, Math.PI / 2, 0]} />)}

      {/* bedroom: a double bed against the right wall, a wardrobe opposite */}
      <group position={[W / 2 - 1.3, 0, z("bedroom")]} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={geo.b.body} material={MAT.wood} /><mesh geometry={geo.b.linen} material={MAT.linen} /><mesh geometry={geo.b.duvet} material={MAT.duvet} />
      </group>
      <mesh geometry={geo.side} material={MAT.wood} position={[-W / 2 + 0.6, 0, z("bedroom") - 1.2]} />
      <mesh geometry={geo.shelf} material={MAT.woodLight} position={[-W / 2 + 0.55, 0, z("bedroom") + 0.6]} scale={[1, 1.9, 0.6]} />

      {/* an unvaleted cabin: glasses left about */}
      {Array.from({ length: glasses }, (_, i) => <mesh key={i} geometry={geo.glass} material={MAT.glass} position={[i % 2 ? 1.3 : -1.3, 0.48, z("lounge") - 1.6 + (i % 3) * 0.12 - 0.1]} />)}
    </>
  );
}
/** which Phantom room you're in (for the overlay's label) */
export const phantomRoomLabel = (zPos: number) => jetZoneAt(zPos)?.label ?? "Aisle";
/** where a seated Phantom passenger looks from: the lounge sofa, facing across the cabin */
export const PHANTOM_SEAT_EYE = { x: PHANTOM_JET.width / 2 - 0.85, y: 1.12, z: PHANTOM_JET.zones[0]!.centerZ };
export { seatEye, roundedRect };
