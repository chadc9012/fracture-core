import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { STORM_ISLAND_SITES, stormSiteWorld, type StormIslandSite } from "@/game/storm-islands";
import { organicDeform, organicRock } from "@/game/organic-geometry";
import { mulberry32 } from "@/game/rng";
import { stormStrike } from "@/game/fracture-storm";

/**
 * Storm Islands (storm-islands.ts, the uploaded world pass rebuilt): six floating islands over the north-east ocean —
 * each a mass of fractured rock hanging beneath a grassy cap, trailing loose boulders, with its landmark on top: the
 * Broken Sky Dock (deck, cranes and beacon), the Signal Spire relay, Windward Ruins, the Thunder Nest, the Aether Temple
 * and the Eye of the Storm (a churning crystal core with lightning). Islands bob slowly; lightning flickers through the
 * chain on the storm clock. Gameplay (landing, quests) is a later milestone; this is the world piece seen from the coast.
 */
const rockMat = new THREE.MeshStandardMaterial({ color: "#4f525e", roughness: 0.92, metalness: 0.05, flatShading: true });
const darkRock = new THREE.MeshStandardMaterial({ color: "#2e2f38", roughness: 0.95, flatShading: true });
const grass = new THREE.MeshStandardMaterial({ color: "#56703f", roughness: 0.95 });
const stone = new THREE.MeshStandardMaterial({ color: "#c9c3b2", roughness: 0.8 });
const metal = new THREE.MeshStandardMaterial({ color: "#6b7b8e", roughness: 0.45, metalness: 0.7 });
const gold = new THREE.MeshStandardMaterial({ color: "#d2b56d", roughness: 0.3, metalness: 0.9, emissive: "#7c6330", emissiveIntensity: 0.3 });
const glowBlue = new THREE.MeshBasicMaterial({ color: new THREE.Color("#8ab5ff").multiplyScalar(2.2), toneMapped: false });
const beacon = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff3030").multiplyScalar(2), toneMapped: false });

function underside(radius: number, depth: number, seed: number) {
  const g = new THREE.ConeGeometry(radius, depth, 14, 6, false);
  g.rotateX(Math.PI); // point down
  return organicDeform(g, seed, radius * 0.18, 0.12);
}

