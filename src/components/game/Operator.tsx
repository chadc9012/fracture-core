import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { ClassId } from "@/game/loadout";
import type { ArmorVisualState } from "./Scavenger";

/**
 * Sleek armored operative matching the class reference sheets: dark glossy plate over a suit,
 * glowing circuit seams, a band visor. Titan carries a tower shield, Hunter a torn scarf and holsters,
 * Warlock tech goggles and an orbiting drone. Same footprint as the old field model (feet ≈ -1.55, head ≈ 1.2).
 *
 * Plate edges use a higher RoundedBox `smoothness` and joints use higher-segment spheres/capsules
 * than the original cut, specifically to soften the faceted "boxy" silhouette the reference art
 * doesn't have — same low part count and procedural (no GLB) build, just rounder primitives and a
 * few extra greebles (elbow pads, a boot sole strip, a split toe cap) to break up flat panel faces.
 */
const BEVEL = 6; // RoundedBox corner smoothness — up from drei's default 4, for softer edges

/** Equipped-gear tier from an item's upgrade level (gearCost/upgradeGear in inventory.ts step
 * level 1 -> 2 -> 3... at 2x materials per step), used to pick which of three geometry sets a
 * slot renders — not a color swap: T2/T3 add real plates/vents/crests the base model doesn't
 * have, T1 is the bare starter silhouette. 1 = starter, 2 = upgraded, 3 = max-tier. */
function tierOf(level: number): 1 | 2 | 3 {
  return level >= 6 ? 3 : level >= 3 ? 2 : 1;
}

