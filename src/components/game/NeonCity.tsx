import { Text } from "./SafeText";
import { DistrictLight } from "./DistrictLight";
import { REGIONS, NEON_OFFSET } from "@/game/world";
import { walkHeight } from "@/game/terrain";
import { ElevatedTrain, LightBar, ShopSign } from "./DistrictStreet";
import { NeonTiers } from "./NeonTiers";
import { NeonGraffiti } from "./NeonGraffiti";
import { NeonRails } from "./NeonRails";
import { SteamVents } from "./SteamVents";
import { MaglevTrains } from "./MaglevTrains";
import { NeonDistricts } from "./NeonDistricts";
import { NeonTowerBlocks } from "./NeonTowerBlocks";
import { NeonPalms } from "./CityPalms";
import { NeonVenues } from "./NeonVenues";
import { WorldPiece } from "./WorldPiece";
import { ResidentialHomes } from "./ResidentialHomes";
import { NEON_FLAT } from "@/game/world";

/**
 * Neon City — the Syndicate's market/cybernetics district bordering Nexus City (per the
 * "Fractured Earth" street-level reference sheet and the fd-06/fd-07 quest beats in quests.ts,
 * which describe it narratively but never gave it a physical footprint). Sits just outside
 * Nexus's own building ring so leaving the hub on foot brings you straight into it.
 *
 * Purely a hand-built visual district (same category as NexusCity.tsx) — no new region entry,
 * no new terrain rules. Reuses the existing tower/block models with neon strip overlays and
 * lit signage instead of new geometry, and registers collision the same way NexusCity does.
 */
const NEXUS = REGIONS.find((r) => r.id === "nexus")!;
export const NEON_CITY_CENTER = { x: NEXUS.x + NEON_OFFSET.x, z: NEXUS.z + NEON_OFFSET.z };

function Billboard({ x, z, y, rotY, label, sub, color }: { x: number; z: number; y: number; rotY: number; label: string; sub?: string; color: string }) {
  return (
    <group position={[x, y, z]} rotation-y={rotY}>
      <mesh>
        <boxGeometry args={[6.4, 3.2, 0.15]} />
        <meshStandardMaterial color="#0a0d12" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.09]}>
        <planeGeometry args={[6, 2.8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} transparent opacity={0.28} />
      </mesh>
      <Text position={[0, sub ? 0.5 : 0, 0.12]} fontSize={0.62} color={color} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000">
        {label}
      </Text>
      {sub && (
        <Text position={[0, -0.55, 0.12]} fontSize={0.3} color="#d8f4ff" anchorX="center" anchorY="middle">
          {sub}
        </Text>
      )}
    </group>
  );
}

