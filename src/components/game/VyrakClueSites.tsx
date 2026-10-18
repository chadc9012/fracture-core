import { memo, useMemo } from "react";
import { VYRAK_CLUE_SITES, clueSiteWorld } from "@/game/vyrak-site";
import { walkHeight } from "@/game/terrain";

/** The two world clues that point to Vyrak's hidden lair: a carved monolith (Solara) and a cold campfire with a journal (Wastelands). */
export const VyrakClueSites = memo(function VyrakClueSites() {
  const sites = useMemo(() => VYRAK_CLUE_SITES.map((s) => { const w = clueSiteWorld(s); return { ...s, x: w.x, z: w.z, y: walkHeight(w.x, w.z) }; }), []);
  return (
    <group>
      {sites.map((s) => s.clueId === "inscription" ? (
        <group key={s.clueId} position={[s.x, s.y, s.z]}>
          <mesh position={[0, 1.6, 0]}><boxGeometry args={[1.4, 3.2, 0.6]} /><meshStandardMaterial color="#6b5a48" roughness={0.9} /></mesh>
          <mesh position={[0, 2.2, 0.32]}><boxGeometry args={[0.8, 1.1, 0.04]} /><meshStandardMaterial color="#1a0f2a" emissive="#b07bff" emissiveIntensity={1.4} toneMapped={false} /></mesh>
          <pointLight position={[0, 2.4, 1]} color="#b07bff" intensity={6} distance={9} />
        </group>
      ) : (
        <group key={s.clueId} position={[s.x, s.y, s.z]}>
          {[0, 1, 2, 3, 4].map((i) => <mesh key={i} position={[Math.cos(i * 1.26) * 0.7, 0.18, Math.sin(i * 1.26) * 0.7]}><dodecahedronGeometry args={[0.28]} /><meshStandardMaterial color="#3a3530" roughness={1} /></mesh>)}
          <mesh position={[0, 0.4, 0]}><coneGeometry args={[0.35, 0.7, 6]} /><meshStandardMaterial color="#2a1308" emissive="#ff7a2a" emissiveIntensity={0.7} toneMapped={false} /></mesh>
          <mesh position={[1.1, 0.12, 0.2]} rotation={[0, 0.5, 0]}><boxGeometry args={[0.5, 0.06, 0.7]} /><meshStandardMaterial color="#c9b88c" /></mesh>
          <pointLight position={[0, 1, 0]} color="#ff7a2a" intensity={4} distance={8} />
        </group>
      ))}
    </group>
  );
});