export function Operator({
  armor = "#1b1f26",
  cloth = "#0e1014",
  visor = "#48d8ff",
  trim: trimColor = "#1a1c20",
  classId = "TITAN",
  visualState = "STABLE",
  chestLevel = 1,
  helmetLevel = 1,
  legsLevel = 1,
  motion,
}: {
  armor?: string;
  cloth?: string;
  visor?: string;
  /** Greeble/plate-trim accent color (collar plates, ridges, shin guards, brow ridge, antennae).
   * Was a hardcoded dark gunmetal; now a 4th customizable channel alongside armor/cloth/visor. */
  trim?: string;
  classId?: ClassId;
  visualState?: ArmorVisualState;
  /** Upgrade level of the equipped chest/helmet/legs gear (PlayerProgression.inventory's
   * GearItem.level for whatever's in equippedGear.chest/.helmet/.legs) — drives real geometry,
   * not a tint: see tierOf(). Defaults to 1 (starter gear / no progression context, e.g. Identity
   * Forge preview) for every slot. */
  chestLevel?: number;
  helmetLevel?: number;
  legsLevel?: number;
  /** live stride from movement-feel.ts (Scene writes it each frame); absent in static previews */
  motion?: { current: { phase: number; intensity: number; swing: number; lean: number; air: boolean } };
}) {
  const chestTier = tierOf(chestLevel);
  const helmetTier = tierOf(helmetLevel);
  const legsTier = tierOf(legsLevel);
  const trim = <meshStandardMaterial color={trimColor} metalness={0.85} roughness={0.25} />;
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const drone = useRef<THREE.Group>(null);
  const orbit = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const cloak = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    const base = visualState === "ASCENDANT" ? 5 : visualState === "FRACTURE" ? 4 : visualState === "ACTIVE" ? 3 : 2.2;
    if (glow.current) glow.current.emissiveIntensity = base + Math.sin(clock.elapsedTime * 3) * 0.5;
    if (drone.current) { const t = clock.elapsedTime; drone.current.position.set(Math.cos(t * 0.9) * 0.9, 1.45 + Math.sin(t * 2) * 0.08, Math.sin(t * 0.9) * 0.9 - 0.2); drone.current.rotation.y = -t * 0.9; }
    // walk/run cycle: legs and arms counter-swing on the shared stride phase, torso leans into speed,
    // the whole body bobs with each footfall; airborne tucks the legs
    const m = motion?.current;
    if (m) {
      const amp = m.swing * Math.min(1, m.intensity * 3);
      const ph = m.phase;
      const air = m.air;
      if (legL.current) legL.current.rotation.x += ((air ? -0.55 : Math.sin(ph) * amp) - legL.current.rotation.x) * Math.min(1, delta * 18);
      if (legR.current) legR.current.rotation.x += ((air ? 0.35 : -Math.sin(ph) * amp) - legR.current.rotation.x) * Math.min(1, delta * 18);
      if (armL.current) armL.current.rotation.x += ((air ? -0.7 : -Math.sin(ph) * amp * 0.8) - armL.current.rotation.x) * Math.min(1, delta * 18);
      if (armR.current) armR.current.rotation.x += ((air ? -0.4 : Math.sin(ph) * amp * 0.25) - armR.current.rotation.x) * Math.min(1, delta * 18);
      if (body.current) {
        body.current.rotation.x += (m.lean - body.current.rotation.x) * Math.min(1, delta * 10);
        body.current.position.y = Math.abs(Math.sin(ph)) * 0.05 * m.intensity;
        body.current.rotation.y = Math.sin(ph) * 0.06 * m.intensity;
      }
    }
    if (orbit.current) orbit.current.rotation.y += delta * 1.2;
    if (rings.current) { rings.current.rotation.y += delta * 0.9; rings.current.rotation.x = Math.sin(clock.elapsedTime * 0.8) * 0.25; }
    if (cloak.current) cloak.current.rotation.x = 0.1 + Math.sin(clock.elapsedTime * 1.6) * 0.04;
  });
  const plateColor = new THREE.Color("#12151a").lerp(new THREE.Color(armor), 0.28).getStyle();
  const suitColor = new THREE.Color("#07080a").lerp(new THREE.Color(cloth), 0.2).getStyle();
  const titan = classId === "TITAN", hunter = classId === "HUNTER", warlock = classId === "WARLOCK";
  const bulk = titan ? 1.14 : hunter ? 0.92 : 1;
  const plate = <meshPhysicalMaterial color={plateColor} metalness={0.75} roughness={0.28} clearcoat={0.8} clearcoatRoughness={0.25} />;
  const suit = <meshStandardMaterial color={suitColor} metalness={0.2} roughness={0.75} />;
  const line = <meshStandardMaterial ref={glow} color={visor} emissive={visor} emissiveIntensity={2.2} toneMapped={false} />;
  const seam = (key: string, p: [number, number, number], s: [number, number, number], r: [number, number, number] = [0, 0, 0]) =>
    <mesh key={key} position={p} rotation={r}><boxGeometry args={s} /><meshStandardMaterial color={visor} emissive={visor} emissiveIntensity={2.4} toneMapped={false} /></mesh>;

  return (
    <group ref={body} scale={[bulk, 1, bulk]}>
      {/* legs: suit capsule + thigh/shin plates + knee caps + boots */}
      {[-0.19, 0.19].map((x) => (
        <group key={x} ref={x < 0 ? legL : legR} position={[x, -0.45, 0]}><group position={[0, 0.45, 0]}>
          <mesh position={[0, -0.95, 0]} castShadow><capsuleGeometry args={[0.12, 0.95, 8, 16]} />{suit}</mesh>
          <RoundedBox args={[0.24, 0.42, 0.25]} radius={0.07} smoothness={BEVEL} position={[0, -0.62, 0.02]} castShadow>{plate}</RoundedBox>
          <RoundedBox args={legsTier >= 3 ? [0.25, 0.46, 0.27] : [0.21, 0.44, 0.23]} radius={0.07} smoothness={BEVEL} position={[0, -1.16, 0.03]} castShadow>{plate}</RoundedBox>
          <mesh position={[0, -0.88, 0.16]} castShadow><sphereGeometry args={[legsTier >= 2 ? 0.135 : 0.11, 16, 14]} />{plate}</mesh>
          {/* legs tier 2+: a real shin-guard overlay plate — not on the base shin below upgrade level 3 */}
          {legsTier >= 2 && <RoundedBox args={[0.14, 0.3, 0.06]} radius={0.025} smoothness={BEVEL} position={[0, -1.1, 0.17]} castShadow>{trim}</RoundedBox>}
          {/* legs tier 3: a knee spike */}
          {legsTier >= 3 && <mesh position={[0, -0.86, 0.22]} rotation={[Math.PI / 2, 0, 0]} castShadow><coneGeometry args={[0.035, 0.12, 8]} />{trim}</mesh>}
          <RoundedBox args={[0.26, 0.16, 0.38]} radius={0.05} smoothness={BEVEL} position={[0, -1.47, 0.03]} castShadow><meshStandardMaterial color="#0b0d10" roughness={0.6} /></RoundedBox>
          {/* split toe cap — breaks up the flat single boot-box silhouette */}
          <RoundedBox args={[0.26, 0.1, 0.1]} radius={0.04} smoothness={BEVEL} position={[0, -1.46, 0.27]} castShadow><meshStandardMaterial color="#0b0d10" roughness={0.6} /></RoundedBox>
          <mesh position={[0, -1.52, 0.1]} castShadow><boxGeometry args={[0.28, 0.025, 0.46]} /><meshStandardMaterial color="#06070a" roughness={0.8} /></mesh>
          {seam(`shin${x}`, [x > 0 ? 0.1 : -0.1, -1.14, 0.12], [0.02, 0.34, 0.02])}
        </group></group>
      ))}
      {/* hips + belt */}
      <RoundedBox args={[0.56, 0.24, 0.34]} radius={0.08} smoothness={BEVEL} position={[0, -0.4, 0]} castShadow>{suit}</RoundedBox>
      <mesh position={[0, -0.34, 0]} castShadow><boxGeometry args={[0.6, 0.07, 0.38]} /><meshStandardMaterial color="#07080a" metalness={0.6} roughness={0.4} /></mesh>
      {/* torso: tapered suit + layered chest cuirass + abdomen segments */}
      <mesh position={[0, 0.1, 0]} castShadow><capsuleGeometry args={[0.26, 0.6, 10, 20]} />{suit}</mesh>
      <RoundedBox args={chestTier >= 3 ? [0.72, 0.52, 0.44] : [0.66, 0.46, 0.4]} radius={0.12} smoothness={BEVEL} position={[0, 0.32, 0.03]} castShadow>{plate}</RoundedBox>
      {[-0.05, -0.18].map((y, i) => <RoundedBox key={y} args={[0.52 - i * 0.06, 0.1, 0.44]} radius={0.04} smoothness={BEVEL} position={[0, y, 0.02]} castShadow>{plate}</RoundedBox>)}
      {/* chest tier 2+: a real collar plate — not in the base cuirass at all below upgrade level 3 */}
      {chestTier >= 2 && <RoundedBox args={[0.5, 0.1, 0.4]} radius={0.04} smoothness={BEVEL} position={[0, 0.56, 0.01]} castShadow>{plate}</RoundedBox>}
      {/* chest tier 3: flanking ridge plates + a raised power core replacing the flat sigil disc */}
      {chestTier >= 3 && <>
        <RoundedBox args={[0.07, 0.42, 0.1]} radius={0.025} smoothness={BEVEL} position={[-0.18, 0.28, 0.23]} castShadow>{trim}</RoundedBox>
        <RoundedBox args={[0.07, 0.42, 0.1]} radius={0.025} smoothness={BEVEL} position={[0.18, 0.28, 0.23]} castShadow>{trim}</RoundedBox>
      </>}
      {/* chest circuit sigil */}
      {seam("c1", [0, 0.44, 0.285], [0.24, 0.025, 0.02])}
      {seam("c2", [-0.13, 0.35, 0.285], [0.025, 0.16, 0.02])}
      {seam("c3", [0.13, 0.35, 0.285], [0.025, 0.16, 0.02])}
      {seam("c4", [-0.22, 0.18, 0.27], [0.02, 0.2, 0.02], [0, 0, -0.5])}
      {seam("c5", [0.22, 0.18, 0.27], [0.02, 0.2, 0.02], [0, 0, 0.5])}
      {chestTier >= 3
        ? <mesh position={[0, 0.3, 0.32]} castShadow><sphereGeometry args={[0.07, 16, 14]} />{line}</mesh>
        : <mesh position={[0, 0.3, 0.29]}><circleGeometry args={[0.045, 16]} />{line}</mesh>}
      {/* shoulders + arms — pauldrons grow a real extra plate past tier 1, not just a bigger tint */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.42, 0, 0]}>
          <RoundedBox args={[(titan ? 0.36 : 0.26) * (chestTier >= 2 ? 1.18 : 1), 0.22 * (chestTier >= 2 ? 1.15 : 1), 0.34]} radius={0.1} smoothness={BEVEL} position={[side * 0.04, 0.55, 0]} rotation={[0, 0, side * -0.25]} castShadow>{plate}</RoundedBox>
          {chestTier >= 2 && <RoundedBox args={[0.1, 0.1, 0.36]} radius={0.03} smoothness={BEVEL} position={[side * 0.04, 0.63, 0]} rotation={[0, 0, side * -0.25]} castShadow>{trim}</RoundedBox>}
          {seam(`sh${side}`, [side * 0.1, 0.6, 0.2], [0.14, 0.02, 0.02], [0, 0, side * -0.25])}
          <group ref={side < 0 ? armL : armR} position={[0, 0.5, 0]}><group position={[0, -0.5, 0]}>
          <mesh position={[side * 0.06, 0.18, 0]} castShadow><capsuleGeometry args={[0.075, 0.46, 8, 14]} />{suit}</mesh>
          <mesh position={[side * 0.065, -0.07, 0.03]} castShadow><sphereGeometry args={[0.095, 12, 10]} />{plate}</mesh>
          <RoundedBox args={[0.17, 0.34, 0.18]} radius={0.06} smoothness={BEVEL} position={[side * 0.07, -0.2, 0.02]} castShadow>{plate}</RoundedBox>
          {seam(`fa${side}`, [side * 0.07, -0.2, 0.13], [0.02, 0.26, 0.02])}
          <mesh position={[side * 0.07, -0.44, 0.02]} castShadow><sphereGeometry args={[0.09, 14, 12]} /><meshStandardMaterial color="#0b0d10" roughness={0.6} /></mesh>
          </group></group>
        </group>
      ))}
      {/* neck + helmet with band visor */}
      <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.12, 0.15, 0.16, 16]} />{suit}</mesh>
      <group position={[0, 0.95, 0.02]}>
        <mesh castShadow scale={[0.9, 1.08, 1]}><sphereGeometry args={[0.24, 28, 22]} />{plate}</mesh>
        <RoundedBox args={[0.3, 0.18, 0.16]} radius={0.06} smoothness={BEVEL} position={[0, -0.12, 0.14]} castShadow>{plate}</RoundedBox>
        {hunter && <mesh position={[0, 0.2, -0.02]} rotation={[0.2, 0, 0]}><boxGeometry args={[0.05, 0.12, 0.34]} />{plate}</mesh>}
        {warlock ? (
          [-0.08, 0.08].map((x) => <group key={x} position={[x, 0.02, 0.22]}><mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.055, 0.06, 0.1, 14]} /><meshStandardMaterial color="#1a1c20" metalness={0.8} roughness={0.3} /></mesh><mesh position={[0, 0, 0.051]}><circleGeometry args={[0.042, 16]} /><meshStandardMaterial color="#ffb347" emissive="#ffa033" emissiveIntensity={3} toneMapped={false} /></mesh></group>)
        ) : (
          <mesh position={[0, 0.02, 0.2]} rotation={[0, 0, 0]}><boxGeometry args={[0.3, 0.035, 0.08]} /><meshStandardMaterial color={visor} emissive={visor} emissiveIntensity={3.2} toneMapped={false} /></mesh>
        )}
        {/* helmet tier 2+: a real brow ridge plate, not on the base dome below upgrade level 3 */}
        {helmetTier >= 2 && <RoundedBox args={[0.32, 0.06, 0.1]} radius={0.02} smoothness={BEVEL} position={[0, 0.1, 0.19]} castShadow>{trim}</RoundedBox>}
        {/* helmet tier 3: a crest fin + twin antenna prongs */}
        {helmetTier >= 3 && <>
          <RoundedBox args={[0.04, 0.16, 0.22]} radius={0.015} smoothness={BEVEL} position={[0, 0.26, -0.02]} rotation={[0.3, 0, 0]} castShadow>{trim}</RoundedBox>
          {[-0.09, 0.09].map((x) => <mesh key={x} position={[x, 0.24, -0.08]} rotation={[0.4, 0, 0]} castShadow><cylinderGeometry args={[0.008, 0.012, 0.18, 6]} />{trim}</mesh>)}
        </>}
      </group>
      {/* class signatures */}
      {titan && <group position={[0, 0.2, -0.56]} rotation={[0.08, 0, 0]}>
        <RoundedBox args={[0.9, 1.5, 0.1]} radius={0.06} smoothness={BEVEL} castShadow><meshPhysicalMaterial color="#141a20" metalness={0.8} roughness={0.3} clearcoat={0.6} /></RoundedBox>
        {seam("tsh1", [0, 0, -0.06], [0.7, 0.025, 0.02])}{seam("tsh2", [-0.4, 0, -0.06], [0.025, 1.3, 0.02])}{seam("tsh3", [0.4, 0, -0.06], [0.025, 1.3, 0.02])}
      </group>}
      {hunter && <group>
        <mesh position={[0, 0.62, 0.02]} rotation={[0.15, 0, 0]} castShadow><torusGeometry args={[0.22, 0.09, 8, 18]} /><meshStandardMaterial color="#111214" roughness={1} /></mesh>
        <mesh position={[0.18, 0.05, -0.3]} rotation={[0.12, 0.1, -0.08]} castShadow><planeGeometry args={[0.3, 1.2, 1, 6]} /><meshStandardMaterial color="#111214" roughness={1} side={THREE.DoubleSide} /></mesh>
        {[-0.34, 0.34].map((x) => <RoundedBox key={x} args={[0.1, 0.3, 0.16]} radius={0.03} smoothness={BEVEL} position={[x, -0.6, 0.04]}><meshStandardMaterial color="#0a0b0d" metalness={0.5} roughness={0.5} /></RoundedBox>)}
      </group>}
      {warlock && <group ref={drone}>
        <mesh castShadow scale={[1, 0.55, 1.3]}><sphereGeometry args={[0.13, 14, 10]} /><meshPhysicalMaterial color="#c9d2dc" metalness={0.8} roughness={0.25} clearcoat={1} /></mesh>
        <mesh position={[0, 0, 0.16]}><circleGeometry args={[0.05, 14]} /><meshStandardMaterial color="#ffb347" emissive="#ffa033" emissiveIntensity={3} toneMapped={false} /></mesh>
        {[-1, 1].map((s) => <mesh key={s} position={[s * 0.18, 0, 0]}><boxGeometry args={[0.14, 0.02, 0.06]} /><meshStandardMaterial color="#9aa4ae" metalness={0.8} roughness={0.3} /></mesh>)}
      </group>}
      <group ref={orbit} visible={visualState === "FRACTURE" || visualState === "ASCENDANT"}>
        {[0, 1, 2].map((i) => <mesh key={i} position={[Math.cos(i * 2.1) * 0.85, 0.2 + i * 0.3, Math.sin(i * 2.1) * 0.85]}><octahedronGeometry args={[0.07]} />{line}</mesh>)}
      </group>
      {/* class backpack (backpacks.ts): Bastion = armored reservoir, Slipstream = capacitor fins, Relay = antenna array */}
      {titan && <group position={[0, 0.22, -0.3]}>
        <RoundedBox args={[0.5, 0.52, 0.2]} radius={0.05} smoothness={BEVEL} castShadow>{plate}</RoundedBox>
        {[-0.14, 0.14].map((x) => <mesh key={x} position={[x, -0.34, -0.02]} rotation={[0, 0, Math.PI]} castShadow><cylinderGeometry args={[0.07, 0.09, 0.2, 12]} />{trim}</mesh>)}
        {seam("bp1", [0, 0.05, -0.105], [0.3, 0.025, 0.02])}{seam("bp2", [0, -0.08, -0.105], [0.3, 0.025, 0.02])}
      </group>}
      {hunter && <group position={[0, 0.3, -0.26]}>
        <RoundedBox args={[0.36, 0.34, 0.14]} radius={0.04} smoothness={BEVEL} castShadow>{plate}</RoundedBox>
        {[-1, 1].map((side) => <mesh key={side} position={[side * 0.24, 0.08, -0.04]} rotation={[0, 0, side * -0.5]} castShadow><boxGeometry args={[0.04, 0.34, 0.14]} />{trim}</mesh>)}
        {seam("bp3", [0, 0, -0.075], [0.2, 0.025, 0.02])}
      </group>}
      {warlock && <group position={[0, 0.28, -0.26]}>
        <RoundedBox args={[0.34, 0.4, 0.14]} radius={0.04} smoothness={BEVEL} castShadow>{plate}</RoundedBox>
        {[-0.11, 0.11].map((x, i) => <mesh key={x} position={[x, 0.36 + i * 0.1, 0]} castShadow><cylinderGeometry args={[0.008, 0.012, 0.5 + i * 0.2, 6]} />{trim}</mesh>)}
        <mesh position={[0.11, 0.7, 0]}><sphereGeometry args={[0.03, 10, 8]} />{line}</mesh>
        {seam("bp4", [0, -0.05, -0.075], [0.18, 0.025, 0.02])}
      </group>}
      {/* signature silhouettes from the operator reference art */}
      {titan && <>
        {/* GOLIATH: hazard-striped pauldrons + a back-mounted ammo drum feeding the chain-cannon */}
        {[-1, 1].map((side) => <group key={`hz${side}`} position={[side * 0.46, 0.64, 0]} rotation={[0, 0, side * -0.25]}>
          {[-0.12, 0, 0.12].map((z, i) => <mesh key={i} position={[0, 0.03, z]}><boxGeometry args={[0.2, 0.025, 0.05]} /><meshStandardMaterial color={i % 2 ? "#15110d" : "#ff7a1a"} emissive={i % 2 ? "#000000" : "#ff5a00"} emissiveIntensity={i % 2 ? 0 : 1.2} toneMapped={false} /></mesh>)}
        </group>)}
        <mesh position={[0.28, -0.1, -0.3]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.13, 0.13, 0.22, 14]} />{trim}</mesh>
      </>}
      {hunter && <group ref={cloak} position={[0, 0.5, -0.24]} rotation={[0.1, 0, 0]}>
        {/* NYX: a translucent phase cloak with a glowing hem — reads as bending light rather than cloth */}
        <mesh position={[0, -0.7, 0]}><planeGeometry args={[0.7, 1.6, 1, 6]} /><meshStandardMaterial color="#1a1226" transparent opacity={0.55} roughness={0.4} metalness={0.3} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <mesh position={[0, -1.5, 0.002]}><boxGeometry args={[0.7, 0.02, 0.01]} /><meshStandardMaterial color={visor} emissive={visor} emissiveIntensity={3} toneMapped={false} /></mesh>
        {[-0.34, 0.34].map((x) => <mesh key={x} position={[x, -0.7, 0.002]}><boxGeometry args={[0.012, 1.6, 0.01]} /><meshStandardMaterial color={visor} emissive={visor} emissiveIntensity={2.2} toneMapped={false} /></mesh>)}
      </group>}
      {warlock && <>
        {/* CIPHER: long trench coat skirt, floating metallic rings, amber holo streams at the wrists */}
        <mesh position={[0, -0.62, 0]} castShadow><cylinderGeometry args={[0.3, 0.42, 0.95, 18, 1, true]} /><meshStandardMaterial color={suitColor} roughness={0.8} metalness={0.15} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0, -1.1, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.415, 0.012, 6, 28]} /><meshStandardMaterial color="#ffb347" emissive="#ffa033" emissiveIntensity={2.4} toneMapped={false} /></mesh>
        <group ref={rings} position={[0, 0.55, 0]}>
          {[0.55, 0.7].map((r, i) => <mesh key={r} rotation={[Math.PI / 2 + i * 0.5, i * 0.4, 0]}><torusGeometry args={[r, 0.012, 6, 40]} /><meshStandardMaterial color="#cfd6de" metalness={0.9} roughness={0.2} emissive="#ffb347" emissiveIntensity={0.7} toneMapped={false} /></mesh>)}
        </group>
        {[-1, 1].map((side) => <mesh key={`holo${side}`} position={[side * 0.5, -0.15, 0.1]} rotation={[0.3, 0, side * 0.2]}><boxGeometry args={[0.012, 0.3, 0.12]} /><meshStandardMaterial color="#ffc864" emissive="#ffa033" emissiveIntensity={3} transparent opacity={0.7} toneMapped={false} /></mesh>)}
      </>}
      {/* rifle */}
      <group position={[0.46, -0.1, 0.42]}>
        <RoundedBox args={[0.12, 0.16, 0.9]} radius={0.03} smoothness={BEVEL}><meshStandardMaterial color="#15181c" metalness={0.7} roughness={0.35} /></RoundedBox>
        {seam("gun", [0.065, 0.02, 0.05], [0.01, 0.03, 0.6])}
        {titan && [0, 1, 2].map((i) => <mesh key={`bar${i}`} position={[Math.cos(i * 2.094) * 0.07, Math.sin(i * 2.094) * 0.07, 0.62]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.03, 0.03, 0.5, 8]} /><meshStandardMaterial color="#2a2622" metalness={0.8} roughness={0.35} /></mesh>)}
        {warlock && <mesh position={[0, 0.02, 0.5]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.07, 0.012, 6, 16]} /><meshStandardMaterial color="#9fe8ff" emissive="#5ad0ff" emissiveIntensity={3.5} toneMapped={false} /></mesh>}
      </group>
    </group>
  );
}
