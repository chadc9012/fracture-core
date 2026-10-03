import * as THREE from "three";
import { INTERIOR_ALTITUDE, INTERIORS } from "@/game/interiors";
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
  return (
    <group>
      {INTERIORS.map((interior) => (
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
          <pointLight position={[0, WALL_HEIGHT - 0.4, 0]} intensity={14} distance={14} color={interior.kind === "SHOP" ? "#ffd9a0" : "#cfe6ff"} />

          {/* shop counter, present only for SHOP interiors */}
          {interior.kind === "SHOP" && (
            <mesh position={[0, 0.55, -1.5]} castShadow>
              <boxGeometry args={[3.4, 1.1, 0.8]} />
              <meshStandardMaterial color="#7a5a3a" roughness={0.6} />
            </mesh>
          )}

          {/* the NPC standee — a simple readable figure, not a full character model */}
          {interior.npcName && (
            <group position={[0, 0, interior.kind === "SHOP" ? -1.5 : -2]}>
              <SpeakingFigure name={interior.npcName} color={interior.kind === "SHOP" ? "#c98a4a" : "#6d8fc9"} />
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
