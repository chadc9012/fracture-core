import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "./SafeText";
import * as THREE from "three";
import { heightAt } from "@/game/terrain";
import { addObstacle } from "@/game/obstacles";
import { registerDeck } from "@/game/district-decks";
import { GRID_WALKWAYS, NEON_DISTRICTS, RACE_GATES, GATE_RADIUS } from "@/game/neon-districts";
import { DistrictLight } from "./DistrictLight";
import { LightBar, ShopSign } from "./DistrictStreet";

/** Live race view written by Scene (current gate index, -1 = no race) — presentation only. */
export const raceLive = { gate: -1, countdown: false };

type C = { x: number; z: number };
const at = (c: C, id: string) => { const d = NEON_DISTRICTS.find((k) => k.id === id)!; return { x: c.x + d.dx, z: c.z + d.dz, d }; };

const METAL = { color: "#2b313c", metalness: 0.75, roughness: 0.32 } as const;
const WET = { color: "#0d0a14", metalness: 0.6, roughness: 0.1 } as const;

function DistrictLabel({ x, y, z, text, sub, color }: { x: number; y: number; z: number; text: string; sub: string; color: string }) {
  return <group position={[x, y, z]}>
    <Text fontSize={2.4} color={color} anchorX="center" outlineWidth={0.04} outlineColor="#000">{text}</Text>
    <Text position={[0, -1.8, 0]} fontSize={0.9} color="#e6ecf5" anchorX="center">{sub}</Text>
  </group>;
}

/** Aegis Spire: a glass corporate tower over a raised, lit plaza. */
function AegisSpire({ c }: { c: C }) {
  const { x, z, d } = at(c, "aegis-spire");
  const y = heightAt(x, z);
  const crown = useRef<THREE.MeshStandardMaterial>(null);
  useMemo(() => {
    addObstacle("tower", x, z - 10, 7, 9999, 3);
    registerDeck({ id: "aegis-plaza", x, z: z + 6, dirX: 0, dirZ: 1, length: 34, width: 26, top: y + 1.2, base: y, ramp: 6 });
  }, [x, z, y]);
  useFrame(({ clock }) => { if (crown.current) crown.current.emissiveIntensity = 2.4 + Math.sin(clock.elapsedTime * 1.3) * 0.6; });
  const tiers = [ [12, 22], [10, 20], [8, 18], [6, 16] ] as const;
  let h = 0;
  return <group>
    <mesh position={[x, y + 0.6, z + 6]} receiveShadow><boxGeometry args={[26, 1.2, 22]} /><meshStandardMaterial {...WET} /></mesh>
    <LightBar position={[x, y + 1.25, z + 17]} size={[26, 0.08, 0.08]} color={d.color} />
    <group position={[x, y, z - 10]}>
      {tiers.map(([w, th], i) => { const yy = h + th / 2; h += th; return <group key={i}>
        <mesh position={[0, yy, 0]} castShadow><boxGeometry args={[w, th, w]} /><meshPhysicalMaterial color="#1b2a3a" metalness={0.9} roughness={0.08} clearcoat={1} /></mesh>
        {[-1, 1].map((s) => <LightBar key={s} position={[s * (w / 2 + 0.02), yy, 0]} size={[0.06, th * 0.96, 0.25]} color={d.color} />)}
      </group>; })}
      <mesh position={[0, h + 6, 0]}><coneGeometry args={[3, 12, 4]} /><meshStandardMaterial ref={crown} color="#cfefff" emissive={d.color} emissiveIntensity={2.4} toneMapped={false} /></mesh>
      <DistrictLight position={[0, h + 4, 0]} color={d.color} intensity={30} distance={90} decay={2} />
    </group>
    <ShopSign label="AEGIS · CORPORATE" color={d.color} position={[x, y + 5, z + 1]} />
    <DistrictLight position={[x, y + 7, z + 8]} color="#d8f4ff" intensity={20} distance={40} decay={2} />
    <DistrictLabel x={x} y={y + 14} z={z + 18} text="AEGIS SPIRE" sub={d.tagline.toUpperCase()} color={d.color} />
  </group>;
}

