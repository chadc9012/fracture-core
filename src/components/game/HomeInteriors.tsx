import { memo, useMemo } from "react";
import * as THREE from "three";
import { HOME_INTERIORS, HOME_ROOM_SIZE, INTERIOR_ALTITUDE } from "@/game/interiors";
import { homeById, type HousingState } from "@/game/housing";
import { heightAt } from "@/game/terrain";

const H = 3.6;
const HALF = HOME_ROOM_SIZE / 2;

/** Finish colors for paint / wallpaper / floor decor ids; anything unlisted uses the room default. */
const WALL: Record<string, { color: string; emissive?: string }> = {
  "paint-slate": { color: "#4f5866" },
  "paint-neon-violet": { color: "#5a3a7a", emissive: "#2a0f44" },
  "wall-circuit": { color: "#1f3a3a", emissive: "#0d4a44" },
  "wall-veyran-silk": { color: "#b89a6a" },
};
const FLOOR: Record<string, string> = { "floor-concrete": "#8a8d90", "floor-oak": "#7a5232" };

function Box({ p, s, c, e, r = 0.6, m = 0 }: { p: [number, number, number]; s: [number, number, number]; c: string; e?: string | undefined; r?: number; m?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={e ?? "#000"} emissiveIntensity={e ? 1.2 : 0} roughness={r} metalness={m} />
    </mesh>
  );
}

/** Furniture/finish objects for one placed decor id, positioned within a room (local coords, room centered at 0). */
function DecorObject({ id }: { id: string }) {
  switch (id) {
    case "sofa-street": return <group position={[0, 0, -3.6]}><Box p={[0, 0.3, 0]} s={[2.4, 0.6, 0.9]} c="#6b4a3a" r={0.9} /><Box p={[0, 0.75, -0.35]} s={[2.4, 0.6, 0.2]} c="#5a3c2e" r={0.9} /></group>;
    case "sofa-aegis": return <group position={[0, 0, -3.4]}><Box p={[0, 0.25, 0]} s={[3.2, 0.5, 1]} c="#d8d4cc" r={0.5} /><Box p={[0, 0.7, -0.4]} s={[3.2, 0.5, 0.2]} c="#cfcac0" r={0.5} /><Box p={[0, 0.2, 1.4]} s={[1.4, 0.4, 0.7]} c="#2a2d33" m={0.6} r={0.25} /></group>;
    case "art-fracture": return <Box p={[-HALF + 0.2, 1.9, 0]} s={[0.05, 1.1, 1.6]} c="#2a1640" e="#8f4dff" />;
    case "art-vyrak": return <Box p={[-HALF + 0.2, 1.9, 0]} s={[0.06, 1.3, 2]} c="#7a2a10" e="#3a1004" r={0.8} />;
    case "tv-wall": return <Box p={[HALF - 0.2, 1.7, 0]} s={[0.08, 1.1, 2]} c="#0d1016" e="#1a3b6a" r={0.2} />;
    case "tv-holo": return <group position={[HALF - 1.2, 0, 0]}><Box p={[0, 0.2, 0]} s={[0.9, 0.4, 0.9]} c="#20242c" m={0.7} /><mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.5, 0.5, 1.8, 20, 1, true]} /><meshBasicMaterial color="#5ce1ff" transparent opacity={0.25} side={THREE.DoubleSide} /></mesh></group>;
    case "bed-bunk": return <group position={[2.5, 0, -3]}><Box p={[0, 0.35, 0]} s={[1.2, 0.3, 2.2]} c="#6a7480" /><Box p={[0, 1.5, 0]} s={[1.2, 0.3, 2.2]} c="#6a7480" /><Box p={[0.6, 0.9, 0]} s={[0.08, 1.8, 2.2]} c="#3a3f46" m={0.5} /></group>;
    case "bed-king": return <group position={[0, 0, -3]}><Box p={[0, 0.45, 0]} s={[2.4, 0.4, 2.4]} c="#e6e2da" r={0.85} /><Box p={[0, 0.85, -1.1]} s={[2.4, 0.9, 0.2]} c="#3a2d4a" /><mesh position={[0, 0.12, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[2.6, 2.6]} /><meshBasicMaterial color="#7a5cff" transparent opacity={0.35} /></mesh></group>;
    default:
      if (id.startsWith("bath")) return <group position={[2.6, 0, -3]}><Box p={[0, 0.35, 0]} s={[1.6, 0.7, 2.6]} c="#e8ecef" r={0.2} /><Box p={[0, 0.65, 0]} s={[1.3, 0.1, 2.3]} c="#7fb8d0" r={0.05} /></group>;
      if (id.startsWith("light")) return <group position={[0, H - 0.3, 0]}><Box p={[0, 0, 0]} s={[2, 0.08, 0.3]} c="#fff1cf" e="#ffd28a" /><pointLight color="#ffd8a0" intensity={6} distance={9} /></group>;
      return null;
  }
}

