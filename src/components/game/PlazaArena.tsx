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

/** The plaza arenas (killbox-arenas.ts FRACTURE_FLOOR, KILLBOX_PRIME), after the owner's PvP maps board (Nov 2): a rain-wet roof on
 * top of a tower at night. `STYLES` holds what differs per map (the building under it, the hologram, masts, skyline, water).
 * Fracture Floor: Dark wet concrete with standing water and yellow hazard stripes along every lip, cargo containers and crates for
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

type PlazaStyle = {
  /** the building under the roofs: one tower with a concrete crown the roofs stand on, or a tower wing under each roof */
  shell: "crown" | "per-roof";
  /** over the objective: a wireframe globe in two rings, or rings of light on the floor round a hologram column */
  holo: "globe" | "rings";
  /** floodlight masts (dx, dz), each throws its light toward the centre; the towers round it (dx, dz, model, height); standing water */
  masts: readonly [number, number][]; skyline: readonly [number, number, BuildingModelId, number][]; puddles: readonly [number, number, number, number][];
  /** walkways drawn as solid wedges or as flights of steps with handrails */
  stairs: "wedge" | "steps";
};
const STYLES: Record<"nexus-grid" | "prime-roof", PlazaStyle> = {
  "nexus-grid": {
    shell: "crown", holo: "globe", stairs: "wedge",
    masts: [[-29, 23], [29, 23], [29, -23], [-29, -23]],
    skyline: [
      [-75, 52, "neon-tower-b", 190], [-30, 82, "neon-tower-a", 230], [28, 86, "neon-tower-c", 175], [76, 50, "neon-tower-a", 210],
      [92, -6, "neon-tower-c", 165], [74, -54, "neon-tower-b", 220], [26, -86, "neon-tower-a", 185], [-28, -84, "neon-tower-c", 240],
      [-78, -50, "neon-tower-a", 200], [-94, 4, "neon-tower-b", 180], [-130, 110, "neon-tower-c", 260], [135, -115, "neon-tower-b", 270],
    ],
    puddles: [[-14, -4, 3.2, 1.6], [14, 4, 3.2, 1.6], [3, -12, 2, 2.8], [-3, 12, 2, 2.8], [-24, -14, 2.4, 1.2], [24, 14, 2.4, 1.2], [0, 30, 3, 1], [0, -30, 3, 1]],
  },
  "prime-roof": {
    shell: "per-roof", holo: "rings", stairs: "steps",
    masts: [[-31, 31], [31, 31], [31, -31], [-31, -31]],
    skyline: [
      [-90, 60, "neon-tower-a", 170], [-40, 96, "neon-tower-c", 210], [30, 100, "neon-tower-b", 160], [92, 64, "neon-tower-a", 200],
      [108, -4, "neon-tower-b", 150], [88, -66, "neon-tower-c", 215], [36, -100, "neon-tower-a", 165], [-34, -98, "neon-tower-b", 225],
      [-94, -62, "neon-tower-c", 185], [-110, 6, "neon-tower-a", 160], [-150, 130, "neon-tower-b", 250], [150, -130, "neon-tower-c", 255],
    ],
    puddles: [[-10, -4, 3, 1.4], [10, 4, 3, 1.4], [16, -20, 2.4, 1.6], [-16, 20, 2.4, 1.6], [-38, -20, 2, 1], [38, 20, 2, 1], [24, -6, 1.6, 2.2], [-24, 6, 1.6, 2.2]],
  },
};
const DROP = 125; // the plaza tower's street lies this far below the arena base
const CONTAINER_PAINT = ["#8a4426", "#2d5c66", "#7a6a2c", "#3b3f6a", "#6c2f2a"];