/** The Grid: raised transit walkways (real walkable decks with ramps), pylons and a patrolling drone. */
function TheGrid({ c }: { c: C }) {
  const { x, z, d } = at(c, "the-grid");
  const y = heightAt(x, z);
  const drone = useRef<THREE.Group>(null);
  useMemo(() => {
    for (const w of GRID_WALKWAYS) registerDeck({ id: w.id, x: c.x + w.dx, z: c.z + w.dz, dirX: w.dirX, dirZ: w.dirZ, length: w.length, width: w.width, top: y + w.top, base: y, ramp: w.ramp });
  }, [c.x, c.z, y]);
  useFrame(({ clock }) => { const g = drone.current; if (!g) return; const t = clock.elapsedTime * 0.4; g.position.set(x + Math.cos(t) * 22, y + 12 + Math.sin(t * 3) * 0.6, z + Math.sin(t) * 18); g.rotation.y = -t; });
  return <group>
    {GRID_WALKWAYS.map((w) => {
      const wx = c.x + w.dx, wz = c.z + w.dz, rot = Math.atan2(w.dirX, w.dirZ);
      const flat = w.length - w.ramp * 2;
      return <group key={w.id} position={[wx, y, wz]} rotation-y={rot}>
        <mesh position={[0, w.top - 0.15, 0]} receiveShadow castShadow><boxGeometry args={[w.width, 0.3, flat]} /><meshStandardMaterial {...METAL} /></mesh>
        {w.ramp > 0 && [-1, 1].map((s) => { const len = Math.hypot(w.ramp, w.top); const ang = Math.atan2(w.top, w.ramp); return (
          <mesh key={s} position={[0, w.top / 2 - 0.15, s * (flat / 2 + w.ramp / 2)]} rotation-x={s * ang} receiveShadow><boxGeometry args={[w.width, 0.3, len]} /><meshStandardMaterial {...METAL} /></mesh>); })}
        {/* grind rails along both edges */}
        {[-1, 1].map((s) => <group key={s}>
          <mesh position={[s * (w.width / 2 - 0.1), w.top + 0.9, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.06, 0.06, flat, 8]} /><meshStandardMaterial color="#c9d3df" metalness={1} roughness={0.15} /></mesh>
          <LightBar position={[s * (w.width / 2), w.top - 0.3, 0]} size={[0.06, 0.06, flat]} color={d.color} />
        </group>)}
        {(() => { const n = Math.max(2, Math.floor(flat / 10)); return Array.from({ length: n }, (_, i) => <mesh key={i} position={[0, w.top / 2 - 0.3, -flat / 2 + (i + 0.5) * (flat / n)]} castShadow><boxGeometry args={[0.7, w.top - 0.3, 0.7]} /><meshStandardMaterial color="#1c2129" metalness={0.6} roughness={0.5} /></mesh>); })()}
      </group>;
    })}
    <group ref={drone}>
      <mesh><boxGeometry args={[1.6, 0.35, 1]} /><meshStandardMaterial color="#20262f" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0, -0.25, 0.4]}><sphereGeometry args={[0.15, 10, 8]} /><meshBasicMaterial color="#ff3b4e" toneMapped={false} /></mesh>
      <spotLight position={[0, -0.3, 0]} angle={0.5} penumbra={0.6} intensity={30} distance={20} color="#cdeaff" />
    </group>
    <DistrictLight position={[x, y + 9, z]} color={d.color} intensity={22} distance={60} decay={2} />
    <DistrictLabel x={x} y={y + 13} z={z} text="THE GRID" sub={d.tagline.toUpperCase()} color={d.color} />
  </group>;
}

