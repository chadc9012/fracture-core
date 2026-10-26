import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { prepareWorldAsset } from "@/game/asset-render-quality";
import * as THREE from "three";
import { Text } from "./SafeText";
import type { PlayerProgression } from "@/game/progression";
import { HALL_URL, LAMPS, RIVERDALE, RIVERDALE_HALL, SIGN, TOWER, boardwalkBoxes, boardwalkDeck, boardwalkFrame, townBoxes, townLevel, townWalls } from "@/game/riverdale";
import { setWalls, clearWalls } from "@/game/walls";
import { registerDeck } from "@/game/district-decks";
import { mergeByMat, ResidentialHomes } from "./ResidentialHomes";
import { ResidenceGarages } from "./ResidenceGarages";
import { DistrictLight } from "./DistrictLight";

/**
 * Riverdale (layout in src/game/riverdale.ts and residences.ts): Aetheria's river town on the Verdant landmass. The square,
 * clock tower, benches, lamps, streets and welcome sign merge into a few meshes; the boardwalk out to the river jetty is
 * its own merged piece turned to its bearing. Homes and garages are the shared walk-in residences. Lamps and the clock
 * faces light at dusk through DistrictLight like every other street light.
 */
export function RiverdaleTown({ progression }: { progression?: PlayerProgression | undefined }) {
  const level = townLevel();
  const meshes = useMemo(() => {
    const at = { x: RIVERDALE.x, z: RIVERDALE.z, floor: level, rot: 0 }, bw = boardwalkFrame();
    return [...mergeByMat(townBoxes().map((b) => ({ b, at })), "riverdale:town"), ...mergeByMat(boardwalkBoxes().map((b) => ({ b, at: bw })), "riverdale:boardwalk")];
  }, [level]);
  useEffect(() => () => { for (const m of meshes) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }, [meshes]);
  useEffect(() => {
    setWalls("riverdale-town", townWalls());
    registerDeck(boardwalkDeck());
    return () => clearWalls("riverdale-town");
  }, []);
  return (
    <group name="riverdale">
      {meshes.map((m) => <primitive key={m.name} object={m} />)}
      <ResidentialHomes city="riverdale" />
      <Suspense fallback={null}><CornerBlock level={level} /></Suspense>
      {progression && <ResidenceGarages city="riverdale" progression={{ nexLedger: progression.nexLedger ?? {}, housing: progression.housing, fleet: progression.fleet }} />}
      {/* the welcome sign's lettering, on the face toward the road in (west) */}
      <group position={[RIVERDALE.x + SIGN.x - 0.1, level + 2.3, RIVERDALE.z + SIGN.z]} rotation={[0, -Math.PI / 2, 0]}>
        <Text fontSize={0.62} color="#f3ead2" anchorX="center" anchorY="middle" position={[0, 0.18, 0]} letterSpacing={0.12}>RIVERDALE</Text>
        <Text fontSize={0.24} color="#bcd7c2" anchorX="center" anchorY="middle" position={[0, -0.32, 0]}>Aetheria · on the Verdant river</Text>
      </group>
      {LAMPS.slice(0, 4).map(([x, z]) => <DistrictLight key={`${x},${z}`} range={60} position={[RIVERDALE.x + x, level + 4.4, RIVERDALE.z + z]} color="#ffd9a0" intensity={7} distance={16} decay={1.6} castShadow={false} />)}
      <DistrictLight range={90} position={[RIVERDALE.x, level + TOWER.height - 1.2, RIVERDALE.z]} color="#fff1cc" intensity={5} distance={14} decay={1.6} castShadow={false} />
    </group>
  );
}

/** the Paris-style corner block on the square (world.ts RIVERDALE_HALL): scaled to its footprint, both facades toward the square */
function CornerBlock({ level }: { level: number }) {
  const { scene } = useGLTF(HALL_URL);
  const obj = useMemo(() => { const o = scene.clone(true); prepareWorldAsset(o, { castShadow: true, receiveShadow: true, anisotropy: 8 }); return o; }, [scene]);
  const H = RIVERDALE_HALL;
  return <primitive object={obj} position={[H.x, level - 0.2, H.z]} rotation={[0, H.yaw, 0]} />;
}
