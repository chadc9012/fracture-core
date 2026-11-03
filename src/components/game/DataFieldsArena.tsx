import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { arenaParapets, fractureAt, shifterLift, surfaceAt, type KillboxArena as Arena } from "@/game/killbox-arenas";
import type { PvpState } from "@/game/pvp";
import { facadeTexture } from "./InstancedGlb";
import { slab, towerShell } from "./arena-parts";

/** Data Fields (killbox-arenas.ts DATA_FIELDS), drawn from the same data its decks and walls come from. Nexus City's look: sterile,
 * symmetrical, white composite panels seamed with cyan light, server racks with status lights, data pillars of cyan light that
 * rise from slots in the floor and sink back into them (the Grid Rewrite), a holographic core turning over the centre objective,
 * surveillance drones circling, and the platform hung on pylons over a glowing data grid. Nexus towers ring the skyline. */

const PANEL_M = 4; // one floor-panel texture tile, m

/** composite floor panels: a light tile with a darker seam round it; the emissive map is only the seam, so the seams glow cyan */
function panelTextures(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } | null {
  if (typeof document === "undefined") return null;
  const make = (glow: boolean) => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d")!;
    x.fillStyle = glow ? "#000" : "#d4d9e0"; x.fillRect(0, 0, 256, 256);
    if (!glow) { for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${120 + Math.random() * 60},${130 + Math.random() * 60},${140 + Math.random() * 60},0.08)`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } x.fillStyle = "#aab2bd"; x.fillRect(0, 126, 256, 4); x.fillRect(126, 0, 4, 256); }
    x.fillStyle = glow ? "#38e8ff" : "#5d6773"; x.fillRect(0, 0, 256, 5); x.fillRect(0, 0, 5, 256);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  };
  return { map: make(false), glow: make(true) };
}

/** a server rack face: gunmetal doors with rows of status lights */
function rackTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 128; c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#161a20"; x.fillRect(0, 0, 128, 256);
  for (let r = 0; r < 22; r++) { x.fillStyle = "#222831"; x.fillRect(6, 8 + r * 11, 116, 8); for (let k = 0; k < 6; k++) if (Math.random() < 0.7) { x.fillStyle = Math.random() < 0.8 ? "#38e8ff" : Math.random() < 0.5 ? "#7dff6a" : "#ffb02e"; x.fillRect(12 + k * 7, 10 + r * 11, 3, 3); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** the data grid far below: dark with a fine cyan grid */
function gridTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#000"; x.fillRect(0, 0, 128, 128); x.fillStyle = "#1fb6d8"; x.fillRect(0, 0, 128, 2); x.fillRect(0, 0, 2, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(120, 120); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Nexus towers round the platform: a symmetrical ring (Nexus is laid out by the system, not grown) and the far spire */
const TOWERS: readonly [number, number, number, number, number][] = [
  [-110, 0, 26, 26, 120], [110, 0, 26, 26, 120], [0, 110, 26, 26, 120], [0, -110, 26, 26, 120],
  [-80, 80, 20, 20, 150], [80, 80, 20, 20, 150], [80, -80, 20, 20, 150], [-80, -80, 20, 20, 150],
  [-150, 70, 22, 22, 100], [150, -70, 22, 22, 100], [70, 150, 22, 22, 100], [-70, -150, 22, 22, 100],
  [0, 240, 34, 34, 320],
];

export function DataFieldsView({ arena: a, state }: { arena: Arena; state: PvpState }) {
  const { x: sx, z: sz } = a.site, B = a.base;
  const W = (dx: number, dz: number) => ({ x: sx + dx, z: sz + dz });

  const geo = useMemo(() => {
    // the platform: each roof a solid body down to B+14 (the terraces' bodies make the 2.5 m faces), its top a panelled plane
    const bodies = mergeGeometries(a.roofs.map((r) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), h = r.top - 14; return slab(c.x, B + 14 + h / 2 - 0.02, c.z, r.x1 - r.x0, h, r.z1 - r.z0); }))!;
    const tops = mergeGeometries([
      ...a.roofs.map((r) => {
        const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), w = r.x1 - r.x0, d = r.z1 - r.z0, g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
        const uv = g.attributes["uv"] as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (r.x0 + uv.getX(i) * w) / PANEL_M, (r.z0 + uv.getY(i) * d) / PANEL_M);
        return g.translate(c.x, B + r.top + 0.01, c.z);
      }),
      // the ramps, panelled the same way
      ...a.walks.map((w) => {
        const c = W(w.x, w.z), rise = w.topB - w.top, len = Math.hypot(w.length, rise), g = new THREE.PlaneGeometry(w.width, len).rotateX(-Math.PI / 2);
        const uv = g.attributes["uv"] as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w.width / PANEL_M, uv.getY(i) * len / PANEL_M);
        return g.rotateX(-Math.atan2(rise, w.length)).translate(c.x, B + (w.top + w.topB) / 2 + 0.03, c.z);
      }),
    ])!;
    // each ramp as a solid wedge under its top: a right triangle in profile (low end flush with the floor), extruded across the width
    const cheeks = mergeGeometries(a.walks.map((w) => {
      const c = W(w.x, w.z), lo = Math.min(w.top, w.topB), rise = Math.abs(w.topB - w.top), up = w.topB > w.top ? 1 : -1;
      const shape = new THREE.Shape();
      shape.moveTo(-w.length / 2, 0); shape.lineTo(w.length / 2, 0);
      if (up > 0) shape.lineTo(w.length / 2, rise); else shape.lineTo(-w.length / 2, rise);
      shape.closePath();
      // profile x runs along the ramp, y up; extrude across the width, then turn the profile's x onto world z
      const g = new THREE.ExtrudeGeometry(shape, { depth: w.width, bevelEnabled: false }).translate(0, 0, -w.width / 2).rotateY(-Math.PI / 2);
      return g.translate(c.x, B + lo, c.z);
    }).map((g) => g.toNonIndexed()))!;
    // parapets: a white composite barrier, its top a cyan light strip; and the same strip along the terrace lips (the ledges)
    const parapets = arenaParapets(a);
    const barrier = mergeGeometries(parapets.map((w) => {
      const len = Math.hypot(w.bx - w.ax, w.bz - w.az), h = w.top - w.base - 0.5, yaw = Math.atan2(w.bx - w.ax, w.bz - w.az);
      return new THREE.BoxGeometry(0.3, h, len).rotateY(yaw).translate((w.ax + w.bx) / 2, w.base + 0.5 + h / 2, (w.az + w.bz) / 2);
    }))!;
    const strips = mergeGeometries([
      ...parapets.map((w) => { const len = Math.hypot(w.bx - w.ax, w.bz - w.az), yaw = Math.atan2(w.bx - w.ax, w.bz - w.az); return new THREE.BoxGeometry(0.34, 0.06, len).rotateY(yaw).translate((w.ax + w.bx) / 2, w.top + 0.03, (w.az + w.bz) / 2); }),
      ...a.ledges.map((l) => { const p = W(l.ax, l.az), q = W(l.bx, l.bz), len = Math.hypot(q.x - p.x, q.z - p.z), yaw = Math.atan2(q.x - p.x, q.z - p.z); return new THREE.BoxGeometry(0.12, 0.06, len).rotateY(yaw).translate((p.x + q.x) / 2, B + l.top + 0.03, (p.z + q.z) / 2 + Math.sign(l.az) * 0.06); }),
    ])!;
    // pylons under the platform down into the void, with cross beams
    const pyl: THREE.BufferGeometry[] = [];
    for (const [dx, dz] of [[-24, -28], [24, -28], [-24, 28], [24, 28], [0, 0]] as const) { const c = W(dx, dz); pyl.push(slab(c.x, B - 30, c.z, 3.2, 88, 3.2)); }
    for (const z of [-28, 28]) { const c = W(0, z); pyl.push(slab(c.x, B + 10, c.z, 48, 1.6, 1.6)); }
    const pylons = mergeGeometries(pyl)!;
    const skyline = mergeGeometries(TOWERS.map(([dx, dz, w, d, h]) => { const c = W(dx, dz); return towerShell(c.x - w / 2, c.x + w / 2, c.z - d / 2, c.z + d / 2, B - 120, B + h); }))!;
    const crowns = mergeGeometries(TOWERS.map(([dx, dz, w, d, h]) => { const c = W(dx, dz); return slab(c.x, B + h + 0.5, c.z, w + 0.8, 1, d + 0.8); }))!;
    const ground = new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2).translate(sx, B + 2, sz);
    return { bodies, tops, cheeks, barrier, strips, pylons, skyline, crowns, ground, box: new THREE.BoxGeometry(1, 1, 1), ring: new THREE.TorusGeometry(4.2, 0.12, 8, 64), core: new THREE.IcosahedronGeometry(1.4, 1), orb: new THREE.SphereGeometry(0.35, 12, 8) };
  }, [a, sx, sz, B]); // eslint-disable-line react-hooks/exhaustive-deps

  const mats = useMemo(() => {
    const panel = panelTextures(), rack = rackTexture(), grid = gridTexture(), fac = facadeTexture();
    if (panel) for (const t of [panel.map, panel.glow]) t.repeat.set(1, 1);
    return {
      top: new THREE.MeshStandardMaterial({ color: "#ffffff", map: panel?.map ?? null, emissive: "#ffffff", emissiveMap: panel?.glow ?? null, emissiveIntensity: 1.1, roughness: 0.32, metalness: 0.15 }),
      body: new THREE.MeshStandardMaterial({ color: "#9aa3ae", roughness: 0.5, metalness: 0.35 }),
      barrier: new THREE.MeshStandardMaterial({ color: "#e6eaef", roughness: 0.3, metalness: 0.1 }),
      strip: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#38e8ff", emissiveIntensity: 2.4, toneMapped: false }),
      rack: new THREE.MeshStandardMaterial({ color: "#ffffff", map: rack, emissive: "#ffffff", emissiveMap: rack, emissiveIntensity: 1.2, roughness: 0.45, metalness: 0.6 }),
      white: new THREE.MeshStandardMaterial({ color: "#dfe4ea", roughness: 0.35, metalness: 0.1 }),
      screen: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#38e8ff", emissiveIntensity: 1.6, toneMapped: false }),
      pillar: new THREE.MeshStandardMaterial({ color: "#7fefff", emissive: "#38e8ff", emissiveIntensity: 1.4, transparent: true, opacity: 0.72, roughness: 0.2, depthWrite: true, toneMapped: false }),
      slot: new THREE.MeshStandardMaterial({ color: "#1a2028", emissive: "#38e8ff", emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.6 }),
      steel: new THREE.MeshStandardMaterial({ color: "#5c6470", roughness: 0.5, metalness: 0.5 }),
      skyline: new THREE.MeshStandardMaterial({ color: "#1b2433", map: fac, emissive: "#ffffff", emissiveMap: fac, emissiveIntensity: 0.85, roughness: 0.3, metalness: 0.6 }),
      ground: new THREE.MeshStandardMaterial({ color: "#05070b", emissive: "#ffffff", emissiveMap: grid, emissiveIntensity: 0.8, roughness: 0.9 }),
      holo: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#38e8ff", emissiveIntensity: 2.2, transparent: true, opacity: 0.85, wireframe: true, toneMapped: false }),
      ringMat: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#38e8ff", emissiveIntensity: 2.6, toneMapped: false }),
      drone: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ff3d5a", emissiveIntensity: 3, toneMapped: false }),
    };
  }, []);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose());
    for (const [k, m] of Object.entries(mats)) {
      if (k !== "skyline") { m.map?.dispose(); m.emissiveMap?.dispose(); } // the facade map is shared with the city towers
      m.dispose();
    }
  }, [geo, mats]);

  const props = useMemo(() => a.cover.map((k) => ({ k, y: B + (Number.isFinite(surfaceAt(a, k.x, k.z)) ? surfaceAt(a, k.x, k.z) : 0), ...W(k.x, k.z) })), [a, B]); // eslint-disable-line react-hooks/exhaustive-deps
  const shifts = useMemo(() => a.shifters.map((k) => ({ k, y: B + (Number.isFinite(surfaceAt(a, k.x, k.z)) ? surfaceAt(a, k.x, k.z) : 0), ...W(k.x, k.z) })), [a, B]); // eslint-disable-line react-hooks/exhaustive-deps
  const pillars = useRef<(THREE.Mesh | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null), core = useRef<THREE.Mesh>(null), drones = useRef<THREE.Group>(null);
  const warnCol = useMemo(() => new THREE.Color("#ff8a3d"), []), calmCol = useMemo(() => new THREE.Color("#38e8ff"), []);

  useFrame(({ clock }) => {
    const t = state.clock, ev = fractureAt(a, t), now = clock.elapsedTime;
    // the pillars rise and sink with the Grid Rewrite; the ones about to move pulse while the event is called
    shifts.forEach(({ k, y }, i) => {
      const m = pillars.current[i]; if (!m) return;
      const lift = shifterLift(a, k, t);
      m.visible = lift > 0.02;
      m.scale.set(k.w, Math.max(0.01, lift * k.h), k.d);
      m.position.y = y + (lift * k.h) / 2;
    });
    const hot = ev.active || ev.warning;
    mats.pillar.emissiveIntensity = hot ? 1.4 + 0.8 * Math.sin(now * 8) : 1.4;
    mats.slot.emissiveIntensity = ev.warning ? 1.2 + Math.sin(now * 8) : 0.5;
    // the core turns over the objective; it burns orange while the grid rewrites
    if (ring.current) { ring.current.rotation.x = Math.PI / 2 + Math.sin(now * 0.6) * 0.25; ring.current.rotation.z = now * 0.5; }
    if (core.current) { core.current.rotation.y = now * 0.8; core.current.rotation.x = now * 0.3; }
    const col = ev.active ? warnCol : calmCol;
    mats.ringMat.emissive.copy(col); mats.holo.emissive.copy(col);
    // surveillance drones on a slow orbit round the platform
    if (drones.current) drones.current.rotation.y = now * 0.15;
  });

  return (
    <group name="killbox-arena:data-fields">
      <hemisphereLight args={["#d8f2ff", "#1a2a3a", 0.95]} />
      <mesh geometry={geo.ground} material={mats.ground} />
      <mesh geometry={geo.skyline} material={mats.skyline} />
      <mesh geometry={geo.crowns} material={mats.steel} />
      <mesh geometry={geo.pylons} material={mats.steel} />
      <mesh geometry={geo.bodies} material={mats.body} castShadow receiveShadow />
      <mesh geometry={geo.tops} material={mats.top} receiveShadow />
      <mesh geometry={geo.cheeks} material={mats.body} castShadow />
      <mesh geometry={geo.barrier} material={mats.barrier} castShadow receiveShadow />
      <mesh geometry={geo.strips} material={mats.strip} />
      {props.map(({ k, x, y, z }) => (
        <group key={k.id} position={[x, y, z]}>
          <mesh geometry={geo.box} material={k.kind === "rack" ? mats.rack : mats.white} position-y={k.h / 2} scale={[k.w, k.h, k.d]} castShadow receiveShadow />
          {/* a cyan light line round the top of every prop; the console's top is its screen */}
          <mesh geometry={geo.box} material={k.kind === "console" ? mats.screen : mats.strip} position-y={k.h + 0.02} scale={[k.w + 0.04, 0.04, k.d + 0.04]} />
        </group>
      ))}
      {shifts.map(({ k, x, y, z }, i) => (
        <group key={k.id}>
          <mesh geometry={geo.box} material={mats.slot} position={[x, y + 0.02, z]} scale={[k.w + 0.3, 0.05, k.d + 0.3]} />
          <mesh ref={(m) => { pillars.current[i] = m; }} geometry={geo.box} material={mats.pillar} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow />
        </group>
      ))}
      <group position={[sx + a.objective[0], B + 27, sz + a.objective[1]]}>
        <mesh ref={ring} geometry={geo.ring} material={mats.ringMat} />
        <mesh ref={core} geometry={geo.core} material={mats.holo} />
      </group>
      <group ref={drones} position={[sx, B + 31, sz]}>
        {[0, 1, 2].map((i) => <mesh key={i} geometry={geo.orb} material={mats.drone} position={[Math.cos((i * Math.PI * 2) / 3) * 42, Math.sin(i * 1.7) * 2, Math.sin((i * Math.PI * 2) / 3) * 42]} />)}
      </group>
    </group>
  );
}