export function PlazaArenaView({ arena: a, state }: { arena: Arena; state: PvpState }) {
  const { x: sx, z: sz } = a.site, B = a.base;
  const st = STYLES[a.look === "prime-roof" ? "prime-roof" : "nexus-grid"], MASTS = st.masts;
  const phone = useMemo(() => isTouchDevice(), []);

  const geo = useMemo(() => {
    const W = (dx: number, dz: number) => ({ x: sx + dx, z: sz + dz });
    const minX = Math.min(...a.roofs.map((r) => r.x0)), maxX = Math.max(...a.roofs.map((r) => r.x1)), minZ = Math.min(...a.roofs.map((r) => r.z0)), maxZ = Math.max(...a.roofs.map((r) => r.z1));
    const p = W(minX, minZ), q = W(maxX, maxZ), cx = (p.x + q.x) / 2, cz = (p.z + q.z) / 2, w = q.x - p.x, d = q.z - p.z;
    // the building: one tower up to a concrete crown the roofs stand on (Fracture Floor), or a wing under each roof (Killbox Prime),
    // with a ledge at every floor and piers up the corners
    const blocks = st.shell === "crown" ? [{ p, q, top: B + 14 }] : a.roofs.map((r) => ({ p: W(r.x0, r.z0), q: W(r.x1, r.z1), top: B + r.top - 0.4 }));
    const shell = mergeGeometries(blocks.map((b) => towerShell(b.p.x, b.q.x, b.p.z, b.q.z, B - DROP, b.top)))!;
    const trim: THREE.BufferGeometry[] = [];
    for (const b of blocks) {
      const bx = (b.p.x + b.q.x) / 2, bz = (b.p.z + b.q.z) / 2, bw = b.q.x - b.p.x, bd = b.q.z - b.p.z;
      for (let y = B - DROP + 3.6; y < b.top - 1; y += 3.6) trim.push(slab(bx, y, b.p.z - 0.12, bw + 0.3, 0.22, 0.26), slab(bx, y, b.q.z + 0.12, bw + 0.3, 0.22, 0.26), slab(b.p.x - 0.12, y, bz, 0.26, 0.22, bd + 0.3), slab(b.q.x + 0.12, y, bz, 0.26, 0.22, bd + 0.3));
      for (const [x, z] of [[b.p.x, b.p.z], [b.q.x, b.p.z], [b.p.x, b.q.z], [b.q.x, b.q.z]] as const) trim.push(slab(x, (B - DROP + b.top) / 2, z, 1.2, b.top - (B - DROP), 1.2));
    }
    // the crown: each roof a concrete body up to its surface (Fracture Floor's uplinks make the 2.5 m faces); a roof slab per wing
    for (const r of a.roofs) { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), from = st.shell === "crown" ? 14 : r.top - 0.4, h = r.top - from; trim.push(slab(c.x, B + from + h / 2 - 0.02, c.z, r.x1 - r.x0, h, r.z1 - r.z0)); }
    const crown = mergeGeometries(trim)!;
    // the walking surface, panelled so the concrete reads in metres
    const tops = mergeGeometries([
      ...a.roofs.map((r) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(-Math.PI / 2).translate(c.x, B + r.top + 0.01, c.z); }),
      // ramps get a panelled top; stepped flights draw their own treads
      ...(st.stairs === "wedge" ? a.walks : []).map((k) => { const c = W(k.x, k.z), rise = k.topB - k.top; return new THREE.PlaneGeometry(k.width, Math.hypot(k.length, rise)).rotateX(-Math.PI / 2).rotateX(-Math.atan2(rise, k.length)).translate(c.x, B + (k.top + k.topB) / 2 + 0.03, c.z); }),
    ])!;
    // each ramp a solid wedge (profile x along the ramp, extruded across it), turned onto the walkway's axis
    const plain = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k); return n; };
    const wedges = mergeGeometries(a.walks.map((k) => {
      const c = W(k.x, k.z), lo = Math.min(k.top, k.topB), rise = Math.abs(k.topB - k.top), shape = new THREE.Shape();
      shape.moveTo(-k.length / 2, 0); shape.lineTo(k.length / 2, 0); if (k.topB > k.top) shape.lineTo(k.length / 2, rise); else shape.lineTo(-k.length / 2, rise); shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: k.width, bevelEnabled: false }).translate(0, 0, -k.width / 2);
      return plain((k.along === "z" ? g.rotateY(-Math.PI / 2) : g).translate(c.x, B + lo, c.z));
    }))!;
    // flights of steps (Killbox Prime): 0.25 m risers following the walkway's slope, and a handrail on each side
    const steps: THREE.BufferGeometry[] = [], rails: THREE.BufferGeometry[] = [];
    if (st.stairs === "steps") for (const k of a.walks) {
      const c = W(k.x, k.z), rise = k.topB - k.top, n = Math.max(2, Math.round(Math.abs(rise) / 0.25)), run = k.length / n, ax = k.along === "x";
      for (let i = 0; i < n; i++) {
        const s = -k.length / 2 + (i + 0.5) * run, h = k.top + rise * ((i + 1) / n), lo = Math.min(k.top, k.topB);
        steps.push(plain(slab(c.x + (ax ? s : 0), B + lo + (h - lo) / 2, c.z + (ax ? 0 : s), ax ? run + 0.01 : k.width, Math.max(0.05, h - lo), ax ? k.width : run + 0.01)));
      }
      for (const side of [-1, 1]) {
        const ox = ax ? 0 : side * (k.width / 2 - 0.08), oz = ax ? side * (k.width / 2 - 0.08) : 0, len = Math.hypot(k.length, rise), tilt = Math.atan2(rise, k.length);
        const tube = new THREE.BoxGeometry(ax ? len : 0.06, 0.06, ax ? 0.06 : len);
        if (ax) tube.rotateZ(tilt); else tube.rotateX(-tilt);
        rails.push(plain(tube.translate(c.x + ox, B + (k.top + k.topB) / 2 + 1, c.z + oz)));
        for (let i = 0; i <= 4; i++) { const s = -k.length / 2 + (i / 4) * k.length, h = k.top + rise * (i / 4); rails.push(plain(slab(c.x + ox + (ax ? s : 0), B + h + 0.5, c.z + oz + (ax ? 0 : s), 0.06, 1, 0.06))); }
      }
    }
    const flights = steps.length ? mergeGeometries(steps)! : new THREE.BufferGeometry(), handrails = rails.length ? mergeGeometries(rails)! : new THREE.BufferGeometry();
    // hazard stripes: along every uplink lip and down both sides of each ramp
    // each ledge: the high side is the one with the higher surface just beyond the line; a stripe on the lip and one at its foot
    const stripes = mergeGeometries(a.ledges.flatMap((l) => {
      const len = Math.hypot(l.bx - l.ax, l.bz - l.az), nx = -(l.bz - l.az) / len, nz = (l.bx - l.ax) / len, mx = (l.ax + l.bx) / 2, mz = (l.az + l.bz) / 2;
      const s = (surfaceAt(a, mx + nx, mz + nz) > surfaceAt(a, mx - nx, mz - nz) ? 1 : -1), hi = surfaceAt(a, mx + nx * s, mz + nz * s), lo = surfaceAt(a, mx - nx * s, mz - nz * s);
      const off = (o: number) => [sx + l.ax + nx * o, sz + l.az + nz * o, sx + l.bx + nx * o, sz + l.bz + nz * o] as const;
      const [a1, b1, c1, d1] = off(s * 0.3), [a2, b2, c2, d2] = off(-s * 0.45);
      return [floorStrip(a1, b1, c1, d1, 0.4, B + hi + 0.02), floorStrip(a2, b2, c2, d2, 0.6, B + lo + 0.02)];
    }))!;
    // parapets: a low concrete wall with a cyan light line along its top
    const parapets = arenaParapets(a);
    const along = (w: (typeof parapets)[number], wide: number, h: number, y: number) => { const len = Math.hypot(w.bx - w.ax, w.bz - w.az), yaw = Math.atan2(w.bx - w.ax, w.bz - w.az); return new THREE.BoxGeometry(wide, h, len).rotateY(yaw).translate((w.ax + w.bx) / 2, y, (w.az + w.bz) / 2); };
    const walls = mergeGeometries(parapets.map((w) => along(w, 0.34, w.top - w.base - 0.56, w.base + 0.5 + (w.top - w.base - 0.56) / 2)))!;
    const lights = mergeGeometries([
      ...parapets.map((w) => along(w, 0.38, 0.06, w.top - 0.03)),
      // under-lip light line round the crown, so the platform edge reads from across the plaza
      ...(st.shell === "crown" ? [[p.x, p.z, q.x, p.z], [p.x, q.z, q.x, q.z], [p.x, p.z, p.x, q.z], [q.x, p.z, q.x, q.z]] : []).map(([ax, az, bx, bz]) => { const len = Math.hypot(bx! - ax!, bz! - az!), yaw = Math.atan2(bx! - ax!, bz! - az!); return new THREE.BoxGeometry(0.12, 0.12, len).rotateY(yaw).translate((ax! + bx!) / 2, B + 14.4, (az! + bz!) / 2); }),
    ])!;
    // standing water
    const puddle = (dx: number, dz: number, rx: number, rz: number) => { const c = W(dx, dz), y = B + surfaceAt(a, dx, dz) + 0.02; return new THREE.CircleGeometry(1, 22).rotateX(-Math.PI / 2).scale(rx, 1, rz).translate(c.x, y, c.z); };
    const puddles = mergeGeometries(st.puddles.map(([dx, dz, rx, rz]) => puddle(dx, dz, rx, rz)))!;
    // floodlight masts: a steel pole, a cross-arm and two lamp heads tilted at the centre
    const pole: THREE.BufferGeometry[] = [], head: THREE.BufferGeometry[] = [], face: THREE.BufferGeometry[] = [];
    for (const [dx, dz] of MASTS) {
      const c = W(dx, dz), yaw = Math.atan2(-dx, -dz), foot = B + surfaceAt(a, dx, dz), top = foot + 11;
      pole.push(new THREE.CylinderGeometry(0.14, 0.2, 11, 10).translate(c.x, foot + 5.5, c.z), new THREE.BoxGeometry(2.6, 0.14, 0.14).rotateY(yaw).translate(c.x, top, c.z), new THREE.BoxGeometry(0.6, 0.3, 0.6).translate(c.x, foot + 0.15, c.z));
      for (const s of [-0.9, 0.9]) {
        const hx = c.x + Math.cos(yaw) * s, hz = c.z - Math.sin(yaw) * s;
        head.push(new THREE.BoxGeometry(0.8, 0.55, 0.3).rotateX(0.5).rotateY(yaw).translate(hx, top + 0.3, hz));
        face.push(new THREE.PlaneGeometry(0.7, 0.45).rotateX(0.5 - Math.PI / 2 + Math.PI / 2).rotateY(yaw).translate(hx + Math.sin(yaw) * 0.16, top + 0.3, hz + Math.cos(yaw) * 0.16));
      }
    }
    const street = new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2).translate(sx, B - DROP, sz);
    return {
      shell, crown, tops, wedges, flights, handrails, stripes, walls, lights, puddles, street,
      zoneRings: mergeGeometries([new THREE.RingGeometry(6.6, 6.9, 72), new THREE.RingGeometry(4.6, 4.75, 64), new THREE.RingGeometry(2.4, 2.5, 48)].map((g) => g.rotateX(-Math.PI / 2)))!,
      column: new THREE.CylinderGeometry(1.6, 1.6, 6, 32, 1, true),
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
      zone: new THREE.MeshBasicMaterial({ color: "#38e8ff", transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }),
      column: new THREE.MeshBasicMaterial({ color: "#38e8ff", transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
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
    for (const [dx, dz, id, h] of st.skyline) { const m = BUILDING_MODELS[id]; by.set(id, [...(by.get(id) ?? []), { x: sx + dx, y: B - DROP, z: sz + dz, yaw: Math.atan2(-dx, -dz), scale: h / m.height }]); }
    return [...by.entries()];
  }, [sx, sz, B, st]);

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
    mats.ring.emissive.copy(col); mats.holo.emissive.copy(col); mats.pad.emissive.copy(col); mats.zone.color.copy(col); mats.column.color.copy(col);
    mats.column.opacity = 0.12 + 0.06 * Math.sin(now * 2.2);
  });

  const y0 = B + 20;
  return (
    <group name={`killbox-arena:${a.id}`}>
      <hemisphereLight args={st.holo === "rings" ? ["#c8d4ff", "#2a2436", 1.4] : ["#9fc8ff", "#1c2236", 1.0]} />
      {!phone && MASTS.map(([dx, dz], i) => <pointLight key={i} position={[sx + dx * 0.9, B + 30, sz + dz * 0.9]} color={st.holo === "rings" ? "#ffe6c4" : "#e8f2ff"} intensity={st.holo === "rings" ? 1400 : 900} distance={st.holo === "rings" ? 70 : 55} decay={2} />)}
      {!phone && <pointLight position={[sx + a.objective[0], B + 25, sz + a.objective[1]]} color="#38e8ff" intensity={240} distance={24} decay={2} />}
      <mesh geometry={geo.street} material={mats.street} />
      <mesh geometry={geo.shell} material={mats.shell} />
      <mesh geometry={geo.crown} material={mats.crown} castShadow receiveShadow />
      <mesh geometry={geo.tops} material={mats.top} receiveShadow />
      {st.stairs === "wedge" ? <mesh geometry={geo.wedges} material={mats.crown} castShadow receiveShadow /> : <><mesh geometry={geo.flights} material={mats.crown} castShadow receiveShadow /><mesh geometry={geo.handrails} material={mats.steel} castShadow /></>}
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
      {st.holo === "globe" ? (
        <group position={[sx + a.objective[0], B + 27, sz + a.objective[1]]}>
          <mesh ref={globe} geometry={geo.globe} material={mats.holo} />
          <mesh ref={ring} geometry={geo.ring} material={mats.ring} />
          <mesh ref={ring2} geometry={geo.ring2} material={mats.ring} />
        </group>
      ) : (
        <group position={[sx + a.objective[0], y0, sz + a.objective[1]]}>
          {/* the capture zone: rings of light on the floor, a faint column of light and a small ring turning over it */}
          <mesh geometry={geo.zoneRings} material={mats.zone} position-y={0.2} />
          <mesh geometry={geo.column} material={mats.column} position-y={3.2} />
          <mesh ref={ring} geometry={geo.ring2} material={mats.ring} position-y={4.5} />
        </group>
      )}
      {skyline.map(([id, items]) => <InstancedGlb key={id} url={BUILDING_MODELS[id].url} items={items} shadows={false} nightGlow={[0.6, 1.8]} windowScale={1.4} />)}
      <ArenaWeather kind="rain" center={{ x: sx, y: B + 12, z: sz }} count={phone ? 500 : 1800} size={110} />
    </group>
  );
}
