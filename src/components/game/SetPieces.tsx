import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { walkHeight } from "@/game/terrain";
import { debrisPose, floatingDebris, lavaFissures, lavaPulse, wreckField, type Wreck } from "@/game/set-pieces";
import { softSprite } from "./softSprite";

/** Burned convoy wrecks with smoke columns (The Convoy Sprint). Procedural, so it can never fail to load. */
export function WreckField() {
  const wrecks = useMemo(() => wreckField(), []);
  return (
    <group>
      {wrecks.map((w, i) => <CarWreck key={i} w={w} />)}
      {wrecks.filter((w) => w.smoke).map((w, i) => <SmokeColumn key={i} x={w.x} z={w.z} seed={i} fire={w.burning} />)}
    </group>
  );
}

const SIZE: Record<Wreck["kind"], [number, number, number, number]> = { sedan: [1.8, 0.7, 4.2, 0.55], pickup: [1.9, 0.8, 5, 0.65], van: [2, 1.2, 4.8, 1.1] };

function CarWreck({ w }: { w: Wreck }) {
  const [wd, h, len, cab] = SIZE[w.kind];
  const y = walkHeight(w.x, w.z);
  const char = <meshStandardMaterial color="#2a2522" roughness={0.95} metalness={0.25} />;
  const rust = <meshStandardMaterial color="#5a3424" roughness={0.9} metalness={0.3} />;
  const tyre = <meshStandardMaterial color="#111" roughness={1} />;
  return (
    <group position={[w.x, y + 0.35, w.z]} rotation={[0, w.yaw, w.roll]}>
      <mesh castShadow receiveShadow position={[0, h / 2 + 0.15, 0]}><boxGeometry args={[wd, h, len]} />{rust}</mesh>
      {w.kind !== "van" && <mesh castShadow position={[0, h + 0.15 + cab / 2, w.kind === "pickup" ? 0.6 : -0.2]}><boxGeometry args={[wd * 0.9, cab, len * (w.kind === "pickup" ? 0.35 : 0.5)]} />{char}</mesh>}
      {/* blown-out windows: dark recess */}
      <mesh position={[0, h + 0.15 + (w.kind === "van" ? -0.25 : cab / 2), len * 0.26]}><boxGeometry args={[wd * 0.82, 0.32, 0.05]} /><meshBasicMaterial color="#050505" /></mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], k) => (
        <mesh key={k} position={[(sx! * wd) / 2, 0.05, (sz! * len) / 3]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.32, 0.32, 0.22, 10]} />{tyre}</mesh>
      ))}
      {w.burning && <Embers wd={wd} len={len} h={h} />}
    </group>
  );
}

function Embers({ wd, len, h }: { wd: number; len: number; h: number }) {
  const light = useRef<THREE.PointLight>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const f = 0.75 + 0.25 * Math.sin(clock.elapsedTime * 13) * Math.sin(clock.elapsedTime * 7.3);
    if (light.current) light.current.intensity = 6 * f;
    if (glow.current) glow.current.opacity = 0.6 * f;
  });
  return (
    <group position={[0, h + 0.2, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[wd * 0.8, len * 0.7]} /><meshBasicMaterial ref={glow} color="#ff6a1f" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
      <pointLight ref={light} color="#ff7a2a" distance={14} decay={2} />
    </group>
  );
}

