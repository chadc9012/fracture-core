import { memo, useMemo } from "react";
import * as THREE from "three";
import { worldRails } from "@/game/maggrind";
import { walkHeight } from "@/game/terrain";

const UP = new THREE.Vector3(0, 1, 0);

/** The glowing magnetic grind rails of Neon City (Mag-Grind Boots latch onto them). Tube segments on posts. */
export const NeonRails = memo(function NeonRails({ c }: { c: { x: number; z: number } }) {
  const rails = useMemo(() => worldRails(c, walkHeight), [c]);
  const parts = useMemo(() => {
    const out: { key: string; pos: THREE.Vector3; quat: THREE.Quaternion; len: number; post: { x: number; y: number; z: number; h: number }[] }[] = [];
    for (const r of rails) {
      const n = r.closed ? r.pts.length : r.pts.length - 1;
      for (let i = 0; i < n; i++) {
        const a = r.pts[i]!, b = r.pts[(i + 1) % r.pts.length]!;
        const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z), len = dir.length();
        const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
        const posts: { x: number; y: number; z: number; h: number }[] = [];
        for (let k = 0; k <= len; k += 8) { const t = k / len; const y = a.y + (b.y - a.y) * t; posts.push({ x: a.x + (b.x - a.x) * t, y, z: a.z + (b.z - a.z) * t, h: Math.max(0.2, y - walkHeight(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) }); }
        out.push({ key: `${r.id}-${i}`, pos: new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), quat, len, post: posts });
      }
    }
    return out;
  }, [rails]);
  return (
    <group>
      {parts.map((p) => (
        <group key={p.key}>
          <mesh position={p.pos} quaternion={p.quat}><cylinderGeometry args={[0.07, 0.07, p.len, 8]} /><meshStandardMaterial color="#0e1a18" emissive="#7dffca" emissiveIntensity={1.4} metalness={0.6} roughness={0.3} /></mesh>
          {p.post.map((q, i) => <mesh key={i} position={[q.x, q.y - q.h / 2, q.z]}><cylinderGeometry args={[0.05, 0.07, q.h, 6]} /><meshStandardMaterial color="#20262c" metalness={0.7} roughness={0.4} /></mesh>)}
        </group>
      ))}
    </group>
  );
});
