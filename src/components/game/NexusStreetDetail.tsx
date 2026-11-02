import { useMemo } from "react";
import * as THREE from "three";
import { REGIONS } from "@/game/world";
import { walkHeight } from "@/game/terrain";
import { NEXUS_HUB_PROMENADE, NEXUS_HUB_ROAD_R } from "@/game/building-models";
import { InstancedGlb, type GlbInstance } from "./InstancedGlb";

/** scanned CC0 props from Poly Haven (scripts: see public/models/props-ph/README.md) */
const LEAVES = "/models/props-ph/leaves.glb", CAFE_SET = "/models/props-ph/cafe-set.glb";

const center = REGIONS.find((r) => r.id === "nexus")!;

/** Visible street dressing for the Nexus hub. Decorative only: existing roads,
 * navigation, collision, vehicles, and mission triggers remain authoritative. */
export function NexusStreetDetail() {
  const sites = useMemo(() => Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    // on the plaza side of the promenade: at promenade + 2.6 they stood in the ring road's lanes (no collision, cars drove through)
    const r = NEXUS_HUB_PROMENADE[0] - 1.3;
    const x = center.x + Math.cos(a) * r;
    const z = center.z + Math.sin(a) * r;
    return { x, y: walkHeight(x, z), z, a, i };
  }), []);
  const planter = useMemo(() => new THREE.MeshStandardMaterial({ color: "#777d84", roughness: 0.68, metalness: 0.12 }), []);
  const soil = useMemo(() => new THREE.MeshStandardMaterial({ color: "#292d2a", roughness: 1 }), []);
  const trim = useMemo(() => new THREE.MeshStandardMaterial({ color: "#bcc6ce", roughness: 0.32, metalness: 0.72 }), []);
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e9f4ff", emissive: "#ffe3b3", emissiveIntensity: 0.55, roughness: 0.22 }), []);
  // Lightweight, terrain-following wet asphalt highlights. These are thin
  // surface details, not replacement road meshes or collision geometry.
  const roadMarks = useMemo(() => Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    const r = NEXUS_HUB_ROAD_R + (i % 3 === 0 ? 1.3 : -1.15);
    const x = center.x + Math.cos(a) * r;
    const z = center.z + Math.sin(a) * r;
    // above the plaza paving disc (walkHeight + 0.06, CityBuildings): at +0.045 these sat under it and never showed
    return { x, z, y: walkHeight(x, z) + 0.078, a, i };
  }), []);
  const wetAsphalt = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: "#526579", metalness: 0.28, roughness: 0.22,
    transparent: true, opacity: 0.36, depthWrite: false,
    clearcoat: 0.85, clearcoatRoughness: 0.13,
    polygonOffset: true, polygonOffsetFactor: -1,
  }), []);
  const roadStripe = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#c9c8b7", roughness: 0.62, transparent: true,
    opacity: 0.68, depthWrite: false,
  }), []);
  // Café terraces and pedestrian-scale street furniture. Geometry is shared
  // across sites; all placement is deterministic and terrain-aware.
  const cafeSites = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const a = ((i + 0.35) / 8) * Math.PI * 2;
    const r = NEXUS_HUB_PROMENADE[0] + 7.2;
    const x = center.x + Math.cos(a) * r;
    const z = center.z + Math.sin(a) * r;
    return { x, z, y: walkHeight(x, z), a, i };
  }), []);
  const darkMetal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#252b32", metalness: 0.7, roughness: 0.32 }), []);
  const fabric = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9c3d43", roughness: 0.88, side: THREE.DoubleSide }), []);
  const warmLight = useMemo(() => new THREE.MeshStandardMaterial({ color: "#fff0c8", emissive: "#ffc77d", emissiveIntensity: 1.4 }), []);
  const paving = useMemo(() => new THREE.MeshStandardMaterial({ color: "#59616a", roughness: 0.43, metalness: 0.06 }), []);
  return <group name="nexus-street-detail">
    {cafeSites.map((p) => <group key={`cafe-${p.i}`} position={[p.x, p.y, p.z]} rotation-y={-p.a}>
      {/* Terrace surface, parasol and two seats; purely decorative. */}
      <mesh material={paving} position={[0, 0.02, 0]} receiveShadow><boxGeometry args={[3.4, 0.04, 2.7]} /></mesh>
      <mesh material={darkMetal} position={[0, 1.6, 0]} castShadow><cylinderGeometry args={[0.045, 0.055, 3.2, 8]} /></mesh>
      <mesh material={fabric} position={[0, 3.25, 0]} castShadow><coneGeometry args={[1.75, 0.56, 10]} /></mesh>
      <mesh material={warmLight} position={[0, 2.95, 0]}><sphereGeometry args={[0.1, 8, 6]} /></mesh>
      {/* Waste bin, bollard and illuminated strip give scale to the sidewalk. */}
      <mesh material={darkMetal} position={[2.1, 0.46, 0.4]} castShadow><cylinderGeometry args={[0.28, 0.25, 0.92, 12]} /></mesh>
      <mesh material={darkMetal} position={[-2.2, 0.48, -0.9]} castShadow><cylinderGeometry args={[0.12, 0.16, 0.96, 10]} /></mesh>
      <mesh material={warmLight} position={[-2.2, 0.85, -0.9]}><cylinderGeometry args={[0.125, 0.125, 0.1, 10]} /></mesh>
    </group>)}

    {/* Broken, reflective patches and restrained lane dashes follow existing terrain.
        Small segments prevent a flat ring from floating above sloped roads. */}
    {roadMarks.map((p) => <group key={`road-${p.i}`}
      position={[p.x, p.y, p.z]} rotation-y={-p.a}>
      <mesh rotation-x={-Math.PI / 2} material={wetAsphalt} receiveShadow>
        <planeGeometry args={[p.i % 4 === 0 ? 2.8 : 1.25, 0.58]} />
      </mesh>
      {p.i % 4 === 0 && <mesh position={[0, 0.008, 0.7]}
        rotation-x={-Math.PI / 2} material={roadStripe}>
        <planeGeometry args={[1.4, 0.085]} />
      </mesh>}
    </group>)}

    {sites.map((p) => <group key={p.i} position={[p.x, p.y, p.z]} rotation-y={-p.a}>
      {/* Low planters are visually rich without changing collision geometry. */}
      <mesh position={[0, 0.36, 0]} material={planter} receiveShadow castShadow><boxGeometry args={[1.9, 0.72, 0.8]} /></mesh>
      <mesh position={[0, 0.735, 0]} material={soil}><boxGeometry args={[1.7, 0.035, 0.62]} /></mesh>
      {p.i % 2 === 0 && <group position={[2.4, 0, 0]}>
        <mesh material={trim} castShadow position={[0, 2.9, 0]}><cylinderGeometry args={[0.065, 0.09, 5.8, 10]} /></mesh>
        <mesh material={trim} castShadow position={[0.45, 5.7, 0]} rotation-z={-0.16}><boxGeometry args={[1, 0.1, 0.13]} /></mesh>
        <mesh material={glass} position={[0.91, 5.62, 0]}><boxGeometry args={[0.46, 0.075, 0.27]} /></mesh>
      </group>}
    </group>)}
  </group>;
}

