import { memo, useMemo } from "react";
import * as THREE from "three";
import { HOME_INTERIORS, HOME_ROOM_SIZE, INTERIOR_ALTITUDE } from "@/game/interiors";
import { decorById, homeById, type HousingState, type RoomId } from "@/game/housing";
import { roomFurniture, styleOf, type HomeStyle, type Part } from "@/game/home-furniture";
import { heightAt } from "@/game/terrain";
import { Text } from "./SafeText";

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

/** One part of a furniture model: a box, cylinder or sphere with its own material (and a light if it glows). */
function PartMesh({ part }: { part: Part }) {
  const glow = part.emissive;
  return (
    <group position={part.pos} rotation-y={part.rotY ?? 0}>
      <mesh castShadow={!part.ghost} receiveShadow>
        {part.shape === "box" && <boxGeometry args={part.size} />}
        {part.shape === "cyl" && <cylinderGeometry args={[part.size[0] / 2, part.size[0] / 2, part.size[1], 20]} />}
        {part.shape === "sphere" && <sphereGeometry args={[part.size[0] / 2, 16, 12]} />}
        <meshStandardMaterial color={part.color} emissive={glow ?? "#000"} emissiveIntensity={glow ? 1.2 : 0} roughness={part.rough ?? 0.6} metalness={part.metal ?? 0} transparent={part.opacity !== undefined} opacity={part.opacity ?? 1} depthWrite={part.opacity === undefined} />
      </mesh>
      {part.light && <pointLight color={glow ?? "#ffd8a0"} intensity={part.light.intensity} distance={part.light.distance} />}
    </group>
  );
}

/** Built-in fixtures plus a detailed model for every item placed in this room, styled for the home. */
const Furniture = memo(function Furniture({ room, style, decor }: { room: RoomId; style: HomeStyle; decor: Record<string, string> }) {
  const f = useMemo(() => roomFurniture(room, style, decor, (id, slot, r) => { const d = decorById(id); return !!d && d.slot === slot && d.rooms.includes(r); }), [room, style, decor]);
  return (
    <group>
      {f.fixtures.map((p, i) => <PartMesh key={`f${i}`} part={p} />)}
      {f.items.map((it) => <group key={it.slot}>{it.parts.map((p, i) => <PartMesh key={i} part={p} />)}</group>)}
    </group>
  );
});

function Room({ index, roomName, decor, exitRoom, style }: { index: number; roomName: RoomId; decor: Record<string, string>; exitRoom: boolean; style: HomeStyle }) {
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
      <Furniture room={roomName} style={style} decor={decor} />
    </group>
  );
}

/** The front door of an owned home, standing in the open world so the player can find it and walk through. */
/** A glowing door frame where walking in enters a pocket room (doorAt); `label` puts the place's name over it. */
export function DoorMarker({ x, z, label }: { x: number; z: number; label?: string }) {
  const y = useMemo(() => heightAt(x, z), [x, z]);
  const glow = { color: "#1c2026", emissive: "#7dffca", emissiveIntensity: 0.9 };
  return (
    <group position={[x, y, z]}>
      <mesh position={[-0.9, 1.2, 0]}><boxGeometry args={[0.18, 2.4, 0.18]} /><meshStandardMaterial {...glow} /></mesh>
      <mesh position={[0.9, 1.2, 0]}><boxGeometry args={[0.18, 2.4, 0.18]} /><meshStandardMaterial {...glow} /></mesh>
      <mesh position={[0, 2.45, 0]}><boxGeometry args={[2.0, 0.18, 0.18]} /><meshStandardMaterial {...glow} /></mesh>
      <mesh position={[0, 1.2, 0]}><planeGeometry args={[1.6, 2.2]} /><meshBasicMaterial color="#7dffca" transparent opacity={0.16} side={THREE.DoubleSide} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}><ringGeometry args={[1.3, 1.6, 28]} /><meshBasicMaterial color="#7dffca" transparent opacity={0.55} /></mesh>
      {label && <Text position={[0, 2.95, 0]} fontSize={0.32} color="#e9fff6" outlineWidth={0.02} outlineColor="#000" anchorX="center" anchorY="middle">{label}</Text>}
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
              return <Room key={i} index={i} roomName={room} decor={decor} exitRoom={i === 0} style={styleOf(home.id)} />;
            })}
            <mesh rotation-x={-Math.PI / 2} position={[it.exitOffset.x, 0.02, it.exitOffset.z]}><ringGeometry args={[1.2, 1.6, 24]} /><meshBasicMaterial color="#7dffca" transparent opacity={0.6} /></mesh>
          </group>
          </group>
        );
      })}
    </group>
  );
});
