import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";

import {
  CRACK_RADIUS, DESCENT_TOP, DROP_RADIUS, RANKS, dayOf, dungeonById, gateColor, gatesForDay, hash,
  type DescentLayout, type FractureGate, type SignatureDungeon, type Tier,
} from "@/game/fracture-gates";
import { openWays, type DescentRun } from "@/game/descent-run";
import { bossExit, thresholdExit, type DescentRuntime } from "@/game/descent-runtime";
import { brokenTower, erodedColumn, flutedColumn, organicRock } from "@/game/organic-geometry";
import { obsidianShard } from "@/game/wild-geometry";

/**
 * Fracture Gates and the descent (fracture-gates.ts / descent-runtime.ts), drawn. Gates stand in the open world: a stone
 * ring as tall as the rank (25–60 m), a churning portal in the rank's colour (cyan F–D, violet C–B, crimson-gold A–S, red
 * and chained when sealed), shards orbiting, and a faint light column so they can be found from far off. The descent is a
 * stack of monumental stone rooms in the dungeon's palette: fluted pilasters, glowing glyph bands, colossal statues in the
 * arenas, light falling through each open drop shaft, a sealed glyph over a shut one, and a void around it all.
 * Geometry comes from the shared generators (flutedColumn, erodedColumn, brokenTower, organicRock, obsidianShard).
 */