const plantersAt = () => Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2, r = NEXUS_HUB_PROMENADE[0] - 1.3, x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
  return { x, y: walkHeight(x, z), z, a, i };
});
const terracesAt = () => Array.from({ length: 8 }, (_, i) => {
  const a = ((i + 0.35) / 8) * Math.PI * 2, r = NEXUS_HUB_PROMENADE[0] + 7.2, x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
  return { x, y: walkHeight(x, z), z, a, i };
});
/** local x offset `o` in a site's frame (the site groups turn by -a) */
const along = (p: { x: number; z: number; a: number }, o: number) => ({ x: p.x + o * Math.cos(-p.a), z: p.z - o * Math.sin(-p.a) });

/** The scanned props of the hub street (instanced GLBs, so drawn outside NexusStreetDetail's MergeStatic, which bakes only plain
 * meshes and would drop models still loading): two leafy plants per planter, two bistro sets per cafe terrace. */
export function NexusStreetScans() {
  const leaves = useMemo<GlbInstance[]>(() => plantersAt().flatMap((p) => [-0.45, 0.45].map((o, k) => ({ ...along(p, o), y: p.y + 0.7, yaw: p.i * 1.7 + k * 2.4, scale: 1.25 + ((p.i + k) % 3) * 0.08 }))), []);
  const cafeSets = useMemo<GlbInstance[]>(() => terracesAt().flatMap((p) => [-0.85, 0.85].map((o, k) => ({ ...along(p, o), y: p.y + 0.04, yaw: -p.a + (k ? Math.PI / 2 : -Math.PI / 2) + 0.2 }))), []);
  return <group name="nexus-street-scans">
    <InstancedGlb url={LEAVES} items={leaves} sway={0.05} />
    <InstancedGlb url={CAFE_SET} items={cafeSets} />
  </group>;
}
