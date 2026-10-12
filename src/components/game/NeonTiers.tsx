import { Text } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { walkHeight } from "@/game/terrain";
import { addObstacle } from "@/game/obstacles";
import { VORTEX, facadeArc, CHECKPOINT, DECK, DRONE_LANES, HOLOGRAMS, PIPES, SKYBRIDGES, SPIRE, deckPillars, laneAt, lanePerimeter, neonWeather, undercity, type Holo } from "@/game/neon-tiers";
import { LightBar } from "./DistrictStreet";
import { softSprite } from "./softSprite";

/** Neon City's vertical tiers (layout in neon-tiers.ts): the Aegis Spire with its quarantine checkpoint and deployment
 * pad, the Grid deck ring with skybridges and drone traffic, the Undercity's pipes, CRT banks, dens and steam, flickering
 * holograms, and the district's acid rain and neon fog. All local to the district centre `c`. */
export function NeonTiers({ c }: { c: { x: number; z: number } }) {
  const y0 = useMemo(() => walkHeight(c.x, c.z), [c.x, c.z]);
  useEffect(() => { addObstacle("tower", c.x + SPIRE.x, c.z + SPIRE.z, SPIRE.base * 0.8, 1e6, 3); }, [c.x, c.z]);
  return (
    <group position={[c.x, y0, c.z]}>
      <Spire />
      <Checkpoint />
      <Deck />
      <Drones />
      <Undercity />
      {HOLOGRAMS.map((h, i) => <Hologram key={i} h={h} seed={i} />)}
      <NeonWeather c={c} y0={y0} />
      <FractureVortex />
      <FacadeArcs />
    </group>
  );
}

const DARK = "#141820";

/** a tapering brutalist core with hard-light terraces, a lit crown and a deployment pad cantilevered near the top */
function Spire() {
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { if (glow.current) glow.current.opacity = 0.55 + 0.25 * Math.sin(clock.elapsedTime * 1.6); });
  return <group position={[SPIRE.x, 0, SPIRE.z]}>
    {/* three stacked prisms narrowing upward */}
    {[[-12, 52, 1], [40, 30, 0.78], [70, SPIRE.height - 70, 0.55]].map(([y, h, k], i) => (
      <mesh key={i} castShadow receiveShadow position-y={y! + h! / 2}><cylinderGeometry args={[SPIRE.base * k! * 0.85, SPIRE.base * k!, h!, 8]} /><meshStandardMaterial color={i === 2 ? "#1d2a36" : DARK} metalness={0.7} roughness={0.35} /></mesh>
    ))}
    {/* vertical light seams */}
    {Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; return <LightBar key={i} position={[Math.sin(a) * SPIRE.base * 0.82, 35, Math.cos(a) * SPIRE.base * 0.82]} size={[0.2, 68, 0.2]} color={i % 2 ? "#38e8ff" : "#7fd8ff"} />; })}
    {/* hard-light terraces: translucent cyan slabs ringed in light */}
    {SPIRE.terraces.map((ty, i) => (
      <group key={ty} position-y={ty}>
        <mesh><cylinderGeometry args={[SPIRE.base * (1.25 - i * 0.12), SPIRE.base * (1.25 - i * 0.12), 0.25, 24]} /><meshPhysicalMaterial color="#8ff0ff" transparent opacity={0.22} roughness={0.05} emissive="#38e8ff" emissiveIntensity={0.6} depthWrite={false} /></mesh>
        <mesh rotation-x={Math.PI / 2}><torusGeometry args={[SPIRE.base * (1.25 - i * 0.12), 0.08, 6, 48]} /><meshBasicMaterial color="#38e8ff" toneMapped={false} /></mesh>
      </group>
    ))}
    {/* deployment pad (upper-tier landing) cantilevered toward the market */}
    <group position={[0, SPIRE.padY, SPIRE.base * 0.7 + SPIRE.padR]}>
      <mesh receiveShadow><cylinderGeometry args={[SPIRE.padR, SPIRE.padR * 0.9, 0.8, 32]} /><meshStandardMaterial color="#2a313b" metalness={0.75} roughness={0.3} /></mesh>
      <mesh position-y={0.42} rotation-x={-Math.PI / 2}><ringGeometry args={[SPIRE.padR * 0.7, SPIRE.padR * 0.78, 48]} /><meshBasicMaterial ref={glow} color="#ffcf3a" transparent toneMapped={false} /></mesh>
      <Text position={[0, 0.45, 0]} rotation-x={-Math.PI / 2} fontSize={2.2} color="#ffcf3a" anchorX="center" anchorY="middle">D-1</Text>
      <mesh position={[0, -1.5, -SPIRE.padR * 0.6]} rotation-x={0.6}><boxGeometry args={[2, 0.6, 7]} /><meshStandardMaterial color={DARK} metalness={0.7} roughness={0.4} /></mesh>
    </group>
    {/* crown beacon */}
    <mesh position-y={SPIRE.height + 4}><cylinderGeometry args={[0.2, 0.6, 8, 6]} /><meshStandardMaterial color="#2a313b" metalness={0.8} /></mesh>
    <mesh position-y={SPIRE.height + 8.3}><sphereGeometry args={[0.6, 10, 8]} /><meshBasicMaterial color="#ff2e5a" toneMapped={false} /></mesh>
  </group>;
}

