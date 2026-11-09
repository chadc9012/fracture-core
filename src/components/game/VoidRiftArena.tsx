import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { crystalShard, equipmentCase } from "@/game/camp-geometry";
import { isTouchDevice } from "@/game/client-input";
import { arenaParapets, fractureAt, shifterLift, surfaceAt, type KillboxArena as Arena } from "@/game/killbox-arenas";
import { organicRock } from "@/game/organic-geometry";
import type { PvpState } from "@/game/pvp";
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";
import { ArenaWeather } from "./ArenaWeather";
import { jerseyBarrier, slab } from "./arena-parts";

/** Void Rift (killbox-arenas.ts VOID_RIFT), after the owner's PvP maps board: inside the fracture itself. It brings its own sky — a
 * violet void of drifting nebula split by a burning crack of white-cyan light. Each island is a torn-off slab of city: cracked
 * asphalt with lane paint and glowing fracture lines on top, a broken kerb round its edge, and an inverted cone of rock and rebar
 * hanging under it; the ramps are hard-light planks, translucent cyan with bright edges. Wrecked fragments — rocks, a bus shelter
 * roof, girders — drift round the islands; obsidian monoliths veined with violet stand as cover. In the Rift Surge the crack flares,
 * the void storms magenta, the floating rock slabs drop away and magenta crystals tear up through the islands. */

const DEBRIS = 40; // drifting fragments round the islands
const CRACK = new THREE.Vector3(0.2, 0.5, -0.84).normalize();

