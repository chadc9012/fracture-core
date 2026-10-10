import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { heightAt } from "@/game/terrain";
import { ruins } from "@/game/weapon-evolution";
import { BOSS_LAIRS, MARKER_COLOR, RESOURCE_SITES } from "@/game/waypoints";

/** In-world beacons for resource sites and boss lairs; depleted sites dim until they respawn. */
const RUIN_GLOW = { THERMAL: "#ff7a2e", CRYO: "#7fd8ff", BIO: "#7dff8a", ARC: "#9b8cff", KINETIC: "#ffb23e" } as const;
/** Procedural ruin: a ring of broken pillars around a floating, glowing core. Presentation only (weapon-evolution.ts owns the rules). */
function RuinSites() {
  return (
    <group>
      {ruins().map((r) => {
        const glow = RUIN_GLOW[r.element];
        return (
          <group key={r.id} position={[r.x, heightAt(r.x, r.z), r.z]}>
            {Array.from({ length: 7 }, (_, i) => {
              const a = (i / 7) * Math.PI * 2, h = 3 + ((i * 37) % 5);
              return <mesh key={i} position={[Math.cos(a) * 5, h / 2, Math.sin(a) * 5]} rotation={[0, a, (i % 3 - 1) * 0.08]} castShadow><boxGeometry args={[1.1, h, 1.1]} /><meshStandardMaterial color="#5b5a58" roughness={0.95} /></mesh>;
            })}
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.12, 0]}><ringGeometry args={[1.2, 5.8, 40]} /><meshStandardMaterial color="#3d3c3b" roughness={1} emissive={glow} emissiveIntensity={0.15} /></mesh>
            <mesh position={[0, 2.4, 0]}><octahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2.2} roughness={0.2} /></mesh>
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