function Island({ site, index }: { site: StormIslandSite; index: number }) {
  const w = stormSiteWorld(site);
  const radius = site.kind === "storm-core" ? 42 : site.kind === "temple" ? 35 : 24 + index * 2;
  const group = useRef<THREE.Group>(null);
  const geo = useMemo(() => ({
    under: underside(radius, radius * 1.6, index + 3),
    cap: new THREE.CylinderGeometry(radius * 0.98, radius, 3, 24),
    boulders: Array.from({ length: 7 }, (_, k) => organicRock(2 + (k % 3) * 1.6, index * 11 + k, 1)),
  }), [radius, index]);
  const r = mulberry32(index * 97 + 5);
  const drift = useMemo(() => Array.from({ length: 7 }, () => ({ a: r() * Math.PI * 2, d: radius * (0.8 + r() * 0.6), y: -radius * (0.3 + r() * 0.9) })), [radius]); // eslint-disable-line react-hooks/exhaustive-deps
  // the islands hang still: their caps are walkable ground (storm-quests.ts stormGroundAt), so they must not bob under your feet
  return (
    <group ref={group} position={[w.x, w.y, w.z]} name={`storm-island:${site.id}`}>
      <mesh geometry={geo.under} material={rockMat} position={[0, -radius * 0.8, 0]} castShadow />
      <mesh geometry={geo.cap} material={grass} position={[0, 1.4, 0]} receiveShadow castShadow />
      {drift.map((b, k) => <mesh key={k} geometry={geo.boulders[k]!} material={darkRock} position={[Math.cos(b.a) * b.d, b.y, Math.sin(b.a) * b.d]} />)}
      {site.kind === "landing" && <group position={[0, 3, 0]}>
        <mesh material={metal} castShadow><boxGeometry args={[34, 1.4, 13]} /></mesh>
        <mesh material={metal} position={[radius * 0.9, 0, 0]} castShadow><boxGeometry args={[18, 0.8, 5]} /></mesh>
        {[-13, 13].map((v) => <mesh key={v} position={[v, 2.4, 0]} material={gold}><boxGeometry args={[1, 4, 13]} /></mesh>)}
        <mesh position={[-8, 9, -4]} material={metal} castShadow><boxGeometry args={[0.8, 18, 0.8]} /></mesh>
        <mesh position={[-2, 17.6, -4]} material={metal} castShadow><boxGeometry args={[12, 0.6, 0.6]} /></mesh>
        <mesh position={[radius * 0.9 + 9, 1, 0]} material={beacon}><sphereGeometry args={[0.6, 8, 6]} /></mesh>
      </group>}
      {(site.kind === "ruins" || site.kind === "temple") && <group position={[0, 3, 0]}>
        {site.kind === "temple" && [0, 1, 2].map((k) => <mesh key={k} position={[0, 0.8 + k * 1.6, 0]} material={stone} castShadow><boxGeometry args={[30 - k * 7, 1.6, 22 - k * 5]} /></mesh>)}
        {[-1, 0, 1].map((v) => [-1, 1].map((s) => <mesh key={`${v}${s}`} castShadow position={[v * 9, (site.kind === "temple" ? 5 : 0) + 6, s * 6]} material={stone}><cylinderGeometry args={[1.4, 1.8, site.kind === "temple" ? 12 : 4 + ((v + s + 3) % 3) * 3, 10]} /></mesh>))}
        {site.kind === "temple" && <mesh position={[0, 18, 0]} material={gold} castShadow><coneGeometry args={[12, 6, 4]} /></mesh>}
      </group>}
      {site.kind === "outpost" && <group position={[0, 3, 0]}>
        <mesh castShadow position={[0, 14, 0]} material={metal}><cylinderGeometry args={[1.5, 3.5, 28, 8]} /></mesh>
        <mesh position={[0, 29, 0]} material={glowBlue}><torusGeometry args={[4, 0.3, 8, 32]} /></mesh>
        <mesh position={[0, 31, 0]} material={beacon}><sphereGeometry args={[0.7, 8, 6]} /></mesh>
      </group>}
      {site.kind === "nest" && <group position={[0, 5, 0]}>
        <mesh castShadow material={darkRock}><torusGeometry args={[10, 2.6, 8, 20]} /></mesh>
        {[0, 1, 2].map((k) => <mesh key={k} position={[Math.cos(k * 2.1) * 3, 1.5, Math.sin(k * 2.1) * 3]} material={stone}><sphereGeometry args={[1.4, 10, 8]} /></mesh>)}
      </group>}
      {site.kind === "storm-core" && <StormCore />}
    </group>
  );
}

function StormCore() {
  const core = useRef<THREE.Mesh>(null), shell = useRef<THREE.Mesh>(null), bolt = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (core.current) { core.current.rotation.y = t * 0.4; core.current.rotation.x = t * 0.23; }
    if (shell.current) shell.current.rotation.y = -t * 0.15;
    if (bolt.current) { const s = stormStrike(t); bolt.current.intensity = 20 + (s.on ? s.k : 0) * 260; }
  });
  return <group position={[0, 26, 0]}>
    <mesh ref={core} material={glowBlue}><icosahedronGeometry args={[7, 1]} /></mesh>
    <mesh ref={shell}><icosahedronGeometry args={[11, 1]} /><meshStandardMaterial color="#8ab5ff" emissive="#5377ff" emissiveIntensity={2} wireframe transparent opacity={0.7} /></mesh>
    <pointLight ref={bolt} color="#9fc0ff" intensity={20} distance={160} decay={1.6} />
  </group>;
}

export function StormIslands() {
  return <group name="storm-islands">{STORM_ISLAND_SITES.map((s, i) => <Island key={s.id} site={s} index={i} />)}</group>;
}
