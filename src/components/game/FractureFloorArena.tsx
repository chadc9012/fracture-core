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
import { InstancedGlb, facadeTexture, type GlbInstance } from "./InstancedGlb";
import { floorStrip, hazardTexture, jerseyBarrier, shippingContainer, slab, towerShell } from "./arena-parts";

/** Fracture Floor (killbox-arenas.ts FRACTURE_FLOOR), after the owner's PvP maps board (Nov 2): a rain-wet plaza on top of a Nexus
 * tower at night. Dark wet concrete with standing water and yellow hazard stripes along every lip, cargo containers and crates for
 * cover, glass data walls with the diamond emblem that rise from slots in the floor and sink back (the Grid Rewrite), floodlight
 * masts on the corners, a holographic globe and ring turning over the centre objective, and lit towers all round.
 * Drawn from the same data its decks and walls come from. World space: arena space maps to it with the arena's site and base. */

/** the glass data wall's face: a cyan frame and the diamond emblem on clear glass */
function glassTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#0a3a48"; x.fillRect(0, 0, 256, 256);
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "rgba(120,240,255,0.35)"); g.addColorStop(1, "rgba(30,160,200,0.05)"); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "#8ff6ff"; x.shadowColor = "#38e8ff"; x.shadowBlur = 12;
  x.lineWidth = 6; x.strokeRect(6, 6, 244, 244);
  x.lineWidth = 5; x.beginPath(); x.moveTo(128, 70); x.lineTo(186, 128); x.lineTo(128, 186); x.lineTo(70, 128); x.closePath(); x.stroke();
  x.lineWidth = 3; x.beginPath(); x.moveTo(128, 96); x.lineTo(160, 128); x.lineTo(128, 160); x.lineTo(96, 128); x.closePath(); x.stroke();
  for (let i = 0; i < 18; i++) { x.globalAlpha = 0.25; x.fillStyle = "#bff9ff"; x.fillRect(16 + Math.random() * 224, 16 + Math.random() * 224, 10 + Math.random() * 30, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** the towers round the plaza: the authored Neon towers (dx, dz, model, height above the plaza's street), lobbies in */
const SKYLINE: readonly [number, number, BuildingModelId, number][] = [
  [-75, 52, "neon-tower-b", 190], [-30, 82, "neon-tower-a", 230], [28, 86, "neon-tower-c", 175], [76, 50, "neon-tower-a", 210],
  [92, -6, "neon-tower-c", 165], [74, -54, "neon-tower-b", 220], [26, -86, "neon-tower-a", 185], [-28, -84, "neon-tower-c", 240],
  [-78, -50, "neon-tower-a", 200], [-94, 4, "neon-tower-b", 180], [-130, 110, "neon-tower-c", 260], [135, -115, "neon-tower-b", 270],
];
/** floodlight masts on the floor's corners (dx, dz): each throws its light toward the centre */
const MASTS: readonly [number, number][] = [[-29, 23], [29, 23], [29, -23], [-29, -23]];
const DROP = 125; // the plaza tower's street lies this far below the arena base
const CONTAINER_PAINT = ["#8a4426", "#2d5c66", "#7a6a2c", "#3b3f6a", "#6c2f2a"];

export function FractureFloorView({ arena: a, state }: { arena: Arena; state: PvpState }) {
  const { x: sx, z: sz } = a.site, B = a.base;
  const phone = useMemo(() => isTouchDevice(), []);

  const geo = useMemo(() => {
    const W = (dx: number, dz: number) => ({ x: sx + dx, z: sz + dz });
    const minX = Math.min(...a.roofs.map((r) => r.x0)), maxX = Math.max(...a.roofs.map((r) => r.x1)), minZ = Math.min(...a.roofs.map((r) => r.z0)), maxZ = Math.max(...a.roofs.map((r) => r.z1));
    const p = W(minX, minZ), q = W(maxX, maxZ), cx = (p.x + q.x) / 2, cz = (p.z + q.z) / 2, w = q.x - p.x, d = q.z - p.z;
    // the tower the plaza sits on: lit facade from the street far below up to the plaza's concrete crown
    const shell = towerShell(p.x, q.x, p.z, q.z, B - DROP, B + 14);
    const trim: THREE.BufferGeometry[] = [];
    for (let y = B - DROP + 3.6; y < B + 13; y += 3.6) trim.push(slab(cx, y, p.z - 0.12, w + 0.3, 0.22, 0.26), slab(cx, y, q.z + 0.12, w + 0.3, 0.22, 0.26), slab(p.x - 0.12, y, cz, 0.26, 0.22, d + 0.3), slab(q.x + 0.12, y, cz, 0.26, 0.22, d + 0.3));
    for (const [x, z] of [[p.x, p.z], [q.x, p.z], [p.x, q.z], [q.x, q.z]] as const) trim.push(slab(x, B + (14 - DROP) / 2, z, 1.2, DROP + 14, 1.2));
    // the crown: each roof a concrete body from B+14 up to its surface (the uplinks' bodies make the 2.5 m faces)
    for (const r of a.roofs) { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), h = r.top - 14; trim.push(slab(c.x, B + 14 + h / 2 - 0.02, c.z, r.x1 - r.x0, h, r.z1 - r.z0)); }
    const crown = mergeGeometries(trim)!;
    // the walking surface, panelled so the concrete reads in metres
    const tops = mergeGeometries([
      ...a.roofs.map((r) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(-Math.PI / 2).translate(c.x, B + r.top + 0.01, c.z); }),
      ...a.walks.map((k) => { const c = W(k.x, k.z), rise = k.topB - k.top; return new THREE.PlaneGeometry(k.width, Math.hypot(k.length, rise)).rotateX(-Math.PI / 2).rotateX(-Math.atan2(rise, k.length)).translate(c.x, B + (k.top + k.topB) / 2 + 0.03, c.z); }),
    ])!;
    // each ramp a solid wedge (profile x along the ramp, extruded across it)
    const wedges = mergeGeometries(a.walks.map((k) => {
      const c = W(k.x, k.z), lo = Math.min(k.top, k.topB), rise = Math.abs(k.topB - k.top), shape = new THREE.Shape();
      shape.moveTo(-k.length / 2, 0); shape.lineTo(k.length / 2, 0); if (k.topB > k.top) shape.lineTo(k.length / 2, rise); else shape.lineTo(-k.length / 2, rise); shape.closePath();
      return new THREE.ExtrudeGeometry(shape, { depth: k.width, bevelEnabled: false }).translate(0, 0, -k.width / 2).rotateY(-Math.PI / 2).translate(c.x, B + lo, c.z).toNonIndexed();
    }))!;
    // hazard stripes: along every uplink lip and down both sides of each ramp
    const stripes = mergeGeometries([
      ...a.ledges.map((l) => { const s = Math.sign(l.az), y = B + 20 + 0.02; return floorStrip(sx + l.ax, sz + l.az - s * 0.45, sx + l.bx, sz + l.bz - s * 0.45, 0.6, y); }),
      ...a.ledges.map((l) => { const s = Math.sign(l.az), y = B + l.top + 0.02; return floorStrip(sx + l.ax, sz + l.az + s * 0.3, sx + l.bx, sz + l.bz + s * 0.3, 0.4, y); }),
    ])!;
    // parapets: a low concrete wall with a cyan light line along its top
    const parapets = arenaParapets(a);
    const along = (w: (typeof parapets)[number], wide: number, h: number, y: number) => { const len = Math.hypot(w.bx - w.ax, w.bz - w.az), yaw = Math.atan2(w.bx - w.ax, w.bz - w.az); return new THREE.BoxGeometry(wide, h, len).rotateY(yaw).translate((w.ax + w.bx) / 2, y, (w.az + w.bz) / 2); };
    const walls = mergeGeometries(parapets.map((w) => along(w, 0.34, w.top - w.base - 0.56, w.base + 0.5 + (w.top - w.base - 0.56) / 2)))!;
    const lights = mergeGeometries([
      ...parapets.map((w) => along(w, 0.38, 0.06, w.top - 0.03)),
      // under-lip light line round the crown, so the platform edge reads from across the plaza
      ...[[p.x, p.z, q.x, p.z], [p.x, q.z, q.x, q.z], [p.x, p.z, p.x, q.z], [q.x, p.z, q.x, q.z]].map(([ax, az, bx, bz]) => { const len = Math.hypot(bx! - ax!, bz! - az!), yaw = Math.atan2(bx! - ax!, bz! - az!); return new THREE.BoxGeometry(0.12, 0.12, len).rotateY(yaw).translate((ax! + bx!) / 2, B + 14.4, (az! + bz!) / 2); }),
    ])!;
    // standing water
    const puddle = (dx: number, dz: number, rx: number, rz: number) => { const c = W(dx, dz), y = B + surfaceAt(a, dx, dz) + 0.02; return new THREE.CircleGeometry(1, 22).rotateX(-Math.PI / 2).scale(rx, 1, rz).translate(c.x, y, c.z); };
    const puddles = mergeGeometries([[-14, -4, 3.2, 1.6], [14, 4, 3.2, 1.6], [3, -12, 2, 2.8], [-3, 12, 2, 2.8], [-24, -14, 2.4, 1.2], [24, 14, 2.4, 1.2], [0, 30, 3, 1], [0, -30, 3, 1]].map(([dx, dz, rx, rz]) => puddle(dx!, dz!, rx!, rz!)))!;
    // floodlight masts: a steel pole, a cross-arm and two lamp heads tilted at the centre
    const pole: THREE.BufferGeometry[] = [], head: THREE.BufferGeometry[] = [], face: THREE.BufferGeometry[] = [];
    for (const [dx, dz] of MASTS) {
      const c = W(dx, dz), yaw = Math.atan2(-dx, -dz), top = B + 20 + 11;
      pole.push(new THREE.CylinderGeometry(0.14, 0.2, 11, 10).translate(c.x, B + 20 + 5.5, c.z), new THREE.BoxGeometry(2.6, 0.14, 0.14).rotateY(yaw).translate(c.x, top, c.z), new THREE.BoxGeometry(0.6, 0.3, 0.6).translate(c.x, B + 20.15, c.z));
      for (const s of [-0.9, 0.9]) {
        const hx = c.x + Math.cos(yaw) * s, hz = c.z - Math.sin(yaw) * s;
        head.push(new THREE.BoxGeometry(0.8, 0.55, 0.3).rotateX(0.5).rotateY(yaw).translate(hx, top + 0.3, hz));
        face.push(new THREE.PlaneGeometry(0.7, 0.45).rotateX(0.5 - Math.PI / 2 + Math.PI / 2).rotateY(yaw).translate(hx + Math.sin(yaw) * 0.16, top + 0.3, hz + Math.cos(yaw) * 0.16));
      }
    }
    const street = new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2).translate(sx, B - DROP, sz);
    return {
      shell, crown, tops, wedges, stripes, walls, lights, puddles, street,
      poles: mergeGeometries(pole)!, heads: mergeGeometries(head)!, faces: mergeGeometries(face)!,
      container: shippingContainer(), crate: equipmentCase(), barrier: jerseyBarrier(), box: new THREE.BoxGeometry(1, 1, 1), plane: new THREE.PlaneGeometry(1, 1),
      ring: new THREE.TorusGeometry(5.2, 0.14, 8, 72), ring2: new THREE.TorusGeometry(3.4, 0.06, 6, 64), globe: new THREE.IcosahedronGeometry(2, 2), base: new THREE.CylinderGeometry(3, 3.3, 0.18, 40),
    };
  }, [a, sx, sz, B]);

  const mats = useMemo(() => {
    const concrete = weatheredConcreteTexture(), fac = facadeTexture(), hazard = hazardTexture(), glass = glassTexture();
    return {
      shell: new THREE.MeshStandardMaterial({ color: "#1a2130", map: fac, emissive: "#ffe2c0", emissiveMap: fac, emissiveIntensity: 1.2, roughness: 0.22, metalness: 0.6 }),
      crown: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#3d3f46", roughness: 0.7 }), concrete, 3),
      // rain-dark concrete with a wet sheen
      top: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#3a3c44", roughness: 0.3, metalness: 0.15 }), concrete, 4),
      wall: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#4e5058", roughness: 0.55 }), concrete, 3),
      light: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#38e8ff", emissiveIntensity: 2.4, toneMapped: false }),
      stripe: new THREE.MeshStandardMaterial({ color: "#ffffff", map: hazard, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2 }),
      puddle: new THREE.MeshStandardMaterial({ color: "#1a1d26", roughness: 0.03, metalness: 0.9, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
      containers: CONTAINER_PAINT.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.45 })),
      crate: new THREE.MeshStandardMaterial({ color: "#5c5a3c", roughness: 0.7, metalness: 0.3 }),
      barrier: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#8d8a84", roughness: 0.85 }), concrete, 2),
      console: new THREE.MeshStandardMaterial({ color: "#20252c", roughness: 0.4, metalness: 0.6 }),
      screen: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#38e8ff", emissiveIntensity: 1.6, toneMapped: false }),
      glass: new THREE.MeshStandardMaterial({ color: "#7fe9ff", map: glass, emissive: "#ffffff", emissiveMap: glass, emissiveIntensity: 1.3, transparent: true, opacity: 0.62, side: THREE.DoubleSide, roughness: 0.08, metalness: 0.1, depthWrite: false, toneMapped: false }),
      frame: new THREE.MeshStandardMaterial({ color: "#2a2f36", roughness: 0.35, metalness: 0.8 }),
      slot: new THREE.MeshStandardMaterial({ color: "#14181e", emissive: "#38e8ff", emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.6 }),
      steel: new THREE.MeshStandardMaterial({ color: "#555b64", roughness: 0.45, metalness: 0.6 }),
      lamp: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#f4f8ff", emissiveIntensity: 4, toneMapped: false, side: THREE.DoubleSide }),
      street: new THREE.MeshStandardMaterial({ color: "#07080c", roughness: 0.2, metalness: 0.6, emissive: "#0d1a2a", emissiveIntensity: 0.5 }),
      holo: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#38e8ff", emissiveIntensity: 2.2, transparent: true, opacity: 0.85, wireframe: true, toneMapped: false }),
      ring: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#38e8ff", emissiveIntensity: 2.8, toneMapped: false }),
      pad: new THREE.MeshStandardMaterial({ color: "#0d2a33", emissive: "#38e8ff", emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.5 }),
    };
  }, []);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose());
    for (const [k, m] of Object.entries(mats)) {
      for (const one of (Array.isArray(m) ? m : [m]) as THREE.MeshStandardMaterial[]) { if (k === "stripe" || k === "glass") one.map?.dispose(); one.dispose(); }
    }
  }, [geo, mats]);

  const props = useMemo(() => a.cover.map((k, i) => ({ k, i, y: B + (Number.isFinite(surfaceAt(a, k.x, k.z)) ? surfaceAt(a, k.x, k.z) : 0), x: sx + k.x, z: sz + k.z })), [a, sx, sz, B]);
  const walls = useMemo(() => a.shifters.map((k) => ({ k, y: B + (Number.isFinite(surfaceAt(a, k.x, k.z)) ? surfaceAt(a, k.x, k.z) : 0), x: sx + k.x, z: sz + k.z, yaw: k.w >= k.d ? 0 : Math.PI / 2, span: Math.max(k.w, k.d), thick: Math.min(k.w, k.d) })), [a, sx, sz, B]);
  const skyline = useMemo(() => {
    const by = new Map<BuildingModelId, GlbInstance[]>();
    for (const [dx, dz, id, h] of SKYLINE) { const m = BUILDING_MODELS[id]; by.set(id, [...(by.get(id) ?? []), { x: sx + dx, y: B - DROP, z: sz + dz, yaw: Math.atan2(-dx, -dz), scale: h / m.height }]); }
    return [...by.entries()];
  }, [sx, sz, B]);

  const panes = useRef<(THREE.Group | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null), ring2 = useRef<THREE.Mesh>(null), globe = useRef<THREE.Mesh>(null);
  const warm = useMemo(() => new THREE.Color("#ff8a3d"), []), cool = useMemo(() => new THREE.Color("#38e8ff"), []);
  useFrame(({ clock }) => {
    const t = state.clock, ev = fractureAt(a, t), now = clock.elapsedTime;
    // the glass walls rise out of their slots and sink back with the Grid Rewrite; the ones about to move pulse while it is called
    walls.forEach(({ k }, i) => {
      const g = panes.current[i]; if (!g) return;
      const lift = shifterLift(a, k, t);
      g.visible = lift > 0.02; g.scale.y = Math.max(0.01, lift);
    });
    mats.glass.emissiveIntensity = ev.active || ev.warning ? 1.3 + 0.7 * Math.sin(now * 8) : 1.3;
    mats.slot.emissiveIntensity = ev.warning ? 1.3 + Math.sin(now * 8) : 0.5;
    // the hologram turns over the objective and burns orange while the grid rewrites
    if (ring.current) { ring.current.rotation.x = Math.PI / 2 + Math.sin(now * 0.6) * 0.22; ring.current.rotation.z = now * 0.5; }
    if (ring2.current) { ring2.current.rotation.x = Math.PI / 2 - Math.sin(now * 0.5) * 0.4; ring2.current.rotation.z = -now * 0.8; }
    if (globe.current) { globe.current.rotation.y = now * 0.35; }
    const col = ev.active ? warm : cool;
    mats.ring.emissive.copy(col); mats.holo.emissive.copy(col); mats.pad.emissive.copy(col);
  });

  const y0 = B + 20;
  return (
    <group name="killbox-arena:fracture-floor">
      <hemisphereLight args={["#9fc8ff", "#1c2236", 1.0]} />
      {!phone && MASTS.map(([dx, dz], i) => <pointLight key={i} position={[sx + dx * 0.9, B + 30, sz + dz * 0.9]} color="#e8f2ff" intensity={900} distance={55} decay={2} />)}
      {!phone && <pointLight position={[sx + a.objective[0], B + 25, sz + a.objective[1]]} color="#38e8ff" intensity={240} distance={24} decay={2} />}
      <mesh geometry={geo.street} material={mats.street} />
      <mesh geometry={geo.shell} material={mats.shell} />
      <mesh geometry={geo.crown} material={mats.crown} castShadow receiveShadow />
      <mesh geometry={geo.tops} material={mats.top} receiveShadow />
      <mesh geometry={geo.wedges} material={mats.crown} castShadow receiveShadow />
      <mesh geometry={geo.stripes} material={mats.stripe} />
      <mesh geometry={geo.walls} material={mats.wall} castShadow receiveShadow />
      <mesh geometry={geo.lights} material={mats.light} />
      <mesh geometry={geo.puddles} material={mats.puddle} />
      <mesh geometry={geo.poles} material={mats.steel} castShadow />
      <mesh geometry={geo.heads} material={mats.steel} />
      <mesh geometry={geo.faces} material={mats.lamp} />
      {props.map(({ k, i, x, y, z }) => k.kind === "container"
        ? <mesh key={k.id} geometry={geo.container} material={mats.containers[i % mats.containers.length]!} position={[x, y, z]} rotation-y={k.w > k.d ? Math.PI / 2 : 0} scale={k.w > k.d ? [k.d, k.h, k.w] : [k.w, k.h, k.d]} castShadow receiveShadow />
        : k.kind === "crate"
          ? <group key={k.id} position={[x, y, z]}>
              {/* a stack of steel cases: two below, one on top */}
              <mesh geometry={geo.crate} material={mats.crate} position={[0, k.h * 0.3, -k.d * 0.25]} scale={[k.w, k.h * 0.6, k.d * 0.48]} castShadow receiveShadow />
              <mesh geometry={geo.crate} material={mats.crate} position={[0, k.h * 0.3, k.d * 0.25]} scale={[k.w, k.h * 0.6, k.d * 0.48]} castShadow receiveShadow />
              <mesh geometry={geo.crate} material={mats.crate} position={[0, k.h * 0.8, -k.d * 0.1]} rotation-y={0.2} scale={[k.w * 0.7, k.h * 0.4, k.d * 0.4]} castShadow />
            </group>
          : k.kind === "console"
            ? <group key={k.id} position={[x, y, z]}>
                <mesh geometry={geo.box} material={mats.console} position-y={k.h / 2} scale={[k.w, k.h, k.d]} castShadow receiveShadow />
                <mesh geometry={geo.box} material={mats.screen} position-y={k.h + 0.02} scale={[k.w * 0.9, 0.04, k.d * 0.9]} />
              </group>
            : <mesh key={k.id} geometry={geo.barrier} material={mats.barrier} position={[x, y, z]} rotation-y={k.d > k.w ? 0 : Math.PI / 2} scale={[Math.min(k.w, k.d), k.h, Math.max(k.w, k.d)]} castShadow receiveShadow />)}
      {walls.map(({ k, x, y, z, yaw, span, thick }, i) => (
        <group key={k.id} position={[x, y, z]} rotation-y={yaw}>
          <mesh geometry={geo.box} material={mats.slot} position-y={0.03} scale={[span + 0.3, 0.06, thick + 0.3]} />
          {/* the wall: glass between two steel end posts and a base rail; it grows up out of the slot */}
          <group ref={(g) => { panes.current[i] = g; }}>
            <mesh geometry={geo.plane} material={mats.glass} position-y={k.h / 2} scale={[span - 0.3, k.h - 0.2, 1]} />
            <mesh geometry={geo.box} material={mats.frame} position={[-span / 2 + 0.12, k.h / 2, 0]} scale={[0.24, k.h, thick]} castShadow />
            <mesh geometry={geo.box} material={mats.frame} position={[span / 2 - 0.12, k.h / 2, 0]} scale={[0.24, k.h, thick]} castShadow />
            <mesh geometry={geo.box} material={mats.frame} position={[0, 0.08, 0]} scale={[span, 0.16, thick]} />
            <mesh geometry={geo.box} material={mats.light} position={[0, k.h - 0.05, 0]} scale={[span, 0.06, thick * 0.6]} />
          </group>
        </group>
      ))}
      {/* the hologram over the objective: a lit pad on the floor, a wireframe globe and two turning rings */}
      <mesh geometry={geo.base} material={mats.pad} position={[sx + a.objective[0], y0 + 0.09, sz + a.objective[1]]} receiveShadow />
      <group position={[sx + a.objective[0], B + 27, sz + a.objective[1]]}>
        <mesh ref={globe} geometry={geo.globe} material={mats.holo} />
        <mesh ref={ring} geometry={geo.ring} material={mats.ring} />
        <mesh ref={ring2} geometry={geo.ring2} material={mats.ring} />
      </group>
      {skyline.map(([id, items]) => <InstancedGlb key={id} url={BUILDING_MODELS[id].url} items={items} shadows={false} nightGlow={[0.6, 1.8]} windowScale={1.4} />)}
      <ArenaWeather kind="rain" center={{ x: sx, y: B + 12, z: sz }} count={phone ? 500 : 1800} size={110} />
    </group>
  );
}