/** quarantine checkpoint: three hard-light arches with scanner beams, Aegis barriers either side */
function Checkpoint() {
  const scan = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (scan.current) scan.current.position.y = 1.5 + Math.abs(Math.sin(clock.elapsedTime * 1.2)) * 4; });
  const span = CHECKPOINT.width / CHECKPOINT.arches;
  return <group position={[CHECKPOINT.x, 0, CHECKPOINT.z]}>
    {Array.from({ length: CHECKPOINT.arches + 1 }, (_, i) => (
      <mesh key={i} castShadow position={[-CHECKPOINT.width / 2 + i * span, 3.2, 0]}><boxGeometry args={[0.7, 6.4, 1.4]} /><meshStandardMaterial color="#222a33" metalness={0.8} roughness={0.3} /></mesh>
    ))}
    <mesh position={[0, 6.6, 0]}><boxGeometry args={[CHECKPOINT.width + 0.7, 0.6, 1.6]} /><meshStandardMaterial color="#222a33" metalness={0.8} roughness={0.3} /></mesh>
    <LightBar position={[0, 6.25, 0.81]} size={[CHECKPOINT.width, 0.12, 0.05]} color="#38e8ff" />
    <Text position={[0, 7.4, 0.85]} fontSize={0.7} color="#d8f4ff" anchorX="center">AEGIS SYNDICATE · QUARANTINE CHECKPOINT</Text>
    {/* hard-light membranes in each arch, a scanner plane sweeping up and down */}
    {Array.from({ length: CHECKPOINT.arches }, (_, i) => (
      <mesh key={i} position={[-CHECKPOINT.width / 2 + (i + 0.5) * span, 3.1, 0]}><planeGeometry args={[span - 0.8, 6]} /><meshBasicMaterial color={i === 1 ? "#39ff7a" : "#38e8ff"} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>
    ))}
    <group ref={scan}><mesh rotation-x={-Math.PI / 2}><planeGeometry args={[CHECKPOINT.width, 1.2]} /><meshBasicMaterial color="#38e8ff" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh></group>
    {[-1, 1].map((s) => <mesh key={s} castShadow position={[s * (CHECKPOINT.width / 2 + 5), 1, 0]}><boxGeometry args={[9, 2, 0.8]} /><meshStandardMaterial color="#2b2f36" metalness={0.6} roughness={0.5} /></mesh>)}
  </group>;
}

