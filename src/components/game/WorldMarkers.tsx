import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { heightAt } from "@/game/terrain";
import { BOSS_LAIRS, MARKER_COLOR, RESOURCE_SITES } from "@/game/waypoints";

/** In-world beacons for resource sites and boss lairs; depleted sites dim until they respawn. */
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
      {RESOURCE_SITES.map((site) => (
        <group key={site.id} ref={(g) => { groups.current[site.id] = g; }} position={[site.x, heightAt(site.x, site.z) + 1.2, site.z]}>
          <mesh castShadow><icosahedronGeometry args={[0.8, 0]} /><meshStandardMaterial color={MARKER_COLOR.RESOURCE} emissive={MARKER_COLOR.RESOURCE} emissiveIntensity={1.6} roughness={0.3} /></mesh>
          <mesh position={[0, 14, 0]}><cylinderGeometry args={[0.08, 0.08, 28, 6]} /><meshBasicMaterial color={MARKER_COLOR.RESOURCE} transparent opacity={0.35} /></mesh>
        </group>
      ))}
      {BOSS_LAIRS.map((lair) => (
        <group key={lair.id} position={[lair.x, heightAt(lair.x, lair.z), lair.z]}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.15, 0]}><ringGeometry args={[8.5, 10, 48]} /><meshBasicMaterial color={MARKER_COLOR.BOSS} transparent opacity={0.6} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 25, 0]}><cylinderGeometry args={[0.25, 0.25, 50, 6]} /><meshBasicMaterial color={MARKER_COLOR.BOSS} transparent opacity={0.4} /></mesh>
          <Billboard position={[0, 6, 0]}><Text fontSize={1.4} color={MARKER_COLOR.BOSS} outlineWidth={0.06} outlineColor="#000000">{`☠ ${lair.label}`}</Text></Billboard>
        </group>
      ))}
    </group>
  );
}
