import "@/game/venue-doors";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { INTERIOR_ALTITUDE, INTERIORS, SHOP_INTERIORS } from "@/game/interiors";
import { DoorMarker } from "./HomeInteriors";
import { SpeakingFigure } from "./SpeakingFigure";
import { castAt, NEXUS_DINER } from "@/game/venue-life";

const ROOM_HALF = 5;
const WALL_HEIGHT = 4;

/**
 * Renders every registered interior's room — plain geometry parked at INTERIOR_ALTITUDE, far from
 * the open world and from each other (see @/game/interiors for why: a position teleport into a
 * pocket room, not a second <Canvas>/scene swap). There are only a couple of small rooms, so unlike
 * Interior.tsx's damage-driven structure this needs no imperative useFrame — it's static geometry,
 * cheap enough to always keep mounted and left for the renderer's own frustum culling.
 */
export function Interiors() {
  // One shared light instead of one per room: a constant light count never forces a shader
  // recompile, and it only does work (intensity > 0) while the camera is inside a pocket room.
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ camera }) => {
    const l = light.current;
    if (!l) return;
    // out in the world the light is switched off entirely, not just dimmed: three.js shades every lit pixel for each
    // visible light, even at zero intensity. The light count changes only at a door, once each way.
    if (camera.position.y < INTERIOR_ALTITUDE - 50) { l.visible = false; return; }
    l.visible = true;
    let best = INTERIORS[0];
    let bd = Infinity;
    for (const it of INTERIORS) {
      const d = Math.hypot(camera.position.x - it.origin.x, camera.position.z - it.origin.z);
      if (d < bd) { bd = d; best = it; }
    }
    if (!best) return;
    l.position.set(best.origin.x, INTERIOR_ALTITUDE + WALL_HEIGHT - 0.4, best.origin.z);
    l.color.set(best.kind === "SHOP" ? "#ffd9a0" : best.kind === "VENUE" ? "#d06bff" : "#cfe6ff");
    l.intensity = best.kind === "VENUE" ? 26 : 20;
  });
  return (
    <group>
      <pointLight ref={light} intensity={0} distance={14} />
      {/* walk-in storefronts: entering is automatic at the door (doorAt), so the doorway has to be visible in the street */}
      {SHOP_INTERIORS.map((it) => <DoorMarker key={`door-${it.id}`} x={it.doorPos.x} z={it.doorPos.z} label={it.name} />)}
      {/* the hand-authored apartments, stores and offices enter the same way, so their doors are marked too (they were invisible triggers) */}
      {INTERIORS.filter((it) => it.kind !== "HOME" && !it.viaLift && !SHOP_INTERIORS.includes(it)).map((it) => <DoorMarker key={`door-${it.id}`} x={it.doorPos.x} z={it.doorPos.z} label={it.name} />)}
      {INTERIORS.filter((i) => i.kind !== "HOME").map((interior) => (
        <group key={interior.id} position={[interior.origin.x, INTERIOR_ALTITUDE, interior.origin.z]}>
          {/* floor */}
          <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, 0, 0]}>
            <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
            <meshStandardMaterial color={interior.kind === "SHOP" ? "#4a3f2f" : "#3a3a42"} roughness={0.85} />
          </mesh>
          {/* ceiling */}
          <mesh rotation-x={Math.PI / 2} position={[0, WALL_HEIGHT, 0]}>
            <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
            <meshStandardMaterial color="#20222a" roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
          {/* back + side walls (the door wall, at +Z, is left open at the exit marker) */}
          <mesh position={[0, WALL_HEIGHT / 2, -ROOM_HALF]} castShadow receiveShadow>
            <boxGeometry args={[ROOM_HALF * 2, WALL_HEIGHT, 0.3]} />
            <meshStandardMaterial color="#565d68" roughness={0.7} />
          </mesh>
          <mesh position={[-ROOM_HALF, WALL_HEIGHT / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.3, WALL_HEIGHT, ROOM_HALF * 2]} />
            <meshStandardMaterial color="#565d68" roughness={0.7} />
          </mesh>
          <mesh position={[ROOM_HALF, WALL_HEIGHT / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.3, WALL_HEIGHT, ROOM_HALF * 2]} />
            <meshStandardMaterial color="#565d68" roughness={0.7} />
          </mesh>
          {/* door wall, split either side of the exit marker to leave a gap the player walks out through */}
          <mesh position={[-(ROOM_HALF + interior.exitOffset.x) / 2 - 1, WALL_HEIGHT / 2, ROOM_HALF]} castShadow receiveShadow>
            <boxGeometry args={[ROOM_HALF - 1.6, WALL_HEIGHT, 0.3]} />
            <meshStandardMaterial color="#565d68" roughness={0.7} />
          </mesh>
          <mesh position={[(ROOM_HALF - interior.exitOffset.x) / 2 + 1, WALL_HEIGHT / 2, ROOM_HALF]} castShadow receiveShadow>
            <boxGeometry args={[ROOM_HALF - 1.6, WALL_HEIGHT, 0.3]} />
            <meshStandardMaterial color="#565d68" roughness={0.7} />
          </mesh>

          {/* the doorway shows daylight from the street, not the sky around the pocket room */}
          <mesh position={[interior.exitOffset.x, WALL_HEIGHT / 2, ROOM_HALF + 0.35]}>
            <planeGeometry args={[3.6, WALL_HEIGHT]} />
            <meshBasicMaterial color={interior.kind === "SHOP" ? "#f3dcb4" : "#d6e6f2"} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>

          {/* shop counter, present only for SHOP interiors */}
          {interior.kind === "SHOP" && (
            <mesh position={[0, 0.55, -1.5]} castShadow>
              <boxGeometry args={[3.4, 1.1, 0.8]} />
              <meshStandardMaterial color="#7a5a3a" roughness={0.6} />
            </mesh>
          )}

          {/* nightlife venue: a lit bar, a dance floor that glows in the venue's colours, booths and neon strips round the walls */}
          {interior.kind === "VENUE" && (interior.venueId === NEXUS_DINER.id ? <DinerRoom /> : <VenueRoom venueId={interior.venueId ?? ""} />)}
          {/* the people inside (venue-life.ts CAST): bouncer by the door, bartender behind the bar, regulars at booths and on the floor */}
          {interior.kind === "VENUE" && castAt(interior.venueId ?? "").filter((c) => c.name !== interior.npcName?.split(",")[0]).map((c) => (
            <group key={c.id} position={[c.spot.x, 0, c.spot.z]} rotation-y={c.role === "bouncer" ? Math.PI : 0}>
              <SpeakingFigure name={c.name} color={c.role === "bouncer" ? "#3a3f48" : c.role === "bartender" ? "#a0563a" : CAST_TINT[c.id.length % CAST_TINT.length]!} role={c.role === "bouncer" ? "OBSERVER" : c.role === "bartender" ? "VENDOR" : c.id.length % 2 ? "ARTISAN" : "SCAVENGER"} />
            </group>
          ))}

          {/* the NPC standee — a simple readable figure, not a full character model */}
          {interior.npcName && (
            <group position={interior.kind === "VENUE" ? [-1.5, 0, -4.6] : interior.kind === "SHOP" ? [0, 0, -2.3] : [2.4, 0, -3.6]}>
              <SpeakingFigure name={interior.npcName} color={interior.kind === "SHOP" ? "#c98a4a" : interior.kind === "VENUE" ? "#c46bff" : "#6d8fc9"} role={interior.kind === "SHOP" || interior.kind === "VENUE" ? "VENDOR" : "MEDIC"} />
            </group>
          )}

          {/* elevator: a lit pad in the floor under a call sign, stepping on it rides to the floor named on it */}
          {interior.lift && <group position={[interior.lift.pad.x, 0, interior.lift.pad.z]}>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.025, 0]}><circleGeometry args={[1, 32]} /><meshStandardMaterial color="#1b2330" metalness={0.8} roughness={0.3} /></mesh>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}><ringGeometry args={[0.78, 1, 32]} /><meshBasicMaterial color="#6fd8ff" toneMapped={false} /></mesh>
            <mesh position={[0, 2.4, -1.1]}><boxGeometry args={[1.6, 0.4, 0.06]} /><meshBasicMaterial color="#6fd8ff" toneMapped={false} /></mesh>
            <Text position={[0, 2.4, -1.06]} fontSize={0.14} color="#04121a" anchorX="center" anchorY="middle" maxWidth={1.5}>{interior.lift.label}</Text>
          </group>}
          {/* exit marker — a faint glowing seam in the floor, so the door out is readable at a glance */}
          <mesh rotation-x={-Math.PI / 2} position={[interior.exitOffset.x, 0.02, interior.exitOffset.z]}>
            <ringGeometry args={[1.2, 1.6, 24]} />
            <meshBasicMaterial color="#7dffca" transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const CAST_TINT = ["#5f6f8a", "#7a5f8a", "#8a6f5a", "#4f7a6f"];