/** the Grid: a deck ring on pillars with rail lights, skybridges over the market avenue */
function Deck() {
  const pillars = useMemo(() => deckPillars(), []);
  const W = DECK.width, hx = DECK.halfX, hz = DECK.halfZ;
  const spans: [number, number, number, number][] = [[0, -hz, 2 * hx + W, W], [0, hz, 2 * hx + W, W], [-hx, 0, W, 2 * hz], [hx, 0, W, 2 * hz]];
  return <group>
    {spans.map(([x, z, w, d], i) => (
      <group key={i} position={[x, DECK.y, z]}>
        <mesh castShadow receiveShadow><boxGeometry args={[w, 0.6, d]} /><meshStandardMaterial color="#232933" metalness={0.65} roughness={0.35} /></mesh>
        <LightBar position={[0, -0.32, 0]} size={[w > d ? w : 0.1, 0.06, d > w ? d : 0.1]} color={i % 2 ? "#ff2ea6" : "#38e8ff"} />
        {/* glass railings on both edges */}
        {[-1, 1].map((s) => <mesh key={s} position={w > d ? [0, 0.9, s * d / 2] : [s * w / 2, 0.9, 0]}><boxGeometry args={w > d ? [w, 1.2, 0.05] : [0.05, 1.2, d]} /><meshPhysicalMaterial color="#9fdcff" transparent opacity={0.18} roughness={0.05} depthWrite={false} /></mesh>)}
      </group>
    ))}
    {pillars.map((p, i) => <mesh key={i} castShadow position={[p.x, DECK.y / 2, p.z]}><boxGeometry args={[1.4, DECK.y, 1.4]} /><meshStandardMaterial color="#1b2028" metalness={0.6} roughness={0.5} /></mesh>)}
    {SKYBRIDGES.map((b, i) => (
      <group key={i} position={[0, DECK.y, b.z]}>
        <mesh castShadow receiveShadow><boxGeometry args={[2 * hx, 0.5, 3.4]} /><meshStandardMaterial color="#2a303b" metalness={0.7} roughness={0.3} /></mesh>
        <mesh position-y={1.6}><boxGeometry args={[2 * hx, 3.2, 3.4]} /><meshPhysicalMaterial color="#8fd8ff" transparent opacity={0.1} roughness={0.05} depthWrite={false} side={THREE.DoubleSide} /></mesh>
        <LightBar position={[0, 3.25, 0]} size={[2 * hx, 0.08, 0.08]} color={i ? "#ff2ea6" : "#38e8ff"} />
      </group>
    ))}
  </group>;
}

/** automated drone traffic: small craft with nav lights circulating on two lanes */
function Drones() {
  const ref = useRef<THREE.Group>(null);
  const all = useMemo(() => DRONE_LANES.flatMap((l, li) => Array.from({ length: l.drones }, (_, k) => ({ l, li, off: (k / l.drones) * lanePerimeter(l) }))), []);
  useFrame(({ clock }) => {
    const g = ref.current; if (!g) return;
    const t = clock.elapsedTime;
    all.forEach((d, i) => {
      const node = g.children[i]; if (!node) return;
      const p = laneAt(d.l, d.off + t * d.l.speed);
      node.position.set(p.x, d.l.y + Math.sin(t * 2 + i) * 0.3, p.z);
      node.rotation.y = d.l.speed > 0 ? p.yaw : p.yaw + Math.PI;
    });
  });
  return <group ref={ref}>{all.map((d, i) => (
    <group key={i}>
      <mesh castShadow><boxGeometry args={[1.2, 0.35, 2.4]} /><meshStandardMaterial color="#20262f" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0, -0.2, 1.2]}><sphereGeometry args={[0.14, 6, 5]} /><meshBasicMaterial color={d.l.color} toneMapped={false} /></mesh>
      <mesh position={[0, -0.2, -1.2]}><sphereGeometry args={[0.12, 6, 5]} /><meshBasicMaterial color="#ff2a2a" toneMapped={false} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * 0.9, 0.1, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.38, 0.05, 4, 12]} /><meshStandardMaterial color="#333a44" /></mesh>)}
    </group>
  ))}</group>;
}

/** Rust-Muck: pipes, CRT terminal banks with green flicker, red-lit dens with hanging curtains, steam vents */
function Undercity() {
  const kit = useMemo(() => undercity(), []);
  const crt = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { if (crt.current) crt.current.opacity = 0.75 + 0.25 * (Math.sin(clock.elapsedTime * 37) > 0.2 ? 1 : 0.3); });
  return <group>
    {PIPES.map((p, i) => {
      const a = new THREE.Vector3(...p.from), b = new THREE.Vector3(...p.to), mid = a.clone().lerp(b, 0.5), len = a.distanceTo(b);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      return <mesh key={i} castShadow position={mid} quaternion={q}><cylinderGeometry args={[p.r, p.r, len, 10]} /><meshStandardMaterial color={i % 3 ? "#5a3b2a" : "#3d4248"} metalness={0.7} roughness={0.55} /></mesh>;
    })}
    {kit.map((k, i) => (
      <group key={i} position={[k.x, 0, k.z]} rotation-y={k.yaw}>
        {k.kind === "terminals" && <group>
          {[0, 1, 2].map((j) => <group key={j} position={[(j - 1) * 0.9, 0.9 + (j % 2) * 0.7, 0]}>
            <mesh><boxGeometry args={[0.8, 0.65, 0.6]} /><meshStandardMaterial color="#2e2a26" roughness={0.8} /></mesh>
            <mesh position-z={0.31}><planeGeometry args={[0.6, 0.45]} /><meshBasicMaterial ref={i === 0 && j === 0 ? crt : undefined} color={j === 1 ? "#ffb347" : "#39ff7a"} transparent toneMapped={false} /></mesh>
          </group>)}
          <mesh position-y={0.3}><boxGeometry args={[2.8, 0.6, 0.8]} /><meshStandardMaterial color="#1e1c1a" /></mesh>
        </group>}
        {k.kind === "den" && <group>
          <mesh position-y={1.4}><boxGeometry args={[3.6, 2.8, 2.4]} /><meshStandardMaterial color="#1a1516" roughness={0.9} /></mesh>
          {[-0.9, 0, 0.9].map((x) => <mesh key={x} position={[x, 1.3, 1.22]}><planeGeometry args={[0.85, 2.3]} /><meshStandardMaterial color="#4a0f18" roughness={1} side={THREE.DoubleSide} /></mesh>)}
          <pointLight position={[0, 2.2, 1.6]} color="#ff2a3a" intensity={4} distance={7} decay={2} />
        </group>}
        {k.kind === "vent" && <SteamVent />}
      </group>
    ))}
  </group>;
}