function Room({ index, roomName, decor, exitRoom }: { index: number; roomName: string; decor: Record<string, string>; exitRoom: boolean }) {
  const wall = WALL[decor["wallpaper"] ?? ""] ?? WALL[decor["paint"] ?? ""] ?? { color: roomName === "bathroom" ? "#9fb0b8" : "#565d68" };
  const floor = FLOOR[decor["floor"] ?? ""] ?? (roomName === "garage" ? "#3d3f42" : "#3a3a42");
  const x = index * HOME_ROOM_SIZE;
  const w = (p: [number, number, number], s: [number, number, number]) => <Box p={p} s={s} c={wall.color} e={wall.emissive} r={0.75} />;
  return (
    <group position={[x, 0, 0]}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[HOME_ROOM_SIZE, HOME_ROOM_SIZE]} /><meshStandardMaterial color={floor} roughness={decor["floor"] === "floor-concrete" ? 0.35 : 0.8} /></mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, H, 0]}><planeGeometry args={[HOME_ROOM_SIZE, HOME_ROOM_SIZE]} /><meshStandardMaterial color="#1e2027" side={THREE.DoubleSide} /></mesh>
      {w([0, H / 2, -HALF], [HOME_ROOM_SIZE, H, 0.25])}
      {/* front wall: room 0 keeps a gap for the exit, others are solid */}
      {exitRoom ? <>{w([-3.2, H / 2, HALF], [3.6, H, 0.25])}{w([3.2, H / 2, HALF], [3.6, H, 0.25])}</> : w([0, H / 2, HALF], [HOME_ROOM_SIZE, H, 0.25])}
      {/* left wall only on the first room; between rooms a wall with a doorway on the right side */}
      {index === 0 && w([-HALF, H / 2, 0], [0.25, H, HOME_ROOM_SIZE])}
      {w([HALF, H / 2, -3.1], [0.25, H, 3.8])}
      {w([HALF, H / 2, 3.1], [0.25, H, 3.8])}
      {w([HALF, H - 0.4, 0], [0.25, 0.8, 2.4])}
      <pointLight position={[0, H - 0.5, 0]} color="#e8eeff" intensity={4} distance={11} />
      {Object.entries(decor).map(([slot, id]) => !["paint", "wallpaper", "floor"].includes(slot) && <DecorObject key={slot} id={id} />)}
    </group>
  );
}

/** The front door of an owned home, standing in the open world so the player can find it and walk through. */
function DoorMarker({ x, z }: { x: number; z: number }) {
  const y = useMemo(() => heightAt(x, z), [x, z]);
  const glow = { color: "#1c2026", emissive: "#7dffca", emissiveIntensity: 0.9 };
  return (
    <group position={[x, y, z]}>
      <mesh position={[-0.9, 1.2, 0]}><boxGeometry args={[0.18, 2.4, 0.18]} /><meshStandardMaterial {...glow} /></mesh>
      <mesh position={[0.9, 1.2, 0]}><boxGeometry args={[0.18, 2.4, 0.18]} /><meshStandardMaterial {...glow} /></mesh>
      <mesh position={[0, 2.45, 0]}><boxGeometry args={[2.0, 0.18, 0.18]} /><meshStandardMaterial {...glow} /></mesh>
      <mesh position={[0, 1.2, 0]}><planeGeometry args={[1.6, 2.2]} /><meshBasicMaterial color="#7dffca" transparent opacity={0.16} side={THREE.DoubleSide} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}><ringGeometry args={[1.3, 1.6, 28]} /><meshBasicMaterial color="#7dffca" transparent opacity={0.55} /></mesh>
    </group>
  );
}

/** Every buyable home as walkable rooms parked at INTERIOR_ALTITUDE, decorated from progression.housing. Only owned homes render. */
export const HomeInteriors = memo(function HomeInteriors({ housing, nexLedger }: { housing?: HousingState | undefined; nexLedger?: Record<string, unknown> | undefined }) {
  return (
    <group>
      {HOME_INTERIORS.map((it) => {
        const home = it.homeId ? homeById(it.homeId) : undefined;
        if (!home || !nexLedger || !(`home:${home.id}` in nexLedger)) return null;
        const placed = housing?.placed[home.id] ?? {};
        return (
          <group key={it.id}>
          <DoorMarker x={it.doorPos.x} z={it.doorPos.z} />
          <group position={[it.origin.x, INTERIOR_ALTITUDE, it.origin.z]}>
            {/* the last room's far wall closes the home */}
            {home.rooms.map((room, i) => {
              const decor: Record<string, string> = {};
              for (const [k, v] of Object.entries(placed)) { const [ri, slot] = k.split(":"); if (slot && Number(ri) === i) decor[slot] = v; }
              return <Room key={i} index={i} roomName={room} decor={decor} exitRoom={i === 0} />;
            })}
            <mesh rotation-x={-Math.PI / 2} position={[it.exitOffset.x, 0.02, it.exitOffset.z]}><ringGeometry args={[1.2, 1.6, 24]} /><meshBasicMaterial color="#7dffca" transparent opacity={0.6} /></mesh>
          </group>
          </group>
        );
      })}
    </group>
  );
});
