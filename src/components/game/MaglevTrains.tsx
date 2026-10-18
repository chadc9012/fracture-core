import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CAR_LENGTH, RAIL_GAUGE, carPoses, trainState, worldMaglev } from "@/game/maglev";
import type { MaglevLine } from "@/game/maglev";
import type { WorldRail } from "@/game/maggrind";

const UP = new THREE.Vector3(0, 1, 0);

/** Glowing floating track: two bright rails with a soft hover-field ribbon between them. No pylons, the line hangs in the air. */
function Track({ line, rail }: { line: MaglevLine; rail: WorldRail }) {
  const segs = useMemo(() => {
    const out: { key: string; pos: THREE.Vector3; quat: THREE.Quaternion; len: number; yaw: number; side: THREE.Vector3 }[] = [];
    const n = rail.closed ? rail.pts.length : rail.pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = rail.pts[i]!, b = rail.pts[(i + 1) % rail.pts.length]!;
      const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z), len = dir.length();
      out.push({ key: `${i}`, pos: new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), quat: new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()), len, yaw: Math.atan2(dir.x, dir.z), side: new THREE.Vector3(dir.z, 0, -dir.x).normalize() });
    }
    return out;
  }, [rail]);
  return (
    <group>
      {segs.map((s) => (
        <group key={s.key}>
          {[-1, 1].map((k) => (
            <mesh key={k} position={s.pos.clone().addScaledVector(s.side, k * RAIL_GAUGE)} quaternion={s.quat}>
              <cylinderGeometry args={[0.09, 0.09, s.len + 0.2, 8]} />
              <meshStandardMaterial color="#0b1418" emissive={line.color} emissiveIntensity={2.2} metalness={0.5} roughness={0.35} toneMapped={false} />
            </mesh>
          ))}
          <mesh position={s.pos.clone().add(new THREE.Vector3(0, -0.35, 0))} rotation={[0, s.yaw, 0]}>
            <boxGeometry args={[RAIL_GAUGE * 2.2, 0.05, s.len]} />
            <meshBasicMaterial color={line.color} transparent opacity={0.22} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Train({ line, rail, index }: { line: MaglevLine; rail: WorldRail; index: number }) {
  const cars = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const st = trainState(line, rail.total, index, performance.now() / 1000);
    for (const p of carPoses(line, rail, st)) { const g = cars.current[p.index]; if (g) { g.position.set(p.x, p.y + 0.9, p.z); g.rotation.y = p.yaw; } }
  });
  return (
    <group>
      {Array.from({ length: line.cars }, (_, i) => (
        <group key={i} ref={(g) => { cars.current[i] = g; }}>
          <mesh><boxGeometry args={[2.6, 1.9, CAR_LENGTH]} /><meshStandardMaterial color="#1a232b" metalness={0.7} roughness={0.28} /></mesh>
          <mesh position={[0, 0.3, 0]}><boxGeometry args={[2.66, 0.55, CAR_LENGTH - 0.9]} /><meshBasicMaterial color="#bff6ff" transparent opacity={0.7} toneMapped={false} /></mesh>
          <mesh position={[0, -1.0, 0]}><boxGeometry args={[2.1, 0.12, CAR_LENGTH - 0.4]} /><meshBasicMaterial color={line.color} toneMapped={false} /></mesh>
          <mesh position={[0, 1.02, 0]}><boxGeometry args={[1.8, 0.1, CAR_LENGTH - 1.2]} /><meshStandardMaterial color="#0b1418" emissive={line.color} emissiveIntensity={1.2} toneMapped={false} /></mesh>
          {i === 0 && <mesh position={[0, 0, CAR_LENGTH / 2 + 0.05]}><boxGeometry args={[2.1, 0.5, 0.1]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>}
        </group>
      ))}
    </group>
  );
}

/** The Neon City maglev network (maglev.ts): four floating lines, trains stop at stations and ease between them. */
export const MaglevTrains = memo(function MaglevTrains({ c }: { c: { x: number; z: number } }) {
  const net = useMemo(() => worldMaglev(c), [c]);
  return (
    <group>
      {net.map(({ line, rail }) => (
        <group key={line.id}>
          <Track line={line} rail={rail} />
          {Array.from({ length: line.trains }, (_, i) => <Train key={i} line={line} rail={rail} index={i} />)}
        </group>
      ))}
    </group>
  );
});
