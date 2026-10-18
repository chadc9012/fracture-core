import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { walkHeight } from "@/game/terrain";
import { rivalPositions, worldPoint, type RaceDef, type RaceRun } from "@/game/racing";

/** In-world race dressing. Principles: the course is the world (roads, ruins, paths); only the NEXT few gates are marked, by region-appropriate objects
 * (holo gates in the city, lantern posts in forests and swamps, banner flags in the deserts, ice markers on the mountain, buoys underwater) with a faint
 * beam on the one you are heading for. No glowing line is painted over the terrain, and passed gates disappear. Rivals are simple pace-cars/runners
 * that follow the same checkpoints (their positions come from racing.ts rivalPositions, so what you see matches the result you get). */
type Look = { post: string; glow: string; banner: string; kind: "holo" | "lantern" | "flag" | "ice" | "buoy" };
const LOOK: Record<string, Look> = {
  neon: { post: "#1a2230", glow: "#2ee6ff", banner: "#ff3df0", kind: "holo" }, nexus: { post: "#222a36", glow: "#7ad6ff", banner: "#e8f6ff", kind: "holo" }, "neon-core": { post: "#1b1b24", glow: "#a56bff", banner: "#ffffff", kind: "holo" },
  veridan: { post: "#4a3a26", glow: "#ffd27a", banner: "#e8b04a", kind: "lantern" }, swamps: { post: "#2f3a2a", glow: "#8cff9e", banner: "#6fd68a", kind: "lantern" },
  wastelands: { post: "#5a3f2a", glow: "#ffb066", banner: "#c8512b", kind: "flag" }, solara: { post: "#7a5a32", glow: "#ffe08a", banner: "#f2b630", kind: "flag" }, ember: { post: "#2a1d1a", glow: "#ff7a3a", banner: "#ff4a1a", kind: "flag" },
  frostspire: { post: "#9fc4d8", glow: "#bfeaff", banner: "#e8f6ff", kind: "ice" }, thalassia: { post: "#16384a", glow: "#3fe0d0", banner: "#2fb4ff", kind: "buoy" },
};
const GATES_SHOWN = 4;

function Gate({ look, width }: { look: Look; width: number }) {
  const h = look.kind === "buoy" ? 0 : 4.2, half = width / 2;
  return (
    <group>
      {look.kind === "buoy" ? (
        <>{[-half, half].map((x) => <mesh key={x} position={[x, 0, 0]}><sphereGeometry args={[0.7, 12, 10]} /><meshStandardMaterial color={look.post} emissive={look.glow} emissiveIntensity={1.4} /></mesh>)}
          <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, width, 6]} /><meshBasicMaterial color={look.glow} transparent opacity={0.35} /></mesh></>
      ) : (
        <>
          {[-half, half].map((x) => <mesh key={x} position={[x, h / 2, 0]}><cylinderGeometry args={[0.18, 0.24, h, 8]} /><meshStandardMaterial color={look.post} roughness={0.85} /></mesh>)}
          {look.kind === "holo" && <mesh position={[0, h, 0]}><boxGeometry args={[width, 0.12, 0.12]} /><meshStandardMaterial color={look.post} emissive={look.glow} emissiveIntensity={1.6} /></mesh>}
          {look.kind === "holo" && <mesh position={[0, h - 1.2, 0]}><planeGeometry args={[width, 2.2]} /><meshBasicMaterial color={look.glow} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} /></mesh>}
          {look.kind === "lantern" && [-half, half].map((x) => <mesh key={x} position={[x, h + 0.3, 0]}><sphereGeometry args={[0.3, 10, 8]} /><meshStandardMaterial color="#fff2c0" emissive={look.glow} emissiveIntensity={2} /></mesh>)}
          {(look.kind === "flag" || look.kind === "ice") && [-half, half].map((x, i) => <mesh key={x} position={[x + (i ? -0.7 : 0.7), h - 0.9, 0]}><planeGeometry args={[1.4, 1.1]} /><meshStandardMaterial color={look.banner} side={THREE.DoubleSide} emissive={look.glow} emissiveIntensity={look.kind === "ice" ? 0.3 : 0.08} /></mesh>)}
        </>
      )}
      <mesh position={[0, look.kind === "buoy" ? 5 : h / 2 + 4, 0]}><cylinderGeometry args={[0.35, 1.1, 14, 10, 1, true]} /><meshBasicMaterial color={look.glow} transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

