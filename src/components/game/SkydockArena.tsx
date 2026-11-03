import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { equipmentCase } from "@/game/camp-geometry";
import { isTouchDevice } from "@/game/client-input";
import { arenaParapets, fractureAt, surfaceAt, type KillboxArena as Arena } from "@/game/killbox-arenas";
import type { PvpState } from "@/game/pvp";
import { latticePylon } from "@/game/street-geometry";
import { floorStrip, hazardTexture, jerseyBarrier, shippingContainer, slab } from "./arena-parts";

/** Skydock (killbox-arenas.ts SKYDOCK), after the owner's PvP maps board: an aerial docking platform above a sea of cloud at dusk.
 * Steel-plate decks on thick hulls held up by glowing lift engines, landing-pad markings and hazard stripes, steel railings, two
 * parked dropships either side of the pad, cranes on the docks, and its own dusk sky (the arena hangs in its own airspace, so it
 * brings its sky with it). During the Cloud Bank a wall of cloud drifts through the dock. Drawn from the same data its decks and
 * walls come from; world space maps to arena space with the arena's site and base. */

const plain = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k); return n; };

/** a dropship in metres, nose toward +x, belly at y = 0: a long hull, a canopy, stub wings with engine pods, a tail fin, skids */
function dropship(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.CapsuleGeometry(1.25, 6.4, 6, 16).rotateZ(Math.PI / 2).scale(1, 0.85, 1).translate(0, 1.6, 0)); // hull
  parts.push(new THREE.ConeGeometry(1.05, 1.8, 16).rotateZ(-Math.PI / 2).scale(1, 0.75, 1).translate(4.7, 1.55, 0)); // nose
  parts.push(new THREE.BoxGeometry(2.4, 0.35, 3.4).translate(-0.6, 1.3, 0)); // wing
  for (const z of [-1.55, 1.55]) parts.push(new THREE.CylinderGeometry(0.42, 0.5, 2.4, 14).rotateZ(Math.PI / 2).translate(-0.7, 1.2, z)); // engine pods
  parts.push(new THREE.BoxGeometry(1.8, 1.5, 0.18).translate(-3.9, 2.8, 0)); // tail fin
  for (const z of [-1, 1]) { parts.push(new THREE.BoxGeometry(5, 0.12, 0.14).translate(0.2, 0.2, z)); parts.push(new THREE.BoxGeometry(0.14, 0.7, 0.14).translate(-1.6, 0.55, z), new THREE.BoxGeometry(0.14, 0.7, 0.14).translate(2, 0.55, z)); } // skids
  return mergeGeometries(parts.map(plain))!;
}
function canopy(): THREE.BufferGeometry { return new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.6, 0.75, 0.9).translate(2.7, 2.35, 0); }
function enginesGlow(): THREE.BufferGeometry { return mergeGeometries([-1.55, 1.55].map((z) => new THREE.CircleGeometry(0.4, 16).rotateY(-Math.PI / 2).translate(-1.92, 1.2, z)))!; }

