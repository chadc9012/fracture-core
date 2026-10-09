import { RoundedBox } from "@react-three/drei";
import type { Motif, SlotLook } from "@/game/armor-look";

/**
 * A set's signature piece detail (armor-look.ts SET_MOTIFS), drawn in the set's color. Positions are
 * relative to the group it is mounted in (helmet group, forearm group, leg group, or the body), so limb
 * motifs swing with the limb. `side` is -1 / 1 for paired parts.
 */
const BEVEL = 5;

export function ArmorMotif({ look, side = 1 }: { look: SlotLook | undefined; side?: number }) {
  if (!look) return null;
  const m: Motif = look.motif;
  const mat = <meshStandardMaterial color={look.color} metalness={0.8} roughness={0.3} emissive={look.color} emissiveIntensity={0.35} toneMapped={false} />;
  switch (m) {
    case "crest": return <RoundedBox args={[0.04, 0.18, 0.26]} radius={0.015} smoothness={BEVEL} position={[0, 0.27, -0.02]} rotation={[0.25, 0, 0]} castShadow>{mat}</RoundedBox>;
    case "horns": return <>{[-1, 1].map((s) => <mesh key={s} position={[s * 0.19, 0.17, 0]} rotation={[0, 0, s * -0.9]} castShadow><coneGeometry args={[0.035, 0.2, 8]} />{mat}</mesh>)}</>;
    case "slit": return <mesh position={[0, 0.04, 0.215]}><boxGeometry args={[0.025, 0.2, 0.02]} />{mat}</mesh>;
    case "spine": return <>{[0.5, 0.4, 0.3, 0.2].map((y, i) => <RoundedBox key={y} args={[0.06 - i * 0.008, 0.05, 0.05]} radius={0.015} smoothness={BEVEL} position={[0, y, 0.26]} castShadow>{mat}</RoundedBox>)}</>;
    case "plates": return <>{[-1, 1].map((s) => <RoundedBox key={s} args={[0.2, 0.3, 0.05]} radius={0.03} smoothness={BEVEL} position={[s * 0.19, 0.3, 0.25]} rotation={[0, s * -0.35, 0]} castShadow>{mat}</RoundedBox>)}</>;
    case "core": return <mesh position={[0, 0.3, 0.3]} rotation={[0, 0, 0]}><torusGeometry args={[0.1, 0.018, 8, 22]} />{mat}</mesh>;
    case "spikes": return <>{[-0.045, 0, 0.045].map((x) => <mesh key={x} position={[side * 0.07 + x, -0.38, 0.13]} rotation={[Math.PI / 2, 0, 0]} castShadow><coneGeometry args={[0.018, 0.09, 6]} />{mat}</mesh>)}</>;
    case "bands": return <>{[-0.12, -0.28].map((y) => <mesh key={y} position={[side * 0.07, y, 0.02]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.105, 0.016, 8, 20]} />{mat}</mesh>)}</>;
    case "greaves": return <RoundedBox args={[0.06, 0.36, 0.12]} radius={0.025} smoothness={BEVEL} position={[side * 0.14, -0.62, 0.02]} castShadow>{mat}</RoundedBox>;
    case "fins": return <RoundedBox args={[0.03, 0.3, 0.14]} radius={0.01} smoothness={BEVEL} position={[side * 0.14, -1.14, -0.02]} rotation={[0.2, 0, side * 0.2]} castShadow>{mat}</RoundedBox>;
    case "sash": return <RoundedBox args={[0.9, 0.07, 0.04]} radius={0.02} smoothness={BEVEL} position={[0, 0.3, 0.27]} rotation={[0, 0, 0.6]} castShadow>{mat}</RoundedBox>;
    case "banner": return <RoundedBox args={[0.16, 0.4, 0.03]} radius={0.015} smoothness={BEVEL} position={[0.3, -0.52, 0.2]} castShadow>{mat}</RoundedBox>;
    case "mantle": return <mesh position={[0, 0.5, -0.22]} rotation={[0.15, 0, 0]}><planeGeometry args={[0.9, 0.5]} /><meshStandardMaterial color={look.color} metalness={0.2} roughness={0.8} side={2} emissive={look.color} emissiveIntensity={0.15} /></mesh>;
  }
}