const PORTAL_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PORTAL_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uCore; uniform vec3 uRim; uniform float uChaos; varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float swirl = a * 3.0 + r * 9.0 - uTime * 1.6;
  float bands = n(vec2(swirl, r * 4.0 - uTime * 0.7)) * 0.7 + n(vec2(a * 6.0 + uTime, r * 12.0)) * 0.3;
  float core = smoothstep(0.55, 0.0, r);
  float flicker = 1.0 - uChaos * step(0.92, h(vec2(floor(uTime * 12.0), 3.0)));
  vec3 c = mix(uCore * 0.25, uCore, bands) + uRim * pow(core, 2.0) * 1.6 + uRim * smoothstep(0.82, 1.0, r) * 1.2;
  gl_FragColor = vec4(c * flicker * 1.6, (0.55 + 0.45 * bands) * smoothstep(1.0, 0.9, r));
}`;

function portalMaterial(core: string, rim: string, chaos = 0) {
  return new THREE.ShaderMaterial({
    vertexShader: PORTAL_VERT, fragmentShader: PORTAL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uCore: { value: new THREE.Color(core) }, uRim: { value: new THREE.Color(rim) }, uChaos: { value: chaos } },
  });
}
const glowMat = (c: string, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
const beamMat = (c: string, opacity: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });

/* ---------------- gates in the open world ---------------- */

const gateStone = new THREE.MeshStandardMaterial({ color: "#2b2a30", roughness: 0.88, metalness: 0.1 });

function Gate({ gate, playerRef }: { gate: FractureGate; playerRef: MutableRefObject<THREE.Group> }) {
  const H = RANKS[gate.shownRank].gateHeight, R = H / 2;
  const col = gateColor(gate.shownRank, gate.sealed);
  const yaw = ((hash(gate.id) % 360) * Math.PI) / 180;
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const shards = useRef<THREE.Group>(null);
  const mats = useMemo(() => ({ portal: portalMaterial(col.core, col.rim, gate.trueRank !== gate.shownRank ? 0.6 : 0.1), rim: glowMat(col.rim, 2.4), beam: beamMat(col.core, 0.08), chain: glowMat("#ff3a2a", 2.2) }), [col.core, col.rim, gate.trueRank, gate.shownRank]);
  const geo = useMemo(() => ({
    ring: new THREE.TorusGeometry(R, R * 0.07, 18, 112),
    rim: new THREE.TorusGeometry(R * 0.93, R * 0.012, 8, 112),
    disc: new THREE.CircleGeometry(R * 0.92, 72),
    beam: new THREE.CylinderGeometry(R * 0.18, R * 0.5, 420, 24, 1, true),
    chain: new THREE.TorusGeometry(R * 1.02, R * 0.018, 8, 96),
    rocks: Array.from({ length: 7 }, (_, k) => organicRock(1.4 + (k % 3) * 1.1, hash(gate.id) % 97 + k, 1)),
    shard: obsidianShard(hash(gate.id) % 13 + 1),
  }), [R, gate.id]);
  useFrame((st) => {
    const p = playerRef.current?.position;
    if (!p) return;
    const d = Math.hypot(p.x - gate.x, p.z - gate.z);
    if (group.current) group.current.visible = d < 1400;
    if (!group.current?.visible) return;
    const t = st.clock.elapsedTime;
    mats.portal.uniforms["uTime"]!.value = t;
    if (light.current) { light.current.visible = d < 260; light.current.intensity = (3 + Math.sin(t * 2.3) * 0.8 + (hash(`${Math.floor(t * 9)}`) % 10 === 0 && gate.trueRank !== gate.shownRank ? 3 : 0)) * R; }
    if (shards.current) shards.current.rotation.y = t * 0.15;
  });
  return (
    <group ref={group} position={[gate.x, gate.y, gate.z]}>
      <group rotation={[0, yaw, 0]}>
        <mesh geometry={geo.ring} material={gateStone} position={[0, R, 0]} castShadow />
        <mesh geometry={geo.rim} material={mats.rim} position={[0, R, 0]} />
        <mesh geometry={geo.disc} material={mats.portal} position={[0, R, 0]} />
        {gate.sealed && [0.6, -0.6, 1.57].map((a, i) => <mesh key={i} geometry={geo.chain} material={mats.chain} position={[0, R, 0]} rotation={[0, a, 0]} />)}
        {geo.rocks.map((g, k) => <mesh key={k} geometry={g} material={gateStone} position={[Math.cos(k * 0.9) * R * 0.9, 0.5, Math.sin(k * 0.9) * R * 0.35]} castShadow />)}
      </group>
      <group ref={shards} position={[0, R, 0]}>
        {Array.from({ length: 9 }, (_, k) => <mesh key={k} geometry={geo.shard} material={gateStone} position={[Math.cos((k / 9) * Math.PI * 2) * R * 1.25, Math.sin(k * 1.7) * R * 0.5, Math.sin((k / 9) * Math.PI * 2) * R * 1.25]} scale={1.2 + (k % 3) * 0.6} rotation={[k, k * 0.7, 0]} />)}
      </group>
      <mesh geometry={geo.beam} material={mats.beam} position={[0, 210, 0]} />
      <pointLight ref={light} color={col.core} position={[0, R, 0]} distance={R * 5} decay={1.6} />
    </group>
  );
}

function FractureGates({ playerRef }: { playerRef: MutableRefObject<THREE.Group> }) {
  const [day, setDay] = useState(() => dayOf(Date.now()));
  const gates = useMemo(() => gatesForDay(Date.parse(`${day}T12:00:00Z`)), [day]);
  const tick = useRef(0);
  useFrame((_, dt) => { tick.current += dt; if (tick.current > 10) { tick.current = 0; const d = dayOf(Date.now()); if (d !== day) setDay(d); } });
  return <>{gates.map((g) => <Gate key={g.id} gate={g} playerRef={playerRef} />)}</>;
}

/* ---------------- the descent ---------------- */

/** cut-stone masonry (procedural canvas, like forest-textures.ts: no project asset covers it): staggered courses of blocks
 * with dark mortar joints, per-block tone and chipped speckle. One texture tiles every wall and floor; geometry UVs are in
 * metres / BLOCK so blocks stay the same size on every room. */
const BLOCK = 3;
let masonry: THREE.CanvasTexture | null = null;
function masonryTexture(): THREE.CanvasTexture {
  if (masonry) return masonry;
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1b1b1b"; g.fillRect(0, 0, 512, 512);
  const rows = 4, rh = 512 / rows;
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 64 : 0;
    for (let x = -off; x < 512; x += 128) {
      const v = 150 + Math.round(rnd() * 70);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x + 3, r * rh + 3, 122, rh - 6);
      for (let k = 0; k < 140; k++) { const s2 = 40 + rnd() * 60; g.fillStyle = `rgba(${s2},${s2},${s2},0.18)`; g.fillRect(x + 3 + rnd() * 120, r * rh + 3 + rnd() * (rh - 8), 2 + rnd() * 5, 1 + rnd() * 3); }
      g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x + 3, r * rh + rh - 9, 122, 6); // shadowed lower lip
    }
  }
  masonry = new THREE.CanvasTexture(c);
  masonry.wrapS = masonry.wrapT = THREE.RepeatWrapping;
  masonry.colorSpace = THREE.SRGBColorSpace;
  masonry.anisotropy = 4;
  return masonry;
}
/** scale a geometry's UVs so one texture repeat covers BLOCK metres (`u` and `v` are the face's size in metres) */
function metreUVs(g: THREE.BufferGeometry, u: number, v: number): THREE.BufferGeometry {
  const uv = g.attributes["uv"] as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * u) / (BLOCK * 4), (uv.getY(i) * v) / BLOCK);
  uv.needsUpdate = true;
  return g;
}

type Mats = { fire: THREE.MeshBasicMaterial; light: THREE.Color; stone: THREE.MeshStandardMaterial; trim: THREE.MeshStandardMaterial; glow: THREE.MeshBasicMaterial; beam: THREE.MeshBasicMaterial; seal: THREE.MeshBasicMaterial; void: THREE.MeshBasicMaterial; portal: THREE.ShaderMaterial };
function themeMats(d: SignatureDungeon): Mats {
  return {
    light: new THREE.Color(d.theme.light),
    fire: glowMat("#ff8a3a", 2.4),
    stone: new THREE.MeshStandardMaterial({ color: new THREE.Color(d.theme.stone).multiplyScalar(2.2), map: masonryTexture(), roughness: 0.95, metalness: 0.03 }),
    trim: new THREE.MeshStandardMaterial({ color: d.theme.trim, roughness: 0.7, metalness: 0.25 }),
    glow: glowMat(d.theme.glow, 2.6),
    beam: beamMat(d.theme.glow, 0.09),
    seal: glowMat("#ff3020", 1.8),
    void: new THREE.MeshBasicMaterial({ color: d.theme.fog, side: THREE.BackSide, fog: false, depthWrite: false }),
    portal: portalMaterial(d.theme.glow, "#ffffff", 0),
  };
}

function floorGeometry(layout: DescentLayout, tier: Tier, crack: boolean): THREE.BufferGeometry {
  const { w, d } = tier, o = layout.origin;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -d / 2); shape.lineTo(w / 2, -d / 2); shape.lineTo(w / 2, d / 2); shape.lineTo(-w / 2, d / 2); shape.lineTo(-w / 2, -d / 2);
  // shape y = -(world z) after the -90° turn about X
  if (tier.drop) { const hole = new THREE.Path(); hole.absarc(tier.drop.x - o.x, -(tier.drop.z - o.z), DROP_RADIUS, 0, Math.PI * 2, true); shape.holes.push(hole); }
  if (crack) { const hole = new THREE.Path(); hole.absarc(0, 0, CRACK_RADIUS, 0, Math.PI * 2, true); shape.holes.push(hole); }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false, curveSegments: 40 });
  // extrude UVs are already in metres: one repeat per BLOCK (slabs read as big floor flags)
  const uv = g.attributes["uv"] as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (BLOCK * 4), uv.getY(i) / (BLOCK * 2));
  g.rotateX(-Math.PI / 2);
  return g;
}

function TierRoom({ layout, tier, step, mats, open, crackOpen, near, exits }: { layout: DescentLayout; tier: Tier; step: number; mats: Mats; open: boolean; crackOpen: boolean; near: boolean; exits: { x: number; z: number }[] }) {
  const o = layout.origin, y = tier.floorY;
  const geo = useMemo(() => {
    const pil = flutedColumn(tier.wallH, 0.9, tier.index + 1);
    const along: [number, number][] = [];
    for (let x = -tier.w / 2 + 6; x <= tier.w / 2 - 6; x += 12) along.push([x, -tier.d / 2 + 1.2], [x, tier.d / 2 - 1.2]);
    for (let z = -tier.d / 2 + 12; z <= tier.d / 2 - 12; z += 12) along.push([-tier.w / 2 + 1.2, z], [tier.w / 2 - 1.2, z]);
    return {
      floor: floorGeometry(layout, tier, tier.kind === "BOSS" && crackOpen),
      wallX: metreUVs(new THREE.BoxGeometry(tier.w + 4, tier.wallH, 2, 8, 6, 1), tier.w + 4, tier.wallH),
      wallZ: metreUVs(new THREE.BoxGeometry(2, tier.wallH, tier.d, 1, 6, 8), tier.d, tier.wallH),
      sigil: new THREE.TorusGeometry(tier.kind === "BOSS" ? 30 : 16, 0.18, 6, 128),
      sigilInner: new THREE.TorusGeometry(tier.kind === "BOSS" ? 24 : 12, 0.1, 6, 6),
      bandX: new THREE.BoxGeometry(tier.w, 0.35, 0.2),
      bandZ: new THREE.BoxGeometry(0.2, 0.35, tier.d),
      pil, along,
      statue: tier.kind === "ENCOUNTER" || tier.kind === "GATEKEEPER" || tier.kind === "BOSS" || tier.kind === "NESTED" ? brokenTower(tier.index + 7) : null,
      plinth: erodedColumn(tier.index + 3),
      flame: organicRock(0.55, tier.index + 21, 1),
      eye: new THREE.SphereGeometry(0.35, 12, 8),
      // the light stops well above the floor below, so someone landing is not standing inside it
      beam: tier.drop ? new THREE.CylinderGeometry(DROP_RADIUS * 0.85, DROP_RADIUS * 0.4, step * 0.55, 32, 1, true) : null,
      ring: new THREE.TorusGeometry(DROP_RADIUS + 0.4, 0.22, 8, 64),
      seal: new THREE.CircleGeometry(DROP_RADIUS + 0.2, 48),
      crackRing: new THREE.TorusGeometry(CRACK_RADIUS + 0.4, 0.4, 8, 80),
      exit: new THREE.CircleGeometry(2.6, 48),
      exitRing: new THREE.TorusGeometry(2.8, 0.18, 8, 64),
      arena: tier.kind === "BOSS" ? flutedColumn(tier.wallH * 0.9, 1.6, 99) : null,
    };
  }, [layout, tier, step, crackOpen]);
  const setPilasters = (m: THREE.InstancedMesh | null) => {
    if (!m) return;
    const tmp = new THREE.Object3D();
    geo.along.forEach(([x, z], i) => { tmp.position.set(o.x + x, y, o.z + z); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); });
    m.instanceMatrix.needsUpdate = true;
  };
  const statueSpots: [number, number, number][] = tier.kind === "BOSS"
    ? [[-tier.w / 2 + 10, 0, -tier.d / 2 + 10], [tier.w / 2 - 10, 0, -tier.d / 2 + 10], [-tier.w / 2 + 10, 0, tier.d / 2 - 10], [tier.w / 2 - 10, 0, tier.d / 2 - 10]]
    : [[-tier.w / 2 + 8, 0, 0], [tier.w / 2 - 8, 0, 0]];
  const statueScale = Math.min(tier.wallH * 0.75, 18);
  const bx = tier.w / 2 - 3, bz = tier.d / 2 - 10;
  const braziers: [number, number][] = [[-bx, -bz], [bx, -bz], [-bx, bz], [bx, bz]];
  const statue = geo.statue;
  return (
    <group>
      <mesh geometry={geo.floor} material={mats.stone} position={[o.x, y - 2, o.z]} receiveShadow />
      <mesh geometry={geo.wallX} material={mats.stone} position={[o.x, y + tier.wallH / 2, o.z - tier.d / 2 - 1]} receiveShadow />
      <mesh geometry={geo.wallX} material={mats.stone} position={[o.x, y + tier.wallH / 2, o.z + tier.d / 2 + 1]} receiveShadow />
      <mesh geometry={geo.wallZ} material={mats.stone} position={[o.x - tier.w / 2 - 1, y + tier.wallH / 2, o.z]} receiveShadow />
      <mesh geometry={geo.wallZ} material={mats.stone} position={[o.x + tier.w / 2 + 1, y + tier.wallH / 2, o.z]} receiveShadow />
      {/* glyph bands at waist height and under the lip */}
      {[1.4, tier.wallH - 1.5].map((h, i) => (
        <group key={i}>
          <mesh geometry={geo.bandX} material={mats.glow} position={[o.x, y + h, o.z - tier.d / 2 + 0.05]} />
          <mesh geometry={geo.bandX} material={mats.glow} position={[o.x, y + h, o.z + tier.d / 2 - 0.05]} />
          <mesh geometry={geo.bandZ} material={mats.glow} position={[o.x - tier.w / 2 + 0.05, y + h, o.z]} />
          <mesh geometry={geo.bandZ} material={mats.glow} position={[o.x + tier.w / 2 - 0.05, y + h, o.z]} />
        </group>
      ))}
      <instancedMesh ref={setPilasters} args={[geo.pil, mats.trim, geo.along.length]} castShadow />
      {/* braziers along the side walls: the warm light that makes the stone read */}
      {braziers.map(([bx, bz], i) => (
        <group key={`b${i}`} position={[o.x + bx, y, o.z + bz]}>
          <mesh geometry={geo.plinth} material={mats.trim} scale={[0.9, 1.4, 0.9]} />
          <mesh geometry={geo.flame} material={mats.fire} position={[0, 1.9, 0]} />
          {near && <pointLight color="#ff9a4a" position={[0, 2.6, 0]} intensity={110} distance={34} decay={1.6} />}
        </group>
      ))}
      {/* watcher statues in the arenas */}
      {statue && statueSpots.map((p, i) => (
        <group key={i} position={[o.x + p[0], y, o.z + p[2]]}>
          <mesh geometry={geo.plinth} material={mats.trim} scale={[3, 2.5, 3]} />
          <mesh geometry={statue} material={mats.stone} position={[0, 2.5, 0]} scale={[statueScale * 0.22, statueScale, statueScale * 0.22]} castShadow />
          {/* the watchers' eyes: two glowing points near the top, facing the room */}
          <mesh geometry={geo.eye} material={mats.glow} position={[-0.6, 2.5 + statueScale * 0.86, -Math.sign(p[0] || p[2]) * statueScale * 0.11]} />
          <mesh geometry={geo.eye} material={mats.glow} position={[0.6, 2.5 + statueScale * 0.86, -Math.sign(p[0] || p[2]) * statueScale * 0.11]} />
        </group>
      ))}
      {/* the boss arena's inner ring of colossal columns */}
      {geo.arena && Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2; return <mesh key={k} geometry={geo.arena!} material={mats.trim} position={[o.x + Math.cos(a) * 52, y, o.z + Math.sin(a) * 52]} castShadow />; })}
      {/* the drop: light pours down an open shaft; a red glyph seals a shut one */}
      {tier.drop && (open ? (
        <>
          <mesh geometry={geo.ring} material={mats.glow} position={[tier.drop.x, y + 0.05, tier.drop.z]} rotation={[-Math.PI / 2, 0, 0]} />
          {geo.beam && <mesh geometry={geo.beam} material={mats.beam} position={[tier.drop.x, y - step * 0.275, tier.drop.z]} />}
        </>
      ) : (
        <mesh geometry={geo.seal} material={mats.seal} position={[tier.drop.x, y + 0.04, tier.drop.z]} rotation={[-Math.PI / 2, 0, 0]} />
      ))}
      {/* a summoning sigil on the floor of every arena */}
      {(tier.kind === "ENCOUNTER" || tier.kind === "GATEKEEPER" || tier.kind === "BOSS" || tier.kind === "NESTED") && (
        <group position={[o.x, y + 0.04, o.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh geometry={geo.sigil} material={mats.glow} />
          <mesh geometry={geo.sigilInner} material={mats.glow} rotation={[0, 0, Math.PI / 6]} />
          <mesh geometry={geo.sigilInner} material={mats.glow} />
        </group>
      )}
      {tier.kind === "BOSS" && crackOpen && <mesh geometry={geo.crackRing} material={mats.seal} position={[o.x, y + 0.05, o.z]} rotation={[-Math.PI / 2, 0, 0]} />}
      {exits.map((e, i) => (
        <group key={i} position={[e.x, y + 0.06, e.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh geometry={geo.exit} material={mats.portal} />
          <mesh geometry={geo.exitRing} material={mats.glow} />
        </group>
      ))}
      {near && (
        <>
          <pointLight color={mats.light} position={[o.x, y + Math.min(tier.wallH * 0.6, 24), o.z]} intensity={Math.max(tier.w, tier.d) * 5} distance={Math.max(tier.w, tier.d) * 1.6} decay={1.4} />
          <pointLight color="#d8d2c4" position={[tier.landing.x, y + 8, tier.landing.z]} intensity={260} distance={55} decay={1.5} />
          {tier.drop && <pointLight color={mats.light} position={[tier.drop.x, y + 2.5, tier.drop.z]} intensity={50} distance={24} decay={1.7} />}
        </>
      )}
    </group>
  );
}

function DescentColumn({ runtime }: { runtime: MutableRefObject<DescentRuntime> }) {
  // re-render only when something you would see changes (which drops are open, the boss, the crack, your tier)
  const [snap, setSnap] = useState<{ run: DescentRun; key: string } | null>(null);
  const d = snap ? dungeonById(snap.run.dungeonId) : null;
  const mats = useMemo(() => (d ? themeMats(d) : null), [d]);
  useFrame((st) => {
    const run = runtime.current.run;
    const key = run ? `${run.gateId}|${run.startedAt}|${run.tier}|${run.cleared.join(",")}|${run.bossDown}|${run.nested}` : "";
    if ((snap?.key ?? "") !== key) setSnap(run ? { run, key } : null);
    if (mats) mats.portal.uniforms["uTime"]!.value = st.clock.elapsedTime;
  });
  const voidGeo = useMemo(() => new THREE.SphereGeometry(900, 32, 16), []);
  if (!snap || !d || !mats) return null;
  const { run } = snap, layout = run.layout, open = openWays(run);
  const step = layout.tiers.length > 1 ? layout.tiers[0]!.floorY - layout.tiers[1]!.floorY : 40;
  const tiers = open.nested ? [...layout.tiers, layout.nested] : layout.tiers;
  const bossIndex = layout.tiers.length - 1;
  return (
    <group name="descent">
      <mesh geometry={voidGeo} material={mats.void} position={[layout.origin.x, (DESCENT_TOP + layout.nested.floorY) / 2, layout.origin.z]} renderOrder={-1} />
      {tiers.map((t) => (
        <TierRoom key={`${run.gateId}:${t.index}`} layout={layout} tier={t} step={t.kind === "BOSS" ? t.floorY - layout.nested.floorY : step} mats={mats}
          open={open.drops.has(t.index)} crackOpen={open.nested} near={Math.abs(t.index - run.tier) <= 1}
          exits={[...(t.index === 0 && !d.sealed && run.tier === 0 ? [thresholdExit(run)] : []), ...(t.index === bossIndex && run.bossDown ? [bossExit(run)] : [])]} />
      ))}
    </group>
  );
}

export function DescentDungeon({ runtime, playerRef }: { runtime: MutableRefObject<DescentRuntime>; playerRef: MutableRefObject<THREE.Group> }) {
  return (
    <>
      <FractureGates playerRef={playerRef} />
      <DescentColumn runtime={runtime} />
    </>
  );
}