function NeonMarketStreet({ y }: { y: number }) {
  const shopColors = ["#38e8ff", "#ff2ea6", "#ffcf3a", "#39ff7a"];
  return (
    <group position={[NEON_CITY_CENTER.x, y, NEON_CITY_CENTER.z]}>
      {/* Broad traversable avenue, rain channels and inset guidance strips. */}
      <mesh position-y={0.08} receiveShadow><boxGeometry args={[19, 0.34, 66]} /><meshStandardMaterial color="#13171d" metalness={0.55} roughness={0.4} /></mesh>
      <mesh position-y={0.27} receiveShadow><boxGeometry args={[9.5, 0.08, 64]} /><meshStandardMaterial color="#26313a" metalness={0.45} roughness={0.48} /></mesh>
      {[-4.3, 4.3].map((x) => <LightBar key={x} position={[x, 0.34, 0]} size={[0.13, 0.04, 62]} color={x < 0 ? "#ff2ea6" : "#38e8ff"} />)}
      {Array.from({ length: 11 }, (_, i) => <group key={i} position-z={-29 + i * 5.8}>
        <LightBar position={[0, 0.34, 0]} size={[1.3, 0.025, 0.08]} color="#576977" />
        <mesh position={[-7.4, 1.7, 0]}><cylinderGeometry args={[0.12, 0.18, 3.4, 7]} /><meshStandardMaterial color="#3a4650" metalness={0.8} roughness={0.3} /></mesh>
        {i % 3 === 0 && <DistrictLight position={[-7.4, 3.3, 0]} color={i % 2 ? "#ff2ea6" : "#38e8ff"} intensity={3.5} distance={9} />}
      </group>)}
      {/* Two levels of stalls and balconies on both sides, with the center kept open for combat and vehicles. */}
      {[-1, 1].map((side) => <group key={side} position-x={side * 8.1}>
        {[0.7, 4.4].map((level, levelIndex) => <group key={level} position-y={level}>
          <mesh receiveShadow><boxGeometry args={[5.5, 0.38, 62]} /><meshStandardMaterial color={levelIndex ? "#222832" : "#292630"} metalness={0.56} roughness={0.42} /></mesh>
          <mesh position={[-side * 2.55, 0.75, 0]}><boxGeometry args={[0.15, 1.35, 62]} /><meshStandardMaterial color="#53616d" metalness={0.75} roughness={0.27} /></mesh>
          <LightBar position={[-side * 2.66, -0.05, 0]} size={[0.1, 0.1, 61]} color={side < 0 ? "#ff2ea6" : "#38e8ff"} />
          {[-24, -12, 0, 12, 24].map((z, stallIndex) => {
            const stallColor = shopColors[stallIndex % shopColors.length] ?? "#38e8ff";
            return <group key={z} position={[side * 0.1, 1.15, z]}>
            <mesh><boxGeometry args={[4.5, 2.15, 9.5]} /><meshStandardMaterial color="#151b22" roughness={0.48} metalness={0.5} /></mesh>
            <mesh position={[-side * 2.28, 0.05, 0]}><boxGeometry args={[0.06, 1.55, 7.5]} /><meshPhysicalMaterial color={stallColor} transparent opacity={0.25} roughness={0.1} depthWrite={false} /></mesh>
            <LightBar position={[-side * 2.36, 1.05, 0]} size={[0.08, 0.11, 8.5]} color={stallColor} />
          </group>})}
        </group>)}
      </group>)}
      <ShopSign label="SYNTH-COFFEE" color="#ffcf3a" position={[-5.25, 3.3, -20]} />
      <ShopSign label="CYBERNETICS" color="#ff2ea6" position={[5.25, 7.05, -4]} face={-1} />
      <ShopSign label="DATA SHARDS" color="#38e8ff" position={[-5.25, 6.9, 13]} />
      <ShopSign label="NEON CORE" color="#39ff7a" position={[5.25, 3.35, 24]} face={-1} />
      <ElevatedTrain length={68} height={11.8} accent="#38e8ff" dark="#222631" />
      {/* Suspended crosswalks make the stacked market read as one connected public space. */}
      {[-17, 16].map((z, i) => <group key={z} position={[0, 7.2, z]}>
        <mesh receiveShadow><boxGeometry args={[13.5, 0.28, 2.2]} /><meshStandardMaterial color="#353b47" metalness={0.65} roughness={0.32} /></mesh>
        <LightBar position={[0, -0.08, 1.05]} size={[13, 0.07, 0.07]} color={i ? "#ff2ea6" : "#38e8ff"} />
      </group>)}
      <DistrictLight position={[0, 5, -13]} color="#ffb36b" intensity={19} distance={34} decay={2} />
      <DistrictLight position={[0, 7, 19]} color="#ffc98a" intensity={18} distance={36} decay={2} />
    </group>
  );
}

export function NeonCity() {
  const y = walkHeight(NEON_CITY_CENTER.x, NEON_CITY_CENTER.z);
  return (
    <group>
      {/* the skyline: authored towers on the street grid across the whole city plateau (neon-layout.ts) */}
      <NeonTowerBlocks />
      <WorldPiece name="neon palms"><NeonPalms /></WorldPiece>
      <WorldPiece name="neon venues"><NeonVenues /></WorldPiece>
      <ResidentialHomes city="neon" />
      <NeonMarketStreet y={y} />
      <NeonTiers c={NEON_CITY_CENTER} />
      <NeonGraffiti c={NEON_CITY_CENTER} />
      <NeonRails c={NEON_CITY_CENTER} />
      <SteamVents c={NEON_CITY_CENTER} />
      <MaglevTrains c={NEON_CITY_CENTER} />
      <NeonDistricts c={NEON_CITY_CENTER} />
      {/* street level: the whole plateau is paved */}
      <mesh position={[NEON_CITY_CENTER.x, y + 0.04, NEON_CITY_CENTER.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[NEON_FLAT - 2, 96]} />
        {/* wet asphalt under the acid rain: glossy so the neon smears across it */}
        <meshStandardMaterial color="#120a1c" roughness={0.28} metalness={0.4} />
      </mesh>
      <DistrictLight position={[NEON_CITY_CENTER.x, y + 8, NEON_CITY_CENTER.z]} color="#ffb36b" intensity={18} distance={60} decay={2} />
      <DistrictLight position={[NEON_CITY_CENTER.x - 20, y + 8, NEON_CITY_CENTER.z + 15]} color="#ffc98a" intensity={16} distance={50} decay={2} />
      <Billboard x={NEON_CITY_CENTER.x} y={y + 21} z={NEON_CITY_CENTER.z - 30} rotY={0} label="THE FRACTURED EARTH" sub="NEXUS CITY · SAFE ZONE / HUB — NEON CITY · ZONE UNKNOWN" color="#38e8ff" />
      <Billboard x={NEON_CITY_CENTER.x + 34} y={y + 10} z={NEON_CITY_CENTER.z + 4} rotY={-Math.PI / 2.4} label="NEON CITY MARKET" sub="CYBERNETICS & MODS" color="#ff2ea6" />
      <Billboard x={NEON_CITY_CENTER.x - 34} y={y + 9} z={NEON_CITY_CENTER.z + 10} rotY={Math.PI / 2.4} label="SYNTH-COFFEE" sub="& DATA-SHARDS" color="#ffcf3a" />
    </group>
  );
}