/** the Grid Line Diner (venue-life.ts NEXUS_DINER): a long counter with stools, booths under a window strip, warm light */
function DinerRoom() {
  const cache = useMemo(() => new Map<string, THREE.MeshBasicMaterial>(), []);
  const glow = (c: string, k = 1.6) => { const key = `${c}:${k}`; let m = cache.get(key); if (!m) cache.set(key, (m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false }))); return m; };
  return <group>
    {/* counter with a steel top, stools in front */}
    <mesh position={[-1.5, 0.52, -3.9]} castShadow><boxGeometry args={[6, 1.04, 0.8]} /><meshStandardMaterial color="#6a3b2a" roughness={0.7} /></mesh>
    <mesh position={[-1.5, 1.06, -3.9]}><boxGeometry args={[6.1, 0.05, 0.9]} /><meshStandardMaterial color="#b9bec4" metalness={0.8} roughness={0.3} /></mesh>
    {[-3.6, -2.4, -1.2, 0, 1.2].map((x) => <group key={x} position={[x, 0, -3.0]}>
      <mesh position-y={0.36}><cylinderGeometry args={[0.04, 0.06, 0.72, 8]} /><meshStandardMaterial color="#9aa0a6" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position-y={0.74}><cylinderGeometry args={[0.2, 0.2, 0.08, 14]} /><meshStandardMaterial color="#b0302a" roughness={0.6} /></mesh>
    </group>)}
    {/* menu board and pass-through glow */}
    <mesh position={[-1.5, 2.5, -4.82]} material={glow(NEXUS_DINER.color, 0.9)}><boxGeometry args={[4.2, 1, 0.04]} /></mesh>
    <mesh position={[-1.5, 1.7, -4.8]} material={glow("#ffe2b0", 0.7)}><boxGeometry args={[2.2, 0.5, 0.04]} /></mesh>
    {/* booths along the left wall, tables between */}
    {[-1.8, 1.8].map((z) => <group key={z} position={[-3.9, 0, z]}>
      <mesh position-y={0.45} castShadow><boxGeometry args={[1.1, 0.9, 1.9]} /><meshStandardMaterial color="#8a2a24" roughness={0.75} /></mesh>
      <mesh position={[1.2, 0.74, 0]}><boxGeometry args={[0.9, 0.05, 1.4]} /><meshStandardMaterial color="#d8d2c4" roughness={0.5} /></mesh>
    </group>)}
    {/* checker floor strip and a jukebox in the corner */}
    {Array.from({ length: 10 }, (_, i) => <mesh key={i} rotation-x={-Math.PI / 2} position={[-4 + i * 0.9, 0.012, -2.2]}><planeGeometry args={[0.9, 0.9]} /><meshStandardMaterial color={i % 2 ? "#e8e2d4" : "#1c1c1e"} roughness={0.6} /></mesh>)}
    <group position={[3.8, 0, -3.8]}>
      <mesh position-y={0.8} castShadow><boxGeometry args={[0.9, 1.6, 0.6]} /><meshStandardMaterial color="#3a2418" roughness={0.6} /></mesh>
      <mesh position={[0, 1.05, 0.31]} material={glow(NEXUS_DINER.accent, 1.2)}><boxGeometry args={[0.6, 0.6, 0.02]} /></mesh>
    </group>
    {[-4.84, 4.84].map((x) => <mesh key={x} position={[x, 3.2, 0]} material={glow(x < 0 ? NEXUS_DINER.color : NEXUS_DINER.accent, 1.2)}><boxGeometry args={[0.04, 0.06, 9.4]} /></mesh>)}
    {/* warm pendant lamps over the counter and booths (emissive only: the room shares Interiors' one light) */}
    {[[-3.6, -3.4], [-1.5, -3.4], [0.6, -3.4], [-3.0, -1.8], [-3.0, 1.8]].map(([x, z]) => <group key={`${x},${z}`} position={[x!, 2.6, z!]}>
      <mesh position-y={0.55}><cylinderGeometry args={[0.01, 0.01, 1.1, 4]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh><coneGeometry args={[0.22, 0.2, 14, 1, true]} /><meshStandardMaterial color="#2a2018" side={THREE.DoubleSide} /></mesh>
      <mesh position-y={-0.06} material={glow("#ffd59a", 2.2)}><sphereGeometry args={[0.07, 10, 8]} /></mesh>
    </group>)}
  </group>;
}
const VENUE_TINT: Record<string, [string, string]> = { "pulse-array": ["#35efff", "#7a5cff"], afterglow: ["#ff3b9d", "#ff7a3a"], "velvet-circuit": ["#c040ff", "#ff4fa8"], "crown-casino": ["#ffc247", "#ff8a2a"] };
function VenueRoom({ venueId }: { venueId: string }) {
  const [a, b] = VENUE_TINT[venueId] ?? ["#c040ff", "#35efff"];
  // no extra lights here: every light costs every lit pixel in the world (the room shares Interiors' one light)
  const cache = useMemo(() => new Map<string, THREE.MeshBasicMaterial>(), []);
  const glow = (c: string, k = 1.8) => { const key = `${c}:${k}`; let m = cache.get(key); if (!m) cache.set(key, (m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false }))); return m; };
  return <group>
    {/* bar along the back wall, lit from beneath */}
    <mesh position={[-1.5, 0.55, -3.9]} castShadow><boxGeometry args={[5.2, 1.1, 0.8]} /><meshStandardMaterial color="#14121a" metalness={0.6} roughness={0.3} /></mesh>
    <mesh position={[-1.5, 0.08, -3.48]} material={glow(a)}><boxGeometry args={[5.2, 0.06, 0.04]} /></mesh>
    <mesh position={[-1.5, 2.6, -4.82]} material={glow(b, 1.2)}><boxGeometry args={[5, 0.9, 0.04]} /></mesh>
    {/* dance floor: a checker of glowing tiles */}
    {Array.from({ length: 16 }, (_, i) => { const x = (i % 4) - 1.5, z = Math.floor(i / 4) - 1.5; return <mesh key={i} rotation-x={-Math.PI / 2} position={[1.6 + x * 1.05, 0.015, 0.2 + z * 1.05]} material={glow((i + Math.floor(i / 4)) % 2 ? a : b, 0.7)}><planeGeometry args={[0.98, 0.98]} /></mesh>; })}
    {/* booths and neon wall strips */}
    {[-1, 1].map((sz) => <mesh key={sz} position={[-3.9, 0.45, sz * 2]} castShadow><boxGeometry args={[1.2, 0.9, 2.2]} /><meshStandardMaterial color="#2a1630" roughness={0.8} /></mesh>)}
    {[-4.84, 4.84].map((x) => <mesh key={x} position={[x, 3.2, 0]} material={glow(x < 0 ? a : b)}><boxGeometry args={[0.04, 0.08, 9.4]} /></mesh>)}
  </group>;
}
