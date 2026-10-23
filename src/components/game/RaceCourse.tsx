import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { walkHeight } from "@/game/terrain";
import { raceObstacles, rivalPositions, worldPoint, type RaceDef, type RaceRun } from "@/game/racing";

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
/** chevron boards along the leg you are on: a few markers either side pointing the way, so a long leg is readable without a painted line */
const ARROWS = 6;
const OBSTACLES_SHOWN = 6;

function RivalModel({ mode, color }: { mode: RaceDef["mode"]; color: THREE.Color }) {
  if (mode === "vehicle") return (
    <group>
      <mesh position={[0, 0.55, 0]}><boxGeometry args={[1.9, 0.6, 4.2]} /><meshStandardMaterial color={color} metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 1.05, -0.3]}><boxGeometry args={[1.6, 0.5, 2]} /><meshStandardMaterial color="#141a22" metalness={0.3} roughness={0.2} /></mesh>
      {[[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x!, 0.35, z!]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.38, 0.38, 0.3, 12]} /><meshStandardMaterial color="#111" roughness={0.9} /></mesh>)}
      {[-0.6, 0.6].map((x) => <mesh key={x} position={[x, 0.65, -2.12]}><boxGeometry args={[0.4, 0.14, 0.04]} /><meshBasicMaterial color="#ff3030" /></mesh>)}
    </group>);
  if (mode === "dive") return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh><capsuleGeometry args={[0.6, 2, 6, 10]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} /></mesh>
      <mesh position={[0, -1.6, 0]}><coneGeometry args={[0.35, 0.6, 8]} /><meshBasicMaterial color="#bff6ff" transparent opacity={0.5} /></mesh>
    </group>);
  return <mesh position={[0, 0.9, 0]}><capsuleGeometry args={[0.35, 1, 4, 8]} /><meshStandardMaterial color={color} /></mesh>;
}

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
  const arrows = useRef<(THREE.Group | null)[]>([]), rocks = useRef<(THREE.Group | null)[]>([]), startLine = useRef<THREE.Group | null>(null);
  const obstacles = useMemo(() => raceObstacles(race), [race]);
  const width = race.mode === "foot" ? 7 : race.mode === "dive" ? 14 : 16;
  const rivalCount = race.rivals;
  const rivalColors = useMemo(() => Array.from({ length: rivalCount }, (_, i) => new THREE.Color().setHSL((i * 0.17 + 0.05) % 1, 0.7, 0.55)), [rivalCount]);
  const rivalColor = (r: number) => rivalColors[r] ?? new THREE.Color("#ffffff");
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
    const live = run.phase === "running";
    // start line: a lit strip across gate 0 while you line up and count down
    const sl = startLine.current;
    if (sl) {
      sl.visible = run.phase === "staging" || run.phase === "countdown";
      if (sl.visible) { const a = worldPoint(race, 0), b = worldPoint(race, 1); sl.position.set(a.x, (a.depth ?? walkHeight(a.x, a.z)) + 0.06, a.z); sl.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); }
    }
    // direction boards along the current leg (both sides, every ~30 m, up to ARROWS), facing along travel
    const seg = Math.max(1, Math.min(race.points.length - 1, live ? run.next : 1));
    const a = worldPoint(race, seg - 1), b = worldPoint(race, seg), ldx = b.x - a.x, ldz = b.z - a.z, len = Math.hypot(ldx, ldz) || 1;
    const per = Math.min(ARROWS / 2, Math.floor(len / 30)), off = race.mode === "foot" ? 5 : 10, nx = ldz / len, nz = -ldx / len;
    for (let k = 0; k < ARROWS; k++) {
      const g = arrows.current[k]; if (!g) continue;
      const slot = k >> 1, side = k & 1 ? 1 : -1;
      if (!live || race.mode === "dive" || slot >= per) { g.visible = false; continue; }
      const t = (slot + 1) / (per + 1), x = a.x + ldx * t + nx * off * side, z = a.z + ldz * t + nz * off * side;
      g.visible = true; g.position.set(x, walkHeight(x, z), z); g.rotation.y = Math.atan2(ldx, ldz);
    }
    // obstacles on this leg and the next
    let n = 0;
    for (const o of obstacles) {
      if (n >= OBSTACLES_SHOWN) break;
      if (!live || o.segment < run.next || o.segment > run.next + 1 || run.hitObstacles?.includes(o.id)) continue;
      const g = rocks.current[n++]; if (!g) continue;
      g.visible = true; g.position.set(o.x, walkHeight(o.x, o.z), o.z);
    }
    for (; n < OBSTACLES_SHOWN; n++) { const g = rocks.current[n]; if (g) g.visible = false; }
    const time = run.phase === "running" ? run.time : run.phase === "finished" || run.phase === "failed" ? run.time : 0;
    const pos = rivalPositions(race, run.difficulty, time), ahead = rivalPositions(race, run.difficulty, time + 0.15);
    for (let r = 0; r < rivalCount; r++) {
      const g = rivals.current[r], p = pos[r]; if (!g || !p) continue;
      g.visible = run.phase === "countdown" || run.phase === "running";
      g.position.set(p.x, p.depth !== undefined ? p.depth : walkHeight(p.x, p.z) + (race.mode === "vehicle" ? 0 : 0.4), p.z);
      const q = ahead[r]; if (q && Math.hypot(q.x - p.x, q.z - p.z) > 0.01) g.rotation.y = Math.atan2(q.x - p.x, q.z - p.z); // face the way they're going
    }
  });
  return (
    <group>
      {Array.from({ length: GATES_SHOWN }, (_, k) => <group key={k} ref={(el) => { gates.current[k] = el; }} visible={false}><Gate look={look} width={width} /></group>)}
      <group ref={startLine} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[width, 1.2]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.85} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.9]}><planeGeometry args={[width, 0.25]} /><meshBasicMaterial color={look.glow} /></mesh>
      </group>
      {Array.from({ length: ARROWS }, (_, k) => (
        <group key={`a${k}`} ref={(el) => { arrows.current[k] = el; }} visible={false}>
          <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.06, 0.06, 1.4, 6]} /><meshStandardMaterial color={look.post} /></mesh>
          <mesh position={[0, 1.6, 0]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.45, 0.9, 3]} /><meshStandardMaterial color={look.banner} emissive={look.glow} emissiveIntensity={0.9} /></mesh>
        </group>
      ))}
      {Array.from({ length: OBSTACLES_SHOWN }, (_, k) => (
        <group key={`o${k}`} ref={(el) => { rocks.current[k] = el; }} visible={false}>
          <mesh position={[0, 0.9, 0]} rotation={[0.3, k, 0.2]}><dodecahedronGeometry args={[1.6, 0]} /><meshStandardMaterial color="#5b544c" roughness={1} flatShading /></mesh>
          <mesh position={[0, 2.9, 0]}><octahedronGeometry args={[0.35, 0]} /><meshBasicMaterial color="#ffb020" /></mesh>
        </group>
      ))}
      {Array.from({ length: rivalCount }, (_, r) => (
        <group key={r} ref={(el) => { rivals.current[r] = el; }} visible={false}>
          <RivalModel mode={race.mode} color={rivalColor(r)} />
        </group>
      ))}
    </group>
  );
});
