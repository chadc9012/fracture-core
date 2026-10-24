import "@/game/venue-doors";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { INTERIOR_ALTITUDE, INTERIORS, SHOP_INTERIORS } from "@/game/interiors";
import { DoorMarker } from "./HomeInteriors";
import { SpeakingFigure } from "./SpeakingFigure";

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
    l.intensity = 14;
  });
  return (
    <group>
      <pointLight ref={light} intensity={0} distance={14} />
      {/* walk-in storefronts: entering is automatic at the door (doorAt), so the doorway has to be visible in the street */}
      {SHOP_INTERIORS.map((it) => <DoorMarker key={`door-${it.id}`} x={it.doorPos.x} z={it.doorPos.z} label={it.name} />)}
      {/* the hand-authored apartments, stores and offices enter the same way, so their doors are marked too (they were invisible triggers) */}
      {INTERIORS.filter((it) => it.kind !== "HOME" && !SHOP_INTERIORS.includes(it)).map((it) => <DoorMarker key={`door-${it.id}`} x={it.doorPos.x} z={it.doorPos.z} label={it.name} />)}
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
          {interior.kind === "VENUE" && <VenueRoom venueId={interior.venueId ?? ""} />}

          {/* the NPC standee — a simple readable figure, not a full character model */}
          {interior.npcName && (
            <group position={interior.kind === "VENUE" ? [-3, 0, -3.4] : [0, 0, interior.kind === "SHOP" ? -1.5 : -2]}>
              <SpeakingFigure name={interior.npcName} color={interior.kind === "SHOP" ? "#c98a4a" : interior.kind === "VENUE" ? "#c46bff" : "#6d8fc9"} />
            </group>
          )}

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