export const RaceCourse = memo(function RaceCourse({ race, run }: { race: RaceDef; run: RaceRun }) {
  const look = LOOK[race.area] ?? LOOK["neon"]!;
  const gates = useRef<(THREE.Group | null)[]>([]), rivals = useRef<(THREE.Group | null)[]>([]);
  const width = race.mode === "foot" ? 7 : race.mode === "dive" ? 14 : 16;
  const rivalCount = race.rivals;
  const rivalColors = useMemo(() => Array.from({ length: rivalCount }, (_, i) => new THREE.Color().setHSL((i * 0.17 + 0.05) % 1, 0.7, 0.55)), [rivalCount]);
  const rivalColor = (r: number) => rivalColors[r] ?? "#ffffff";
  useFrame(() => {
    const first = run.phase === "staging" || run.phase === "countdown" ? 0 : run.next;
    for (let k = 0; k < GATES_SHOWN; k++) {
      const g = gates.current[k]; if (!g) continue;
      const i = first + k;
      if (i >= race.points.length || run.phase === "finished" || run.phase === "failed") { g.visible = false; continue; }
      const w = worldPoint(race, i), prev = worldPoint(race, Math.max(0, i - 1)), next = worldPoint(race, Math.min(race.points.length - 1, i + 1));
      const ref = i === 0 ? next : prev, dx = i === 0 ? ref.x - w.x : w.x - ref.x, dz = i === 0 ? ref.z - w.z : w.z - ref.z;
      g.visible = true;
      g.position.set(w.x, w.depth !== undefined ? w.depth : walkHeight(w.x, w.z), w.z);
      g.rotation.y = Math.atan2(dx, dz) + Math.PI / 2; // posts sit either side of the line of travel
      const s = k === 0 ? 1 : 0.8 - k * 0.1; g.scale.setScalar(Math.max(0.4, s));
    }
    const time = run.phase === "running" ? run.time : run.phase === "finished" || run.phase === "failed" ? run.time : 0;
    const pos = rivalPositions(race, run.difficulty, time);
    for (let r = 0; r < rivalCount; r++) {
      const g = rivals.current[r], p = pos[r]; if (!g || !p) continue;
      g.visible = run.phase === "countdown" || run.phase === "running";
      g.position.set(p.x, p.depth !== undefined ? p.depth : walkHeight(p.x, p.z) + 0.4, p.z);
    }
  });
  return (
    <group>
      {Array.from({ length: GATES_SHOWN }, (_, k) => <group key={k} ref={(el) => { gates.current[k] = el; }} visible={false}><Gate look={look} width={width} /></group>)}
      {Array.from({ length: rivalCount }, (_, r) => (
        <group key={r} ref={(el) => { rivals.current[r] = el; }} visible={false}>
          {race.mode === "vehicle" ? <mesh position={[0, 0.5, 0]}><boxGeometry args={[1.8, 0.8, 4]} /><meshStandardMaterial color={rivalColor(r)} metalness={0.6} roughness={0.4} /></mesh>
            : race.mode === "dive" ? <mesh><capsuleGeometry args={[0.6, 2, 6, 10]} /><meshStandardMaterial color={rivalColor(r)} emissive={rivalColor(r)} emissiveIntensity={0.3} /></mesh>
            : <mesh position={[0, 0.9, 0]}><capsuleGeometry args={[0.35, 1, 4, 8]} /><meshStandardMaterial color={rivalColor(r)} /></mesh>}
        </group>
      ))}
    </group>
  );
});