/** steel deck plate: grey panels with seams and rows of tread bumps */
function plateTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#9a9ea6"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) { const v = 130 + Math.random() * 50; x.fillStyle = `rgba(${v},${v},${v + 6},0.12)`; x.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
  x.fillStyle = "rgba(60,62,70,0.5)"; for (let r = 0; r < 16; r++) for (let k = 0; k < 16; k++) x.fillRect(k * 16 + ((r % 2) * 8) + 4, r * 16 + 6, 7, 2);
  x.fillStyle = "#5d6068"; x.fillRect(0, 0, 256, 3); x.fillRect(0, 0, 3, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** the landing pad marking: a yellow ring and an H (or a dock number) on clear ground */
function padTexture(label: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const x = c.getContext("2d")!;
  x.clearRect(0, 0, 512, 512); x.strokeStyle = "#f2c230"; x.lineWidth = 22; x.beginPath(); x.arc(256, 256, 226, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 6; x.beginPath(); x.arc(256, 256, 190, 0, Math.PI * 2); x.stroke();
  x.fillStyle = "#f2f2ee"; x.font = "bold 220px Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(label, 256, 268);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** soft cloud: layered blobs of white fading to clear, for the cloud sea and the Cloud Bank */
function cloudTexture(seed: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d")!;
  let s = seed; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 70; i++) {
    const cx = rnd() * 256, cy = rnd() * 256, r = 18 + rnd() * 46, g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(255,255,255,0.32)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    // wrap so the texture tiles
    for (const [ox, oy] of [[256, 0], [-256, 0], [0, 256], [0, -256]] as const) { x.save(); x.translate(ox, oy); x.fillRect(cx - r, cy - r, r * 2, r * 2); x.restore(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** one drifting cloud sheet for the Cloud Bank: the cloud texture faded to nothing toward every edge, so no sheet shows its border */
function sheetTexture(seed: number): THREE.CanvasTexture | null {
  const base = cloudTexture(seed); if (!base || typeof document === "undefined") return base;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d")!;
  x.drawImage(base.image as HTMLCanvasElement, 0, 0); base.dispose();
  x.globalCompositeOperation = "destination-in";
  const g = x.createRadialGradient(128, 128, 30, 128, 128, 128); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.7, "rgba(0,0,0,0.6)"); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const DUSK = { top: "#141c3a", mid: "#6a3a78", low: "#ff8a4a", sun: "#ffd29a" } as const;
/** cranes on the docks: (dx, dz, boom yaw) */
const CRANES: readonly [number, number, number][] = [[-18, 32.5, 0.6], [18, -32.5, 0.6 + Math.PI]];

export function SkydockView({ arena: a, state }: { arena: Arena; state: PvpState }) {
  const { x: sx, z: sz } = a.site, B = a.base;
  const phone = useMemo(() => isTouchDevice(), []);

  const geo = useMemo(() => {
    const W = (dx: number, dz: number) => ({ x: sx + dx, z: sz + dz });
    // the decks: a steel-plate top on a thick hull, with a lip of trim; walkways on steel beams
    const tops: THREE.BufferGeometry[] = [], hulls: THREE.BufferGeometry[] = [], trim: THREE.BufferGeometry[] = [], pods: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = [];
    for (const r of a.roofs) {
      const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), w = r.x1 - r.x0, d = r.z1 - r.z0, thin = Math.min(w, d) < 5;
      const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), uv = g.attributes["uv"] as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (r.x0 + uv.getX(i) * w) / 4, (r.z0 + uv.getY(i) * d) / 4);
      tops.push(g.translate(c.x, B + r.top + 0.01, c.z));
      const hull = thin ? 0.9 : 3.2;
      hulls.push(plain(slab(c.x, B + r.top - hull / 2, c.z, w, hull, d)));
      if (!thin) hulls.push(plain(slab(c.x, B + r.top - hull - 1, c.z, w - 4, 2, d - 4))); // a stepped keel under the big decks
      trim.push(plain(slab(c.x, B + r.top - 0.12, r.z0 + sz, w + 0.2, 0.24, 0.2)), plain(slab(c.x, B + r.top - 0.12, r.z1 + sz, w + 0.2, 0.24, 0.2)), plain(slab(r.x0 + sx, B + r.top - 0.12, c.z, 0.2, 0.24, d + 0.2)), plain(slab(r.x1 + sx, B + r.top - 0.12, c.z, 0.2, 0.24, d + 0.2)));
      // lift engines under the corners of each deck (the gantries hang off thin girders instead)
      if (!thin) for (const [px, pz] of [[r.x0 + 3, r.z0 + 3], [r.x1 - 3, r.z0 + 3], [r.x0 + 3, r.z1 - 3], [r.x1 - 3, r.z1 - 3]] as const) {
        const p = W(px, pz);
        pods.push(plain(new THREE.CylinderGeometry(1.3, 1.6, 2.4, 18).translate(p.x, B + r.top - hull - 2.4, p.z)));
        glow.push(new THREE.CircleGeometry(1.25, 20).rotateX(Math.PI / 2).translate(p.x, B + r.top - hull - 3.62, p.z));
      }
    }
    // gantry girders: a truss line under each gantry down to the deck hull
    for (const r of a.roofs.filter((q) => q.x1 - q.x0 < 5)) for (let z = r.z0 + 4; z < r.z1; z += 8) { const p = W((r.x0 + r.x1) / 2, z); hulls.push(plain(slab(p.x, B + r.top - 3, p.z, 0.4, 5, 0.4))); }
    // walkways: steel grate decks on two side beams; steep ones are stairs
    const walks: THREE.BufferGeometry[] = [];
    for (const k of a.walks) {
      const c = W(k.x, k.z), rise = k.topB - k.top, ax = k.along === "x", tilt = Math.atan2(rise, k.length), len = Math.hypot(k.length, rise);
      if (Math.abs(rise) / k.length > 0.45) {
        const n = Math.round(Math.abs(rise) / 0.25), run = k.length / n, lo = Math.min(k.top, k.topB);
        for (let i = 0; i < n; i++) { const s = -k.length / 2 + (i + 0.5) * run, h = k.top + rise * ((i + 1) / n); walks.push(plain(slab(c.x + (ax ? s : 0), B + (lo + h) / 2, c.z + (ax ? 0 : s), ax ? run + 0.01 : k.width, Math.max(0.05, h - lo), ax ? k.width : run + 0.01))); }
      } else {
        const g = new THREE.BoxGeometry(ax ? len : k.width, 0.16, ax ? k.width : len); if (ax) g.rotateZ(tilt); else g.rotateX(-tilt);
        walks.push(plain(g.translate(c.x, B + (k.top + k.topB) / 2 - 0.08, c.z)));
        for (const s of [-1, 1]) { const b = new THREE.BoxGeometry(ax ? len : 0.2, 0.5, ax ? 0.2 : len); if (ax) b.rotateZ(tilt); else b.rotateX(-tilt); walks.push(plain(b.translate(c.x + (ax ? 0 : s * k.width / 2), B + (k.top + k.topB) / 2 - 0.35, c.z + (ax ? s * k.width / 2 : 0)))); }
      }
    }
    // railings: posts every 2 m and two rails on every parapet line and down both sides of every railed walkway
    const rails: THREE.BufferGeometry[] = [];
    const railRun = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2));
      for (let i = 0; i <= n; i++) { const t = i / n; rails.push(plain(slab(ax + (bx - ax) * t, ay + (by - ay) * t + 0.55, az + (bz - az) * t, 0.07, 1.1, 0.07))); }
      for (const h of [0.55, 1.08]) {
        const g = new THREE.BoxGeometry(0.06, 0.06, Math.hypot(len, by - ay)).rotateX(-Math.atan2(by - ay, len)).rotateY(Math.atan2(bx - ax, bz - az));
        rails.push(plain(g.translate((ax + bx) / 2, (ay + by) / 2 + h, (az + bz) / 2)));
      }
    };
    for (const w of arenaParapets(a)) railRun(w.ax, w.base + 0.5, w.az, w.bx, w.base + 0.5, w.bz);
    for (const k of a.walks) if (k.rails) for (const s of [-1, 1]) {
      const ax = k.along === "x", h = k.length / 2 - 0.6;
      const p = W(k.x + (ax ? -h : s * k.width / 2), k.z + (ax ? s * k.width / 2 : -h)), q = W(k.x + (ax ? h : s * k.width / 2), k.z + (ax ? s * k.width / 2 : h));
      const t0 = 0.6 / k.length, ya = B + k.top + (k.topB - k.top) * t0, yb = B + k.topB - (k.topB - k.top) * t0;
      railRun(p.x, ya, p.z, q.x, yb, q.z);
    }
    // hazard stripes inside every parapet line (the drop edge)
    const stripes = mergeGeometries(arenaParapets(a).map((w) => {
      const len = Math.hypot(w.bx - w.ax, w.bz - w.az), nx = -(w.bz - w.az) / len, nz = (w.bx - w.ax) / len, mx = (w.ax + w.bx) / 2 - sx, mz = (w.az + w.bz) / 2 - sz;
      const s = Number.isFinite(surfaceAt(a, mx + nx * 0.8, mz + nz * 0.8)) ? 1 : -1;
      return floorStrip(w.ax + nx * s * 0.55, w.az + nz * s * 0.55, w.bx + nx * s * 0.55, w.bz + nz * s * 0.55, 0.5, w.base + 0.5 + 0.03);
    }))!;
    // landing pad markings: the H on the capture pad, the dock numbers
    const pad = (dx: number, dz: number, r: number, yaw: number) => { const c = W(dx, dz); return new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2).rotateY(yaw).translate(c.x, B + surfaceAt(a, dx, dz) + 0.03, c.z); };
    // cranes: a lattice tower, a boom and a hook line
    const cranes: THREE.BufferGeometry[] = [];
    for (const [dx, dz, yaw] of CRANES) {
      const c = W(dx, dz), foot = B + surfaceAt(a, dx, dz - Math.sign(dz) * 0.8);
      cranes.push(plain(latticePylon(14).translate(c.x, foot, c.z)));
      const boom = new THREE.BoxGeometry(12, 0.5, 0.6).translate(4, 0, 0).rotateY(yaw).translate(c.x, foot + 14.5, c.z);
      cranes.push(plain(boom), plain(new THREE.BoxGeometry(0.05, 6, 0.05).translate(c.x + Math.cos(yaw) * 9, foot + 11.5, c.z - Math.sin(yaw) * 9)), plain(slab(c.x + Math.cos(yaw) * 9, foot + 8.3, c.z - Math.sin(yaw) * 9, 0.6, 0.5, 0.6)));
    }
    // the sky dome and the cloud sea far below
    const sky = new THREE.SphereGeometry(900, 32, 16).translate(sx, B, sz);
    const sea = mergeGeometries([new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2).translate(sx, B - 14, sz), new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2).translate(sx, B - 26, sz)])!;
    // the Cloud Bank: tall soft sheets standing about the dock at random angles (shown only while it rolls through)
    const bank: THREE.BufferGeometry[] = [];
    let seed = 99; const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 40; i++) { const p = W((rnd() - 0.5) * 84, (rnd() - 0.5) * 84); bank.push(new THREE.PlaneGeometry(20 + rnd() * 14, 12 + rnd() * 6).rotateY(rnd() * Math.PI).translate(p.x, B + 20 + 2 + rnd() * 5, p.z)); }
    return {
      tops: mergeGeometries(tops)!, hulls: mergeGeometries(hulls)!, trim: mergeGeometries(trim)!, pods: mergeGeometries(pods)!, glow: mergeGeometries(glow)!,
      walks: mergeGeometries(walks)!, rails: mergeGeometries(rails)!, stripes, cranes: mergeGeometries(cranes)!, sky, sea, bank: mergeGeometries(bank)!,
      padH: pad(a.objective[0], a.objective[1], 6, 0), padN: pad(0, 29, 4, Math.PI), padS: pad(0, -29, 4, 0),
      ship: dropship(), canopy: canopy(), shipGlow: enginesGlow(), container: shippingContainer(), crate: equipmentCase(), barrier: jerseyBarrier(),
    };
  }, [a, sx, sz, B]);

  const mats = useMemo(() => {
    const plate = plateTexture(), hazard = hazardTexture(), cloudA = cloudTexture(3), cloudB = cloudTexture(17), bankTex = sheetTexture(41);
    if (cloudA) cloudA.repeat.set(5, 5); if (cloudB) cloudB.repeat.set(3.3, 3.3);
    const sky = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(DUSK.top) }, mid: { value: new THREE.Color(DUSK.mid) }, low: { value: new THREE.Color(DUSK.low) }, sun: { value: new THREE.Color(DUSK.sun) }, sunDir: { value: new THREE.Vector3(-0.8, 0.08, 0.6).normalize() } },
      vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position - cameraPosition); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }",
      fragmentShader: `uniform vec3 top, mid, low, sun; uniform vec3 sunDir; varying vec3 vDir;
        void main() { float h = vDir.y; vec3 c = mix(mix(low, mid, smoothstep(-0.08, 0.22, h)), top, smoothstep(0.18, 0.85, h));
          float s = max(dot(normalize(vDir), sunDir), 0.0); c += sun * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.35); gl_FragColor = vec4(c, 1.0); }`,
    });
    return {
      sky,
      top: new THREE.MeshStandardMaterial({ color: "#ffffff", map: plate, roughness: 0.45, metalness: 0.65 }),
      hull: new THREE.MeshStandardMaterial({ color: "#3c4150", roughness: 0.5, metalness: 0.7 }),
      trim: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ffb35a", emissiveIntensity: 1.6, toneMapped: false }),
      pod: new THREE.MeshStandardMaterial({ color: "#2a2f3a", roughness: 0.4, metalness: 0.8 }),
      podGlow: new THREE.MeshBasicMaterial({ color: "#5ff0ff", toneMapped: false, side: THREE.DoubleSide }),
      walk: new THREE.MeshStandardMaterial({ color: "#5a606c", roughness: 0.45, metalness: 0.75 }),
      rail: new THREE.MeshStandardMaterial({ color: "#c9a23a", roughness: 0.4, metalness: 0.6 }),
      stripe: new THREE.MeshStandardMaterial({ color: "#ffffff", map: hazard, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
      pad: [padTexture("H"), padTexture("01"), padTexture("02")].map((t) => new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })),
      crane: new THREE.MeshStandardMaterial({ color: "#d9a43a", roughness: 0.55, metalness: 0.5 }),
      ship: new THREE.MeshStandardMaterial({ color: "#c7ccd4", roughness: 0.35, metalness: 0.7 }),
      canopy: new THREE.MeshStandardMaterial({ color: "#10161e", roughness: 0.05, metalness: 0.9, emissive: "#ff9a55", emissiveIntensity: 0.15 }),
      shipGlow: new THREE.MeshBasicMaterial({ color: "#7fe9ff", toneMapped: false }),
      containers: ["#8a4426", "#2d5c66", "#7a6a2c"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.45 })),
      crate: new THREE.MeshStandardMaterial({ color: "#5c5a3c", roughness: 0.7, metalness: 0.3 }),
      barrier: new THREE.MeshStandardMaterial({ color: "#8f8c86", roughness: 0.8 }),
      sea: new THREE.MeshBasicMaterial({ color: "#f4b49a", map: cloudA, transparent: true, opacity: 0.8, depthWrite: false }),
      sea2: new THREE.MeshBasicMaterial({ color: "#9a6a9a", map: cloudB, transparent: true, opacity: 0.95, depthWrite: false }),
      bank: new THREE.MeshBasicMaterial({ color: "#f6e6dc", map: bankTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    };
  }, []);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose());
    for (const m of Object.values(mats)) for (const one of (Array.isArray(m) ? m : [m]) as THREE.Material[]) { const t = (one as THREE.MeshStandardMaterial).map; t?.dispose(); one.dispose(); }
  }, [geo, mats]);

  const props = useMemo(() => a.cover.map((k, i) => ({ k, i, y: B + (Number.isFinite(surfaceAt(a, k.x, k.z)) ? surfaceAt(a, k.x, k.z) : 0), x: sx + k.x, z: sz + k.z })), [a, sx, sz, B]);
  const seaRef = useRef<THREE.Mesh>(null);
  // the low dusk sun: a directional light aimed at the dock's centre (its target lives in the arena group so its matrix updates)
  const sunTarget = useMemo(() => { const o = new THREE.Object3D(); o.position.set(sx, B, sz); return o; }, [sx, sz, B]);
  useFrame((_, dt) => {
    const f = fractureAt(a, state.clock);
    mats.bank.opacity = 0.95 * f.strength;
    // the cloud sea drifts; the bank's sheets drift with it
    for (const t of [mats.sea.map, mats.sea2.map]) if (t) { t.offset.x += dt * 0.004; t.offset.y += dt * 0.002; }
  });

  return (
    <group name="killbox-arena:skydock">
      {/* drawn at the far plane after the world's own sky, so the dock's dusk wins wherever no geometry stands in front */}
      <mesh geometry={geo.sky} material={mats.sky} renderOrder={1} frustumCulled={false} />
      <hemisphereLight args={["#ffb88a", "#3a2a4a", 1.2]} />
      <primitive object={sunTarget} />
      <directionalLight position={[sx - 300, B + 60, sz + 220]} target={sunTarget} color="#ffb077" intensity={2.4} />
      {!phone && <pointLight position={[sx, B + 26, sz]} color="#ffc890" intensity={500} distance={50} decay={2} />}
      <mesh ref={seaRef} geometry={geo.sea} material={mats.sea} />
      <mesh geometry={geo.sea} material={mats.sea2} position-y={-6} />
      <mesh geometry={geo.hulls} material={mats.hull} castShadow receiveShadow />
      <mesh geometry={geo.tops} material={mats.top} receiveShadow />
      <mesh geometry={geo.trim} material={mats.trim} />
      <mesh geometry={geo.pods} material={mats.pod} />
      <mesh geometry={geo.glow} material={mats.podGlow} />
      <mesh geometry={geo.walks} material={mats.walk} castShadow receiveShadow />
      <mesh geometry={geo.rails} material={mats.rail} castShadow />
      <mesh geometry={geo.stripes} material={mats.stripe} />
      <mesh geometry={geo.padH} material={mats.pad[0]!} />
      <mesh geometry={geo.padN} material={mats.pad[1]!} />
      <mesh geometry={geo.padS} material={mats.pad[2]!} />
      <mesh geometry={geo.cranes} material={mats.crane} castShadow />
      {props.map(({ k, i, x, y, z }) => {
        const long = k.w > k.d;
        if (k.kind === "dropship") return (
          <group key={k.id} position={[x, y, z]} rotation-y={long ? (k.x < 0 ? 0 : Math.PI) : Math.PI / 2}>
            <mesh geometry={geo.ship} material={mats.ship} castShadow receiveShadow />
            <mesh geometry={geo.canopy} material={mats.canopy} />
            <mesh geometry={geo.shipGlow} material={mats.shipGlow} />
          </group>
        );
        if (k.kind === "container") return <mesh key={k.id} geometry={geo.container} material={mats.containers[i % 3]!} position={[x, y, z]} rotation-y={long ? Math.PI / 2 : 0} scale={long ? [k.d, k.h, k.w] : [k.w, k.h, k.d]} castShadow receiveShadow />;
        if (k.kind === "crate") return <mesh key={k.id} geometry={geo.crate} material={mats.crate} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />;
        return <mesh key={k.id} geometry={geo.barrier} material={mats.barrier} position={[x, y, z]} rotation-y={k.d > k.w ? 0 : Math.PI / 2} scale={[Math.min(k.w, k.d), k.h, Math.max(k.w, k.d)]} castShadow receiveShadow />;
      })}
      <mesh geometry={geo.bank} material={mats.bank} />
    </group>
  );
}