function SteamVent() {
  const ref = useRef<THREE.Group>(null);
  const tex = useMemo(() => softSprite("dot"), []);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => {
      const k = (clock.elapsedTime * 0.35 + i / 8) % 1, s = 0.6 + k * 3;
      c.position.set(Math.sin(i * 2.3) * k * 0.6, 0.3 + k * 5, Math.cos(i * 1.7) * k * 0.6); c.scale.set(s, s, 1);
      ((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.min(1, k * 6) * (1 - k) * 0.4;
    });
  });
  return <group>
    <mesh position-y={0.1}><boxGeometry args={[1.4, 0.2, 1.4]} /><meshStandardMaterial color="#2a2d31" metalness={0.6} /></mesh>
    <group ref={ref}>{Array.from({ length: 8 }, (_, i) => <sprite key={i}><spriteMaterial map={tex ?? null} color="#cfd8e0" transparent depthWrite={false} /></sprite>)}</group>
  </group>;
}

/** hologram: a translucent panel with scanlines and text that flickers and glitches now and then */
function Hologram({ h, seed }: { h: Holo; seed: number }) {
  const g = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, c: { value: new THREE.Color(h.color) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: "uniform float t; uniform vec3 c; varying vec2 vUv; void main(){ float scan = 0.6 + 0.4*step(0.5, fract(vUv.y*60.0 - t*2.0)); float edge = smoothstep(0.0,0.04,vUv.x)*smoothstep(1.0,0.96,vUv.x)*smoothstep(0.0,0.06,vUv.y)*smoothstep(1.0,0.94,vUv.y); gl_FragColor = vec4(c*1.4, 0.16*scan + 0.25*(1.0-edge)); }",
  }), [h.color]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 7.1;
    mat.uniforms["t"]!.value = t;
    // brief glitch: a horizontal jitter and a dropout every few seconds
    const glitch = Math.sin(t * 0.7) > 0.97;
    if (g.current) { g.current.position.x = h.x + (glitch ? Math.sin(t * 90) * 0.25 : 0); g.current.visible = !(glitch && Math.sin(t * 53) > 0.6); }
  });
  return <group ref={g} position={[h.x, h.y, h.z]} rotation-y={h.yaw}>
    <mesh material={mat}><planeGeometry args={[h.w, h.h]} /></mesh>
    <Text position={[0, 0, 0.05]} fontSize={h.h * 0.32} maxWidth={h.w * 0.92} color={h.color} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000" fillOpacity={0.9}>{h.text}</Text>
  </group>;
}