const PUFFS = 14;
/** A rising, widening smoke plume built from soft sprites recycled bottom→top. */
function SmokeColumn({ x, z, seed, fire }: { x: number; z: number; seed: number; fire: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const tex = useMemo(() => softSprite("dot"), []);
  const base = useMemo(() => walkHeight(x, z) + 1.4, [x, z]);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime + seed * 3.1;
    g.children.forEach((c, i) => {
      const k = ((t * 0.07 + i / PUFFS) % 1);
      const s = 1.5 + k * 9;
      c.position.set(Math.sin(i * 2.3 + t * 0.2) * k * 2.5 + k * k * 6, k * 26, Math.cos(i * 1.7) * k * 2);
      c.scale.set(s, s, 1);
      const m = (c as THREE.Sprite).material as THREE.SpriteMaterial;
      m.opacity = Math.min(1, k * 8) * (1 - k) * 0.55;
      m.color.setRGB(fire && k < 0.12 ? 0.45 : 0.16 + k * 0.2, 0.14 + k * 0.19, 0.13 + k * 0.19);
    });
  });
  return (
    <group ref={ref} position={[x, base, z]}>
      {Array.from({ length: PUFFS }, (_, i) => (
        <sprite key={i}><spriteMaterial map={tex ?? null} transparent depthWrite={false} fog /></sprite>
      ))}
    </group>
  );
}

/** Smoldering Trench: glowing lava fissures inside the real lava-trench hazard zone, fracture debris hanging above. */
export function LavaTrench() {
  const fissures = useMemo(() => lavaFissures(), []);
  const strips = useMemo(() => fissures.map((f) => [drapedStrip(f.x, f.z, f.yaw, f.length, f.width * 2.4, 0.08), drapedStrip(f.x, f.z, f.yaw, f.length * 0.96, f.width, 0.12)] as const), [fissures]);
  const debris = useMemo(() => floatingDebris(), []);
  const lava = useRef<THREE.MeshBasicMaterial>(null);
  const crust = useRef<THREE.MeshStandardMaterial>(null);
  const debrisRef = useRef<THREE.Group>(null);
  const bases = useMemo(() => debris.map((d) => walkHeight(d.x, d.z)), [debris]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (lava.current) lava.current.color.setRGB(1 * lavaPulse(t), 0.36 * lavaPulse(t, 1), 0.06);
    if (crust.current) crust.current.emissiveIntensity = 1.2 * lavaPulse(t, 2);
    debrisRef.current?.children.forEach((c, i) => {
      const d = debris[i]!, p = debrisPose(d, t);
      c.position.set(d.x, bases[i]! + p.y, d.z); c.rotation.set(p.rx, p.ry, 0);
    });
  });
  return (
    <group>
      {fissures.map((f, i) => (
        <group key={i}>
          <mesh geometry={strips[i]![0]}><meshStandardMaterial side={THREE.DoubleSide} ref={i === 0 ? crust : undefined} color="#1a0f0c" emissive="#ff3a0a" emissiveIntensity={1.1} roughness={1} transparent opacity={0.85} depthWrite={false} polygonOffset polygonOffsetFactor={-2} /></mesh>
          <mesh geometry={strips[i]![1]}><meshBasicMaterial side={THREE.DoubleSide} ref={i === 0 ? lava : undefined} color="#ff6a14" toneMapped={false} polygonOffset polygonOffsetFactor={-4} /></mesh>
          {i === 0 && <pointLight position={[f.x, walkHeight(f.x, f.z) + 2, f.z]} color="#ff5a1a" intensity={30} distance={40} decay={2} />}
        </group>
      ))}
      <group ref={debrisRef}>
        {debris.map((d, i) => (
          <mesh key={i} castShadow scale={d.size}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#2b2433" roughness={0.8} emissive="#9a4dff" emissiveIntensity={0.35} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** A strip along `yaw` that follows the ground (world-space vertices), so a fissure never floats or sinks on a slope. */
function drapedStrip(cx: number, cz: number, yaw: number, length: number, width: number, lift: number): THREE.BufferGeometry {
  const seg = Math.max(2, Math.ceil(length / 2));
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg - 0.5) * length;
    const taper = Math.sin((i / seg) * Math.PI) * 0.8 + 0.2; // pointed ends
    for (const side of [-0.5, 0.5]) {
      const x = cx + fx * a + rx * side * width * taper, z = cz + fz * a + rz * side * width * taper;
      pos.push(x, walkHeight(x, z) + lift, z);
    }
    if (i < seg) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