/** Rust-Muck: a covered undercity — rusted walls, a low roof, sodium lights and steam, with the race line at its mouth. */
function RustMuck({ c }: { c: C }) {
  const { x, z, d } = at(c, "rust-muck");
  const y = heightAt(x, z);
  const steam = useRef<THREE.Mesh>(null);
  useMemo(() => {
    for (const s of [-1, 1]) addObstacle("tower", x + s * 15, z, 2.4, 9999, 3);
  }, [x, z]);
  useFrame(({ clock }) => { const m = steam.current; if (!m) return; (m.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(clock.elapsedTime * 0.7) * 0.04; });
  const rust = { color: "#5a2f1c", metalness: 0.55, roughness: 0.8 } as const;
  return <group position={[x, y, z]}>
    {/* side walls and a low roof read as underground from the street */}
    {[-1, 1].map((s) => <mesh key={s} position={[s * 15, 4, 0]} castShadow receiveShadow><boxGeometry args={[1.2, 8, 46]} /><meshStandardMaterial {...rust} /></mesh>)}
    <mesh position={[0, 8.3, 0]} receiveShadow><boxGeometry args={[31, 0.6, 46]} /><meshStandardMaterial color="#2a1a14" metalness={0.5} roughness={0.85} /></mesh>
    {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[0, 7.7, -20 + i * 8]}><boxGeometry args={[30, 0.5, 0.5]} /><meshStandardMaterial {...rust} /></mesh>)}
    <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[30, 46]} /><meshStandardMaterial {...WET} color="#1a0f0a" /></mesh>
    {/* market stalls along the walls */}
    {[-1, 1].flatMap((s) => [-14, -2, 10].map((zz) => <group key={`${s}${zz}`} position={[s * 11.5, 0, zz]}>
      <mesh position={[0, 1.1, 0]} castShadow><boxGeometry args={[3.5, 2.2, 3]} /><meshStandardMaterial color="#3a2a22" roughness={0.8} /></mesh>
      <LightBar position={[-s * 1.8, 2.3, 0]} size={[0.06, 0.06, 3]} color={zz === -2 ? "#ff2ea6" : d.color} />
    </group>))}
    <ShopSign label="RUST-MUCK" color={d.color} position={[0, 6.4, 23]} />
    <ShopSign label="UNDERGROUND RACING" color="#ffcf3a" position={[0, 5.2, 23.2]} />
    {[-15, 0, 15].map((zz) => <DistrictLight key={zz} position={[0, 6.5, zz]} color="#ff9a4a" intensity={14} distance={24} decay={2} />)}
    <mesh ref={steam} position={[0, 3, 0]}><boxGeometry args={[28, 6, 44]} /><meshBasicMaterial color="#ffb07a" transparent opacity={0.12} depthWrite={false} /></mesh>
    <DistrictLabel x={0} y={11} z={24} text="RUST-MUCK" sub="THE UNDERCITY · UNDERGROUND RACES" color={d.color} />
  </group>;
}

/** Race gates: the next gate burns bright, the rest stay dim so the route reads ahead. */
function RaceGates({ c }: { c: C }) {
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const ys = useMemo(() => RACE_GATES.map((g) => heightAt(c.x + g.dx, c.z + g.dz)), [c.x, c.z]);
  useFrame(({ clock }) => {
    mats.current.forEach((m, i) => {
      if (!m) return;
      const next = raceLive.gate === i, finish = i === RACE_GATES.length - 1;
      m.color.set(next ? "#ffe14a" : finish ? "#39ff7a" : "#ff7a2e");
      m.opacity = next ? 0.85 + Math.sin(clock.elapsedTime * 8) * 0.15 : raceLive.gate < 0 && finish ? 0.7 : 0.18;
    });
  });
  return <group>{RACE_GATES.map((g, i) => {
    const nx = RACE_GATES[(i + 1) % RACE_GATES.length]!;
    const rot = Math.atan2(nx.dx - g.dx, nx.dz - g.dz);
    return <mesh key={i} position={[c.x + g.dx, ys[i]! + GATE_RADIUS * 0.6, c.z + g.dz]} rotation-y={rot}>
      <torusGeometry args={[GATE_RADIUS * 0.7, 0.18, 8, 40]} />
      <meshBasicMaterial ref={(m) => { mats.current[i] = m; }} color="#ff7a2e" transparent opacity={0.2} toneMapped={false} />
    </mesh>;
  })}</group>;
}

export function NeonDistricts({ c }: { c: C }) {
  return <group>
    <AegisSpire c={c} />
    <TheGrid c={c} />
    <RustMuck c={c} />
    <RaceGates c={c} />
  </group>;
}