/** a torn-off street: dark asphalt, lane paint, and glowing fracture lines */
function streetTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const x = c.getContext("2d")!;
  x.fillStyle = "#2a2a30"; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const v = 30 + Math.random() * 40; x.fillStyle = `rgb(${v},${v},${v + 6})`; x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
  x.fillStyle = "#c8b040"; for (let y = 0; y < 512; y += 64) x.fillRect(250, y, 12, 36);
  x.fillStyle = "#d8d8d8"; x.fillRect(40, 0, 6, 512); x.fillRect(466, 0, 6, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
/** the fracture lines: branching glowing cracks on black, used as an emissive map */
function crackTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const x = c.getContext("2d")!;
  x.fillStyle = "#000"; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = "#c86aff"; x.shadowColor = "#c86aff"; x.shadowBlur = 8; x.lineCap = "round";
  const branch = (px: number, py: number, ang: number, len: number, w: number, depth: number) => {
    if (depth <= 0 || len < 6) return;
    x.lineWidth = w; x.beginPath(); x.moveTo(px, py);
    let qx = px, qy = py;
    for (let k = 0; k < 5; k++) { ang += (Math.random() - 0.5) * 0.7; qx += Math.cos(ang) * len / 5; qy += Math.sin(ang) * len / 5; x.lineTo(qx, qy); }
    x.stroke();
    branch(qx, qy, ang + 0.6, len * 0.6, w * 0.7, depth - 1); branch(qx, qy, ang - 0.6, len * 0.6, w * 0.7, depth - 1);
  };
  for (let i = 0; i < 6; i++) branch(Math.random() * 512, Math.random() * 512, Math.random() * Math.PI * 2, 160, 3, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function VoidRiftView({ arena: a, state }: { arena: Arena; state: PvpState }) {
  const { x: sx, z: sz } = a.site, B = a.base;
  const phone = useMemo(() => isTouchDevice(), []);
  const plain = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k); return n; };

  const geo = useMemo(() => {
    const W = (dx: number, dz: number) => ({ x: sx + dx, z: sz + dz });
    // each island: a 1.5 m slab of road and its kerb, its street surface, and a hanging cone of rock under it
    const slabs: THREE.BufferGeometry[] = [], undersides: THREE.BufferGeometry[] = [];
    const surface = mergeGeometries(a.roofs.map((r) => { const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(-Math.PI / 2).translate(c.x, B + r.top + 0.01, c.z); }))!;
    a.roofs.forEach((r, i) => {
      const c = W((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), w = r.x1 - r.x0, d = r.z1 - r.z0;
      slabs.push(plain(slab(c.x, B + r.top - 0.75, c.z, w, 1.5, d)));
      // the underside: a cone of rock dropping a long way, rough-edged
      const depth = 14 + Math.max(w, d) * 0.6;
      undersides.push(plain(organicRock(1, 70 + i * 9, 2).scale(w * 0.58, depth, d * 0.58).translate(c.x, B + r.top - 1.4 - depth, c.z)));
      for (let k = 0; k < 3; k++) undersides.push(plain(organicRock(1, 90 + i * 11 + k, 1).scale(2 + k, 3 + k, 2 + k).translate(c.x + (k - 1) * w * 0.3, B + r.top - depth * (1.7 + k * 0.25), c.z + (k % 2 ? d * 0.2 : -d * 0.2))));
    });
    // broken kerbs and twisted rails along every edge
    const kerbs: THREE.BufferGeometry[] = [], rails: THREE.BufferGeometry[] = [];
    for (const p of arenaParapets(a)) {
      const len = Math.hypot(p.bx - p.ax, p.bz - p.az), yaw = Math.atan2(p.bx - p.ax, p.bz - p.az), floor = p.base + 0.5, n = Math.max(1, Math.round(len / 2));
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, hh = 0.25 + ((i * 7) % 5) * 0.08; kerbs.push(plain(new THREE.BoxGeometry(0.35, hh, len / n - 0.08).rotateY(yaw).translate(p.ax + (p.bx - p.ax) * t, floor + hh / 2, p.az + (p.bz - p.az) * t))); }
      for (let i = 0; i <= n; i++) { const t = i / n; rails.push(plain(slab(p.ax + (p.bx - p.ax) * t, floor + 0.55, p.az + (p.bz - p.az) * t, 0.07, 1.1, 0.07))); }
      for (const h of [0.6, 1.08]) rails.push(plain(new THREE.BoxGeometry(0.06, 0.06, len).rotateY(yaw).translate((p.ax + p.bx) / 2, floor + h, (p.az + p.bz) / 2)));
    }
    // hard-light ramps: a translucent plank and bright edges and handrails
    const planks: THREE.BufferGeometry[] = [], edges: THREE.BufferGeometry[] = [];
    for (const k of a.walks) {
      const c = W(k.x, k.z), ax = k.along === "x", rise = k.topB - k.top, len = Math.hypot(k.length, rise), tilt = Math.atan2(rise, k.length);
      const tilted = (g: THREE.BufferGeometry, ox: number, oy: number, oz: number) => { if (ax) g.rotateZ(tilt); else g.rotateX(-tilt); return plain(g.translate(c.x + ox, B + (k.top + k.topB) / 2 + oy, c.z + oz)); };
      planks.push(tilted(new THREE.BoxGeometry(ax ? len : k.width, 0.12, ax ? k.width : len), 0, -0.06, 0));
      for (const side of [-1, 1]) {
        const ox = ax ? 0 : side * (k.width / 2 - 0.04), oz = ax ? side * (k.width / 2 - 0.04) : 0;
        edges.push(tilted(new THREE.BoxGeometry(ax ? len : 0.08, 0.08, ax ? 0.08 : len), ox, 0.02, oz), tilted(new THREE.BoxGeometry(ax ? len : 0.05, 0.05, ax ? 0.05 : len), ox, 1.05, oz));
        for (let i = 0; i <= 3; i++) { const s = -k.length / 2 + (i / 3) * k.length, h = k.top + rise * (i / 3); edges.push(plain(slab(c.x + ox + (ax ? s : 0), B + h + 0.52, c.z + oz + (ax ? 0 : s), 0.04, 1.04, 0.04))); }
      }
    }
    const sky = new THREE.SphereGeometry(900, 48, 24).translate(sx, B, sz);
    return {
      surface, slabs: mergeGeometries(slabs)!, undersides: mergeGeometries(undersides)!, kerbs: mergeGeometries(kerbs)!, rails: mergeGeometries(rails)!,
      planks: mergeGeometries(planks)!, edges: mergeGeometries(edges)!, sky,
      rock: organicRock(1, 5, 1), girder: new THREE.BoxGeometry(0.4, 0.6, 1), panel: new THREE.BoxGeometry(1, 0.15, 1),
      monolith: crystalShard(4), crystal: mergeGeometries([0, 1, 2].map((i) => plain(crystalShard(i + 8).scale(i ? 0.35 : 0.5, i ? 0.75 : 1, i ? 0.35 : 0.5).rotateZ((i - 1) * 0.35).translate((i - 1) * 0.3, 0, 0))))!,
      box: new THREE.BoxGeometry(1, 1, 1), crate: equipmentCase(), barrier: jerseyBarrier(),
    };
  }, [a, sx, sz, B]); // eslint-disable-line react-hooks/exhaustive-deps

  const mats = useMemo(() => {
    const concrete = weatheredConcreteTexture(), street = streetTexture(), cracks = crackTexture();
    street?.repeat.set(2, 2); cracks?.repeat.set(2, 2);
    const sky = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { time: { value: 0 }, surge: { value: 0 }, crack: { value: CRACK.clone() } },
      vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position - cameraPosition); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }",
      fragmentShader: `uniform float time, surge; uniform vec3 crack; varying vec3 vDir;
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main() { vec3 d = normalize(vDir); vec2 uv = vec2(atan(d.x, d.z) * 1.6, d.y * 3.0);
          float neb = n(uv * 2.0 + time * 0.01) * 0.6 + n(uv * 5.0 - time * 0.02) * 0.4;
          vec3 c = mix(vec3(0.03, 0.0, 0.07), vec3(0.22, 0.04, 0.32), neb) + vec3(0.35, 0.05, 0.4) * pow(neb, 3.0);
          c = mix(c, vec3(0.02, 0.0, 0.04), smoothstep(0.0, -0.8, d.y));
          // the crack: a jagged seam of light across the sky, along a great circle through the crack direction
          vec3 axis = normalize(cross(crack, vec3(0.0, 1.0, 0.0)));
          float off = dot(d, axis) + (n(vec2(dot(d, crack) * 18.0, 0.0)) - 0.5) * 0.05;
          float seam = exp(-abs(off) * (90.0 - surge * 40.0)) * smoothstep(-0.2, 0.3, dot(d, crack));
          c += vec3(0.75, 0.95, 1.0) * seam * (1.3 + surge * 1.5) + vec3(0.6, 0.2, 0.9) * exp(-abs(off) * 12.0) * 0.35 * smoothstep(-0.2, 0.3, dot(d, crack));
          c = mix(c, c * vec3(1.6, 0.6, 1.4) + vec3(0.15, 0.0, 0.12), surge * 0.6);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    return {
      sky,
      street: new THREE.MeshStandardMaterial({ color: "#ffffff", map: street, emissive: "#ffffff", emissiveMap: cracks, emissiveIntensity: 1.4, roughness: 0.7 }),
      slab: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#5a5660", roughness: 0.85 }), concrete, 3),
      rock: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#3a3040", roughness: 0.9, emissive: "#2a0a3a", emissiveIntensity: 0.4 }), concrete, 6),
      kerb: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#8a8690", roughness: 0.8 }), concrete, 2),
      rail: new THREE.MeshStandardMaterial({ color: "#6a6470", roughness: 0.5, metalness: 0.7 }),
      plank: new THREE.MeshStandardMaterial({ color: "#7fe8ff", emissive: "#38c8ff", emissiveIntensity: 0.6, transparent: true, opacity: 0.45, roughness: 0.2, depthWrite: false }),
      edge: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#7ff4ff", emissiveIntensity: 3, toneMapped: false }),
      debris: new THREE.MeshStandardMaterial({ color: "#4a4450", roughness: 0.85, emissive: "#20082a", emissiveIntensity: 0.5 }),
      girder: new THREE.MeshStandardMaterial({ color: "#7a4a34", roughness: 0.6, metalness: 0.6 }),
      monolith: new THREE.MeshStandardMaterial({ color: "#0c0a12", emissive: "#a040ff", emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.7 }),
      vein: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#c86aff", emissiveIntensity: 2.5, toneMapped: false }),
      crystal: new THREE.MeshStandardMaterial({ color: "#ff9ae8", emissive: "#ff3ad8", emissiveIntensity: 1.6, roughness: 0.1, transparent: true, opacity: 0.88, toneMapped: false }),
      crate: new THREE.MeshStandardMaterial({ color: "#4a4e58", roughness: 0.6, metalness: 0.4 }),
      barrier: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#8a8690", roughness: 0.85 }), concrete, 2),
      slabRock: applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#4a4450", roughness: 0.85, emissive: "#3a0a5a", emissiveIntensity: 0.3 }), concrete, 2),
    };
  }, []);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose());
    mats.street.map?.dispose(); mats.street.emissiveMap?.dispose();
    for (const m of Object.values(mats)) m.dispose();
  }, [geo, mats]);

  const props = useMemo(() => a.cover.map((k) => ({ k, x: sx + k.x, y: B + surfaceAt(a, k.x, k.z), z: sz + k.z })), [a, sx, sz, B]);
  const shifters = useMemo(() => a.shifters.map((k) => ({ k, x: sx + k.x, y: B + surfaceAt(a, k.x, k.z), z: sz + k.z, slab: k.phase === "up" })), [a, sx, sz, B]);
  // drifting debris: rocks, girders and slabs of pavement on slow orbits round the islands
  const debris = useMemo(() => Array.from({ length: DEBRIS }, (_, i) => ({ kind: i % 3, r: 62 + ((i * 37) % 50), y: B + 6 + ((i * 23) % 34), w: 0.02 + ((i * 7) % 5) * 0.006, p: i * 2.39996, s: 0.8 + ((i * 13) % 7) * 0.5, spin: ((i * 11) % 7) * 0.05 })), [B]);

  const moving = useRef<(THREE.Group | null)[]>([]), rocks = useRef<THREE.InstancedMesh>(null), girders = useRef<THREE.InstancedMesh>(null), panels = useRef<THREE.InstancedMesh>(null), storm = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const t = state.clock, ev = fractureAt(a, t);
    shifters.forEach(({ k, slab }, i) => {
      const g = moving.current[i]; if (!g) return;
      const lift = shifterLift(a, k, t);
      // rock slabs fall away (and keep falling) as they drop; crystals tear up out of the ground
      if (slab) { g.position.y = lift >= 1 ? Math.sin(t * 0.8 + i) * 0.08 : -(1 - lift) * 18; g.rotation.z = (1 - lift) * 0.8; g.visible = lift > 0.01; }
      else { g.position.y = (lift - 1) * (k.h + 0.3); g.visible = lift > 0.01; }
    });
    const counts = [0, 0, 0], meshes = [rocks.current, girders.current, panels.current];
    for (const d of debris) {
      const m = meshes[d.kind]; if (!m) continue;
      const ang = d.p + t * d.w;
      tmp.position.set(sx + Math.cos(ang) * d.r, d.y + Math.sin(t * 0.3 + d.p) * 1.2, sz + Math.sin(ang) * d.r);
      tmp.rotation.set(t * d.spin + d.p, t * d.spin * 0.7, d.p); tmp.scale.set(d.kind === 1 ? d.s * 0.4 : d.s * 1.2, d.kind === 1 ? d.s * 0.4 : d.s * 0.9, d.kind === 1 ? d.s * 4 : d.s * 1.2);
      tmp.updateMatrix(); m.setMatrixAt(counts[d.kind]!++, tmp.matrix);
    }
    meshes.forEach((m) => { if (m) m.instanceMatrix.needsUpdate = true; });
    const surge = ev.active ? ev.strength : ev.warning ? 0.15 + 0.15 * Math.sin(performance.now() / 100) : 0;
    (mats.sky.uniforms["surge"] as { value: number }).value = surge;
    (mats.sky.uniforms["time"] as { value: number }).value = t;
    mats.street.emissiveIntensity = 1.4 + surge * 1.6;
    if (storm.current) storm.current.visible = ev.active;
  });

  const perKind = [0, 1, 2].map((k) => debris.filter((d) => d.kind === k).length);
  const crackPos = CRACK.clone().multiplyScalar(300);
  return (
    <group name="killbox-arena:void-rift">
      {/* drawn at the far plane after the world's own sky: the rift is its own void */}
      <mesh geometry={geo.sky} material={mats.sky} renderOrder={1} frustumCulled={false} />
      <directionalLight position={[sx + crackPos.x, B + crackPos.y, sz + crackPos.z]} color="#cfe8ff" intensity={1.3} />
      <hemisphereLight args={["#b08aff", "#3a1050", phone ? 1.3 : 0.9]} />
      {!phone && <pointLight position={[sx, B + 28, sz]} color="#c86aff" intensity={800} distance={50} decay={2} />}
      {!phone && [[-29, 0], [29, 0], [0, 25], [0, -25]].map(([dx, dz], i) => <pointLight key={i} position={[sx + dx!, B + 24, sz + dz!]} color={i < 2 ? "#7ff4ff" : "#ff7ad8"} intensity={300} distance={28} decay={2} />)}
      <mesh geometry={geo.undersides} material={mats.rock} />
      <mesh geometry={geo.slabs} material={mats.slab} castShadow receiveShadow />
      <mesh geometry={geo.surface} material={mats.street} receiveShadow />
      <mesh geometry={geo.kerbs} material={mats.kerb} castShadow />
      <mesh geometry={geo.rails} material={mats.rail} />
      <mesh geometry={geo.planks} material={mats.plank} />
      <mesh geometry={geo.edges} material={mats.edge} />
      <instancedMesh ref={rocks} args={[geo.rock, mats.debris, perKind[0]!]} frustumCulled={false} />
      <instancedMesh ref={girders} args={[geo.girder, mats.girder, perKind[1]!]} frustumCulled={false} />
      <instancedMesh ref={panels} args={[geo.panel, mats.slab, perKind[2]!]} frustumCulled={false} />
      {props.map(({ k, x, y, z }) => {
        if (k.kind === "monolith") return (
          <group key={k.id} position={[x, y, z]}>
            {/* an obsidian monolith: a black shard with a violet vein down each face */}
            <mesh geometry={geo.monolith} material={mats.monolith} position-y={k.h / 2} scale={[k.w * 0.8, k.h, k.d * 0.8]} castShadow receiveShadow />
            {[0, 1, 2, 3].map((s) => <mesh key={s} geometry={geo.box} material={mats.vein} position={[Math.sin((s * Math.PI) / 2) * k.w * 0.36, k.h * 0.45, Math.cos((s * Math.PI) / 2) * k.d * 0.36]} rotation-y={(s * Math.PI) / 2} scale={[0.06, k.h * 0.6, 0.02]} />)}
          </group>
        );
        if (k.kind === "crate") return <mesh key={k.id} geometry={geo.crate} material={mats.crate} position={[x, y + k.h / 2, z]} scale={[k.w, k.h, k.d]} castShadow receiveShadow />;
        return <mesh key={k.id} geometry={geo.barrier} material={mats.barrier} position={[x, y, z]} rotation-y={k.d > k.w ? 0 : Math.PI / 2} scale={[Math.min(k.w, k.d), k.h, Math.max(k.w, k.d)]} castShadow receiveShadow />;
      })}
      {shifters.map(({ k, x, y, z, slab }, i) => {
        const wide = k.w >= k.d, len = Math.max(k.w, k.d), thick = Math.min(k.w, k.d);
        return (
          <group key={k.id} position={[x, y, z]}>
            <group ref={(g) => { moving.current[i] = g; }}>
              <group rotation-y={wide ? 0 : Math.PI / 2}>
                {slab ? (
                  /* a floating slab of rock and pavement, hovering just off the ground */
                  <mesh geometry={geo.box} material={mats.slabRock} position-y={k.h / 2 + 0.05} scale={[len, k.h, thick]} castShadow receiveShadow />
                ) : (
                  /* a cluster of magenta void crystal */
                  <mesh geometry={geo.crystal} material={mats.crystal} position-y={k.h / 2} scale={[len, k.h, thick * 1.3]} castShadow />
                )}
              </group>
            </group>
          </group>
        );
      })}
      <ArenaWeather kind="motes" center={{ x: sx, y: B + 18, z: sz }} count={phone ? 250 : 800} size={100} height={30} color="#c86aff" />
      <group ref={storm} visible={false}><ArenaWeather kind="rain" center={{ x: sx, y: B + 14, z: sz }} count={phone ? 600 : 2200} size={80} color="#ff7ad8" /></group>
    </group>
  );
}