/** acid rain (green-tinged streaks that follow the camera inside the district) and low neon fog banks */
function NeonWeather({ c, y0 }: { c: { x: number; z: number }; y0: number }) {
  const N = 1400, BOX = 60;
  const rain = useRef<THREE.InstancedMesh>(null);
  const fog = useRef<THREE.Group>(null);
  const drops = useMemo(() => Float32Array.from({ length: N * 3 }, () => Math.random()), []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const tex = useMemo(() => softSprite("dot"), []);
  const rainMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ camera, clock }, dt) => {
    const lx = camera.position.x - c.x, lz = camera.position.z - c.z, k = neonWeather(lx, lz);
    const m = rain.current;
    if (m) {
      m.visible = k > 0.01;
      if (rainMat.current) rainMat.current.opacity = 0.35 * k;
      if (m.visible) {
        for (let i = 0; i < N; i++) {
          drops[i * 3 + 1] = (drops[i * 3 + 1]! - dt * 0.9 + 1) % 1;
          tmp.position.set(lx + (drops[i * 3]! - 0.5) * BOX, camera.position.y - y0 - 10 + drops[i * 3 + 1]! * 40, lz + (drops[i * 3 + 2]! - 0.5) * BOX);
          tmp.rotation.set(0.12, 0, 0.06); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix);
        }
        m.instanceMatrix.needsUpdate = true;
      }
    }
    const t = clock.elapsedTime;
    fog.current?.children.forEach((s, i) => {
      s.position.x = ((i * 37) % 80) - 40 + Math.sin(t * 0.05 + i) * 6;
      ((s as THREE.Sprite).material as THREE.SpriteMaterial).opacity = (0.08 + 0.04 * Math.sin(t * 0.3 + i)) * k;
    });
  });
  return <group>
    <instancedMesh ref={rain} args={[undefined, undefined, N]} frustumCulled={false}>
      <boxGeometry args={[0.02, 0.9, 0.02]} />
      <meshBasicMaterial ref={rainMat} color="#b8ffcf" transparent depthWrite={false} />
    </instancedMesh>
    <group ref={fog}>
      {Array.from({ length: 16 }, (_, i) => (
        <sprite key={i} position={[0, 2 + (i % 4) * 2.5, ((i * 23) % 70) - 35]} scale={[34, 12, 1]}>
          <spriteMaterial map={tex ?? null} color={i % 2 ? "#ff2ea6" : "#38e8ff"} transparent depthWrite={false} fog={false} />
        </sprite>
      ))}
    </group>
  </group>;
}

const VORTEX_FRAG = /* glsl */ `
uniform float uTime; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float arms = sin(a * 3.0 + log(r + 0.02) * 6.0 - uTime * 0.9) * 0.5 + 0.5;
  float grain = n2(vec2(a * 4.0, r * 9.0 - uTime * 0.3));
  float eye = smoothstep(0.22, 0.0, r);
  float body = pow(arms, 3.0) * (0.55 + 0.45 * grain) * smoothstep(1.0, 0.35, r);
  vec3 col = mix(vec3(0.62, 0.38, 1.0), vec3(0.45, 0.9, 1.0), smoothstep(0.7, 0.1, r)) * body * 1.3 + vec3(0.95, 0.98, 1.0) * eye * 1.6;
  gl_FragColor = vec4(col, clamp(body * 0.8 + eye, 0.0, 1.0) * smoothstep(1.0, 0.8, r));
}`;
const VORTEX_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** the sky spiralling open above the Spire (neon-tiers.ts VORTEX) — one additive disc facing down */
function FractureVortex() {
  const mat = useMemo(() => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: VORTEX_VERT, fragmentShader: VORTEX_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, side: THREE.DoubleSide }), []);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { mat.uniforms["uTime"]!.value = clock.elapsedTime; if (ref.current) ref.current.rotation.z = clock.elapsedTime * VORTEX.spin; });
  return <mesh ref={ref} material={mat} position={[SPIRE.x, VORTEX.y, SPIRE.z]} rotation-x={Math.PI / 2}><circleGeometry args={[VORTEX.r, 64]} /></mesh>;
}

/** violet fracture lightning crawling down one Spire face every few seconds (neon-tiers.ts facadeArc) — one pooled line, re-jittered per frame while on */
function FacadeArcs() {
  const line = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(24 * 3), 3)); return new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#d4a8ff", toneMapped: false, transparent: true })); }, []);
  useFrame(({ clock }) => {
    const a = facadeArc(clock.elapsedTime);
    line.visible = a.on;
    if (!a.on) return;
    const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    const ang = (a.face / 4) * Math.PI * 2 + Math.PI / 4;
    const nx = Math.cos(ang), nz = Math.sin(ang), tx = -nz, tz = nx;
    const top = SPIRE.height * 0.95, reach = SPIRE.height * 0.85 * a.k;
    for (let i = 0; i < 24; i++) {
      const f = i / 23, y = top - reach * f;
      const r = SPIRE.base * (1 - 0.45 * Math.min(1, Math.max(0, y / SPIRE.height)));
      const off = (Math.random() - 0.5) * r * 0.9;
      pos.setXYZ(i, SPIRE.x + nx * (r + 0.4) + tx * off, y, SPIRE.z + nz * (r + 0.4) + tz * off);
    }
    pos.needsUpdate = true;
    (line.material as THREE.LineBasicMaterial).opacity = 1 - a.k * 0.5;
  });
  return <primitive object={line} />;
}
