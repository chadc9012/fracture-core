import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { heightAt } from "@/game/terrain";
import { DistrictLight } from "./DistrictLight";
import { ruins } from "@/game/weapon-evolution";
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";
import { chippedBlock, flutedColumn, organicRock } from "@/game/organic-geometry";
import { crystalShard } from "@/game/camp-geometry";
import { BOSS_LAIRS, MARKER_COLOR, RESOURCE_SITES } from "@/game/waypoints";

/** In-world beacons for resource sites and boss lairs; depleted sites dim until they respawn. */
const RUIN_GLOW = { THERMAL: "#ff7a2e", CRYO: "#7fd8ff", BIO: "#7dff8a", ARC: "#9b8cff", KINETIC: "#ffb23e" } as const;
/** Ruin site: a ring of broken fluted columns (some fallen) on a cracked flagstone floor that follows the ground,
 * rubble, and a floating crystal core. Presentation only (weapon-evolution.ts owns the rules). Built from the
 * organic-geometry set pieces and weathered stone, so no flat disc floats over slopes. */
const RUIN_GEO = (() => {
  const columns = [0, 1, 2].map((i) => flutedColumn(1, 0.42, 11 + i));
  return { columns, slab: chippedBlock(1.6, 0.28, 1.6, 7), drum: chippedBlock(0.9, 0.7, 0.9, 13), rubble: organicRock(0.45, 21, 1, 0.14), core: crystalShard(9) };
})();
let ruinStone: THREE.MeshStandardMaterial | null = null;
const stone = () => (ruinStone ??= applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#8a857c", roughness: 0.95 }), weatheredConcreteTexture(), 3));
const hh = (n: number) => { const v = Math.sin(n * 91.7 + 13.1) * 43758.5; return v - Math.floor(v); };
function RuinSites() {
  return (
    <group>
      {ruins().map((r, ri) => {
        const glow = RUIN_GLOW[r.element], base = heightAt(r.x, r.z);
        const local = (dx: number, dz: number) => heightAt(r.x + dx, r.z + dz) - base;
        // cracked flagstones on a 1.7 m grid inside the column ring, a few missing
        const flags: [number, number, number][] = [];
        for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) { const x = gx * 1.7, z = gz * 1.7; if (Math.hypot(x, z) > 5.6 || hh(ri * 97 + gx * 7 + gz) < 0.12) continue; flags.push([x, z, hh(ri + gx * 3 + gz * 5)]); }
        return (
          <group key={r.id} position={[r.x, base, r.z]}>
            {Array.from({ length: 7 }, (_, i) => {
              const a = (i / 7) * Math.PI * 2, x = Math.cos(a) * 5, z = Math.sin(a) * 5, h = 2.4 + ((i * 37) % 5) * 0.9, y = local(x, z);
              const fallen = (i + ri) % 4 === 3;
              return fallen
                ? <group key={i}>
                    <mesh geometry={RUIN_GEO.drum} material={stone()} position={[x, y + 0.3, z]} rotation={[0, a, 0]} castShadow receiveShadow />
                    <mesh geometry={RUIN_GEO.columns[i % 3]!} material={stone()} position={[x + Math.cos(a + 1.4) * 0.6, y + 0.4, z + Math.sin(a + 1.4) * 0.6]} rotation={[0, a + 1.4, Math.PI / 2 - 0.06]} scale={[1, h * 0.8, 1]} castShadow receiveShadow />
                  </group>
                : <mesh key={i} geometry={RUIN_GEO.columns[i % 3]!} material={stone()} position={[x, y - 0.15, z]} rotation={[(i % 3 - 1) * 0.05, a, (i % 2 ? 1 : -1) * 0.04]} scale={[1, h, 1]} castShadow receiveShadow />;
            })}
            {flags.map(([x, z, n], i) => <mesh key={`f${i}`} geometry={RUIN_GEO.slab} material={stone()} position={[x, local(x, z) - 0.06, z]} rotation={[(n - 0.5) * 0.08, n * 3, (0.5 - n) * 0.06]} receiveShadow />)}
            {Array.from({ length: 6 }, (_, i) => { const a = hh(ri * 13 + i) * 6.28, d = 3 + hh(ri * 7 + i) * 4, x = Math.cos(a) * d, z = Math.sin(a) * d; return <mesh key={`r${i}`} geometry={RUIN_GEO.rubble} material={stone()} position={[x, local(x, z) + 0.12, z]} scale={0.6 + hh(i + ri) * 0.9} rotation={[i, i * 2, 0]} castShadow receiveShadow />; })}
            {/* the element's glow pooled on the floor, and the core itself */}
            <DistrictLight position={[0, 2.4, 0]} color={glow} intensity={6} distance={9} decay={2} range={70} />
            <mesh geometry={RUIN_GEO.core} position={[0, 2.4, 0]} scale={[0.55, 1.6, 0.55]}><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2.2} roughness={0.2} flatShading /></mesh>
            <mesh position={[0, 20, 0]}><cylinderGeometry args={[0.1, 0.1, 40, 6]} /><meshBasicMaterial color={glow} transparent opacity={0.22} depthWrite={false} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

export function WorldMarkers({ depleted }: { depleted: React.MutableRefObject<Record<string, number>> }) {
  const groups = useRef<Record<string, THREE.Group | null>>({});
  useFrame(({ clock }) => {
    const now = performance.now();
    for (const site of RESOURCE_SITES) {
      const g = groups.current[site.id]; if (!g) continue;
      const empty = (depleted.current[site.id] ?? 0) > now;
      g.scale.setScalar(empty ? 0.5 : 1);
      g.children[0]?.rotateY(0.02);
      g.position.y = heightAt(site.x, site.z) + 1.2 + Math.sin(clock.elapsedTime * 2 + site.x) * 0.2;
    }
  });
  return (
    <group>
      <RuinSites />
      {RESOURCE_SITES.map((site) => (
        <group key={site.id} ref={(g) => { groups.current[site.id] = g; }} position={[site.x, heightAt(site.x, site.z) + 1.2, site.z]}>
          <mesh castShadow><icosahedronGeometry args={[0.8, 0]} /><meshStandardMaterial color={MARKER_COLOR.RESOURCE} emissive={MARKER_COLOR.RESOURCE} emissiveIntensity={1.6} roughness={0.3} /></mesh>
          <mesh position={[0, 14, 0]}><cylinderGeometry args={[0.08, 0.08, 28, 6]} /><meshBasicMaterial color={MARKER_COLOR.RESOURCE} transparent opacity={0.35} /></mesh>
        </group>
      ))}
      {BOSS_LAIRS.map((lair) => (
        <group key={lair.id} position={[lair.x, heightAt(lair.x, lair.z), lair.z]}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.15, 0]}><ringGeometry args={[8.5, 10, 48]} /><meshBasicMaterial color={MARKER_COLOR.BOSS} transparent opacity={0.6} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 25, 0]}><cylinderGeometry args={[0.15, 0.15, 50, 6]} /><meshBasicMaterial color={MARKER_COLOR.BOSS} transparent opacity={0.3} depthWrite={false} /></mesh>
        </group>
      ))}
    </group>
  );
}
